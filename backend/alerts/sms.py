"""Pluggable SMS sending. The default backend only writes to the SmsOutbox table (shown in the
Doctor inbox screen) so the whole flow can be demonstrated without a paid provider.
To send real SMS, add a backend class with a send(phone, body) method and set SMS_BACKEND."""
import logging
import re

from django.conf import settings
from django.utils import timezone
from django.utils.module_loading import import_string

from .models import SmsOutbox

log = logging.getLogger("alerts")


class ConsoleSmsBackend:
    def send(self, phone: str, body: str) -> str:
        return "console"


def _mask(phone: str) -> str:
    return "*" * (len(phone) - 2) + phone[-2:]


def send_sms(phone: str, template: str, body: str) -> SmsOutbox:
    """Never raises. A failed SMS must never block an SOS."""
    stored = re.sub(r"\d{6}", "******", body) if template == "otp" else body
    row = SmsOutbox.objects.create(to_phone=phone, template=template, body=stored)
    try:
        pid = import_string(settings.SMS_BACKEND)().send(phone, body)
        row.status, row.provider_id, row.sent_at = "sent", str(pid)[:60], timezone.now()
    except Exception as e:  # noqa: BLE001 - deliberately broad
        row.status = "failed"
        log.warning("sms failed template=%s to=%s err=%s", template, _mask(phone), type(e).__name__)
    row.save()
    return row
