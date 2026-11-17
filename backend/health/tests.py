from datetime import date, timedelta
from django.core.management import call_command
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from accounts.models import User
from .models import Ambulance, SOSRequest, UsageEvent


class ApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", verbosity=0)

    def setUp(self):
        cache.clear()
        self.admin = APIClient()
        self.admin.force_authenticate(User.objects.get(phone="9000000000"))

    def test_nearest_human_and_chain(self):
        r = self.client.get("/api/nearest/?lat=12.9440&lng=75.7850")  # Sakleshpura
        self.assertEqual(r.status_code, 200)
        self.assertNotEqual(r.data["type"], "vet")
        self.assertEqual(r.data["chain"][-1]["type"], "hub")

    def test_nearest_animal_is_vet(self):
        r = self.client.get("/api/nearest/?lat=13.0&lng=76.1&kind=animal")
        self.assertEqual(r.data["type"], "vet")

    def test_sos_dispatch_and_resolve(self):
        r = self.client.post("/api/sos/", {"lat": 13.0, "lng": 76.1, "kind": "human"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "dispatched")
        self.assertFalse(r.data["ambulance"]["is_animal"])
        amb_id = r.data["ambulance"]["id"]
        self.assertEqual(Ambulance.objects.get(id=amb_id).status, "on_trip")
        # Test note update via PATCH
        hdr = {"HTTP_X_SOS_TOKEN": r.data["owner_token"]}
        r_note = self.client.patch(f"/api/sos/{r.data['id']}/", {"note": "Near bus stand water tank"}, format="json", **hdr)
        self.assertEqual(r_note.status_code, 200)
        self.assertEqual(r_note.data["note"], "Near bus stand water tank")
        r2 = self.client.patch(f"/api/sos/{r.data['id']}/", {"status": "resolved"}, format="json", **hdr)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(Ambulance.objects.get(id=amb_id).status, "available")

    def test_sos_animal_uses_animal_ambulance(self):
        r = self.client.post("/api/sos/", {"lat": 13.0, "lng": 76.1, "kind": "animal"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["facility"]["type"], "vet")
        self.assertTrue(r.data["ambulance"]["is_animal"])

    def test_sos_validation(self):
        self.assertEqual(self.client.post("/api/sos/", {"kind": "human"}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/sos/", {"lat": 1, "lng": 1, "kind": "x"}, format="json").status_code, 400)

    def test_ambulance_location_update(self):
        a = Ambulance.objects.first()
        r = self.admin.post(f"/api/ambulances/{a.id}/location/", {"lat": 13.1, "lng": 76.2}, format="json")
        self.assertEqual(r.data["lat"], 13.1)

    def test_camp_create_and_list(self):
        d = (date.today() + timedelta(days=2)).isoformat()
        r = self.admin.post("/api/camps/", {"title": "T", "village": "V", "taluk": "Hassan", "lat": 13, "lng": 76,
                                             "date": d}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(any(c["title"] == "T" for c in self.client.get("/api/camps/").data))

    def test_camp_update_and_delete(self):
        d = (date.today() + timedelta(days=3)).isoformat()
        r = self.admin.post("/api/camps/", {"title": "Old Camp", "village": "V1", "taluk": "Hassan",
                                             "lat": 13.0, "lng": 76.0, "date": d}, format="json")
        camp_id = r.data["id"]
        # Update camp
        r_patch = self.admin.patch(f"/api/camps/{camp_id}/", {"title": "Updated Camp", "village": "V2"}, format="json")
        self.assertEqual(r_patch.status_code, 200)
        self.assertEqual(r_patch.data["title"], "Updated Camp")
        self.assertEqual(r_patch.data["village"], "V2")
        # Delete camp
        r_del = self.admin.delete(f"/api/camps/{camp_id}/")
        self.assertEqual(r_del.status_code, 204)
        self.assertFalse(any(c["id"] == camp_id for c in self.client.get("/api/camps/").data))

    def test_dashboard(self):
        r = self.admin.get("/api/dashboard/")
        self.assertEqual(r.status_code, 200)
        self.assertGreater(len(r.data["funding"]), 0)
        self.assertEqual(r.data["taluks"][0]["taluk"] in
                         {"Sakleshpura", "Alur", "Arkalgud", "Belur"}, True)
        self.assertIn("camp_suggestions", r.data)

    def test_facility_detail(self):
        r = self.client.get("/api/facilities/2/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("health", r.data)

    def test_sos_reason_and_pressed_at(self):
        # Specific reason and pressed_at
        r1 = self.client.post("/api/sos/", {
            "lat": 13.0, "lng": 76.1, "kind": "human",
            "reason": "snakebite", "pressed_at": "2026-11-17T09:00:00Z",
            "session_id": "sess-test-1",
        }, format="json")
        self.assertEqual(r1.status_code, 201)
        self.assertEqual(r1.data["reason"], "snakebite")
        self.assertEqual(SOSRequest.objects.get(id=r1.data["id"]).session_id, "sess-test-1")
        self.assertNotIn("session_id", r1.data)
        self.assertIn("2026-11-17T09:00:00", r1.data["pressed_at"])

        # Missing reason defaults to 'general'
        r2 = self.client.post("/api/sos/", {
            "lat": 13.0, "lng": 76.1, "kind": "human",
        }, format="json")
        self.assertEqual(r2.status_code, 201)
        self.assertEqual(r2.data["reason"], "general")

        # Invalid reason safely falls back to 'general'
        r3 = self.client.post("/api/sos/", {
            "lat": 13.0, "lng": 76.1, "kind": "human",
            "reason": "invalid_reason_xyz",
        }, format="json")
        self.assertEqual(r3.status_code, 201)
        self.assertEqual(r3.data["reason"], "general")

    def test_events_single_batch_and_rounding(self):
        # Single event with rounding
        r1 = self.client.post("/api/events/", {
            "session_id": "sess-round",
            "event": "app_open",
            "lat": 13.00334,
            "lng": 76.10045,
            "language": "kn",
        }, format="json")
        self.assertEqual(r1.status_code, 204)
        ev = UsageEvent.objects.filter(session_id="sess-round").latest("id")
        self.assertEqual(ev.lat, 13.00)
        self.assertEqual(ev.lng, 76.10)

        # Batch of events <= 20
        r2 = self.client.post("/api/events/", [
            {"session_id": "sess-batch", "event": "map_opened"},
            {"session_id": "sess-batch", "event": "voice_played", "detail": "help_audio"},
        ], format="json")
        self.assertEqual(r2.status_code, 204)
        self.assertEqual(UsageEvent.objects.filter(session_id="sess-batch").count(), 2)

        # Batch > 20 rejected
        big_batch = [{"session_id": "sess-big", "event": "app_open"} for _ in range(21)]
        r3 = self.client.post("/api/events/", big_batch, format="json")
        self.assertEqual(r3.status_code, 400)

        # Unknown event rejected
        r4 = self.client.post("/api/events/", {
            "session_id": "sess-unknown",
            "event": "hacker_event",
        }, format="json")
        self.assertEqual(r4.status_code, 400)

    def test_events_rate_limit(self):
        cache.clear()
        sid = "sess-spam-rate-limit"
        # 6 batches of 20 = 120 events
        for _ in range(6):
            batch = [{"session_id": sid, "event": "app_open"} for _ in range(20)]
            r = self.client.post("/api/events/", batch, format="json")
            self.assertEqual(r.status_code, 204)

        # 121st event should hit 429
        r_over = self.client.post("/api/events/", {"session_id": sid, "event": "app_open"}, format="json")
        self.assertEqual(r_over.status_code, 429)
        cache.clear()

    def test_usage_endpoint_and_fixture(self):
        # General GET /api/usage/
        r = self.admin.get("/api/usage/")
        self.assertEqual(r.status_code, 200)
        expected_keys = [
            "summary", "total_events_per_day", "unique_sessions_per_day",
            "event_counts", "sos_by_reason", "sos_by_kind",
            "sos_by_hour", "recent_sos", "date_range",
        ]
        for k in expected_keys:
            self.assertIn(k, r.data)

        # Exact counts for a small fixture on a future date
        target_date = date.today() + timedelta(days=60)
        target_dt = timezone.make_aware(timezone.datetime.combine(target_date, timezone.datetime.min.time()) + timedelta(hours=10))

        # Disable auto_now_add to create fixture with fixed target_dt
        ev_field = UsageEvent._meta.get_field("created_at")
        sos_field = SOSRequest._meta.get_field("created_at")
        ev_field.auto_now_add = False
        sos_field.auto_now_add = False

        try:
            UsageEvent.objects.create(session_id="sess-fix-1", event="app_open", created_at=target_dt)
            UsageEvent.objects.create(session_id="sess-fix-1", event="call_108", created_at=target_dt)
            UsageEvent.objects.create(session_id="sess-fix-2", event="map_opened", created_at=target_dt)

            amb = Ambulance.objects.filter(is_animal=False).first()
            SOSRequest.objects.create(
                kind="human", reason="snakebite", lat=13.0, lng=76.1,
                ambulance=amb, pressed_at=target_dt, created_at=target_dt,
            )
            SOSRequest.objects.create(
                kind="animal", reason="animal_sick", lat=13.0, lng=76.1,
                pressed_at=target_dt, created_at=target_dt,
            )
        finally:
            ev_field.auto_now_add = True
            sos_field.auto_now_add = True

        r_filter = self.admin.get(f"/api/usage/?from={target_date.isoformat()}&to={target_date.isoformat()}")
        self.assertEqual(r_filter.status_code, 200)
        self.assertEqual(r_filter.data["summary"]["total_events_in_range"], 3)
        self.assertEqual(r_filter.data["summary"]["total_sos_in_range"], 2)
        self.assertEqual(r_filter.data["sos_by_kind"]["human"], 1)
        self.assertEqual(r_filter.data["sos_by_kind"]["animal"], 1)
        # SOS reasons
        reasons_map = {x["reason"]: x["count"] for x in r_filter.data["sos_by_reason"]}
        self.assertEqual(reasons_map["snakebite"], 1)
        self.assertEqual(reasons_map["animal_sick"], 1)
        self.assertEqual(reasons_map["accident"], 0)
        # Unique sessions
        self.assertEqual(r_filter.data["unique_sessions_per_day"][0]["count"], 2)




class Phase0AuthTests(APITestCase):
    """Guests keep the public features; everything else needs the right role."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed", verbosity=0)

    def setUp(self):
        cache.clear()

    def test_public_endpoints_work_for_guests(self):
        for url in ["/api/facilities/", "/api/nearest/?lat=13&lng=76", "/api/camps/", "/api/ambulances/", "/api/facilities/2/"]:
            self.assertEqual(self.client.get(url).status_code, 200, url)
        self.assertEqual(self.client.post("/api/sos/", {"lat": 13, "lng": 76.1}, format="json").status_code, 201)
        self.assertEqual(self.client.post("/api/events/", {"session_id": "x", "event": "app_open"}, format="json").status_code, 204)

    def test_protected_endpoints_reject_guests(self):
        self.assertEqual(self.client.get("/api/sos/").status_code, 401)
        self.assertEqual(self.client.get("/api/dashboard/").status_code, 401)
        self.assertEqual(self.client.get("/api/usage/").status_code, 401)
        self.assertEqual(self.client.post("/api/camps/", {"title": "x"}, format="json").status_code, 401)
        self.assertEqual(self.client.post("/api/ambulances/1/location/", {"lat": 1, "lng": 1}, format="json").status_code, 401)
        self.assertEqual(self.client.get("/api/admin/doctors/").status_code, 401)

    def test_patient_cannot_use_admin_endpoints(self):
        c = APIClient()
        c.force_authenticate(User.objects.get(phone="9000000201"))
        self.assertEqual(c.get("/api/dashboard/").status_code, 403)
        self.assertEqual(c.get("/api/sos/").status_code, 403)
        self.assertEqual(c.get("/api/admin/doctors/").status_code, 403)

    def test_admin_login_and_wrong_password(self):
        r = self.client.post("/api/auth/admin-login/", {"phone": "9000000000", "password": "Admin@12345"}, format="json")
        self.assertEqual(r.status_code, 200)
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION="Bearer " + r.data["access"])
        self.assertEqual(c.get("/api/dashboard/").status_code, 200)
        bad = self.client.post("/api/auth/admin-login/", {"phone": "9000000000", "password": "nope"}, format="json")
        self.assertEqual(bad.status_code, 401)

    def test_admin_login_refuses_non_admin_role(self):
        u = User.objects.get(phone="9000000201")
        u.set_password("Secret@123")
        u.save()
        r = self.client.post("/api/auth/admin-login/", {"phone": "9000000201", "password": "Secret@123"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_sos_patch_needs_owner_token_or_admin(self):
        r = self.client.post("/api/sos/", {"lat": 13, "lng": 76.1}, format="json")
        sid = r.data["id"]
        self.assertEqual(self.client.patch(f"/api/sos/{sid}/", {"status": "resolved"}, format="json").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/sos/{sid}/", {"status": "resolved"}, format="json",
                                           HTTP_X_SOS_TOKEN="wrong").status_code, 404)
        ok = self.client.patch(f"/api/sos/{sid}/", {"status": "resolved"}, format="json", HTTP_X_SOS_TOKEN=r.data["owner_token"])
        self.assertEqual(ok.status_code, 200)

    def test_public_sos_payload_has_no_secrets(self):
        r = self.client.post("/api/sos/", {"lat": 13, "lng": 76.1}, format="json")
        sid = r.data["id"]
        got = self.client.get(f"/api/sos/{sid}/", HTTP_X_SOS_TOKEN=r.data["owner_token"])
        self.assertNotIn("owner_token", got.data)
        self.assertNotIn("session_id", got.data)

    def test_logout_blacklists_refresh(self):
        r = self.client.post("/api/auth/admin-login/", {"phone": "9000000000", "password": "Admin@12345"}, format="json")
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION="Bearer " + r.data["access"])
        self.assertEqual(c.post("/api/auth/logout/", {"refresh": r.data["refresh"]}, format="json").status_code, 204)
        again = self.client.post("/api/auth/refresh/", {"refresh": r.data["refresh"]}, format="json")
        self.assertEqual(again.status_code, 401)
