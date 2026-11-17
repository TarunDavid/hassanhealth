from django.urls import path
from . import views as v

urlpatterns = [
    path("facilities/", v.facilities), path("facilities/<int:pk>/", v.facility_detail),
    path("nearest/", v.nearest), path("sos/", v.sos), path("sos/<int:pk>/", v.sos_update), path("sos/<int:pk>/location/", v.sos_location),
    path("ambulances/", v.ambulances), path("ambulances/<int:pk>/location/", v.ambulance_location),
    path("camps/", v.camps), path("camps/<int:pk>/", v.camp_detail), path("dashboard/", v.dashboard),
    path("events/", v.events), path("usage/", v.usage),
]
