from django.contrib import admin
from .models import Station, Line, LineStop, Schedule

admin.site.register(Station)
admin.site.register(Line)
admin.site.register(LineStop)
admin.site.register(Schedule)
