import math
from collections import defaultdict
from django.db.models import Sum
from .models import Facility, StaffRecord, Equipment, PatientVisit, CommunityIssue, Ambulance


def haversine(lat1, lng1, lat2, lng2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def facility_dict(f, lat=None, lng=None):
    d = {"id": f.id, "name": f.name, "name_kn": f.name_kn, "type": f.type, "taluk": f.taluk, "lat": f.lat,
         "lng": f.lng, "phone": f.phone, "has_telemedicine": f.has_telemedicine,
         "telemedicine_link": f.telemedicine_link, "has_internet": f.has_internet,
         "has_emergency": f.has_emergency, "specialist_services": f.specialist_services,
         "parent_id": f.parent_id}
    if lat is not None:
        d["distance_km"] = round(haversine(lat, lng, f.lat, f.lng), 1)
    return d


def referral_chain(f):
    """Hub-and-spoke path from a facility up to the district hub."""
    chain, seen = [], set()
    while f and f.id not in seen:
        seen.add(f.id)
        chain.append({"id": f.id, "name": f.name, "name_kn": f.name_kn, "type": f.type,
                      "phone": f.phone, "has_telemedicine": f.has_telemedicine})
        f = f.parent
    return chain


def nearest_facility(lat, lng, kind="human", need_emergency=False):
    qs = Facility.objects.filter(type="vet") if kind == "animal" else Facility.objects.exclude(type="vet")
    if need_emergency and kind != "animal":
        qs = qs.filter(has_emergency=True) | qs.filter(type="hub")
    best = sorted(qs.distinct(), key=lambda f: haversine(lat, lng, f.lat, f.lng))
    return best[0] if best else None


def nearest_ambulance(lat, lng, animal=False):
    cand = Ambulance.objects.filter(status="available", is_animal=animal)
    best = sorted(cand, key=lambda a: haversine(lat, lng, a.lat, a.lng))
    return best[0] if best else None


def facility_health(f):
    staff = list(f.staff.all())
    sanc, fill = sum(s.sanctioned for s in staff), sum(s.filled for s in staff)
    eq = list(f.equipment.all())
    req, work = sum(e.required for e in eq), sum(e.working for e in eq)
    staff_pct = round(100 * fill / sanc) if sanc else 100
    equip_pct = round(100 * work / req) if req else 100
    needs, score = [], 0
    if staff_pct < 65:
        needs.append("staff"); score += (65 - staff_pct) * 1.2
    if equip_pct < 80:
        needs.append("equipment"); score += (80 - equip_pct) * 0.8
    if f.building_condition <= 2:
        needs.append("building_repair"); score += (3 - f.building_condition) * 22
    if f.medicine_stock_pct < 55:
        needs.append("medicine"); score += (55 - f.medicine_stock_pct) * 1.0
    if not f.has_internet:
        needs.append("connectivity"); score += 15
    if f.type != "vet" and not f.has_emergency and f.type in ("phc",):
        score += 4
    return {"staff_pct": staff_pct, "staff_sanctioned": sanc, "staff_filled": fill, "equipment_pct": equip_pct,
            "equipment_required": req, "equipment_working": work, "needs": needs, "urgency": round(score)}


def dashboard_payload():
    facs = list(Facility.objects.select_related("parent").prefetch_related("staff", "equipment"))
    rows = []
    for f in facs:
        h = facility_health(f)
        rows.append({**facility_dict(f), "building_condition": f.building_condition,
                     "medicine_stock_pct": f.medicine_stock_pct, **h})
    funding = sorted([r for r in rows if r["needs"]], key=lambda r: -r["urgency"])[:12]

    by_taluk = defaultdict(lambda: {"staff_sanc": 0, "staff_fill": 0, "facilities": 0, "no_internet": 0, "visits": 0})
    for r in rows:
        t = by_taluk[r["taluk"]]
        t["staff_sanc"] += r["staff_sanctioned"]; t["staff_fill"] += r["staff_filled"]
        t["facilities"] += 1; t["no_internet"] += 0 if r["has_internet"] else 1
    for tt in PatientVisit.objects.values("facility__taluk").annotate(v=Sum("visits")):
        by_taluk[tt["facility__taluk"]]["visits"] = tt["v"]
    issues = defaultdict(dict)
    for c in CommunityIssue.objects.all():
        issues[c.taluk][c.kind] = c.households_affected_pct
    taluks = []
    for t, v in by_taluk.items():
        fill_pct = round(100 * v["staff_fill"] / v["staff_sanc"]) if v["staff_sanc"] else 100
        burden = round(sum(issues[t].values()) / max(1, len(issues[t])))
        taluks.append({"taluk": t, "staff_fill_pct": fill_pct, "facilities": v["facilities"],
                       "no_internet": v["no_internet"], "visits": v["visits"], "transport_pct": issues[t].get("transport"),
                       "financial_pct": issues[t].get("financial"), "distance_pct": issues[t].get("distance"),
                       "need_score": round(burden * 0.6 + (100 - fill_pct) * 0.4)})
    taluks.sort(key=lambda x: -x["need_score"])

    monthly = defaultdict(int)
    for m in PatientVisit.objects.values("month").annotate(v=Sum("visits")).order_by("month"):
        monthly[m["month"].strftime("%b %Y")] = m["v"]
    illness = list(PatientVisit.objects.values("illness").annotate(v=Sum("visits")).order_by("-v"))
    types = defaultdict(int)
    for f in facs:
        types[f.type] += 1
    return {
        "summary": {
            "facilities": len(facs), "by_type": dict(types),
            "telemedicine": sum(f.has_telemedicine for f in facs),
            "no_internet": sum(not f.has_internet for f in facs),
            "emergency_capable": sum(f.has_emergency for f in facs),
            "avg_staff_fill_pct": round(sum(r["staff_pct"] for r in rows) / len(rows)),
            "needs_attention": len([r for r in rows if r["needs"]]),
            "ambulances_total": Ambulance.objects.count(),
            "ambulances_available": Ambulance.objects.filter(status="available").count(),
        },
        "facilities": rows, "funding": funding, "taluks": taluks,
        "visits_monthly": [{"month": k, "visits": v} for k, v in monthly.items()],
        "illness": [{"illness": i["illness"], "visits": i["v"]} for i in illness],
        "camp_suggestions": [{"taluk": t["taluk"], "need_score": t["need_score"],
                              "reason": f"{t['transport_pct']}% lack transport, staff {t['staff_fill_pct']}% filled"}
                             for t in taluks[:3]],
    }
