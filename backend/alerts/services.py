import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from accounts.models import DoctorProfile
from .models import SosAlert, SosTrackPoint
from .sms import send_sms

FIRST_WAVE = 2
MAX_DOCTORS = 3
REASON_LABELS = {"general": "Emergency", "snakebite": "Snake bite", "accident": "Accident", "maternal": "Maternal emergency",
                 "animal_sick": "Sick animal", "animal_injury": "Injured animal", "other": "Other"}


def pick_alert_doctors(sos):
    """Order: patient's own doctors, then on-duty doctors at the assigned facility, then its parent chain."""
    base = DoctorProfile.objects.filter(approval_status="approved", on_duty=True, sms_enabled=True,
                                        user__is_active=True).select_related("user", "facility")
    if sos.kind == "animal":
        base = base.filter(specialty__iexact="veterinary")
    out, seen = [], set()

    def add(qs, limit=MAX_DOCTORS):
        n = 0
        for d in qs:
            if d.id not in seen and len(out) < MAX_DOCTORS and n < limit:
                seen.add(d.id)
                out.append(d)
                n += 1

    from records.models import AccessGrant
    now = timezone.now()
    if sos.user_id:
        granted = AccessGrant.objects.filter(patient_id=sos.user_id, status="active").exclude(
            expires_at__lt=now).values_list("doctor_id", flat=True)
        add(base.filter(user_id__in=list(granted)).order_by("id"), limit=2)
    f = sos.facility
    hops = 0
    while f is not None and hops < 4 and len(out) < MAX_DOCTORS:
        add(base.filter(facility=f).order_by("id"))
        f, hops = f.parent, hops + 1
    return out


def _body(sos, alert):
    p = sos.user.patient
    link = f"{settings.PUBLIC_BASE_URL}"
    age = f", {p.age}" if p.age is not None else ""
    sex = f", {p.sex[:1].upper()}" if p.sex else ""
    return (f"HASSAN HEALTH SOS\n{p.full_name}{age}{sex}. Phone {sos.user.phone}\n"
            f"Reason: {REASON_LABELS.get(sos.reason, 'Emergency')}\n"
            f"Time: {timezone.localtime(sos.pressed_at or sos.created_at).strftime('%H:%M')}\n"
            f"Location: {link}/s/{alert.token}\nRespond: {link}/r/{alert.token}")


def _send(sos, alert):
    row = send_sms(alert.doctor.user.phone, "sos_alert", _body(sos, alert))
    alert.status = SosAlert.FAILED if row.status == "failed" else SosAlert.SENT
    alert.sent_at = timezone.now()
    alert.save(update_fields=["status", "sent_at"])
    return alert


def send_next(sos):
    nxt = sos.alerts.filter(status=SosAlert.QUEUED).order_by("order").first()
    if not nxt:
        return None
    _send(sos, nxt)
    if nxt.status == SosAlert.FAILED:  # provider failed, move on immediately
        return send_next(sos)
    return nxt


def dispatch_alerts(sos):
    """Create alerts for up to 3 doctors and send the first wave. Never raises into the SOS flow."""
    if not sos.user_id or not hasattr(sos.user, "patient"):
        return []
    try:
        doctors = pick_alert_doctors(sos)
        expires = timezone.now() + timedelta(hours=settings.TRACK_LINK_HOURS)
        alerts = [SosAlert.objects.create(sos=sos, doctor=d, token=secrets.token_urlsafe(16), order=i, expires_at=expires)
                  for i, d in enumerate(doctors)]
        for a in alerts[:FIRST_WAVE]:
            _send(sos, a)
        if alerts and not sos.alerts.filter(status=SosAlert.SENT).exists():
            send_next(sos)
        return alerts
    except Exception:  # noqa: BLE001
        return []


def escalate_if_due(sos):
    """Send the next queued doctor when nobody has responded in ALERT_ESCALATE_SECONDS, or all sent ones declined."""
    if sos.doctor_ack_at or sos.closed_at:
        return
    alerts = list(sos.alerts.all())
    if not any(a.status == SosAlert.QUEUED for a in alerts):
        return
    sent = [a for a in alerts if a.sent_at]
    live = [a for a in sent if a.status == SosAlert.SENT]
    if not sent:
        send_next(sos)
        return
    if not live:
        send_next(sos)
        return
    last = max(a.sent_at for a in sent)
    if (timezone.now() - last).total_seconds() >= settings.ALERT_ESCALATE_SECONDS:
        send_next(sos)


def respond(alert, action):
    sos = alert.sos
    if action == "accept":
        if sos.doctor_ack_at:
            return False
        now = timezone.now()
        alert.status, alert.acked_at = SosAlert.ACKED, now
        alert.save(update_fields=["status", "acked_at"])
        sos.doctor_ack_by, sos.doctor_ack_at = alert.doctor.user, now
        sos.save(update_fields=["doctor_ack_by", "doctor_ack_at"])
        for other in sos.alerts.exclude(pk=alert.pk):
            if other.status == SosAlert.SENT:
                send_sms(other.doctor.user.phone, "sos_taken",
                         f"HASSAN HEALTH SOS: Dr {alert.doctor.full_name} is responding. No action needed.")
            if other.status in (SosAlert.QUEUED, SosAlert.SENT):
                other.status = SosAlert.CANCELLED
                other.save(update_fields=["status"])
        return True
    alert.status = SosAlert.DECLINED
    alert.save(update_fields=["status"])
    escalate_if_due(sos)
    return True


def add_track_point(sos, lat, lng):
    sos.lat, sos.lng = lat, lng
    sos.save(update_fields=["lat", "lng"])
    SosTrackPoint.objects.create(sos=sos, lat=lat, lng=lng)
    ids = list(sos.track_points.order_by("-at").values_list("id", flat=True)[30:])
    if ids:
        SosTrackPoint.objects.filter(id__in=ids).delete()
