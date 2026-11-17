from django.conf import settings
from django.db import models


class Facility(models.Model):
    HUB, CHC, PHC, CLINIC, VET = "hub", "chc", "phc", "clinic", "vet"
    TYPES = [(HUB, "District Hub"), (CHC, "Community Health Centre"), (PHC, "Primary Health Centre"),
             (CLINIC, "Village Clinic"), (VET, "Veterinary Hospital")]
    name = models.CharField(max_length=120)
    name_kn = models.CharField(max_length=160, blank=True)
    type = models.CharField(max_length=10, choices=TYPES)
    taluk = models.CharField(max_length=60)
    lat = models.FloatField()
    lng = models.FloatField()
    phone = models.CharField(max_length=20, blank=True)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    has_telemedicine = models.BooleanField(default=False)
    telemedicine_link = models.CharField(max_length=200, blank=True)
    has_internet = models.BooleanField(default=True)
    has_emergency = models.BooleanField(default=False)
    specialist_services = models.CharField(max_length=200, blank=True)
    building_condition = models.IntegerField(default=3, help_text="1 (poor) to 5 (good)")
    medicine_stock_pct = models.IntegerField(default=70)

    def __str__(self):
        return self.name


class StaffRecord(models.Model):
    facility = models.ForeignKey(Facility, on_delete=models.CASCADE, related_name="staff")
    role = models.CharField(max_length=40)
    sanctioned = models.IntegerField()
    filled = models.IntegerField()


class Equipment(models.Model):
    facility = models.ForeignKey(Facility, on_delete=models.CASCADE, related_name="equipment")
    name = models.CharField(max_length=60)
    required = models.IntegerField(default=1)
    working = models.IntegerField(default=0)


class Ambulance(models.Model):
    code = models.CharField(max_length=20)
    base = models.ForeignKey(Facility, on_delete=models.CASCADE, related_name="ambulances")
    status = models.CharField(max_length=12, default="available")  # available / on_trip / offline
    lat = models.FloatField()
    lng = models.FloatField()
    is_animal = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)


class HealthCamp(models.Model):
    title = models.CharField(max_length=120)
    village = models.CharField(max_length=80)
    taluk = models.CharField(max_length=60)
    lat = models.FloatField()
    lng = models.FloatField()
    date = models.DateField()
    focus = models.CharField(max_length=120, blank=True)
    is_animal = models.BooleanField(default=False)
    organised_by = models.ForeignKey(Facility, null=True, blank=True, on_delete=models.SET_NULL)


class SOSRequest(models.Model):
    HUMAN, ANIMAL = "human", "animal"
    REASONS = [
        ("general", "General"),
        ("snakebite", "Snake Bite"),
        ("accident", "Accident"),
        ("maternal", "Maternal"),
        ("animal_sick", "Sick Animal"),
        ("animal_injury", "Injured Animal"),
        ("other", "Other"),
    ]
    kind = models.CharField(max_length=8, default=HUMAN)
    reason = models.CharField(max_length=20, choices=REASONS, default="general")
    lat = models.FloatField()
    lng = models.FloatField()
    note = models.CharField(max_length=200, blank=True)
    language = models.CharField(max_length=4, default="kn")
    status = models.CharField(max_length=12, default="new")  # new / dispatched / resolved
    facility = models.ForeignKey(Facility, null=True, on_delete=models.SET_NULL)
    ambulance = models.ForeignKey(Ambulance, null=True, blank=True, on_delete=models.SET_NULL)
    pressed_at = models.DateTimeField(null=True, blank=True)
    session_id = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Phase 2: link to a logged-in patient, per-SOS secret for guests, doctor acknowledgement
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="sos_requests")
    owner_token = models.CharField(max_length=40, blank=True)
    doctor_ack_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    doctor_ack_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)


class UsageEvent(models.Model):
    EVENTS = [
        ("app_open", "App Open"),
        ("sos_hold_started", "SOS Hold Started"),
        ("sos_hold_cancelled", "SOS Hold Cancelled"),
        ("sos_sent", "SOS Sent"),
        ("sos_failed", "SOS Failed"),
        ("animal_mode_on", "Animal Mode On"),
        ("human_mode_on", "Human Mode On"),
        ("language_changed", "Language Changed"),
        ("voice_played", "Voice Played"),
        ("map_opened", "Map Opened"),
        ("facility_selected", "Facility Selected"),
        ("doctor_opened", "Doctor Opened"),
        ("call_started", "Call Started"),
        ("camps_opened", "Camps Opened"),
        ("camp_reminder", "Camp Reminder"),
        ("call_108", "Call 108"),
        ("call_112", "Call 112"),
        ("call_1962", "Call 1962"),
        ("offline_fallback_shown", "Offline Fallback Shown"),
    ]
    session_id = models.CharField(max_length=40)
    event = models.CharField(max_length=30, choices=EVENTS)
    kind = models.CharField(max_length=10, blank=True)
    detail = models.CharField(max_length=60, blank=True)
    language = models.CharField(max_length=4, default="kn")
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f"{self.event} ({self.session_id[:8]})"


class PatientVisit(models.Model):
    facility = models.ForeignKey(Facility, on_delete=models.CASCADE, related_name="visits")
    month = models.DateField()
    visits = models.IntegerField()
    illness = models.CharField(max_length=40)


class CommunityIssue(models.Model):
    """Patient & community data: what the community is facing."""
    taluk = models.CharField(max_length=60)
    kind = models.CharField(max_length=20)  # transport / financial / illness
    label = models.CharField(max_length=60)
    households_affected_pct = models.IntegerField()
