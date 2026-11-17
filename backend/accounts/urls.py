from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views as v

urlpatterns = [
    path("auth/register/", v.register), path("auth/login/", v.login),
    path("auth/admin-login/", v.admin_login), path("auth/logout/", v.logout),
    path("auth/refresh/", TokenRefreshView.as_view()),
    path("me/", v.me), path("me/consent/", v.consent),
    path("doctors/register/", v.doctor_register), path("doctors/directory/", v.doctor_directory),
    path("doctors/<int:pk>/call/", v.doctor_call), path("doctors/me/duty/", v.doctor_duty),
    path("facilities-signup/", v.facilities_for_signup),
    path("admin/doctors/", v.admin_doctors),
    path("admin/doctors/<int:pk>/<str:action>/", v.admin_doctor_decide),
]
