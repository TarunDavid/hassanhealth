from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_active and u.role == "admin")


class IsApprovedDoctor(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated and u.is_active and u.role == "doctor"):
            return False
        d = getattr(u, "doctor", None)
        return bool(d and d.approval_status == "approved")


class IsPatientRole(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_active and u.role == "patient" and hasattr(u, "patient"))
