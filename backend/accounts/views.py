import hashlib
import hmac
import re
import secrets
from datetime import date, timedelta

from django.conf import settings
from django.core.cache import cache
from django.contrib.auth import authenticate
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from health.models import Facility
from .models import DoctorProfile, OtpCode, PatientProfile, User, mask_phone
from .permissions import IsAdminRole, IsApprovedDoctor
from .ratelimit import client_ip, hit

PHONE_RE = re.compile(r"^[6-9]\d{9}$")
OTP_TTL = timedelta(minutes=5)
MAX_ATTEMPTS = 5
LOCK_SECONDS = 15 * 60


def _hash(phone: str, code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def tokens_for(user: User) -> dict:
    r = RefreshToken.for_user(user)
    return {"access": str(r.access_token), "refresh": str(r)}


def patient_dict(p: PatientProfile) -> dict:
    return {"full_name": p.full_name, "dob": p.dob.isoformat() if p.dob else None, "age": p.age, "sex": p.sex,
            "blood_group": p.blood_group, "taluk": p.taluk, "language": p.language,
            "guardian_phone": p.guardian_phone, "emergency_contact_name": p.emergency_contact_name,
            "emergency_contact_phone": p.emergency_contact_phone, "share_with_contact": p.share_with_contact,
            "allow_emergency_access": p.allow_emergency_access}


def doctor_dict(d: DoctorProfile) -> dict:
    return {"id": d.id, "full_name": d.full_name, "council": d.council, "registration_no": d.registration_no,
            "specialty": d.specialty, "facility_id": d.facility_id, "facility": d.facility.name,
            "facility_name_kn": d.facility.name_kn, "on_duty": d.on_duty, "sms_enabled": d.sms_enabled,
            "shift_note": d.shift_note, "approval_status": d.approval_status}


def me_dict(u: User) -> dict:
    out = {"id": u.id, "phone": u.phone, "role": u.role, "profile": None,
           "consent_required": u.role != User.ADMIN and u.consent_version != settings.CONSENT_VERSION}
    if hasattr(u, "patient"):
        out["profile"] = patient_dict(u.patient)
    elif hasattr(u, "doctor"):
        out["profile"] = doctor_dict(u.doctor)
    return out


def _err(msg, status=400):
    return Response({"error": msg}, status=status)


MIN_PASSWORD = 6


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """Create a patient or doctor account with phone + password. No code is sent."""
    phone = str(request.data.get("phone", "")).strip()
    password = str(request.data.get("password", ""))
    role = request.data.get("role", User.PATIENT)
    if not PHONE_RE.match(phone):
        return _err("invalid_phone")
    if len(password) < MIN_PASSWORD or len(password) > 128:
        return _err("weak_password")
    if role not in (User.PATIENT, User.DOCTOR):
        return _err("invalid_role")
    if not hit(f"reg_ip:{client_ip(request)}", 20, 3600):
        return _err("rate_limited", 429)
    if User.objects.filter(phone=phone).exists():
        return _err("phone_taken", 409)
    user = User.objects.create_user(phone, password, role=role)
    return Response({**tokens_for(user), "user": me_dict(user), "is_new": True}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    phone = str(request.data.get("phone", "")).strip()
    password = str(request.data.get("password", ""))
    if not PHONE_RE.match(phone):
        return _err("invalid_phone")
    if not hit(f"login:{phone}:{client_ip(request)}", 10, 900):
        return _err("rate_limited", 429)
    user = authenticate(request, username=phone, password=password)
    # Same answer for unknown number and wrong password. Admins use the separate admin login.
    if not user or not user.is_active or user.role not in (User.PATIENT, User.DOCTOR):
        return _err("invalid_credentials", 401)
    return Response({**tokens_for(user), "user": me_dict(user), "is_new": False})


@api_view(["POST"])
@permission_classes([AllowAny])
def admin_login(request):
    phone = str(request.data.get("phone", "")).strip()
    password = str(request.data.get("password", ""))
    if not hit(f"adm:{phone}:{client_ip(request)}", 10, 900):
        return _err("rate_limited", 429)
    user = authenticate(request, username=phone, password=password)
    if not user or not user.is_active or user.role != User.ADMIN:
        return _err("invalid_credentials", 401)
    return Response({**tokens_for(user), "user": me_dict(user)})


@api_view(["POST"])
def logout(request):
    try:
        RefreshToken(str(request.data.get("refresh", ""))).blacklist()
    except TokenError:
        pass
    return Response(status=204)


@api_view(["GET", "PATCH", "DELETE"])
def me(request):
    u = request.user
    if request.method == "GET":
        return Response(me_dict(u))
    if request.method == "DELETE":
        if u.role == User.ADMIN:
            return _err("not_allowed", 403)
        from records.services import erase_patient_data
        with transaction.atomic():
            if u.role == User.PATIENT:
                erase_patient_data(u)
            u.delete()
        return Response(status=204)
    if u.role != User.PATIENT:
        return _err("patients_only", 403)
    d = request.data
    p = getattr(u, "patient", None)
    name = str(d.get("full_name", p.full_name if p else "")).strip()[:80]
    if not name:
        return _err("name_required")
    dob = p.dob if p else None
    if "dob" in d:
        try:
            dob = date.fromisoformat(d["dob"]) if d["dob"] else None
        except (ValueError, TypeError):
            return _err("invalid_dob")
        if dob and dob > timezone.now().date():
            return _err("invalid_dob")
    guardian = str(d.get("guardian_phone", p.guardian_phone if p else "")).strip()
    age = None
    if dob:
        t = timezone.now().date()
        age = t.year - dob.year - ((t.month, t.day) < (dob.month, dob.day))
    if age is not None and age < 18 and not PHONE_RE.match(guardian):
        return _err("guardian_phone_required")
    for key in ("emergency_contact_phone", "guardian_phone"):
        v = str(d.get(key, "")).strip()
        if v and not PHONE_RE.match(v):
            return _err(f"invalid_{key}")
    p = p or PatientProfile(user=u)
    p.full_name, p.dob, p.guardian_phone = name, dob, guardian
    for key, ml in (("sex", 10), ("blood_group", 4), ("taluk", 60), ("emergency_contact_name", 80),
                    ("emergency_contact_phone", 15)):
        if key in d:
            setattr(p, key, str(d[key]).strip()[:ml])
    if d.get("language") in ("kn", "en"):
        p.language = d["language"]
    for key in ("share_with_contact", "allow_emergency_access"):
        if key in d:
            setattr(p, key, bool(d[key]))
    p.save()
    return Response(me_dict(User.objects.get(pk=u.pk)))


@api_view(["POST"])
def consent(request):
    u = request.user
    if not request.data.get("agree"):
        return _err("agree_required")
    u.consent_at, u.consent_version = timezone.now(), settings.CONSENT_VERSION
    u.save(update_fields=["consent_at", "consent_version"])
    return Response(me_dict(u))


@api_view(["POST"])
def doctor_register(request):
    u = request.user
    if u.role != User.DOCTOR:
        return _err("doctors_only", 403)
    d = request.data
    name = re.sub(r"^(dr\.?\s+)", "", str(d.get("full_name", "")).strip(), flags=re.I)[:80]  # SMS and UI add "Dr"
    council = str(d.get("council", "")).strip()[:60]
    reg = str(d.get("registration_no", "")).strip()[:40]
    fac = Facility.objects.filter(pk=d.get("facility_id")).first()
    if not (name and council and reg and fac):
        return _err("missing_fields")
    prof = getattr(u, "doctor", None) or DoctorProfile(user=u, on_duty=True)
    prof.full_name, prof.council, prof.registration_no, prof.facility = name, council, reg, fac
    prof.specialty = str(d.get("specialty", "general")).strip()[:40] or "general"
    prof.shift_note = str(d.get("shift_note", ""))[:100]
    if prof.pk and prof.approval_status == DoctorProfile.REJECTED:
        prof.approval_status = DoctorProfile.PENDING
    prof.save()
    return Response(me_dict(User.objects.get(pk=u.pk)), status=201)


@api_view(["PATCH"])
@permission_classes([IsApprovedDoctor])
def doctor_duty(request):
    prof = request.user.doctor
    for key in ("on_duty", "sms_enabled"):
        if key in request.data:
            setattr(prof, key, bool(request.data[key]))
    prof.save()
    return Response(doctor_dict(prof))


@api_view(["GET"])
@permission_classes([AllowAny])
def facilities_for_signup(request):
    return Response([{"id": f.id, "name": f.name, "name_kn": f.name_kn, "type": f.type, "taluk": f.taluk}
                     for f in Facility.objects.all().order_by("taluk", "name")])


@api_view(["GET"])
@permission_classes([IsAdminRole])
def admin_doctors(request):
    qs = DoctorProfile.objects.select_related("facility", "user").order_by("-user__created_at")
    st = request.query_params.get("status")
    if st:
        qs = qs.filter(approval_status=st)
    return Response([{**doctor_dict(d), "phone": d.user.phone} for d in qs])


@api_view(["POST"])
@permission_classes([IsAdminRole])
def admin_doctor_decide(request, pk, action):
    d = DoctorProfile.objects.filter(pk=pk).first()
    if not d or action not in ("approve", "reject"):
        return _err("not_found", 404)
    d.approval_status = DoctorProfile.APPROVED if action == "approve" else DoctorProfile.REJECTED
    d.approved_by, d.approved_at = request.user, timezone.now()
    if action == "reject":
        d.on_duty = False
    d.save()
    return Response(doctor_dict(d))


@api_view(["GET"])
def doctor_directory(request):
    """Approved doctors a signed-in patient may call. On-duty doctors first."""
    if request.user.role != User.PATIENT:
        return _err("patients_only", 403)
    q = str(request.query_params.get("q", "")).strip().lower()
    rows = DoctorProfile.objects.filter(approval_status="approved", user__is_active=True).select_related("user", "facility")
    out = [{"id": d.id, "full_name": d.full_name, "specialty": d.specialty, "facility": d.facility.name,
            "facility_name_kn": d.facility.name_kn, "on_duty": d.on_duty, "shift_note": d.shift_note}
           for d in rows if not q or q in d.full_name.lower() or q in d.specialty.lower() or q in d.facility.name.lower()]
    out.sort(key=lambda x: (not x["on_duty"], x["full_name"].lower()))
    return Response(out)


@api_view(["POST"])
def doctor_call(request, pk):
    """Patient taps Call. We note it in the doctor's inbox and return the number to dial. The patient's own phone
    then places a normal phone call, so the doctor's phone rings straight away."""
    u = request.user
    pp = getattr(u, "patient", None)
    if u.role != User.PATIENT or not pp:
        return _err("patients_only", 403)
    doc = DoctorProfile.objects.filter(pk=pk, approval_status="approved", user__is_active=True).select_related("user").first()
    if not doc:
        return _err("not_found", 404)
    if not doc.on_duty:
        return _err("off_duty", 409)
    if not hit(f"call:{u.id}", 10, 3600):
        return _err("rate_limited", 429)
    from alerts.sms import send_sms
    send_sms(doc.user.phone, "call_request", f"HASSAN HEALTH: {pp.full_name} ({u.phone}) is calling you now.")
    return Response({"tel": "+91" + doc.user.phone, "name": doc.full_name})
