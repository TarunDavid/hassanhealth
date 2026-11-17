from datetime import date, datetime, time, timedelta
from django.core.cache import cache
from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
import secrets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from accounts.permissions import IsAdminRole
from .models import Facility, Ambulance, HealthCamp, SOSRequest, UsageEvent
from . import services as sv


def amb_dict(a):
    return {"id": a.id, "code": a.code, "status": a.status, "lat": a.lat, "lng": a.lng, "is_animal": a.is_animal,
            "base": a.base.name, "updated_at": a.updated_at.isoformat()}


def sos_dict(s, admin_view=False):
    return {"id": s.id, "kind": s.kind, "reason": s.reason,
            "pressed_at": s.pressed_at.isoformat() if s.pressed_at else s.created_at.isoformat(),
            "lat": s.lat, "lng": s.lng, "note": s.note, "status": s.status,
            "language": s.language, "created_at": s.created_at.isoformat(),
            "facility": sv.facility_dict(s.facility, s.lat, s.lng) if s.facility else None,
            "ambulance": amb_dict(s.ambulance) if s.ambulance else None,
            "doctors_alerted": s.alerts.filter(status__in=["sent", "delivered", "acked"]).count() if s.user_id else 0,
            "doctor_responding": ({"name": s.doctor_ack_by.doctor.full_name, "at": s.doctor_ack_at.isoformat()}
                                  if s.doctor_ack_by_id and hasattr(s.doctor_ack_by, "doctor") else None),
            **({"patient_name": s.user.patient.full_name if s.user_id and hasattr(s.user, "patient") else None}
               if admin_view else {})}


def camp_dict(c):
    return {"id": c.id, "title": c.title, "village": c.village, "taluk": c.taluk, "lat": c.lat, "lng": c.lng,
            "date": c.date.isoformat(), "focus": c.focus, "is_animal": c.is_animal}


def _admin_only(request):
    """Return an error Response unless the caller is a logged-in admin (role), else None."""
    u = request.user
    if not u.is_authenticated:
        return Response({"error": "authentication_required"}, status=401)
    if not (u.is_active and u.role == "admin"):
        return Response({"error": "forbidden"}, status=403)
    return None


def _sos_owner_ok(request, s):
    """The citizen who created an SOS holds its secret token. Admins may also act on any SOS."""
    u = request.user
    if u.is_authenticated and u.is_active and u.role == "admin":
        return True
    tok = request.headers.get("X-SOS-Token", "")
    return bool(s.owner_token) and secrets.compare_digest(tok, s.owner_token)


def _coords(request):
    try:
        return float(request.query_params["lat"]), float(request.query_params["lng"])
    except (KeyError, ValueError):
        return None, None


@api_view(["GET"])
@permission_classes([AllowAny])
def facilities(request):
    lat, lng = _coords(request)
    qs = Facility.objects.all()
    if request.query_params.get("type"):
        qs = qs.filter(type=request.query_params["type"])
    data = [sv.facility_dict(f, lat, lng) for f in qs]
    if lat is not None:
        data.sort(key=lambda d: d["distance_km"])
    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def facility_detail(request, pk):
    f = get_object_or_404(Facility, pk=pk)
    d = sv.facility_dict(f)
    d["chain"] = sv.referral_chain(f)
    d["children"] = [sv.facility_dict(c) for c in f.children.all()]
    d["staff"] = [{"role": s.role, "sanctioned": s.sanctioned, "filled": s.filled} for s in f.staff.all()]
    d["equipment"] = [{"name": e.name, "required": e.required, "working": e.working} for e in f.equipment.all()]
    d["health"] = sv.facility_health(f)
    return Response(d)


@api_view(["GET"])
@permission_classes([AllowAny])
def nearest(request):
    lat, lng = _coords(request)
    if lat is None:
        return Response({"error": "lat and lng required"}, status=400)
    kind = request.query_params.get("kind", "human")
    f = sv.nearest_facility(lat, lng, kind)
    if not f:
        return Response({"error": "no facility"}, status=404)
    d = sv.facility_dict(f, lat, lng)
    d["chain"] = sv.referral_chain(f)
    # nearest facility with telemedicine in the chain (or hub fallback)
    tele = next((c for c in d["chain"] if c["has_telemedicine"]), None)
    d["telemedicine"] = tele
    return Response(d)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def sos(request):
    if request.method == "GET":
        if (e := _admin_only(request)):
            return e
        rows = SOSRequest.objects.select_related("facility", "ambulance", "user__patient", "doctor_ack_by__doctor")[:50]
        return Response([sos_dict(s, admin_view=True) for s in rows])
    p = request.data
    try:
        lat, lng = float(p["lat"]), float(p["lng"])
    except (KeyError, TypeError, ValueError):
        return Response({"error": "lat and lng required"}, status=400)
    kind = p.get("kind", "human")
    if kind not in ("human", "animal"):
        return Response({"error": "kind must be human or animal"}, status=400)
    
    reason = p.get("reason", "general")
    valid_reasons = dict(SOSRequest.REASONS)
    if reason not in valid_reasons:
        reason = "general"

    pressed_at_raw = p.get("pressed_at")
    pressed_at = None
    if pressed_at_raw:
        try:
            pressed_at = datetime.fromisoformat(str(pressed_at_raw).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pressed_at = timezone.now()
    if not pressed_at:
        pressed_at = timezone.now()

    session_id = str(p.get("session_id", ""))[:40]

    f = sv.nearest_facility(lat, lng, kind, need_emergency=True)
    amb = sv.nearest_ambulance(lat, lng, animal=(kind == "animal"))
    s = SOSRequest.objects.create(
        kind=kind,
        reason=reason,
        pressed_at=pressed_at,
        session_id=session_id,
        lat=lat,
        lng=lng,
        note=str(p.get("note", ""))[:200],
        language=p.get("language", "kn"),
        user=request.user if (request.user.is_authenticated and request.user.role == "patient") else None,
        owner_token=secrets.token_urlsafe(16),
        facility=f,
        ambulance=amb,
        status="dispatched" if amb else "new",
    )
    if amb:
        amb.status = "on_trip"
        amb.save()
    # Doctor alerts must never block or break the SOS response
    if s.user_id:
        try:
            from alerts.services import dispatch_alerts
            dispatch_alerts(s)
        except Exception:  # noqa: BLE001
            pass
    out = sos_dict(s)
    out["owner_token"] = s.owner_token
    out["emergency_numbers"] = {"ambulance": "108", "national": "112"}
    return Response(out, status=201)


@api_view(["GET", "PATCH"])
@permission_classes([AllowAny])
def sos_update(request, pk):
    s = get_object_or_404(SOSRequest, pk=pk)
    if not _sos_owner_ok(request, s):
        return Response({"error": "not_found"}, status=404)
    if request.method == "GET":
        from alerts.services import escalate_if_due
        escalate_if_due(s)
        return Response(sos_dict(s))
    data = request.data
    st = data.get("status")
    if st is not None:
        if st not in ("new", "dispatched", "resolved"):
            return Response({"error": "bad status"}, status=400)
        s.status = st
        if st == "resolved":
            s.closed_at = timezone.now()
    if "note" in data:
        s.note = str(data["note"])[:200]
    s.save()
    if st == "resolved" and s.ambulance:
        s.ambulance.status = "available"
        s.ambulance.save()
    return Response(sos_dict(s))


@api_view(["GET"])
@permission_classes([AllowAny])
def ambulances(request):
    return Response([amb_dict(a) for a in Ambulance.objects.select_related("base")])


@api_view(["POST"])
@permission_classes([IsAdminRole])
def ambulance_location(request, pk):
    a = get_object_or_404(Ambulance, pk=pk)
    try:
        a.lat, a.lng = float(request.data["lat"]), float(request.data["lng"])
    except (KeyError, TypeError, ValueError):
        return Response({"error": "lat and lng required"}, status=400)
    if request.data.get("status") in ("available", "on_trip", "offline"):
        a.status = request.data["status"]
    a.save()
    return Response(amb_dict(a))


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def camps(request):
    if request.method == "GET":
        return Response([camp_dict(c) for c in HealthCamp.objects.filter(date__gte=date.today()).order_by("date")])
    if (e := _admin_only(request)):
        return e
    p = request.data
    try:
        c = HealthCamp.objects.create(title=p["title"], village=p["village"], taluk=p["taluk"],
                                      lat=float(p["lat"]), lng=float(p["lng"]), date=date.fromisoformat(str(p["date"])),
                                      focus=p.get("focus", ""), is_animal=bool(p.get("is_animal", False)))
    except (KeyError, TypeError, ValueError) as e:
        return Response({"error": f"invalid camp: {e}"}, status=400)
    return Response(camp_dict(c), status=201)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([AllowAny])
def camp_detail(request, pk):
    c = get_object_or_404(HealthCamp, pk=pk)
    if request.method == "GET":
        return Response(camp_dict(c))
    if (e := _admin_only(request)):
        return e
    if request.method == "DELETE":
        c.delete()
        return Response(status=204)
    p = request.data
    if "title" in p:
        c.title = str(p["title"])
    if "village" in p:
        c.village = str(p["village"])
    if "taluk" in p:
        c.taluk = str(p["taluk"])
    if "date" in p:
        try:
            c.date = date.fromisoformat(str(p["date"]))
        except (TypeError, ValueError):
            return Response({"error": "bad date"}, status=400)
    if "lat" in p:
        try:
            c.lat = float(p["lat"])
        except (TypeError, ValueError):
            return Response({"error": "bad lat"}, status=400)
    if "lng" in p:
        try:
            c.lng = float(p["lng"])
        except (TypeError, ValueError):
            return Response({"error": "bad lng"}, status=400)
    if "focus" in p:
        c.focus = str(p["focus"])
    if "is_animal" in p:
        c.is_animal = bool(p["is_animal"])
    c.save()
    return Response(camp_dict(c))


@api_view(["GET"])
@permission_classes([IsAdminRole])
def dashboard(request):
    return Response(sv.dashboard_payload())


@api_view(["POST"])
@permission_classes([AllowAny])
def events(request):
    data = request.data
    if isinstance(data, dict):
        items = [data]
    elif isinstance(data, list):
        if len(data) > 20:
            return Response({"error": "batch size must be at most 20"}, status=400)
        items = data
    else:
        return Response({"error": "invalid payload"}, status=400)

    if not items:
        return Response(status=204)

    valid_events = {e[0] for e in UsageEvent.EVENTS}

    # Validate items and check rate limit
    sessions = set()
    for item in items:
        if not isinstance(item, dict):
            return Response({"error": "each item must be an object"}, status=400)
        ev_name = item.get("event")
        if ev_name not in valid_events:
            return Response({"error": f"invalid event name: {ev_name}"}, status=400)
        sid = str(item.get("session_id", ""))[:40]
        if sid:
            sessions.add(sid)

    num_events = len(items)
    for sid in sessions:
        rkey = f"rate_limit_events_{sid}"
        curr = cache.get(rkey, 0)
        if curr + num_events > 120:
            return Response({"error": "rate limit exceeded (max 120 events/min)"}, status=429)
        cache.set(rkey, curr + num_events, timeout=60)

    objs = []
    for item in items:
        lat = item.get("lat")
        lng = item.get("lng")
        try:
            lat = round(float(lat), 2) if lat is not None else None
        except (ValueError, TypeError):
            lat = None
        try:
            lng = round(float(lng), 2) if lng is not None else None
        except (ValueError, TypeError):
            lng = None

        objs.append(
            UsageEvent(
                session_id=str(item.get("session_id", ""))[:40],
                event=item.get("event"),
                kind=str(item.get("kind", ""))[:10] if item.get("kind") in ("human", "animal") else "",
                detail=str(item.get("detail", ""))[:60],
                language=str(item.get("language", "kn"))[:4],
                lat=lat,
                lng=lng,
            )
        )
    UsageEvent.objects.bulk_create(objs)
    return Response(status=204)


@api_view(["GET"])
@permission_classes([IsAdminRole])
def usage(request):
    from_param = request.query_params.get("from")
    to_param = request.query_params.get("to")
    now_date = timezone.now().date()

    if to_param:
        try:
            to_date = date.fromisoformat(to_param)
        except (ValueError, TypeError):
            to_date = now_date
    else:
        to_date = now_date

    if from_param:
        try:
            from_date = date.fromisoformat(from_param)
        except (ValueError, TypeError):
            from_date = to_date - timedelta(days=29)
    else:
        from_date = to_date - timedelta(days=29)

    if from_date > to_date:
        from_date, to_date = to_date, from_date

    start_dt = timezone.make_aware(datetime.combine(from_date, time.min))
    end_dt = timezone.make_aware(datetime.combine(to_date, time.max))

    events_qs = UsageEvent.objects.filter(created_at__range=(start_dt, end_dt))
    sos_qs = SOSRequest.objects.filter(created_at__range=(start_dt, end_dt))

    # Days map
    num_days = (to_date - from_date).days + 1
    day_counts = {(from_date + timedelta(days=i)).isoformat(): 0 for i in range(num_days)}
    day_sessions = {(from_date + timedelta(days=i)).isoformat(): set() for i in range(num_days)}

    for ev in events_qs.values("created_at", "session_id"):
        d_key = ev["created_at"].date().isoformat()
        if d_key in day_counts:
            day_counts[d_key] += 1
            if ev["session_id"]:
                day_sessions[d_key].add(ev["session_id"])

    total_events_per_day = [{"date": k, "count": day_counts[k]} for k in sorted(day_counts.keys())]
    unique_sessions_per_day = [{"date": k, "count": len(day_sessions[k])} for k in sorted(day_sessions.keys())]

    # Event counts
    ev_counts_map = dict(events_qs.values("event").annotate(c=Count("id")).values_list("event", "c"))
    event_counts = [{"event": e[0], "label": e[1], "count": ev_counts_map.get(e[0], 0)} for e in UsageEvent.EVENTS]

    # SOS count by reason
    sos_reason_map = dict(sos_qs.values("reason").annotate(c=Count("id")).values_list("reason", "c"))
    sos_by_reason = [{"reason": r[0], "label": r[1], "count": sos_reason_map.get(r[0], 0)} for r in SOSRequest.REASONS]

    # SOS count human vs animal
    sos_by_kind = {
        "human": sos_qs.filter(kind="human").count(),
        "animal": sos_qs.filter(kind="animal").count(),
    }

    # SOS by hour of day (0-23)
    hour_counts = {h: 0 for h in range(24)}
    for s in sos_qs:
        dt = s.pressed_at or s.created_at
        hour_counts[dt.hour] += 1
    sos_by_hour = [{"hour": h, "count": hour_counts[h]} for h in range(24)]

    # 50 most recent SOS entries
    recent = SOSRequest.objects.select_related("facility", "ambulance").order_by("-created_at")[:50]
    recent_sos = [sos_dict(s) for s in recent]

    # Summary metrics for KPI tiles
    today = timezone.now().date()
    today_start = timezone.make_aware(datetime.combine(today, time.min))
    today_end = timezone.make_aware(datetime.combine(today, time.max))

    summary = {
        "events_today": UsageEvent.objects.filter(created_at__range=(today_start, today_end)).count(),
        "unique_sessions_today": UsageEvent.objects.filter(created_at__range=(today_start, today_end)).values("session_id").distinct().count(),
        "sos_today": SOSRequest.objects.filter(created_at__range=(today_start, today_end)).count(),
        "animal_sos_today": SOSRequest.objects.filter(created_at__range=(today_start, today_end), kind="animal").count(),
        "total_events_in_range": events_qs.count(),
        "total_sos_in_range": sos_qs.count(),
    }

    return Response({
        "summary": summary,
        "total_events_per_day": total_events_per_day,
        "unique_sessions_per_day": unique_sessions_per_day,
        "event_counts": event_counts,
        "sos_by_reason": sos_by_reason,
        "sos_by_kind": sos_by_kind,
        "sos_by_hour": sos_by_hour,
        "recent_sos": recent_sos,
        "date_range": {
            "from": from_date.isoformat(),
            "to": to_date.isoformat(),
        },
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def sos_location(request, pk):
    s = get_object_or_404(SOSRequest, pk=pk)
    if not _sos_owner_ok(request, s) or s.closed_at:
        return Response({"error": "not_found"}, status=404)
    try:
        lat, lng = float(request.data["lat"]), float(request.data["lng"])
    except (KeyError, TypeError, ValueError):
        return Response({"error": "lat and lng required"}, status=400)
    from alerts.services import add_track_point
    add_track_point(s, lat, lng)
    return Response(status=204)
