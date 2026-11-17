# Hassan Rural Health — Emergency & Resource Tracking Prototype

Mobile-first emergency app (human + animal) and a health-authority dashboard for Hassan district, Karnataka.
**All facility/staff/patient numbers are SIMULATED seed data** (see `backend/health/management/commands/seed.py`).

## Run it (two terminals)

**Terminal 1 — backend (Python 3.11+)**
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate      Mac/Linux: source .venv/bin/activate
pip install django djangorestframework django-cors-headers
python manage.py migrate
python manage.py seed          # loads 46 facilities, 13 ambulances, camps, visits, ~40 SOS, ~700 events
python manage.py runserver 0.0.0.0:8000
python manage.py test health   # 14 API tests
```

**Terminal 2 — frontend (Node 20+)**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

| URL | What |
|---|---|
| `/` | Citizen app: 1-second hold-to-dispatch SOS button, animal emergency switch, live nearest facility & accuracy, voice guidance, pure Kannada/English toggle |
| `/map` | Nearby facilities map + list (human / vet filter, live distance, ETA at 35 km/h) |
| `/doctor` | Telemedicine consultation (public demo room), voice call fallback, full hub-and-spoke referral path |
| `/camps` | Upcoming mobile health camps with real date sorting, distance, and local reminder |
| `/admin` | Authority dashboard (demo passcode `hassan123`): Overview, Facilities, Funding, Community, Live, Camps, Usage |
| `/driver` | Ambulance driver page: share real GPS or simulate a drive to the patient |

## Test on a phone (HTTPS tunnel)
Modern mobile browsers require an **HTTPS origin** to grant Geolocation permissions (GPS) and register the offline Service Worker. When opening plain LAN IP addresses (`http://192.168.x.x`), browsers block GPS and fall back to the Hassan city-centre default.

To test with real phone GPS and offline caching:
```bash
# In a separate terminal with cloudflared installed:
cloudflared tunnel --url http://localhost:5173
```
Open the printed HTTPS URL (`https://<random>.trycloudflare.com`) on your mobile browser. Allow location access to view real device coordinates and GPS accuracy.

## Demo flow (2 minutes)
1. Open `/admin` → **Live** tab on a laptop. Notice active SOS badge equals 0.
2. Open `/` on a phone or narrow browser window.
   - A quick tap shows "Keep holding" / "ಒತ್ತಿ ಹಿಡಿಯಿರಿ" warning and plays audio guidance.
   - Press and hold the big red button for 1 second until the circular progress ring completes.
   - SOS is dispatched, real ambulance assigned, and active request appears on the admin Live map.
3. Open `/driver`, pick the assigned ambulance, click **▶ Simulate Drive to Patient**.
   - The vehicle moves along the route on both the citizen tracking map and the admin Live tracker.
4. On `/admin` Live tab, click **Mark Resolved** (or click **Cancel emergency request** on the citizen tracking screen). The assigned ambulance becomes available again.
5. In `/admin` Camps tab, test **Auto-Optimize MMU Routes** to run the nearest-neighbour TSP ordering from the district hub and review total route km.

## Audio Clips (Offline Voice Guidance)
Record 64–128kbps mono MP3 clips and place them in `frontend/public/audio/kn/` for instant offline voice guidance without text-to-speech lag:

| File Name | Kannada Script Text | English Meaning |
|---|---|---|
| `sos_human.mp3` | ತುರ್ತು ಸಹಾಯಕ್ಕಾಗಿ ಒತ್ತಿ | Press for emergency help |
| `sos_animal.mp3` | ಪಶು ತುರ್ತು ಸಹಾಯಕ್ಕಾಗಿ ಒತ್ತಿ | Press for livestock emergency help |
| `sending.mp3` | ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ | Sending your location... |
| `dispatched.mp3` | ಸಹಾಯ ಬರುತ್ತಿದೆ. ಶಾಂತವಾಗಿರಿ. | Help is on the way. Stay calm. |
| `logged.mp3` | ವಿನಂತಿ ದಾಖಲಾಗಿದೆ. ಈಗಲೇ 108 ಗೆ ಕರೆ ಮಾಡಿ. | Request logged. Call 108 now. |
| `error.mp3` | ಸಂಪರ್ಕ ವಿಫಲ. 108 ಗೆ ಕರೆ ಮಾಡಿ. | Connection failed. Call 108. |
| `map_intro.mp3` | ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗಳನ್ನು ನೋಡಿ | See nearby hospitals |
| `doctor_intro.mp3` | ವೈದ್ಯರೊಂದಿಗೆ ಮಾತನಾಡಲು ಬಟನ್ ಒತ್ತಿ | Press button to talk to a doctor |
| `camps_intro.mp3` | ಮುಂಬರುವ ಆರೋಗ್ಯ ಶಿಬಿರಗಳು | Upcoming health camps |
| `hold_hint.mp3` | ಒತ್ತಿ ಹಿಡಿಯಿರಿ | Keep holding |

## Reset between demos
Each SOS uses up one free ambulance until you click **Mark resolved** in the dashboard Live tab or cancel it from the tracking screen. To reset all simulated state:
```bash
cd backend && python manage.py seed
```

## Known limits (say these in your report)
- **SOS is simulated:** The prototype logs requests and assigns simulated telematic units; it does NOT send real SMS or place automated cellular calls. Real 108 / 112 / 1962 numbers are provided as tap-to-call links.
- **Demo authentication:** The `/admin` login (`hassan123`) is a client-side gate for evaluation purposes, not a multi-tenant identity provider.
- **Public demo video rooms:** Jitsi Meet rooms (`meet.jit.si`) are public demonstration rooms. No real patient data, identifiable health information, or private medical details should ever be transmitted.
- **GPS on HTTPS:** Mobile browsers require HTTPS for geolocation. Over plain HTTP, the app detects missing geolocation or denied permissions, flags the location as approximate, and omits the high-precision badge.
- **Simulated seed data:** All facility metrics, staffing posts, medicine stocks, and camp schedules are synthetic research data.
- **Offline operation:** The Service Worker (`public/sw.js`) caches shell assets and API data on first online visit. When disconnected, `/`, `/map`, and `/doctor` remain navigable, and SOS presents an immediate offline "Call 108" action.

## Feature → requirement map
| Original Requirement | Implementation in Hassan Rural Health |
|---|---|
| **Bright colors & high contrast** | Red/Amber/Navy high-contrast design, 44px+ tap targets, clear status badges |
| **Zero-text UI (icons & audio over text)** | Icon-first controls, visual triage tiles, circular hold progress ring, speaker button on all screens |
| **Voice-guided help** | `src/voice.ts`, `SpeakerButton` component reading in active language, fallback from MP3 clips to TTS |
| **Localized language support** | `src/i18n.tsx` with pure Kannada and pure English (no mixed text), dynamically setting `lang` attribute |
| **One-tap human help; swipe for animal help** | Quick segmented switch on citizen home screen (`panel` state 0 vs 1), dedicated 1962 vet dispatch |
| **Accidental press protection** | 1000ms hold-to-dispatch gesture (`HOLD_MS = 1000`), circular filling progress ring, tap warning |
| **Telemedicine & hub-and-spoke** | `/doctor` with nearest telemedicine hub, expandable referral chain (Clinic → PHC → CHC → Hub), voice call fallback for offline facilities |
| **Mobile health camp & ambulance tracker** | `/camps` with live distance calculation, admin Camps with nearest-neighbour route optimization and roster printing, `/driver` telematics simulation, admin Live map |
| **Facility & resource dashboard** | `/admin` Facilities tab (staffing fill %, equipment condition, medicine stock, connectivity, emergency capacity) |
| **Patient & community data** | `/admin` Overview & Community tabs (visits by illness, transport barriers, financial burdens) |
| **Funding recommendations** | `/admin` Funding tab scoring and ranking facilities by composite urgency formula (`facility_health()`) |
| **Honest prototype labeling** | Zero fabricated government seals or fake identities; clear "Prototype - simulated data" badges |
| **Usage analytics & reason tracking** | `/admin` Usage tab with Recharts, anonymous session tracking, SOS emergency reason breakdown, and button press timestamp logging |

## Privacy Architecture & Analytics
- **Zero Personal Identifiable Information (PII):** No citizen names, phone numbers, Aadhaar, ABHA IDs, or citizen login accounts are collected or stored.
- **Anonymous Session ID:** An anonymous UUID is generated in the client browser (`getSessionId()`) and cached in `localStorage` (safely wrapped in `try/catch`). It cannot be linked to the physical hardware or device identity.
- **Fuzzy Coordinate Logging:** All feature usage events store geographic coordinates rounded to 2 decimal places (~1 km precision). Exact GPS coordinates are strictly reserved for active emergency dispatch payloads (`SOSRequest`).
- **Non-blocking Telemetry:** Client-side tracking (`track.ts`) is fully asynchronous and decoupled from emergency dispatches. It queues events in memory, falls back to `localStorage` offline (up to 100 events), automatically flushes on `online` restoration, and leverages `navigator.sendBeacon` when the page unloads.
- **Rate-Limited Ingestion:** The `POST /api/events/` endpoint enforces a per-session rate limit (120 events/min) and batch caps (max 20 events per call).
- **Public Privacy Notice:** A bilingual privacy notice is displayed on the citizen home screen informing users that system interactions are recorded anonymously.



## Accounts, doctor alerts and private health records (new)

**After pulling this version delete `backend/db.sqlite3`** (the user model changed), then:

```bash
cd backend && pip install -r requirements.txt   # adds cryptography
python manage.py migrate && python manage.py seed
python manage.py runserver 8000
cd ../frontend && npm install && npm run dev
```

Sign-in is phone number + password (no OTP). Create account > pick Patient or Doctor > phone + password (min 6 characters). A new doctor must be approved by the admin before appearing in the patient's Doctor page.

Calling: a signed-in patient opens the Doctor tab, sees the approved on-duty doctors and presses Call. The patient's phone dials the doctor's number (tel: link, a normal phone call, so the doctor's phone rings); the doctor also gets a message in the /dr inbox. The number is only revealed when Call is pressed. On a desktop browser, tel: needs a calling app.

Demo accounts (all data is SIMULATED, no real SMS is sent):

| Who | Phone | How |
|---|---|---|
| Admin | 9000000000 | `/admin`, password `Admin@12345` (or env `DEMO_ADMIN_PASSWORD`) |
| Doctors (approved) | 9000000101, 102, 103 (vet) | Sign in, password `Demo@12345` |
| Doctor (pending) | 9000000104 | approve it from Admin > Doctors |
| Patients | 9000000201 (has records, granted Dr Rao), 9000000202 | Sign in, password `Demo@12345` |

Settings (env): `DJANGO_DEBUG`, `DJANGO_SECRET_KEY`, `RECORDS_MASTER_KEY` (Fernet key, required when DEBUG=0; in dev a key is generated into the git-ignored `backend/.dev_master_key`), `RECORDS_ROOT`, `SMS_BACKEND` (default console, writes to the SmsOutbox table), `PUBLIC_BASE_URL`, `ALERT_ESCALATE_SECONDS`.
Run `python manage.py purge_old` daily (SMS bodies 30 d, OTP codes 1 d, location trails 7 d after close).
Tests: `python manage.py test` (85). Browser story: `python e2e/story.py en|kn` (needs Playwright + Chrome, servers running).
