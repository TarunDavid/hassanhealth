from django.urls import path
from . import views as v

urlpatterns = [
    path("me/medical/", v.my_medical),
    path("me/records/", v.my_records), path("me/records/<int:pk>/", v.my_record),
    path("me/records/<int:pk>/download/", v.my_record),
    path("me/access/", v.my_access), path("me/access/<int:pk>/", v.my_access_revoke),
    path("me/access-log/", v.my_access_log),
    path("doctor/patients/", v.doctor_patients),
    path("doctor/patients/<int:pid>/medical/", v.doctor_patient_medical),
    path("doctor/patients/<int:pid>/records/", v.doctor_patient_records),
    path("doctor/patients/<int:pid>/records/<int:rid>/download/", v.doctor_patient_download),
]
