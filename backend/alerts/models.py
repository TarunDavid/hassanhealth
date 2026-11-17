from django.db import models


class SmsOutbox(models.Model):
    to_phone = models.CharField(max_length=15, db_index=True)
    template = models.CharField(max_length=30)
    body = models.TextField()
    status = models.CharField(max_length=12, default="queued")  # queued/sent/delivered/failed
    provider_id = models.CharField(max_length=60, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True)


class SosAlert(models.Model):
    QUEUED, SENT, DELIVERED, FAILED, ACKED, DECLINED, CANCELLED = (
        "queued", "sent", "delivered", "failed", "acked", "declined", "cancelled")
    sos = models.ForeignKey("health.SOSRequest", on_delete=models.CASCADE, related_name="alerts")
    doctor = models.ForeignKey("accounts.DoctorProfile", on_delete=models.CASCADE, related_name="alerts")
    token = models.CharField(max_length=40, unique=True)
    order = models.IntegerField(default=0)
    status = models.CharField(max_length=12, default=QUEUED)
    sent_at = models.DateTimeField(null=True, blank=True)
    acked_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["order"]


class SosTrackPoint(models.Model):
    sos = models.ForeignKey("health.SOSRequest", on_delete=models.CASCADE, related_name="track_points")
    lat = models.FloatField()
    lng = models.FloatField()
    at = models.DateTimeField(auto_now_add=True)
