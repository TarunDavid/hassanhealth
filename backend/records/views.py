import hashlib
import re
from datetime import date, timedelta

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.models import DoctorProfile, User
from accounts.ratelimit import hit
from alerts.sms import send_sms
from . import crypto, services as sv
from .models import AccessGrant, MedicalCondition, MedicalRecord, RecordAccessLog

# Every view here is AllowAny at the DRF level and decides access itself, answering 404 (never 403/401) to
# anyone without a right, so the existence of a patient or a record is never revealed. There is no admin route.

COND_FIELDS = ("chronic", "allergies", "medicines", "surgeries", "pregnancy", "notes")


def _patient_me(request):
    u = request.user
    if not (u.is_authenticated and u.is_active and u.role == "patient" and hasattr(u, "patient")):
        raise NotFound()
    return u


def _doctor_for(request, patient_id):
    reason = sv.access_reason(request.user, patient_id)
    if reason not in ("granted", "emergency"):
        raise NotFound()
    patient = User.objects.filter(pk=patient_id, role="patient").select_related("patient").first()
    if not patient or not hasattr(patient, "patient"):
        raise NotFound()
    return patient, reason


def _clean_conditions(d) -> dict:
    out = {}
    for k in COND_FIELDS:
        v = d.get(k, [] if k == "chronic" else "")
        if k == "chronic":
            v = [str(x)[:60] for x in (v if isinstance(v, list) else [])][:30]
        else:
            v = str(v)[:500]
        out[k] = v
    return out


def _rec_dict(r):
    return {"id": r.id, "title": r.title, "record_type": r.record_type, "record_date": r.record_date.isoformat() if r.record_date else None,
            "source_name": r.source_name, "size_bytes": r.size_bytes, "mime_type": r.mime_type,
            "uploaded_at": r.uploaded_at.isoformat()}


def _download(rec):
    try:
        data = crypto.decrypt_file(sv.store_path(rec.storage_name).read_bytes(), rec.file_key_enc)
    except Exception:  # noqa: BLE001
        raise NotFound()
    ext = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png"}.get(rec.mime_type, "bin")
    name = re.sub(r"[^A-Za-z0-9_-]+", "_", rec.title)[:50] or "record"
    resp = HttpResponse(data, content_type=rec.mime_type)
    resp["Content-Disposition"] = f'attachment; filename="{name}.{ext}"'
    resp["Cache-Control"] = "no-store"
    resp["X-Content-Type-Options"] = "nosniff"
    return resp


def _emergency_notice(patient, doctor_user, request):
    """Tell the patient once per emergency that the responding doctor viewed their data."""
    recent = RecordAccessLog.objects.filter(patient=patient, actor=doctor_user, reason="emergency",
                                            at__gte=timezone.now() - timedelta(hours=6)).exists()
    if not recent:
        t = timezone.localtime().strftime("%H:%M")
        send_sms(patient.phone, "emergency_access_notice",
                 f"HASSAN HEALTH: Dr {doctor_user.doctor.full_name} viewed your health records during your emergency at {t}.")


# ---------------- patient (owner) ----------------
@api_view(["GET", "PUT"])
@permission_classes([AllowAny])
def my_medical(request):
    u = _patient_me(request)
    if request.method == "PUT":
        data = _clean_conditions(request.data if isinstance(request.data, dict) else {})
        c, _ = MedicalCondition.objects.get_or_create(patient=u, defaults={"data_enc": ""})
        c.data_enc = crypto.encrypt_json(data)
        c.save()
        return Response(data)
    c = MedicalCondition.objects.filter(patient=u).first()
    data = crypto.decrypt_json(c.data_enc) if c and c.data_enc else _clean_conditions({})
    sv.log(u, u, "view", "self", detail="conditions", request=request)
    return Response(data)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def my_records(request):
    u = _patient_me(request)
    if request.method == "GET":
        return Response([_rec_dict(r) for r in MedicalRecord.objects.filter(patient=u).order_by("-uploaded_at")])
    if not hit(f"upload:{u.id}", 20, 3600):
        return Response({"error": "rate_limited"}, status=429)
    f = request.FILES.get("file")
    if not f:
        return Response({"error": "file_required"}, status=400)
    if f.size == 0:
        return Response({"error": "empty_file"}, status=400)
    if f.size > settings.RECORDS_MAX_BYTES:
        return Response({"error": "file_too_large"}, status=413)
    if MedicalRecord.objects.filter(patient=u).count() >= settings.RECORDS_MAX_FILES:
        return Response({"error": "too_many_files"}, status=400)
    data = f.read()
    mime, _ext = sv.sniff(data)
    if not mime:
        return Response({"error": "unsupported_type"}, status=415)
    title = str(request.data.get("title", "")).strip()[:100] or "Record"
    rtype = request.data.get("record_type", "other")
    if rtype not in MedicalRecord.TYPES:
        rtype = "other"
    rdate = None
    if request.data.get("record_date"):
        try:
            rdate = date.fromisoformat(request.data["record_date"])
        except ValueError:
            return Response({"error": "invalid_date"}, status=400)
    ct, key_enc = crypto.encrypt_file(data)
    name = sv.new_storage_name()
    p = sv.store_path(name)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(ct)
    rec = MedicalRecord.objects.create(patient=u, title=title, record_type=rtype, record_date=rdate,
                                       source_name=str(request.data.get("source_name", ""))[:100], storage_name=name,
                                       size_bytes=len(data), mime_type=mime, sha256=hashlib.sha256(data).hexdigest(),
                                       file_key_enc=key_enc)
    sv.log(u, u, "upload", "self", record=rec, detail=title, request=request)
    return Response(_rec_dict(rec), status=201)


@api_view(["GET", "DELETE"])
@permission_classes([AllowAny])
def my_record(request, pk):
    u = _patient_me(request)
    rec = MedicalRecord.objects.filter(pk=pk, patient=u).first()
    if not rec:
        raise NotFound()
    if request.method == "DELETE":
        sv.delete_record_file(rec)
        sv.log(u, u, "delete", "self", detail=rec.title, request=request)
        rec.delete()
        return Response(status=204)
    sv.log(u, u, "download", "self", record=rec, detail=rec.title, request=request)
    return _download(rec)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def my_access(request):
    u = _patient_me(request)
    if request.method == "POST":
        phone = str(request.data.get("doctor_phone", "")).strip()
        doc = DoctorProfile.objects.filter(user__phone=phone, approval_status="approved", user__is_active=True).select_related("user").first()
        if not doc:
            return Response({"error": "doctor_not_found"}, status=404)
        days = request.data.get("duration")
        exp = timezone.now() + timedelta(days=30) if days == "30d" else None
        g, _ = AccessGrant.objects.get_or_create(patient=u, doctor=doc.user, status="active", defaults={"expires_at": exp})
        g.expires_at = exp
        g.save()
        sv.log(u, u, "grant", "self", detail=f"Dr {doc.full_name}", request=request)
    now = timezone.now()
    grants = AccessGrant.objects.filter(patient=u, status="active").exclude(expires_at__lt=now).select_related("doctor__doctor")
    return Response([{"id": g.id, "doctor": g.doctor.doctor.full_name, "specialty": g.doctor.doctor.specialty,
                      "facility": g.doctor.doctor.facility.name,
                      "expires_at": g.expires_at.isoformat() if g.expires_at else None} for g in grants])


@api_view(["DELETE"])
@permission_classes([AllowAny])
def my_access_revoke(request, pk):
    u = _patient_me(request)
    g = AccessGrant.objects.filter(pk=pk, patient=u, status="active").select_related("doctor__doctor").first()
    if not g:
        raise NotFound()
    g.status, g.revoked_at = "revoked", timezone.now()
    g.save()
    sv.log(u, u, "revoke", "self", detail=f"Dr {g.doctor.doctor.full_name}", request=request)
    return Response(status=204)


@api_view(["GET"])
@permission_classes([AllowAny])
def my_access_log(request):
    u = _patient_me(request)
    rows = RecordAccessLog.objects.filter(patient=u).select_related("actor").order_by("-at")[:200]
    out = []
    for r in rows:
        who = "You"
        if r.actor_id and r.actor_id != u.id:
            d = getattr(r.actor, "doctor", None)
            who = f"Dr {d.full_name}" if d else "Doctor"
        out.append({"id": r.id, "who": who, "action": r.action, "reason": r.reason, "detail": r.detail, "at": r.at.isoformat()})
    return Response(out)


# ---------------- doctor ----------------
@api_view(["GET"])
@permission_classes([AllowAny])
def doctor_patients(request):
    u = request.user
    if not (u.is_authenticated and u.is_active and u.role == "doctor" and hasattr(u, "doctor") and u.doctor.approval_status == "approved"):
        raise NotFound()
    now = timezone.now()
    ids = set(AccessGrant.objects.filter(doctor=u, status="active").exclude(expires_at__lt=now).values_list("patient_id", flat=True))
    from health.models import SOSRequest
    for s in SOSRequest.objects.filter(doctor_ack_by=u, doctor_ack_at__isnull=False, user__isnull=False):
        if sv.access_reason(u, s.user_id) == "emergency":
            ids.add(s.user_id)
    out = []
    for pid in ids:
        reason = sv.access_reason(u, pid)
        p = User.objects.filter(pk=pid).select_related("patient").first()
        if reason and p and hasattr(p, "patient"):
            out.append({"id": pid, "name": p.patient.full_name, "access": reason})
    return Response(sorted(out, key=lambda x: x["name"]))


@api_view(["GET"])
@permission_classes([AllowAny])
def doctor_patient_medical(request, pid):
    patient, reason = _doctor_for(request, pid)
    c = MedicalCondition.objects.filter(patient=patient).first()
    data = crypto.decrypt_json(c.data_enc) if c and c.data_enc else _clean_conditions({})
    if reason == "emergency":
        _emergency_notice(patient, request.user, request)
    sv.log(patient, request.user, "view", reason, detail="conditions", request=request)
    p = patient.patient
    return Response({"patient": {"id": patient.id, "name": p.full_name, "age": p.age, "sex": p.sex, "blood_group": p.blood_group,
                                 "phone": patient.phone}, "access": reason, "conditions": data})


@api_view(["GET"])
@permission_classes([AllowAny])
def doctor_patient_records(request, pid):
    patient, _reason = _doctor_for(request, pid)
    return Response([_rec_dict(r) for r in MedicalRecord.objects.filter(patient=patient).order_by("-uploaded_at")])


@api_view(["GET"])
@permission_classes([AllowAny])
def doctor_patient_download(request, pid, rid):
    patient, reason = _doctor_for(request, pid)
    rec = MedicalRecord.objects.filter(pk=rid, patient=patient).first()
    if not rec:
        raise NotFound()
    if reason == "emergency":
        _emergency_notice(patient, request.user, request)
    sv.log(patient, request.user, "download", reason, record=rec, detail=rec.title, request=request)
    return _download(rec)
