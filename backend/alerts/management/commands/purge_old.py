"""Retention: SMS bodies 30 days, OTP codes 1 day, SOS location trails 7 days after the SOS closed.
Run daily (cron). Safe to run repeatedly."""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import OtpCode
from alerts.models import SmsOutbox, SosTrackPoint


class Command(BaseCommand):
    help = "Delete old SMS bodies, OTP codes and location trails"

    def handle(self, *a, **o):
        now = timezone.now()
        s = SmsOutbox.objects.filter(created_at__lt=now - timedelta(days=30)).delete()[0]
        c = OtpCode.objects.filter(created_at__lt=now - timedelta(days=1)).delete()[0]
        t = SosTrackPoint.objects.filter(sos__closed_at__lt=now - timedelta(days=7)).delete()[0]
        self.stdout.write(f"purged sms={s} otp={c} trail_points={t}")
