# Report: accounts, doctor SMS alerts, private health records

## What now works
- Patients and doctors register with a phone OTP. Doctors need admin approval. Guests can still press SOS with no login.
- A signed-in patient's SOS creates alerts for up to 3 doctors (patient's own doctors first, then on-duty doctors at the assigned facility and its parents; vets for animal SOS). Two get an SMS at once, the third is queued and sent after 3 minutes or when everyone declines.
- The SMS has name, age, sex, phone, reason, time and a live-location link plus a respond link. The doctor opens the link, sees a map link, and accepts or declines. The patient's screen shows "a doctor is responding" and sends live location every 10 s.
- Patients store conditions and upload PDF/JPG/PNG records (10 MB, 30 files). Files and conditions are encrypted. The patient chooses which doctors can see them. A doctor who accepted the patient's SOS gets temporary emergency access, the patient is told by SMS, and every access appears in the patient's "who viewed" list.

## Verified
| Check | Result |
|---|---|
| `manage.py test` | 79 pass |
| `makemigrations --check` | no changes |
| `npm run build` | passes |
| Browser story, English and Kannada | 20/20 each |
| Admin and superuser on every records/conditions route | 404 (test and browser) |
| Django admin lists a medical model | no |
| Stored file is ciphertext; storage URLs | ciphertext confirmed; 404 |
| Guest SOS works; SOS succeeds when SMS provider fails | tested |
| Medical fields in SMS, logs or analytics | none (code grep + SMS content test) |

## Not done / limits
- No real SMS: the console backend only writes to a table. Delivery, cost and DLT registration for India are unsolved.
- "Not even the admin" holds for the application. Someone with server and master-key access could still decrypt. It is not end-to-end encryption.
- Rate limits are per-process memory. JWT lives in localStorage.
- Kannada strings are mine and need a native proofread. Voice on the new screens uses the browser's speech engine, no recorded clips.
- The track page shows the reason label in English only.
- Doctor identity is only as good as the admin's check of the council number.
- All demo data is simulated.
