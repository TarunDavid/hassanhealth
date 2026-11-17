import hashlib
import io
from datetime import timedelta

from django.conf import settings
from django.contrib import admin as dj_admin
from django.core.cache import cache
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import DoctorProfile, User
from accounts.tests import login
from alerts.models import SmsOutbox
from health.models import SOSRequest
from .models import AccessGrant, MedicalRecord, RecordAccessLog
from . import services as sv

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nSECRET-REPORT-CONTENT"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def up(c, data=PDF, name="r.pdf", title="Blood test", rtype="report"):
    f = io.BytesIO(data)
    f.name = name
    return c.post("/api/me/records/", {"file": f, "title": title, "record_type": rtype}, format="multipart")


class RecordsBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", verbosity=0)

    def setUp(self):
        cache.clear()
        SmsOutbox.objects.all().delete()
        self.owner, _ = login(self.client, "9444444441")
        self.owner.post("/api/me/consent/", {"agree": True}, format="json")
        self.owner.patch("/api/me/", {"full_name": "Owner One", "dob": "1990-01-01", "taluk": "Hassan"}, format="json")
        self.owner_id = User.objects.get(phone="9444444441").id
        self.other, _ = login(self.client, "9444444442")
        self.other.patch("/api/me/", {"full_name": "Other Two", "dob": "1991-01-01", "taluk": "Hassan"}, format="json")
        r = up(self.owner)
        assert r.status_code == 201, r.data
        self.rid = r.data["id"]
        self.owner.put("/api/me/medical/", {"chronic": ["Diabetes"], "allergies": "Penicillin"}, format="json")


class RoundTripTests(RecordsBase):
    def test_upload_download_checksum(self):
        r = self.owner.get(f"/api/me/records/{self.rid}/download/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(hashlib.sha256(r.content).hexdigest(), hashlib.sha256(PDF).hexdigest())
        self.assertEqual(r["Cache-Control"], "no-store")

    def test_file_on_disk_is_ciphertext(self):
        rec = MedicalRecord.objects.get(pk=self.rid)
        raw = sv.store_path(rec.storage_name).read_bytes()
        self.assertNotIn(b"SECRET-REPORT-CONTENT", raw)
        self.assertFalse(raw.startswith(b"%PDF"))

    def test_conditions_stored_encrypted_in_db(self):
        from .models import MedicalCondition
        c = MedicalCondition.objects.get(patient_id=self.owner_id)
        self.assertNotIn("Penicillin", c.data_enc)
        self.assertNotIn("Diabetes", c.data_enc)
        self.assertEqual(self.owner.get("/api/me/medical/").data["allergies"], "Penicillin")

    def test_delete_removes_file_from_disk(self):
        rec = MedicalRecord.objects.get(pk=self.rid)
        p = sv.store_path(rec.storage_name)
        self.assertTrue(p.exists())
        self.assertEqual(self.owner.delete(f"/api/me/records/{self.rid}/").status_code, 204)
        self.assertFalse(p.exists())

    def test_delete_account_removes_everything(self):
        rec = MedicalRecord.objects.get(pk=self.rid)
        p = sv.store_path(rec.storage_name)
        self.assertEqual(self.owner.delete("/api/me/").status_code, 204)
        self.assertFalse(p.exists())
        self.assertFalse(MedicalRecord.objects.filter(patient_id=self.owner_id).exists())
        self.assertFalse(User.objects.filter(pk=self.owner_id).exists())

    def test_storage_is_not_served_over_http(self):
        rec = MedicalRecord.objects.get(pk=self.rid)
        for url in (f"/records_store/{rec.storage_name}", f"/media/{rec.storage_name}", f"/static/{rec.storage_name}",
                    f"/{rec.storage_name}"):
            self.assertEqual(APIClient().get(url).status_code, 404)
        self.assertFalse(str(settings.RECORDS_ROOT).startswith(str(settings.BASE_DIR / "static")))


class UploadValidationTests(RecordsBase):
    def test_renamed_exe_rejected(self):
        self.assertEqual(up(self.owner, data=b"MZ\x90\x00" + b"\x00" * 100, name="evil.pdf").status_code, 415)

    def test_png_accepted_and_text_rejected(self):
        self.assertEqual(up(self.owner, data=PNG, name="a.png").status_code, 201)
        self.assertEqual(up(self.owner, data=b"hello world", name="a.pdf").status_code, 415)

    def test_empty_and_oversize(self):
        self.assertEqual(up(self.owner, data=b"", name="e.pdf").status_code, 400)
        big = b"%PDF-" + b"0" * (settings.RECORDS_MAX_BYTES + 10)
        self.assertEqual(up(self.owner, data=big).status_code, 413)

    def test_31st_file_rejected(self):
        with self.settings(RECORDS_MAX_FILES=3):
            up(self.owner)
            up(self.owner)
            self.assertEqual(up(self.owner).status_code, 400)

    def test_upload_rate_limit(self):
        codes = [up(self.owner, title=f"t{i}").status_code for i in range(25)]
        self.assertIn(429, codes)


class PermissionMatrixTests(RecordsBase):
    def routes(self, pid, rid):
        return [f"/api/doctor/patients/{pid}/medical/", f"/api/doctor/patients/{pid}/records/",
                f"/api/doctor/patients/{pid}/records/{rid}/download/"]

    def assert_all_404(self, client, label):
        for url in self.routes(self.owner_id, self.rid):
            self.assertEqual(client.get(url).status_code, 404, f"{label} {url}")

    def test_guest_gets_404_everywhere(self):
        g = APIClient()
        self.assert_all_404(g, "guest")
        for url in ("/api/me/medical/", "/api/me/records/", f"/api/me/records/{self.rid}/download/",
                    "/api/me/access/", "/api/me/access-log/", "/api/doctor/patients/"):
            self.assertEqual(g.get(url).status_code, 404, url)

    def test_other_patient_cannot_read(self):
        self.assert_all_404(self.other, "other patient")
        self.assertEqual(self.other.get(f"/api/me/records/{self.rid}/download/").status_code, 404)
        self.assertEqual(self.other.delete(f"/api/me/records/{self.rid}/").status_code, 404)
        self.assertEqual(self.other.get("/api/me/records/").data, [])

    def test_doctor_without_grant_and_pending_doctor(self):
        dc, _ = login(self.client, "9000000101", role="doctor")
        self.assert_all_404(dc, "doctor without grant")
        pend, _ = login(self.client, "9000000104", role="doctor")
        AccessGrant.objects.create(patient_id=self.owner_id, doctor=User.objects.get(phone="9000000104"), status="active")
        self.assert_all_404(pend, "pending doctor even with a grant")

    def test_admin_and_superuser_get_404_on_all_routes(self):
        adm = APIClient()
        r = adm.post("/api/auth/admin-login/", {"phone": "9000000000", "password": "Admin@12345"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        adm.credentials(HTTP_AUTHORIZATION="Bearer " + r.data["access"])
        self.assert_all_404(adm, "admin")
        for url in ("/api/me/medical/", "/api/me/records/", f"/api/me/records/{self.rid}/download/", "/api/me/access-log/",
                    "/api/doctor/patients/"):
            self.assertEqual(adm.get(url).status_code, 404, f"admin {url}")
        su = User.objects.create_superuser(phone="9555555555", password="Super@12345")
        su.role = "admin"
        su.save()
        sc = APIClient()
        sc.force_authenticate(su)
        self.assert_all_404(sc, "superuser")
        su.role = "doctor"
        su.save()
        self.assert_all_404(sc, "superuser with doctor role but no profile")

    def test_django_admin_lists_no_medical_models(self):
        names = {m.__name__ for m in dj_admin.site._registry}
        for n in ("MedicalRecord", "MedicalCondition", "AccessGrant", "RecordAccessLog"):
            self.assertNotIn(n, names)
        self.assertFalse(any(m._meta.app_label == "records" for m in dj_admin.site._registry))

    def test_grant_allows_then_revoke_blocks(self):
        dc, _ = login(self.client, "9000000101", role="doctor")
        r = self.owner.post("/api/me/access/", {"doctor_phone": "9000000101", "duration": "forever"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        gid = r.data[0]["id"]
        for url in self.routes(self.owner_id, self.rid):
            self.assertEqual(dc.get(url).status_code, 200, url)
        self.assertEqual(dc.get(self.routes(self.owner_id, self.rid)[0]).data["conditions"]["allergies"], "Penicillin")
        self.assertEqual(self.owner.delete(f"/api/me/access/{gid}/").status_code, 204)
        self.assert_all_404(dc, "revoked doctor")

    def test_grant_expiry(self):
        dc, _ = login(self.client, "9000000101", role="doctor")
        self.owner.post("/api/me/access/", {"doctor_phone": "9000000101", "duration": "30d"}, format="json")
        AccessGrant.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assert_all_404(dc, "expired grant")

    def test_grant_needs_approved_doctor(self):
        for phone in ("9000000104", "9999999999"):
            self.assertEqual(self.owner.post("/api/me/access/", {"doctor_phone": phone, "duration": "forever"}, format="json").status_code, 404)

    def test_access_is_logged_and_visible_to_owner(self):
        dc, _ = login(self.client, "9000000101", role="doctor")
        self.owner.post("/api/me/access/", {"doctor_phone": "9000000101", "duration": "forever"}, format="json")
        dc.get(f"/api/doctor/patients/{self.owner_id}/records/{self.rid}/download/")
        rows = self.owner.get("/api/me/access-log/").data
        self.assertTrue(any(r["action"] == "download" and r["who"].startswith("Dr ") for r in rows))


class EmergencyAccessTests(RecordsBase):
    def setUp(self):
        super().setUp()
        self.owner.patch("/api/me/", {"allow_emergency_access": True}, format="json")
        DoctorProfile.objects.update(on_duty=True, sms_enabled=True)
        self.dc, _ = login(self.client, "9000000101", role="doctor")
        r = self.owner.post("/api/sos/", {"lat": 13.0, "lng": 76.1, "kind": "human"}, format="json")
        self.sos = SOSRequest.objects.get(pk=r.data["id"])
        self.url = f"/api/doctor/patients/{self.owner_id}/records/{self.rid}/download/"

    def accept(self):
        self.sos.doctor_ack_by = User.objects.get(phone="9000000101")
        self.sos.doctor_ack_at = timezone.now()
        self.sos.save()

    def test_alerted_but_not_acknowledged_has_no_access(self):
        self.assertEqual(self.dc.get(self.url).status_code, 404)

    def test_acknowledged_doctor_gets_access_and_patient_is_notified(self):
        self.accept()
        self.assertEqual(self.dc.get(self.url).status_code, 200)
        self.assertEqual(SmsOutbox.objects.filter(template="emergency_access_notice", to_phone="9444444441").count(), 1)
        self.dc.get(self.url)  # second access in the same emergency: no second SMS
        self.assertEqual(SmsOutbox.objects.filter(template="emergency_access_notice").count(), 1)
        self.assertTrue(RecordAccessLog.objects.filter(patient_id=self.owner_id, reason="emergency").exists())

    def test_patient_can_turn_emergency_access_off(self):
        self.accept()
        self.owner.patch("/api/me/", {"allow_emergency_access": False}, format="json")
        self.assertEqual(self.dc.get(self.url).status_code, 404)

    def test_access_ends_six_hours_after_close(self):
        self.accept()
        SOSRequest.objects.filter(pk=self.sos.pk).update(status="resolved", closed_at=timezone.now() - timedelta(hours=7))
        self.assertEqual(self.dc.get(self.url).status_code, 404)

    def test_another_doctor_cannot_use_this_emergency(self):
        self.accept()
        other, _ = login(self.client, "9000000102", role="doctor")
        self.assertEqual(other.get(self.url).status_code, 404)
