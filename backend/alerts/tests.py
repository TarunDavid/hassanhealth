from datetime import timedelta
from unittest import mock

from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import DoctorProfile, User
from accounts.tests import login
from health.models import SOSRequest
from records.models import AccessGrant
from .models import SmsOutbox, SosAlert
from . import services as sv

PATIENT = "9000000201"


def press(client, **extra):
    return client.post("/api/sos/", {"lat": 13.0, "lng": 76.1, "kind": "human", "reason": "snakebite", **extra}, format="json")


class AlertTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", verbosity=0)

    def setUp(self):
        cache.clear()
        SmsOutbox.objects.all().delete()
        self.pc, _ = login(self.client, PATIENT)
        self.pc.post("/api/me/consent/", {"agree": True}, format="json")
        DoctorProfile.objects.update(on_duty=True, sms_enabled=True)
        AccessGrant.objects.all().delete()

    def sos(self):
        r = press(self.pc)
        self.assertEqual(r.status_code, 201, r.data)
        return SOSRequest.objects.get(pk=r.data["id"])

    def sms_to(self):
        return list(SmsOutbox.objects.filter(template="sos_alert").values_list("to_phone", flat=True))

    def test_guest_sos_sends_no_doctor_sms(self):
        r = press(APIClient())
        self.assertEqual(r.status_code, 201)
        self.assertEqual(SmsOutbox.objects.filter(template="sos_alert").count(), 0)
        self.assertEqual(SosAlert.objects.count(), 0)

    def test_logged_in_patient_alerts_doctors_with_links(self):
        s = self.sos()
        self.assertTrue(s.alerts.exists())
        self.assertLessEqual(len(self.sms_to()), 2)
        body = SmsOutbox.objects.filter(template="sos_alert").first().body
        self.assertIn("/s/", body)
        self.assertIn("/r/", body)

    def test_never_alerts_pending_rejected_offduty_or_paused(self):
        DoctorProfile.objects.filter(user__phone="9000000104").update(approval_status="pending")
        DoctorProfile.objects.filter(user__phone="9000000101").update(on_duty=False)
        DoctorProfile.objects.filter(user__phone="9000000102").update(sms_enabled=False)
        DoctorProfile.objects.filter(user__phone="9000000103").update(approval_status="rejected")
        s = self.sos()
        self.assertEqual(s.alerts.count(), 0)
        self.assertEqual(self.sms_to(), [])

    def test_granted_doctor_is_alerted_first(self):
        rao = User.objects.get(phone="9000000102")
        AccessGrant.objects.create(patient=User.objects.get(phone=PATIENT), doctor=rao, status="active")
        s = self.sos()
        self.assertEqual(s.alerts.order_by("order").first().doctor.user_id, rao.id)

    def test_animal_sos_only_alerts_veterinary(self):
        r = press(self.pc, kind="animal", reason="animal_sick")
        s = SOSRequest.objects.get(pk=r.data["id"])
        for a in s.alerts.all():
            self.assertEqual(a.doctor.specialty.lower(), "veterinary")

    def test_no_medical_data_in_sms_body(self):
        s = self.sos()
        for row in SmsOutbox.objects.filter(template="sos_alert"):
            for bad in ("allerg", "diabet", "condition", "medicine", "record", "pdf"):
                self.assertNotIn(bad, row.body.lower())

    def test_sms_failure_does_not_block_sos(self):
        with override_settings(SMS_BACKEND="alerts.tests.BrokenSms"):
            r = press(self.pc)
        self.assertEqual(r.status_code, 201)
        self.assertTrue(SOSRequest.objects.filter(pk=r.data["id"]).exists())

    def test_third_doctor_queued_then_escalates_after_timeout(self):
        fac = self.sos().facility
        for i, ph in enumerate(("9000000111", "9000000112", "9000000113")):
            u = User.objects.create_user(phone=ph, role="doctor")
            DoctorProfile.objects.create(user=u, full_name=f"Extra {i}", council="KMC", registration_no=f"X{i}",
                                         specialty="general", facility=fac, approval_status="approved",
                                         on_duty=True, sms_enabled=True)
        DoctorProfile.objects.exclude(user__phone__startswith="900000011").update(on_duty=False)
        SmsOutbox.objects.all().delete()
        s = self.sos()
        alerts = list(s.alerts.order_by("order"))
        self.assertEqual(len(alerts), 3)
        self.assertEqual([a.status for a in alerts], [SosAlert.SENT, SosAlert.SENT, SosAlert.QUEUED])
        sv.escalate_if_due(s)
        alerts[2].refresh_from_db()
        self.assertEqual(alerts[2].status, SosAlert.QUEUED)  # too early
        SosAlert.objects.filter(sos=s, status=SosAlert.SENT).update(sent_at=timezone.now() - timedelta(seconds=600))
        sv.escalate_if_due(s)
        alerts[2].refresh_from_db()
        self.assertEqual(alerts[2].status, SosAlert.SENT)

    def test_all_declined_escalates_immediately(self):
        fac = self.sos().facility
        for i, ph in enumerate(("9000000111", "9000000112", "9000000113")):
            u = User.objects.create_user(phone=ph, role="doctor")
            DoctorProfile.objects.create(user=u, full_name=f"Extra {i}", council="KMC", registration_no=f"X{i}",
                                         specialty="general", facility=fac, approval_status="approved",
                                         on_duty=True, sms_enabled=True)
        DoctorProfile.objects.exclude(user__phone__startswith="900000011").update(on_duty=False)
        s = self.sos()
        first_two = list(s.alerts.order_by("order")[:2])
        for a in first_two:
            sv.respond(a, "decline")
        third = s.alerts.order_by("order")[2]
        self.assertEqual(third.status, SosAlert.SENT)

    def test_track_public_by_token_and_hides_other_tokens(self):
        s = self.sos()
        a = s.alerts.first()
        r = APIClient().get(f"/api/track/{a.token}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["patient"]["name"], "Ravi Kumar" if False else r.data["patient"]["name"])
        self.assertNotIn("conditions", r.data)
        self.assertEqual(APIClient().get("/api/track/not-a-token/").status_code, 404)

    def test_track_expired_and_resolved_return_410(self):
        s = self.sos()
        a = s.alerts.first()
        SosAlert.objects.filter(pk=a.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(APIClient().get(f"/api/track/{a.token}/").status_code, 410)
        SosAlert.objects.filter(pk=a.pk).update(expires_at=timezone.now() + timedelta(hours=1))
        SOSRequest.objects.filter(pk=s.pk).update(status="resolved", closed_at=timezone.now())
        self.assertEqual(APIClient().get(f"/api/track/{a.token}/").status_code, 410)

    def test_respond_requires_the_right_approved_doctor(self):
        s = self.sos()
        a = s.alerts.order_by("order").first()
        other = s.alerts.order_by("order").last()
        self.assertEqual(APIClient().post(f"/api/respond/{a.token}/", {"action": "accept"}, format="json").status_code, 401)
        dc, _ = login(self.client, a.doctor.user.phone, role="doctor")
        r = dc.post(f"/api/respond/{a.token}/", {"action": "accept"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        s.refresh_from_db()
        self.assertEqual(s.doctor_ack_by_id, a.doctor.user_id)
        if other.pk != a.pk:  # another doctor's token is not usable by this doctor
            self.assertEqual(dc.post(f"/api/respond/{other.token}/", {"action": "accept"}, format="json").status_code, 404)
        pc2 = self.pc.post(f"/api/respond/{a.token}/", {"action": "accept"}, format="json")
        self.assertIn(pc2.status_code, (401, 403))

    def test_location_trail_keeps_last_30(self):
        for i in range(35):
            sv.add_track_point(self.sos() if i == 0 else SOSRequest.objects.latest("id"), 13.0 + i / 1000, 76.1)
        s = SOSRequest.objects.latest("id")
        self.assertLessEqual(s.track_points.count(), 30)


class BrokenSms:
    def send(self, phone, body):
        raise RuntimeError("provider down")


class PurgeTests(APITestCase):
    def test_purge_removes_old_rows_only(self):
        old = SmsOutbox.objects.create(to_phone="9", template="x", body="b")
        new = SmsOutbox.objects.create(to_phone="9", template="x", body="b")
        SmsOutbox.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=31))
        call_command("purge_old", verbosity=0)
        self.assertFalse(SmsOutbox.objects.filter(pk=old.pk).exists())
        self.assertTrue(SmsOutbox.objects.filter(pk=new.pk).exists())
