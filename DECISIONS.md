# Decisions

- **Admin has no route to medical data.** Access is decided by `records.services.access_reason`, which looks only at the patient/doctor relationship. `role=admin`, `is_staff` and `is_superuser` are never consulted. Medical views answer 404 (not 403) so existence is not revealed. No medical model is registered in Django admin. A person with shell or database access can still run code; that is outside what an application rule can stop.
- **Envelope encryption, not end-to-end.** Each file gets its own Fernet key, wrapped by a master key from the environment. This protects stolen disk/database copies. The running server can decrypt, so a server operator with the master key can read files. True end-to-end would need keys on the patient's device and was left out because lost phones would mean lost records.
- **Emergency "break glass".** A doctor who accepted the patient's SOS may read records until the SOS is closed plus 6 hours. Patient can switch this off. Patient gets an SMS once per emergency. Every access is logged and visible to the patient.
- **SOS never depends on login or SMS.** Guests keep working. SMS and alert errors are swallowed and cannot fail the SOS request.
- **SMS body carries no medical data**: name, age, sex, phone, reason, time and two links.
- **Links to a live SOS** are per-doctor random tokens that expire after 3 h or when the SOS closes. Anyone holding the link can see the patient's name and location during that time; responding still needs a doctor login.
- **Console SMS backend only.** No provider, no cost. A real provider is a class with a `send(phone, body)` method.
- **OTP**: 6 digits, hashed, 5 min, 5 tries then 15 min lock, 30 s resend, per-phone and per-IP limits. Limits use the in-process cache, so they reset on restart and are per-process; use Redis in production.
- **JWT in localStorage** (30 min access, 30 day rotating refresh with blacklist). Simple, but readable by any XSS bug; httpOnly cookies are the stronger choice.
- **Kannada text** was written by me and needs proofreading by a native speaker before real use.
