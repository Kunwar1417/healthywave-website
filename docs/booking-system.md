# The /book booking system

How a patient on thehealthywave.in ends up as a row in the clinic's desk app.
**Read this before touching `book.html`, `api/*.mjs`, or the slot times.**

---

## The shape of it

```
patient's phone
      │  POST /api/book            GET /api/availability?date=
      ▼
Vercel serverless functions          ← the shared secret lives ONLY here
  api/book.mjs · api/availability.mjs
      │  X-Intake-Key: <secret>
      ▼
healthywave-desk.fly.dev
  /api/v1/intake/appointments · /api/v1/intake/availability
      │
      ▼
Google Sheet → Appointments tab (Source = "website")
      │
      ▼
staff see it on the desk app's Today and Calendar screens
```

### Why the proxy exists — do not remove it

The desk API has **no authentication** (`api/auth.py` returns a hardcoded admin
on purpose) and **`allow_origins=["*"]`**. The same host also serves
`GET /api/v1/patients`, which returns every patient with their phone number.

So the browser must never hold the key or call the desk directly. The functions
are also where rate limiting, spam checks and the availability cache live.

---

## Files

| File | Role |
|---|---|
| `book.html` | The whole page. Inline `<script>`, no libraries, no build step. |
| `api/_shared.mjs` | Config, phone/date validation, rate limiter, fetch-with-timeout. Not a route — Vercel ignores `api/_*`. |
| `api/availability.mjs` | `GET /api/availability?date=` → `{slots, blocked, live}`. 45s cache. |
| `api/book.mjs` | `POST /api/book` → forwards to the desk; Apps Script fallback. |
| `styles.css` | Booking styles are the last block, scoped to `.book-page`. |
| `vercel.json` | `/book` rewrite + `maxDuration` for `api/book.mjs`. Leave the `/desk` rewrites alone. |

**`.mjs`, not `.js`** — there is no `package.json`, so Vercel treats `.js` as
CommonJS and `import`/`export` throws at runtime.

---

## The two secrets must match

| Where | Name |
|---|---|
| Vercel (Production) | `INTAKE_KEY` |
| Fly (`healthywave-desk`) | `WEBSITE_INTAKE_KEY` |

Same 64-char hex value. The desk **fails closed**: unset or mismatched = every
booking 401s. Never commit it; it is not in git and not in the page source.

```bash
# rotating
KEY=$(openssl rand -hex 32)
flyctl secrets set WEBSITE_INTAKE_KEY="$KEY" -a healthywave-desk
npx vercel env rm INTAKE_KEY production --yes
npx vercel env add INTAKE_KEY production --value "$KEY" --yes
npx vercel deploy --prod --yes      # env changes need a redeploy
```

---

## Clinic hours and slots — three files must agree

**Mon–Sat, 11:00–14:00 and 18:00–21:00. Closed Sunday.** Public slots are
30-minute:

```
11:00 11:30 12:00 12:30 13:00 13:30
18:00 18:30 19:00 19:30 20:00 20:30
```

Change all three together or bookings start 400-ing:

1. `book.html` → `MORNING` / `EVENING`
2. `api/_shared.mjs` → `PUBLIC_SLOTS`
3. desk app `api/intake.py` → `MORNING_SLOTS` / `EVENING_SLOTS`

**Staff book on a 15-minute grid, the website on 30.** A public slot is blocked
when *any* staff booking falls inside its half hour — 11:15 blocks the 11:00
pill. That rule lives in `api/intake.py::_blocked_slots`.

---

## Deploy — order matters

```bash
# 1. sheet first, if a column was added. Writing a column the sheet lacks
#    silently drops the value: the write succeeds and the data vanishes.
cd "../HealthyWave WebApp" && python tools/migrate_sheets.py

# 2. desk app, so the endpoint exists before the page that calls it
flyctl deploy -a healthywave-desk --remote-only

# 3. website. Pushing to GitHub does NOT deploy.
cd "../HealthyWave Website"
git push origin main
npx vercel deploy --prod --yes
```

Then smoke-test (see the bottom of this file).

---

## Gotchas — every one of these cost real debugging

**1. A desk write takes ~9 seconds.** Several Google Sheets round-trips on a
256MB machine. The proxy timeout is **22s** with `maxDuration: 30`. It was 6s,
and aborting the fetch *does not undo the row the desk already committed* — the
appointment was created, the patient was told it failed, and the lead was
written twice. If you touch the timeout, keep it well above 10s.

**2. The 45s availability cache is a quota guard, not an optimisation.** Google
Sheets allows ~60 reads/min for the whole clinic and the **staff app shares that
budget**. Without the cache, every date tap by every visitor is a full-sheet
read and a busy afternoon can blank the desk UI mid-clinic.

**3. `tel:` links must not be cancelled.** `gtag_report_conversion()` used to
`return false` and dial via `window.location`. Instagram's and Facebook's
in-app browsers refuse a *scripted* `tel:` navigation — "Link cannot be loaded",
then the browser closes. It now returns `true` and lets the anchor dial. Much of
this clinic's traffic is Instagram ads, so this silently ate real calls.

**4. Google Maps embeds: use the direct endpoint.**
`maps?q=...&output=embed` 301-redirects and *that redirect carries
`x-frame-options: SAMEORIGIN`*. Use
`https://www.google.com/maps/embed?pb=!1m2!2m1!1s<query>` — 200, no framing
header. A blank white box where the map should be means this regressed.

**5. Booking-page CSS tokens are scoped `body.book-page, .book-page`.** Both
selectors are needed: the live page puts the class on `<body>`, previews wrap
the page in a `<div>`. With only the first, every `var()` is undefined —
borders vanish (an invalid declaration is dropped) and selected pills render
white-on-transparent.

**6. Never reference `assets/dr-handa.png` on a page.** It is 6.2MB. Use
`assets/dr-handa-avatar.jpg` (13KB, 320px square).

**7. Some sheet rows store 12-hour times** (`6:30`, `1:00`) with no meridiem.
The desk normalises these on read; see its `docs/website-booking-intake.md`.

---

## Not real data

The three testimonials in `book.html` are **written examples, not real
patients** — an explicit owner decision. Anything else on the page is real:
the 5.0 / 36 Google reviews rating is the clinic's actual listing, linked to it.

Update the rating in two places or the stars will disagree with the number:
the `5.0` text and `--pct` (rating ÷ 5 as a percentage).

---

## Seeing the page before you ship it

There is no browser in the agent environment, but macOS Quick Look renders HTML
through WebKit:

```bash
qlmanage -t -s 1000 -o /tmp/out book.html    # writes book.html.png
```

**It executes no JavaScript**, so the calendar and slots come out empty — build
a copy with that markup pre-rendered to inspect them. It also ignores the
viewport meta: to see the mobile layout, strip the `@media (min-width: 900px)`
block and pin `html,body{width:390px}`.

Two rounds of this project shipped visibly broken pages because they were
published without looking. Look first.

---

## Smoke test after deploying

```bash
D=2026-09-08   # any weekday, not a Sunday

curl -s "https://www.thehealthywave.in/api/availability?date=$D"
#   expect "live":true — false means the desk was unreachable and the page
#   silently degraded to all-slots-open

curl -s -X POST https://www.thehealthywave.in/api/book \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"ZZ Test\",\"phone\":\"6000000001\",\"date\":\"$D\",\"time\":\"20:30\",\"elapsed\":9000}"
#   expect {"ok":true,"synced":true,...}
#   synced:false = it fell back to Apps Script; the desk never saw it
```

Then delete the test appointment **and** its patient row — a booking creates
both. The appointment can go via the desk UI; the patient row needs the sheet.

Also check: bad phone → inline 400, same slot twice → 409, and the page source
contains no key and no `healthywave-desk.fly.dev` URL.
