from django.urls import path
from . import views as v

urlpatterns = [
    path("track/<str:token>/", v.track), path("respond/<str:token>/", v.respond),
    path("doctors/inbox/", v.inbox),
]
