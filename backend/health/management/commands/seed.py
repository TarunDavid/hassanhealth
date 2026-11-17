"""Seed SIMULATED data for Hassan district. Not official figures."""
import random
import uuid
from datetime import date, timedelta
from django.utils import timezone
from django.core.management.base import BaseCommand
from health.models import (Facility, StaffRecord, Equipment, Ambulance, HealthCamp,
                           PatientVisit, CommunityIssue, SOSRequest, UsageEvent)

TALUKS = {  # name: (kannada, lat, lng, remoteness 0..1 — higher = worse served)
    "Hassan": ("ಹಾಸನ", 13.0033, 76.1004, 0.1),
    "Arsikere": ("ಅರಸೀಕೆರೆ", 13.3140, 76.2580, 0.4),
    "Belur": ("ಬೇಲೂರು", 13.1650, 75.8650, 0.5),
    "Channarayapatna": ("ಚನ್ನರಾಯಪಟ್ಟಣ", 12.9060, 76.3880, 0.4),
    "Holenarasipura": ("ಹೊಳೆನರಸೀಪುರ", 12.7850, 76.2420, 0.35),
    "Sakleshpura": ("ಸಕಲೇಶಪುರ", 12.9440, 75.7850, 0.85),
    "Alur": ("ಆಲೂರು", 12.9700, 75.9900, 0.8),
    "Arkalgud": ("ಅರಕಲಗೂಡು", 12.7620, 76.0540, 0.75),
}
VILLAGES = {
    "Hassan": [("Dudda", "ದುದ್ದ"), ("Shantigrama", "ಶಾಂತಿಗ್ರಾಮ")],
    "Arsikere": [("Javagal", "ಜಾವಗಲ್"), ("Banavara", "ಬಾಣಾವರ")],
    "Belur": [("Halebeedu", "ಹಳೇಬೀಡು"), ("Arehalli", "ಅರೇಹಳ್ಳಿ")],
    "Channarayapatna": [("Shravanabelagola", "ಶ್ರವಣಬೆಳಗೊಳ"), ("Hirisave", "ಹಿರೀಸಾವೆ")],
    "Holenarasipura": [("Hallimysore", "ಹಳ್ಳಿಮೈಸೂರು"), ("Gandasi", "ಗಂಡಸಿ")],
    "Sakleshpura": [("Yesalur", "ಯಸಳೂರು"), ("Hanbal", "ಹಾನುಬಾಳ್")],
    "Alur": [("Kattaya", "ಕಟ್ಟಾಯ"), ("Pete Sargur", "ಪೇಟೆ ಸರಗೂರು")],
    "Arkalgud": [("Konanur", "ಕೊಣನೂರು"), ("Ramanathapura", "ರಾಮನಾಥಪುರ")],
}
TYPE_KN = {"hub": "ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ", "chc": "ಸಮುದಾಯ ಆರೋಗ್ಯ ಕೇಂದ್ರ", "phc": "ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರ",
           "clinic": "ಗ್ರಾಮ ಚಿಕಿತ್ಸಾಲಯ", "vet": "ಪಶು ಆಸ್ಪತ್ರೆ"}
SANCTIONED = {  # role: counts by type
    "hub": {"Doctor": 40, "Nurse": 90, "Lab Technician": 14, "Pharmacist": 8},
    "chc": {"Doctor": 8, "Nurse": 16, "Lab Technician": 3, "Pharmacist": 2},
    "phc": {"Doctor": 2, "Nurse": 4, "Lab Technician": 1, "Pharmacist": 1},
    "clinic": {"Nurse": 2, "Pharmacist": 1},
    "vet": {"Veterinarian": 3, "Vet Assistant": 4},
}
EQUIP = {
    "hub": ["ECG", "Ventilator", "X-ray", "Ultrasound", "Oxygen Concentrator", "Cold Chain Fridge"],
    "chc": ["ECG", "X-ray", "Ultrasound", "Oxygen Concentrator", "Cold Chain Fridge"],
    "phc": ["ECG", "Oxygen Concentrator", "Cold Chain Fridge"],
    "clinic": ["Cold Chain Fridge", "BP Monitor"],
    "vet": ["Cold Chain Fridge", "Surgical Kit", "Microscope"],
}
ILLNESS = ["Fever / Infection", "Respiratory", "Diabetes / BP", "Maternal Care", "Injury", "Snakebite", "Gastro"]
SPECIALIST = {"hub": "Cardiology, Trauma, Paediatrics, Gynaecology, ICU",
              "chc": "Basic surgery, Obstetrics", "phc": "", "clinic": "", "vet": "Large-animal care"}


class Command(BaseCommand):
    help = "Seed simulated Hassan district data"

    def handle(self, *a, **kw):
        rnd = random.Random(42)
        self._wipe_accounts()
        for m in (SOSRequest, HealthCamp, Ambulance, PatientVisit, Equipment, StaffRecord,
                  CommunityIssue, Facility, UsageEvent):
            m.objects.all().delete()

        hub = Facility.objects.create(
            name="HIMS Hassan (District Hub)", name_kn="ಹಿಮ್ಸ್ ಹಾಸನ (ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆ)", type="hub", taluk="Hassan",
            lat=13.0040, lng=76.1010, phone="08172-268888", has_telemedicine=True,
            telemedicine_link="https://meet.jit.si/HassanHub-Telemedicine", has_internet=True,
            has_emergency=True, specialist_services=SPECIALIST["hub"], building_condition=4, medicine_stock_pct=88)
        facs = [hub]

        def make(name, kn, typ, taluk, lat, lng, parent, rem):
            tele = typ in ("chc",) or (typ == "phc" and rnd.random() > rem)
            f = Facility.objects.create(
                name=name, name_kn=kn, type=typ, taluk=taluk, lat=lat, lng=lng,
                phone=f"08172-{rnd.randint(220000, 289999)}", parent=parent,
                has_telemedicine=tele,
                telemedicine_link=f"https://meet.jit.si/Hassan-{name.replace(' ', '')}" if tele else "",
                has_internet=rnd.random() > rem * 0.7 if typ != "vet" else rnd.random() > rem * 0.5,
                has_emergency=typ in ("chc",) or (typ == "phc" and rnd.random() > 0.5),
                specialist_services=SPECIALIST[typ],
                building_condition=max(1, min(5, round(5 - rem * 3 + rnd.uniform(-1, 1)))),
                medicine_stock_pct=int(max(15, min(98, 95 - rem * 55 + rnd.uniform(-15, 10)))))
            facs.append(f)
            return f

        for t, (tkn, la, ln, rem) in TALUKS.items():
            chc = hub if t == "Hassan" else make(f"{t} Taluk Hospital (CHC)", f"{tkn} ತಾಲ್ಲೂಕು ಆಸ್ಪತ್ರೆ", "chc", t,
                                                  la, ln, hub, rem)
            for (vn, vkn) in VILLAGES[t]:
                phc = make(f"PHC {vn}", f"ಪ್ರಾ.ಆ.ಕೇಂದ್ರ {vkn}", "phc", t, la + rnd.uniform(-.14, .14),
                           ln + rnd.uniform(-.14, .14), chc, rem)
                make(f"{vn} Village Clinic", f"{vkn} ಗ್ರಾಮ ಚಿಕಿತ್ಸಾಲಯ", "clinic", t, phc.lat + rnd.uniform(-.05, .05),
                     phc.lng + rnd.uniform(-.05, .05), phc, rem)
            if t in ("Hassan", "Arsikere", "Belur", "Sakleshpura", "Arkalgud", "Channarayapatna"):
                make(f"Veterinary Hospital {t}", f"ಪಶು ಆಸ್ಪತ್ರೆ {tkn}", "vet", t, la + rnd.uniform(-.03, .03),
                     ln + rnd.uniform(-.03, .03), None, rem)

        rem_of = {t: v[3] for t, v in TALUKS.items()}
        today = date.today().replace(day=1)
        for f in facs:
            rem = rem_of[f.taluk]
            for role, n in SANCTIONED[f.type].items():
                fill = max(0.25, min(1.0, 1.0 - rem * 0.55 + rnd.uniform(-.15, .1)))
                StaffRecord.objects.create(facility=f, role=role, sanctioned=n, filled=int(round(n * fill)))
            for e in EQUIP[f.type]:
                req = {"hub": 6, "chc": 2}.get(f.type, 1)
                working = req if rnd.random() > rem * 0.6 else rnd.randint(0, req - 1) if req > 1 else 0
                Equipment.objects.create(facility=f, name=e, required=req, working=working)
            if f.type != "vet":
                base = {"hub": 3200, "chc": 900, "phc": 380, "clinic": 120}[f.type]
                for i in range(6):
                    mon = (today - timedelta(days=30 * (5 - i))).replace(day=1)
                    for ill in rnd.sample(ILLNESS, 3):
                        PatientVisit.objects.create(facility=f, month=mon, illness=ill,
                                                    visits=int(base * rnd.uniform(.1, .35)))

        for t, (_, la, ln, rem) in TALUKS.items():
            CommunityIssue.objects.create(taluk=t, kind="transport", label="No transport to hospital",
                                          households_affected_pct=int(20 + rem * 55 + rnd.randint(-5, 5)))
            CommunityIssue.objects.create(taluk=t, kind="financial", label="Treatment cost burden",
                                          households_affected_pct=int(30 + rem * 35 + rnd.randint(-5, 5)))
            CommunityIssue.objects.create(taluk=t, kind="distance", label="Hospital more than 10 km away",
                                          households_affected_pct=int(10 + rem * 60 + rnd.randint(-5, 5)))

        # ambulances: hub 3, each CHC 1, two animal ambulances at vet hospitals
        n = 1
        for f in facs:
            if f.type == "hub":
                for _ in range(3):
                    Ambulance.objects.create(code=f"KA-108-{n:02d}", base=f, lat=f.lat, lng=f.lng); n += 1
            elif f.type == "chc":
                Ambulance.objects.create(code=f"KA-108-{n:02d}", base=f, lat=f.lat, lng=f.lng,
                                         status="available" if rnd.random() > .25 else "on_trip"); n += 1
        for f in [x for x in facs if x.type == "vet"][:3]:
            Ambulance.objects.create(code=f"KA-VET-{n:02d}", base=f, lat=f.lat, lng=f.lng, is_animal=True); n += 1

        camps = [("Maternal & child health camp", "Yesalur", "Sakleshpura", "Maternal care, vaccination", False),
                 ("Diabetes & BP screening", "Kattaya", "Alur", "Diabetes / BP screening", False),
                 ("General health camp", "Konanur", "Arkalgud", "Fever, respiratory, general", False),
                 ("Livestock vaccination camp", "Arehalli", "Belur", "Foot-and-mouth vaccination", True),
                 ("Eye & general checkup", "Hirisave", "Channarayapatna", "Eye checkup, general", False)]
        for i, (title, vil, tal, focus, animal) in enumerate(camps):
            _, la, ln, _r = TALUKS[tal]
            HealthCamp.objects.create(title=title, village=vil, taluk=tal, lat=la + rnd.uniform(-.1, .1),
                                      lng=ln + rnd.uniform(-.1, .1), date=date.today() + timedelta(days=3 + i * 4),
                                      focus=focus, is_animal=animal, organised_by=hub)

        # Temporarily disable auto_now_add for backdated created_at
        sos_created_field = SOSRequest._meta.get_field("created_at")
        sos_created_field.auto_now_add = False
        usage_created_field = UsageEvent._meta.get_field("created_at")
        usage_created_field.auto_now_add = False

        try:
            now = timezone.now()
            all_ambs = list(Ambulance.objects.all())
            human_ambs = [a for a in all_ambs if not a.is_animal]
            animal_ambs = [a for a in all_ambs if a.is_animal]
            human_facs = [f for f in facs if f.type != "vet"]
            vet_facs = [f for f in facs if f.type == "vet"]

            human_reasons = ["snakebite", "accident", "maternal", "general", "other"]
            animal_reasons = ["animal_sick", "animal_injury", "other"]

            sos_objs = []
            for i in range(40):
                is_animal = rnd.random() < 0.28
                kind = "animal" if is_animal else "human"
                reason = rnd.choice(animal_reasons) if is_animal else rnd.choice(human_reasons)
                
                days_ago = rnd.randint(0, 29)
                hour = rnd.choice([rnd.randint(7, 21), rnd.randint(0, 23)])
                minute = rnd.randint(0, 59)
                second = rnd.randint(0, 59)
                sos_time = now - timedelta(days=days_ago, hours=now.hour - hour, minutes=now.minute - minute, seconds=now.second - second)
                if sos_time > now:
                    sos_time = now - timedelta(minutes=rnd.randint(5, 120))
                
                pressed_time = sos_time - timedelta(seconds=rnd.randint(3, 20))
                
                target_facs = vet_facs if is_animal else human_facs
                target_ambs = animal_ambs if is_animal else human_ambs
                chosen_fac = rnd.choice(target_facs)
                lat = round(chosen_fac.lat + rnd.uniform(-0.06, 0.06), 4)
                lng = round(chosen_fac.lng + rnd.uniform(-0.06, 0.06), 4)
                
                if days_ago == 0 and i < 3:
                    status = rnd.choice(["new", "dispatched"])
                    assigned_amb = rnd.choice(target_ambs) if status == "dispatched" else None
                else:
                    status = rnd.choice(["resolved", "resolved", "dispatched"])
                    assigned_amb = rnd.choice(target_ambs)

                sess_id = f"sess_{uuid.UUID(int=rnd.getrandbits(128))}"
                note = f"SIMULATED SOS: {reason} near {chosen_fac.taluk}"
                
                sos_objs.append(SOSRequest(
                    kind=kind,
                    reason=reason,
                    lat=lat,
                    lng=lng,
                    note=note,
                    language=rnd.choice(["kn", "kn", "en"]),
                    status=status,
                    facility=chosen_fac,
                    ambulance=assigned_amb,
                    pressed_at=pressed_time,
                    session_id=sess_id,
                    created_at=sos_time,
                ))
            
            SOSRequest.objects.bulk_create(sos_objs)

            # Seed ~600 UsageEvents over the past 30 days
            session_pool = [str(uuid.UUID(int=rnd.getrandbits(128))) for _ in range(120)]
            
            event_specs = [
                ("app_open", 160, None),
                ("map_opened", 100, None),
                ("facility_selected", 65, "taluk_center"),
                ("voice_played", 60, "help_audio"),
                ("doctor_opened", 35, None),
                ("camps_opened", 35, None),
                ("camp_reminder", 20, "camp_remind_set"),
                ("language_changed", 30, "toggle_lang"),
                ("animal_mode_on", 25, None),
                ("human_mode_on", 20, None),
                ("sos_hold_started", 45, None),
                ("sos_hold_cancelled", 15, "released_early"),
                ("sos_sent", 40, "dispatched"),
                ("call_108", 22, "108"),
                ("call_1962", 14, "1962"),
                ("call_112", 8, "112"),
                ("call_started", 18, "telemed_connect"),
                ("offline_fallback_shown", 8, "cached_data"),
                ("sos_failed", 4, "network_timeout"),
            ]
            
            usage_objs = []
            for ev_name, count, default_detail in event_specs:
                for _ in range(count):
                    days_ago = rnd.randint(0, 29)
                    if rnd.random() < 0.75:
                        ev_hour = rnd.randint(7, 20)
                    else:
                        ev_hour = rnd.choice(list(range(0, 7)) + list(range(21, 24)))
                    ev_minute = rnd.randint(0, 59)
                    ev_second = rnd.randint(0, 59)
                    ev_time = now - timedelta(days=days_ago, hours=now.hour - ev_hour, minutes=now.minute - ev_minute, seconds=now.second - ev_second)
                    if ev_time > now:
                        ev_time = now - timedelta(seconds=rnd.randint(10, 600))
                    
                    sess = rnd.choice(session_pool)
                    k = "animal" if ev_name in ("animal_mode_on", "call_1962") or (rnd.random() < 0.25 and ev_name not in ("human_mode_on", "call_108")) else "human"
                    
                    t_name = rnd.choice(list(TALUKS.keys()))
                    _, t_lat, t_lng, _ = TALUKS[t_name]
                    lat_round = round(t_lat + rnd.uniform(-0.1, 0.1), 2) if rnd.random() > 0.1 else None
                    lng_round = round(t_lng + rnd.uniform(-0.1, 0.1), 2) if lat_round is not None else None
                    
                    lang = rnd.choice(["kn", "kn", "en"])
                    detail = (default_detail or "")[:60]
                    
                    usage_objs.append(UsageEvent(
                        session_id=sess,
                        event=ev_name,
                        kind=k,
                        detail=detail,
                        language=lang,
                        lat=lat_round,
                        lng=lng_round,
                        created_at=ev_time,
                    ))
            
            UsageEvent.objects.bulk_create(usage_objs)
        finally:
            sos_created_field.auto_now_add = True
            usage_created_field.auto_now_add = True

        self._demo_accounts()
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {Facility.objects.count()} facilities, {Ambulance.objects.count()} ambulances, "
            f"{HealthCamp.objects.count()} camps, {SOSRequest.objects.count()} SOS, {UsageEvent.objects.count()} events"
        ))


    # ---- demo accounts (SIMULATED: obviously fake numbers 90000001xx / 90000002xx) -----------------
    def _wipe_accounts(self):
        from accounts.models import User
        from records.services import erase_patient_data
        for u in User.objects.filter(role="patient"):
            erase_patient_data(u)
        User.objects.all().delete()  # cascades profiles, grants, records, OTPs' owners

    def _demo_accounts(self):
        import os
        from accounts.models import User, DoctorProfile, PatientProfile
        from records import crypto, services as rsv
        from records.models import MedicalCondition, MedicalRecord, AccessGrant
        pw = os.environ.get("DEMO_ADMIN_PASSWORD", "Admin@12345")
        dpw = os.environ.get("DEMO_PASSWORD", "Demo@12345")  # password for every demo doctor and patient
        User.objects.create_superuser("9000000000", pw)

        def fac(sub, t=None):
            qs = Facility.objects.filter(name__icontains=sub)
            if t:
                qs = qs.filter(type=t)
            return qs.first()

        docs = [("9000000101", "Demo Sharma", "general", fac("HIMS"), "approved"),
                ("9000000102", "Demo Rao", "general", fac("Sakleshpura Taluk"), "approved"),
                ("9000000103", "Demo Gowda", "veterinary", fac("Sakleshpura", "vet"), "approved"),
                ("9000000104", "Demo Pending", "general", fac("Belur Taluk"), "pending")]
        for phone, name, spec, f, st in docs:
            u = User.objects.create_user(phone, dpw, role="doctor")
            DoctorProfile.objects.create(user=u, full_name=name, council="Karnataka Medical Council (SIMULATED)",
                                         registration_no=f"DEMO-{phone[-3:]}", specialty=spec, facility=f,
                                         on_duty=(st == "approved"), approval_status=st)
        p1 = User.objects.create_user("9000000201", dpw, role="patient")
        PatientProfile.objects.create(user=p1, full_name="Demo Patient One", dob=date(1990, 5, 12), sex="male",
                                      blood_group="B+", taluk="Sakleshpura", language="kn",
                                      emergency_contact_name="Demo Contact", emergency_contact_phone="9000000299")
        p2 = User.objects.create_user("9000000202", dpw, role="patient")
        PatientProfile.objects.create(user=p2, full_name="Demo Patient Two", dob=date(1978, 3, 2), sex="female",
                                      blood_group="O+", taluk="Hassan", language="en")
        now = timezone.now()
        for u in (p1, p2, *User.objects.filter(role="doctor")):
            u.consent_at, u.consent_version = now, "1"
            u.save(update_fields=["consent_at", "consent_version"])
        MedicalCondition.objects.create(patient=p1, data_enc=crypto.encrypt_json({
            "chronic": ["Diabetes (SIMULATED)"], "allergies": "Penicillin (SIMULATED)", "medicines": "Demo tablet 500 mg",
            "surgeries": "", "pregnancy": "", "notes": "SIMULATED demo data. Not a real patient."}))
        pdf = (b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
               b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
               b"4 0 obj<</Length 60>>stream\nBT /F1 14 Tf 20 50 Td (SIMULATED DEMO RECORD) Tj ET\nendstream endobj\n"
               b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF")
        ct, key = crypto.encrypt_file(pdf)
        import hashlib
        name = rsv.new_storage_name()
        path = rsv.store_path(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(ct)
        MedicalRecord.objects.create(patient=p1, title="Demo blood test (SIMULATED)", record_type="report", storage_name=name,
                                     size_bytes=len(pdf), mime_type="application/pdf", sha256=hashlib.sha256(pdf).hexdigest(),
                                     file_key_enc=key)
        AccessGrant.objects.create(patient=p1, doctor=User.objects.get(phone="9000000102"))
