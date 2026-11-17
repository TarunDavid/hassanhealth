from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, phone, password=None, **extra):
        if not phone:
            raise ValueError("phone required")
        extra.setdefault("role", User.PATIENT)
        user = self.model(phone=phone, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra):
        extra.update(role=User.ADMIN, is_staff=True, is_superuser=True)
        return self.create_user(phone, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    PATIENT, DOCTOR, ADMIN = "patient", "doctor", "admin"
    ROLES = [(PATIENT, "Patient"), (DOCTOR, "Doctor"), (ADMIN, "Admin")]

    phone = models.CharField(max_length=15, unique=True)
    role = models.CharField(max_length=10, choices=ROLES, default=PATIENT)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)  # Django admin site only. Never grants data access.
    created_at = models.DateTimeField(default=timezone.now)
    consent_at = models.DateTimeField(null=True, blank=True)
    consent_version = models.CharField(max_length=10, blank=True)

    USERNAME_FIELD = "phone"
    objects = UserManager()

    def __str__(self):
        return f"{self.role}:{mask_phone(self.phone)}"


def mask_phone(p: str) -> str:
    return ("*" * max(len(p) - 2, 0)) + p[-2:] if p else ""


class PatientProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="patient")
    full_name = models.CharField(max_length=80)
    dob = models.DateField(null=True, blank=True)
    sex = models.CharField(max_length=10, blank=True)
    blood_group = models.CharField(max_length=4, blank=True)
    taluk = models.CharField(max_length=60, blank=True)
    language = models.CharField(max_length=2, default="kn")
    guardian_phone = models.CharField(max_length=15, blank=True)
    emergency_contact_name = models.CharField(max_length=80, blank=True)
    emergency_contact_phone = models.CharField(max_length=15, blank=True)
    share_with_contact = models.BooleanField(default=False)
    allow_emergency_access = models.BooleanField(default=True)  # break-glass for the responding doctor

    @property
    def age(self):
        if not self.dob:
            return None
        t = timezone.now().date()
        return t.year - self.dob.year - ((t.month, t.day) < (self.dob.month, self.dob.day))


class DoctorProfile(models.Model):
    PENDING, APPROVED, REJECTED = "pending", "approved", "rejected"
    STATUS = [(PENDING, "Pending"), (APPROVED, "Approved"), (REJECTED, "Rejected")]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="doctor")
    full_name = models.CharField(max_length=80)
    council = models.CharField(max_length=60)
    registration_no = models.CharField(max_length=40)
    specialty = models.CharField(max_length=40, default="general")
    facility = models.ForeignKey("health.Facility", on_delete=models.PROTECT, related_name="doctors")
    on_duty = models.BooleanField(default=False)
    sms_enabled = models.BooleanField(default=True)
    shift_note = models.CharField(max_length=100, blank=True)
    approval_status = models.CharField(max_length=10, choices=STATUS, default=PENDING)
    approved_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    approved_at = models.DateTimeField(null=True, blank=True)


class OtpCode(models.Model):
    phone = models.CharField(max_length=15, db_index=True)
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.IntegerField(default=0)
    used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
