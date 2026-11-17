import secrets
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from .models import AccessGrant, MedicalRecord, RecordAccessLog

EMERGENCY_TAIL = timedelta(hours=6)


def store_path(name: str) -> Path:
    return Path(settings.RECORDS_ROOT) / name[:2] / f"{name}.bin"


def sniff(data: bytes):
    """Return (mime, ext) from the real file contents, not the client-supplied name."""
    if data.startswith(b"%PDF-"):
        return "application/pdf", "pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    return None, None


def delete_record_file(rec: MedicalRecord):
    try:
        store_path(rec.storage_name).unlink(missing_ok=True)
    except OSError:
        pass


def erase_patient_data(user):
    for rec in MedicalRecord.objects.filter(patient=user):
        delete_record_file(rec)


def log(patient, actor, action, reason, record=None, detail="", request=None):
    ip = ""
    if request is not None:
        ip = ".".join(request.META.get("REMOTE_ADDR", "").split(".")[:2]) + ".x.x" if "." in request.META.get("REMOTE_ADDR", "") else ""
    RecordAccessLog.objects.create(patient=patient, actor=actor, action=action, reason=reason, record=record,
                                   detail=detail[:100], ip_trunc=ip)


def new_storage_name() -> str:
    return secrets.token_hex(16)


def access_reason(user, patient_id):
    """Why `user` may read patient `patient_id`'s medical data: 'self', 'granted', 'emergency' or None.
    Admins and superusers are never given access: role and is_staff are deliberately not consulted."""
    from health.models import SOSRequest
    if not user or not user.is_authenticated or not user.is_active:
        return None
    if user.role == "patient":
        return "self" if user.id == patient_id and hasattr(user, "patient") else None
    if user.role != "doctor":
        return None
    doc = getattr(user, "doctor", None)
    if not doc or doc.approval_status != "approved":
        return None
    now = timezone.now()
    if AccessGrant.objects.filter(patient_id=patient_id, doctor=user, status="active").exclude(expires_at__lt=now).exists():
        return "granted"
    from accounts.models import PatientProfile
    pp = PatientProfile.objects.filter(user_id=patient_id).first()
    if pp and pp.allow_emergency_access:
        for s in SOSRequest.objects.filter(user_id=patient_id, doctor_ack_by=user, doctor_ack_at__isnull=False):
            if s.closed_at is None or s.closed_at + EMERGENCY_TAIL > now:
                return "emergency"
    return None
