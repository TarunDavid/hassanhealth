# These models are deliberately NOT registered in Django admin and have no admin API route.
from django.conf import settings
from django.db import models


class MedicalCondition(models.Model):
    patient = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="condition")
    data_enc = models.TextField()  # encrypted JSON: conditions, allergies, medicines, surgeries, pregnancy, notes
    updated_at = models.DateTimeField(auto_now=True)


class MedicalRecord(models.Model):
    TYPES = ["report", "prescription", "scan", "discharge", "vaccination", "other"]
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="records")
    title = models.CharField(max_length=100)
    record_type = models.CharField(max_length=20, default="other")
    record_date = models.DateField(null=True, blank=True)
    source_name = models.CharField(max_length=100, blank=True)
    storage_name = models.CharField(max_length=40, unique=True)
    size_bytes = models.IntegerField()
    mime_type = models.CharField(max_length=40)
    sha256 = models.CharField(max_length=64)
    file_key_enc = models.TextField()
    scan_status = models.CharField(max_length=12, default="clean")
    uploaded_at = models.DateTimeField(auto_now_add=True)


class AccessGrant(models.Model):
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="grants_given")
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="grants_received")
    status = models.CharField(max_length=10, default="active")  # active / revoked
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)


class RecordAccessLog(models.Model):
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="access_logs")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    action = models.CharField(max_length=12)  # view/download/upload/delete/grant/revoke
    record = models.ForeignKey(MedicalRecord, null=True, blank=True, on_delete=models.SET_NULL)
    detail = models.CharField(max_length=100, blank=True)  # record title or doctor name, never contents
    reason = models.CharField(max_length=12)  # self / granted / emergency
    at = models.DateTimeField(auto_now_add=True, db_index=True)
    ip_trunc = models.CharField(max_length=20, blank=True)
