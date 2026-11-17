from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsApprovedDoctor
from . import services as sv
from .models import SmsOutbox, SosAlert


def _live_alert(token):
    a = SosAlert.objects.select_related("sos", "doctor", "sos__user", "sos__user__patient", "sos__facility").filter(token=token).first()
    if not a:
        return None, Response({"error": "not_found"}, status=404)
    if a.expires_at < timezone.now() or a.sos.closed_at or a.sos.status == "resolved":
        return None, Response({"error": "expired"}, status=410)
    return a, None


@api_view(["GET"])
@permission_classes([AllowAny])
def track(request, token):
    a, err = _live_alert(token)
    if err:
        return err
    s = a.sos
    sv.escalate_if_due(s)
    p = s.user.patient
    return Response({
        "status": s.status, "kind": s.kind, "reason": s.reason, "reason_label": sv.REASON_LABELS.get(s.reason, ""),
        "patient": {"name": p.full_name, "age": p.age, "sex": p.sex, "phone": s.user.phone},
        "lat": s.lat, "lng": s.lng, "facility": s.facility.name if s.facility else None,
        "pressed_at": (s.pressed_at or s.created_at).isoformat(),
        "trail": [{"lat": t.lat, "lng": t.lng, "at": t.at.isoformat()} for t in s.track_points.order_by("at")],
        "my_status": a.status, "responder": s.doctor_ack_by.doctor.full_name if s.doctor_ack_by_id else None,
    })


@api_view(["POST"])
@permission_classes([IsApprovedDoctor])
def respond(request, token):
    a, err = _live_alert(token)
    if err:
        return err
    if a.doctor.user_id != request.user.id:
        return Response({"error": "not_found"}, status=404)
    action = request.data.get("action")
    if action not in ("accept", "decline"):
        return Response({"error": "bad_action"}, status=400)
    ok = sv.respond(a, action)
    if not ok:
        return Response({"error": "already_taken"}, status=409)
    a.refresh_from_db()
    return Response({"my_status": a.status})


@api_view(["GET"])
@permission_classes([IsApprovedDoctor])
def inbox(request):
    rows = SmsOutbox.objects.filter(to_phone=request.user.phone).exclude(template="otp").order_by("-created_at")[:50]
    return Response([{"id": r.id, "template": r.template, "body": r.body, "status": r.status,
                      "at": r.created_at.isoformat()} for r in rows])
