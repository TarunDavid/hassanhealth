import json, sys, re, time
from playwright.sync_api import sync_playwright, expect
LANG = sys.argv[1] if len(sys.argv) > 1 else "en"
BASE = "http://localhost:4173"
sfx = str(int(time.time()))[-4:]
PH, DR = "97777" + sfx[:4] + "1"[:0], None
PATIENT = "9777" + sfx + "01"
DOCTOR = "9777" + sfx + "02"
PDF = "/home/claude/e2e/report.pdf"
open(PDF, "wb").write(b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nSECRET-E2E")
res = []
def ok(name, cond):
    res.append((name, bool(cond))); print(("PASS " if cond else "FAIL ") + name)

PW = "Secret@123"
def otp_login(page, role_text_re, phone):
    """Create an account with phone + password (no code)."""
    page.goto(BASE + "/login")
    page.get_by_test_id("role-doctor" if "doctor" in role_text_re else "role-patient").click()
    page.get_by_test_id("phone").fill(phone)
    page.get_by_test_id("password").fill(PW)
    page.get_by_test_id("submit").click()
    page.wait_for_url(re.compile(r"/profile"))

def signin(page, phone, pw):
    page.goto(BASE + "/login")
    page.get_by_test_id("tab-login").click()
    page.get_by_test_id("phone").fill(phone)
    page.get_by_test_id("password").fill(pw)
    page.get_by_test_id("submit").click()
    page.wait_for_url(re.compile(r"/profile"))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    def ctx():
        c = b.new_context(viewport={"width": 420, "height": 860}, geolocation={"latitude": 13.0, "longitude": 76.1}, permissions=["geolocation"])
        c.add_init_script(f"localStorage.setItem('lang','{LANG}')")
        return c
    S = lambda page, n: page.screenshot(path=f"/home/claude/e2e/shots/{LANG}_{n}.png")
    L = lambda en, kn: re.compile(en if LANG == "en" else kn)

    # ---- patient registers ----
    pc = ctx(); pg = pc.new_page()
    pg.goto(BASE + "/login"); S(pg, "01_login")
    ok("login screen is in selected language", pg.get_by_text(L("Who are you", "ನೀವು ಯಾರು")).count() > 0)
    otp_login(pg, r"I am a patient|ನಾನು ರೋಗಿ", PATIENT)
    ok("consent gate shown", pg.get_by_text(L("I agree", "ನಾನು ಒಪ್ಪುತ್ತೇನೆ")).count() > 0); S(pg, "02_consent")
    pg.get_by_role("button", name=L("I agree", "ನಾನು ಒಪ್ಪುತ್ತೇನೆ")).click()
    pg.locator("input").first.wait_for()
    inputs = pg.locator("input:not([type=checkbox])")
    inputs.nth(0).fill("E2E P"+sfx); pg.locator("input[type=date]").fill("1990-05-05")
    pg.locator("select").nth(2).select_option("kn") if False else None
    S(pg, "03_profile_form")
    pg.get_by_role("button", name=L("^Save$", "^ಉಳಿಸಿ$")).click()
    pg.get_by_text(L("My health", "ನನ್ನ ಆರೋಗ್ಯ")).wait_for()
    ok("profile saved, My health link visible", True); S(pg, "04_profile")
    pg.get_by_text(L("My health", "ನನ್ನ ಆರೋಗ್ಯ")).click()
    pg.wait_for_url(re.compile("/health"))
    pg.locator("textarea").fill("Diabetes\nAsthma")
    pg.locator("input:not([type=file]):not([type=checkbox])").nth(0).fill("Penicillin")
    pg.get_by_role("button", name=L("^Save$", "^ಉಳಿಸಿ$")).first.click()
    pg.get_by_text(L("Saved", "ಉಳಿಸಲಾಗಿದೆ")).first.wait_for()
    pg.get_by_test_id("record-file").set_input_files(PDF)
    pg.locator("label", has_text=L("Title", "ಶೀರ್ಷಿಕೆ")).locator("input").fill("My blood test")
    pg.get_by_role("button", name=L("^Upload$", "^ಅಪ್‌ಲೋಡ್$")).click()
    pg.get_by_text("My blood test").wait_for()
    ok("record uploaded and listed", True)
    ok("private banner shown", pg.get_by_text(L("Only you and doctors you allow", "ನೀವು ಮತ್ತು ನೀವು ಅನುಮತಿಸಿದ")).count() > 0)
    S(pg, "05_health")
    with pg.expect_download() as dl:
        pg.get_by_role("button", name=L("Download", "ಡೌನ್‌ಲೋಡ್")).first.click()
    data = open(dl.value.path(), "rb").read()
    ok("download returns the original bytes", b"SECRET-E2E" in data)
    # grant Dr Rao
    pg.locator("label", has_text=L("Doctor's mobile", "ವೈದ್ಯರ ಮೊಬೈಲ್")).locator("input").fill("9000000102")
    pg.get_by_role("button", name=L("Allow a doctor", "ವೈದ್ಯರಿಗೆ ಅನುಮತಿ ನೀಡಿ")).click()
    pg.get_by_text("Rao").first.wait_for()
    ok("doctor access granted and listed", True); S(pg, "06_grant")

    # ---- doctor registers ----
    dc = ctx(); dp = dc.new_page()
    otp_login(dp, r"I am a doctor|ನಾನು ವೈದ್ಯ", DOCTOR)
    try:
        dp.get_by_role("button", name=L("I agree", "ನಾನು ಒಪ್ಪುತ್ತೇನೆ")).click(timeout=5000)
    except Exception:
        pass
    dp.locator("select").nth(1).wait_for()
    txt = dp.locator("input")
    txt.nth(0).fill("E2E Doc "+sfx); txt.nth(2).fill("KMC-E2E-" + sfx)
    dp.locator("select").nth(1).select_option(index=1)
    S(dp, "07_doctor_form")
    dp.get_by_role("button", name=L("Submit", "ಸಲ್ಲಿಸಿ")).click()
    dp.get_by_text(L("Waiting for approval", "ಅನುಮೋದನೆಗಾಗಿ")).first.wait_for()
    ok("doctor sees pending state", True); S(dp, "08_pending")
    ok("pending doctor has no on-duty toggle", dp.get_by_test_id("toggle-on_duty").count() == 0)

    # ---- admin approves ----
    ac = ctx(); ap = ac.new_page()
    ap.goto(BASE + "/admin")
    ap.locator("input").nth(0).fill("9000000000"); ap.locator("input[type=password]").fill("Admin@12345")
    ap.get_by_role("button", name=re.compile("Sign in|Log in|Login", re.I)).click()
    ap.get_by_role("button", name="Doctors").click()
    row = ap.locator("tr", has_text="E2E Doc "+sfx)
    row.get_by_role("button", name="Approve").click()
    expect(row).to_contain_text("approved")
    ok("admin approved doctor", True)
    ap.screenshot(path=f"/home/claude/e2e/shots/{LANG}_09_admin_doctors.png")
    # admin cannot reach patient data (API through the browser session)
    tok = ap.evaluate("localStorage.getItem('hh_access')")
    codes = ap.evaluate("""async (t) => { const out = {}; for (const u of ['/api/me/records/','/api/me/medical/','/api/doctor/patients/']) { const r = await fetch(u, {headers:{Authorization:'Bearer '+t}}); out[u]=r.status } return out }""", tok)
    ok("admin gets 404 on records/conditions routes: " + json.dumps(codes), all(v == 404 for v in codes.values()))

    # ---- doctor goes on duty ----
    dp.reload(); dp.get_by_test_id("toggle-on_duty").wait_for()
    expect(dp.get_by_test_id("toggle-on_duty")).to_be_checked()  # on duty by default after registration
    S(dp, "10_duty")
    # make the other seeded doctors off duty so the new doctor is picked deterministically? patient's grant is Dr Rao -> Rao + facility doctors alerted
    # ---- patient calls the newly registered doctor from the Doctor page ----
    pg.goto(BASE + "/doctor")
    row = pg.get_by_test_id("doctor-row").filter(has_text="E2E Doc " + sfx)
    row.wait_for(timeout=10000)
    ok("new doctor is listed on the Doctor page", True); S(pg, "10b_doctor_list")
    with pg.expect_response(re.compile(r"/api/doctors/\d+/call/")) as ci:
        row.get_by_role("button").click()
    ok("Call returns the doctor's number", ci.value.ok and ci.value.json()["tel"] == "+91" + DOCTOR)
    time.sleep(1)
    inbox = json.loads(__import__("subprocess").run(["/home/claude/review2/venv/bin/python", "manage.py", "shell", "-c",
        "from alerts.models import *;import json;print(json.dumps(list(SmsOutbox.objects.filter(template='call_request').values_list('to_phone',flat=True))))"],
        cwd="/home/claude/rh2/backend", capture_output=True, text=True).stdout.strip().splitlines()[-1])
    ok("doctor was notified of the call", DOCTOR in inbox)
    # ---- SOS by patient (UI hold) ----
    pg.close(); pg = pc.new_page(); pg.goto(BASE + "/"); time.sleep(3)
    sos_btn = pg.locator("button", has_text=re.compile("HOLD|ಒತ್ತಿ ಹಿಡಿ", re.I)).first
    box = sos_btn.bounding_box()
    pg.mouse.move(box["x"] + box["width"]/2, box["y"] + box["height"]/2); pg.mouse.down(); time.sleep(2.2); pg.mouse.up()
    try:
        pg.get_by_test_id("doctor-alerted").or_(pg.get_by_test_id("doctor-responding")).wait_for(timeout=15000)
        ok("patient sees 'doctor alerted' on SOS screen", True)
    except Exception as e:
        ok("patient sees 'doctor alerted' on SOS screen", False)
    S(pg, "11_sos_patient")
    out = json.loads(__import__("subprocess").run(["/home/claude/review2/venv/bin/python", "manage.py", "shell", "-c",
        "from alerts.models import *;import json;print(json.dumps([[m.to_phone,m.body] for m in SmsOutbox.objects.filter(template='sos_alert').order_by('-id')[:3]]))"],
        cwd="/home/claude/rh2/backend", capture_output=True, text=True).stdout.strip().splitlines()[-1])
    ok("SMS rows exist for the SOS: %d" % len(out), len(out) > 0)
    links = re.findall(r"/r/([A-Za-z0-9_-]+)", out[0][1]) if out else []
    # the alerted doctor is Dr Rao (granted). Log in as Rao and open the respond link
    rc = ctx(); rp = rc.new_page()
    signin(rp, out[0][0], "Demo@12345")
    rp.goto(BASE + "/r/" + links[0])
    rp.get_by_role("button", name=L("I am responding", "ನಾನು ಸ್ಪಂದಿಸುತ್ತಿದ್ದೇನೆ")).click()
    rp.get_by_text(L("You are responding", "ನೀವು ಸ್ಪಂದಿಸುತ್ತಿದ್ದೀರಿ")).wait_for()
    ok("doctor accepted from the SMS link", True); S(rp, "12_doctor_track")
    ok("track page has maps link", rp.locator("a[href*='google.com/maps']").count() == 1)
    # patient screen now shows responder
    pg.get_by_test_id("doctor-responding").wait_for(timeout=15000)
    ok("patient sees which doctor is responding", True); S(pg, "13_sos_responding")
    # doctor desk shows the patient and opens records
    rp.goto(BASE + "/dr")
    rp.get_by_text("E2E P"+sfx+"").first.wait_for()
    rp.get_by_text("E2E P"+sfx+"").first.click()
    rp.get_by_text("Penicillin").wait_for()
    ok("doctor reads patient conditions", True)
    with rp.expect_download() as d2:
        rp.get_by_role("button", name=L("Download", "ಡೌನ್‌ಲೋಡ್")).first.click()
    ok("doctor downloads the record", b"SECRET-E2E" in open(d2.value.path(), "rb").read()); S(rp, "14_doctor_patient")
    # patient sees who viewed
    pg.goto(BASE + "/health"); pg.get_by_text(re.compile(r"· Dr \w+")).first.wait_for()
    ok("patient's access log shows the doctor", pg.get_by_text(re.compile(r"· Dr \w+")).count() > 0)
    # logout clears tokens
    pg.goto(BASE + "/profile"); pg.get_by_role("button", name=L("Log out", "ಲಾಗ್ ಔಟ್")).click(); time.sleep(0.7)
    ok("tokens cleared on logout", pg.evaluate("localStorage.getItem('hh_access')") is None)
    b.close()
bad = [n for n, c in res if not c]
print("\n%d/%d passed" % (len(res) - len(bad), len(res)))
sys.exit(1 if bad else 0)
