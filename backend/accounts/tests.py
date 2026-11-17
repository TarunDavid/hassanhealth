from datetime import date, timedelta

from django.core.cache import cache
from django.core.management import call_command
from rest_framework.test import APIClient, APITestCase

from health.models import Facility
from .models import DoctorProfile, OtpCode, User


def login(client, phone, role="patient"):
    """Sign in (or register on first use). Demo accounts use the seed password. Returns (authed client, payload)."""
    r = client.post("/api/auth/login/", {"phone": phone, "password": "Demo@12345"}, format="json")
    if r.status_code == 401:
        r = client.post("/api/auth/register/", {"phone": phone, "password": "Demo@12345", "role": role}, format="json")
    assert r.status_code in (200, 201), r.data
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION="Bearer " + r.data["access"])
    return c, r.data


class AuthTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", verbosity=0)

    def setUp(self):
        cache.clear()

    def reg(self, phone, password="secret1", role="patient"):
        return self.client.post("/api/auth/register/", {"phone": phone, "password": password, "role": role}, format="json")

    def test_register_patient_without_any_code(self):
        r = self.reg("9111111111")
        self.assertEqual(r.status_code, 201)
        self.assertNotIn("dev_otp", r.data)
        self.assertEqual(r.data["user"]["role"], "patient")
        self.assertTrue(r.data["user"]["consent_required"])
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION="Bearer " + r.data["access"])
        p = c.patch("/api/me/", {"full_name": "Asha K", "dob": "1990-01-01", "taluk": "Hassan", "language": "kn"}, format="json")
        self.assertEqual(p.status_code, 200)
        self.assertEqual(p.data["profile"]["full_name"], "Asha K")

    def test_register_doctor_then_login_again(self):
        self.assertEqual(self.reg("9111111112", role="doctor").status_code, 201)
        r = self.client.post("/api/auth/login/", {"phone": "9111111112", "password": "secret1"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["user"]["role"], "doctor")

    def test_cannot_register_admin_or_reuse_phone(self):
        self.assertEqual(self.reg("9111111113", role="admin").status_code, 400)
        self.assertEqual(self.reg("9000000101").status_code, 409)

    def test_wrong_password_and_unknown_number_look_the_same(self):
        a = self.client.post("/api/auth/login/", {"phone": "9000000101", "password": "nope"}, format="json")
        b = self.client.post("/api/auth/login/", {"phone": "9888888888", "password": "nope"}, format="json")
        self.assertEqual((a.status_code, b.status_code), (401, 401))
        self.assertEqual(a.data, b.data)

    def test_admin_cannot_use_the_public_login(self):
        r = self.client.post("/api/auth/login/", {"phone": "9000000000", "password": "Admin@12345"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_invalid_phone_and_short_password_rejected(self):
        for bad in ["123", "abcdefghij", "5123456789", ""]:
            self.assertEqual(self.reg(bad).status_code, 400)
        self.assertEqual(self.reg("9111111114", password="123").status_code, 400)

    def test_login_is_rate_limited(self):
        codes = [self.client.post("/api/auth/login/", {"phone": "9000000101", "password": "bad"}, format="json").status_code for _ in range(12)]
        self.assertIn(429, codes)
        good = self.client.post("/api/auth/login/", {"phone": "9000000101", "password": "Demo@12345"}, format="json")
        self.assertEqual(good.status_code, 429)  # still locked for this phone and address

    def test_password_is_hashed(self):
        self.reg("9111111115", password="mypassword")
        self.assertNotIn("mypassword", User.objects.get(phone="9111111115").password)

    def test_otp_routes_are_gone(self):
        self.assertEqual(self.client.post("/api/auth/otp/request/", {"phone": "9111111116"}, format="json").status_code, 404)


class DoctorCallTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", verbosity=0)

    def setUp(self):
        cache.clear()
        self.pc, _ = login(self.client, "9000000201")
        self.rao = DoctorProfile.objects.get(user__phone="9000000102")

    def test_directory_lists_approved_doctors_only_and_needs_patient_login(self):
        self.assertEqual(APIClient().get("/api/doctors/directory/").status_code, 401)
        rows = self.pc.get("/api/doctors/directory/").data
        names = [r["full_name"] for r in rows]
        self.assertIn("Demo Rao", names)
        self.assertNotIn("Demo Pending", names)
        self.assertNotIn("phone", rows[0])  # numbers are only given out when Call is pressed
        dc, _ = login(self.client, "9000000101", role="doctor")
        self.assertEqual(dc.get("/api/doctors/directory/").status_code, 403)

    def test_newly_registered_doctor_is_listed_once_approved(self):
        c, _ = login(self.client, "9333333301", role="doctor")
        fac = self.rao.facility_id
        r = c.post("/api/doctors/register/", {"full_name": "Dr Meera Nair", "council": "KMC", "registration_no": "K1", "facility_id": fac}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertNotIn("Meera Nair", [d["full_name"] for d in self.pc.get("/api/doctors/directory/").data])
        DoctorProfile.objects.filter(user__phone="9333333301").update(approval_status="approved")
        rows = self.pc.get("/api/doctors/directory/").data
        mine = [d for d in rows if d["full_name"] == "Meera Nair"]
        self.assertEqual(len(mine), 1)
        self.assertTrue(mine[0]["on_duty"])

    def test_call_returns_number_and_notifies_doctor(self):
        from alerts.models import SmsOutbox
        r = self.pc.post(f"/api/doctors/{self.rao.id}/call/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["tel"], "+919000000102")
        self.assertTrue(SmsOutbox.objects.filter(to_phone="9000000102", template="call_request").exists())

    def test_cannot_call_off_duty_pending_or_without_login(self):
        DoctorProfile.objects.filter(pk=self.rao.pk).update(on_duty=False)
        self.assertEqual(self.pc.post(f"/api/doctors/{self.rao.id}/call/").status_code, 409)
        pend = DoctorProfile.objects.get(user__phone="9000000104")
        self.assertEqual(self.pc.post(f"/api/doctors/{pend.id}/call/").status_code, 404)
        self.assertEqual(APIClient().post(f"/api/doctors/{self.rao.id}/call/").status_code, 401)

    def test_call_rate_limited(self):
        codes = [self.pc.post(f"/api/doctors/{self.rao.id}/call/").status_code for _ in range(12)]
        self.assertIn(429, codes)


class ProfileTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", verbosity=0)

    def setUp(self):
        cache.clear()

    def test_minor_needs_guardian_phone(self):
        c, _ = login(self.client, "9888888881")
        young = (date.today() - timedelta(days=365 * 10)).isoformat()
        r = c.patch("/api/me/", {"full_name": "Kid", "dob": young}, format="json")
        self.assertEqual(r.status_code, 400)
        r = c.patch("/api/me/", {"full_name": "Kid", "dob": young, "guardian_phone": "9888888882"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_future_dob_and_bad_contact_rejected(self):
        c, _ = login(self.client, "9888888883")
        future = (date.today() + timedelta(days=5)).isoformat()
        self.assertEqual(c.patch("/api/me/", {"full_name": "X", "dob": future}, format="json").status_code, 400)
        self.assertEqual(c.patch("/api/me/", {"full_name": "X", "emergency_contact_phone": "12"}, format="json").status_code, 400)

    def test_consent_flow(self):
        c, data = login(self.client, "9888888884")
        self.assertTrue(data["user"]["consent_required"])
        self.assertEqual(c.post("/api/me/consent/", {}, format="json").status_code, 400)
        r = c.post("/api/me/consent/", {"agree": True}, format="json")
        self.assertFalse(r.data["consent_required"])

    def test_doctor_registration_pending_then_approved(self):
        c, _ = login(self.client, "9999990001", role="doctor")
        fac = Facility.objects.filter(type="chc").first()
        r = c.post("/api/doctors/register/", {"full_name": "Dr Test", "council": "KMC", "registration_no": "KMC-1",
                                              "specialty": "general", "facility_id": fac.id}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["profile"]["approval_status"], "pending")
        # pending doctors cannot go on duty, see inbox, or open patient data
        self.assertEqual(c.patch("/api/doctors/me/duty/", {"on_duty": True}, format="json").status_code, 403)
        self.assertEqual(c.get("/api/doctors/inbox/").status_code, 403)
        admin = APIClient()
        admin.force_authenticate(User.objects.get(phone="9000000000"))
        pend = admin.get("/api/admin/doctors/?status=pending")
        self.assertTrue(any(d["registration_no"] == "KMC-1" for d in pend.data))
        did = DoctorProfile.objects.get(registration_no="KMC-1").id
        self.assertEqual(admin.post(f"/api/admin/doctors/{did}/approve/").status_code, 200)
        duty = c.patch("/api/doctors/me/duty/", {"on_duty": True}, format="json")
        self.assertEqual(duty.status_code, 200)
        self.assertTrue(duty.data["on_duty"])

    def test_rejected_doctor_loses_duty_and_can_reapply(self):
        d = DoctorProfile.objects.get(user__phone="9000000102")
        admin = APIClient()
        admin.force_authenticate(User.objects.get(phone="9000000000"))
        admin.post(f"/api/admin/doctors/{d.id}/reject/")
        d.refresh_from_db()
        self.assertEqual(d.approval_status, "rejected")
        self.assertFalse(d.on_duty)
        c = APIClient()
        c.force_authenticate(d.user)
        r = c.post("/api/doctors/register/", {"full_name": d.full_name, "council": "KMC", "registration_no": "NEW-1",
                                              "facility_id": d.facility_id}, format="json")
        self.assertEqual(r.data["profile"]["approval_status"], "pending")

    def test_doctor_register_requires_all_fields_and_role(self):
        c, _ = login(self.client, "9999990002", role="doctor")
        self.assertEqual(c.post("/api/doctors/register/", {"full_name": "x"}, format="json").status_code, 400)
        p, _ = login(self.client, "9999990003", role="patient")
        self.assertEqual(p.post("/api/doctors/register/", {"full_name": "x"}, format="json").status_code, 403)

    def test_only_admin_decides_doctors(self):
        c, _ = login(self.client, "9999990004", role="patient")
        did = DoctorProfile.objects.first().id
        self.assertEqual(c.post(f"/api/admin/doctors/{did}/approve/").status_code, 403)
        doc = APIClient()
        doc.force_authenticate(User.objects.get(phone="9000000101"))
        self.assertEqual(doc.post(f"/api/admin/doctors/{did}/approve/").status_code, 403)

    def test_signup_facility_list_is_public(self):
        self.assertEqual(self.client.get("/api/facilities-signup/").status_code, 200)

    def test_delete_my_account_removes_profile_and_files(self):
        c, _ = login(self.client, "9999990005", role="patient")
        c.patch("/api/me/", {"full_name": "Temp User", "dob": "1990-01-01"}, format="json")
        self.assertEqual(c.delete("/api/me/").status_code, 204)
        self.assertFalse(User.objects.filter(phone="9999990005").exists())

    def test_admin_cannot_delete_via_me(self):
        admin = APIClient()
        admin.force_authenticate(User.objects.get(phone="9000000000"))
        self.assertEqual(admin.delete("/api/me/").status_code, 403)
