# HealthyWave Website — Project Guide

## What This Is
Static HTML/CSS website for **Healthy Wave Skin and Aesthetic Clinic**, Bareilly, UP, India.
Doctor: **Dr. Aman Jeet Handa** — BAMS, FMC (Fellowship in Medical Cosmetology), 14 years experience.
Primary audience: Women in Bareilly and nearby cities (Pilibhit, Shahjahanpur, Rampur, Moradabad).

---

## Live Site & Deployment

- **Production URL:** https://www.thehealthywave.in
- **Hosting:** Vercel (project: `kunwar-s-projects/healthywave-clinic`)
- **GitHub repo:** https://github.com/Kunwar1417/healthywave-website
- **IMPORTANT:** GitHub push does NOT auto-trigger Vercel. Always deploy manually:
  ```
  npx vercel --prod
  ```
- Vercel CLI is already installed (`npx vercel`). Auth is cached.

---

## File Structure

```
/
├── index.html          # Homepage — hero, services overview, trust section, FAQ, CTA
├── about.html          # Dr. Handa's background and clinic story
├── services.html       # Full services list (Dermabrasion, HIFU, Hydrafacial, etc.)
├── book.html           # Appointment booking (PRIMARY CONVERSION PAGE, served at /book)
├── contact.html        # Address, map, hours — links to /book
├── privacy.html        # Privacy policy
├── terms.html          # Terms of service
├── disclaimer.html     # Medical disclaimer
├── styles.css          # Single global stylesheet (all pages share this)
├── vercel.json         # Vercel config — rewrites /desk/* to fly.dev backend
└── assets/
    ├── logo.png
    ├── dr-handa.png          # 6MB original — never reference this on a page
    ├── dr-handa-avatar.jpg   # 13KB 320px square crop, used by book.html
    └── clinic-interior.jpg
```

---

## Tech Stack

- Pure HTML + CSS. No framework, no build step, no npm.
- One shared `styles.css` for all pages.
- JavaScript is inline `<script>` blocks at the bottom of each HTML file.
- No external JS libraries.

---

## Integrations & Third-Party Services

### Google Ads (Google Tag)
- Tag ID: `AW-16514287301`
- Conversion label: `3YUGCIzWwaocEMWN0MI9`
- All `tel:` links fire `gtag_report_conversion()` via inline `onclick`
- Script present in `<head>` of every page

### Meta Pixel (Facebook Ads)
- Pixel ID: `1227039256008469`
- Base code in `<head>` of every page — fires `PageView` on load
- Custom events (added via code, not Meta Event Setup Tool):

| Event | Trigger | Pages |
|---|---|---|
| `PageView` | Page load | All 7 |
| `ViewContent` | Page load | services.html only |
| `InitiateCheckout` | Booking page load / CTA click | index, about, services, contact, book |
| `Contact` | Phone number (`tel:`) click | All 7 |
| `Lead` | Booking submitted successfully | book.html only |

- Event tracking script is a `<script>` block before `</body>` using `querySelectorAll` listeners.
- On book.html, `fbq('track', 'Lead')` and `gtag_report_conversion()` fire in `succeed()` after a booking is saved.

### Booking Page (book.html → /book)  ← PRIMARY CONVERSION PAGE
- Live at `https://www.thehealthywave.in/book` (`vercel.json` rewrites `/book` → `/book.html`)
- Mobile-first single page: date strip → time slots → details. No libraries, inline JS.
- **Bookings land directly in the HealthyWave Desk app's `Appointments` tab** with `Source = website`
- Slots are 30-minute, **11:00–13:30 and 18:00–20:30**, Sunday closed.
  These MUST stay in step with `MORNING_SLOTS`/`EVENING_SLOTS` in the desk app's `api/intake.py`.
- Booked slots grey out live. The desk books on a 15-min grid, so a public 30-min slot
  is blocked when any staff booking falls inside its half hour (11:15 blocks the 11:00 pill).

**Never let the browser call the desk API directly.** That API has no auth and
`allow_origins=["*"]`, and the same origin also serves the full patient list. Two Vercel
serverless functions sit in between and hold the shared secret:

| File | Route | Does |
|---|---|---|
| `api/_shared.mjs` | — | Config, phone/date validation, rate limiter, `fetch` timeout |
| `api/availability.mjs` | `GET /api/availability?date=` | Blocked slots for a date. 45s cache — this is the Google Sheets quota guard. Returns times only, never patient data. |
| `api/book.mjs` | `POST /api/book` | Validates, forwards with `X-Intake-Key`. Falls back to the old Apps Script if the desk is down (`synced:false` → page says "we'll call you to confirm" rather than claiming a slot). |

- `.mjs` on purpose: with no `package.json`, Vercel treats `.js` as CommonJS and the ESM breaks.
- Files in `api/` starting with `_` are helpers, not routes.
- **Env var `INTAKE_KEY`** (Vercel) must equal **`WEBSITE_INTAKE_KEY`** (Fly secret on
  `healthywave-desk`). Set both; never commit either.
- Spam controls: hidden `company` honeypot, minimum time-on-page, per-IP rate limit.

### Legacy Apps Script
- `https://script.google.com/macros/s/AKfycbzHN5xUGi-fOuSx8cQW9Xd6wvqNgS2rLAexj9IvJnbwdgpmwKfXcxO9RxSrVUBQvD-mtA/exec`
- No longer the booking path — **fallback only**, used by `api/book.mjs` when the desk is unreachable.
- Staff work out of the desk app, not this sheet.

### Other
- **Fonts:** Google Fonts — Inter + JetBrains Mono
- **Instagram:** https://www.instagram.com/dr.amanhanda
- **Google Maps:** https://maps.app.goo.gl/EHdA8AAKt6Xb3LMh7
- **Email:** hwskinclinic@gmail.com
- **Phone:** +91 96285 91786
- **Address:** Near Bareilly Point Marriage Lawn, Ejas Nagar, Pilibhit Bypass Road, Bareilly 243006

### /desk Route
- `vercel.json` proxies `/desk/*` → `https://healthywave-desk.fly.dev/`
- This is a separate backend app (not part of this repo)

---

## Deployment Workflow

```bash
# 1. Make changes to HTML/CSS files
# 2. Commit
git add <files>
git commit -m "description"
git push origin main          # updates GitHub (but does NOT redeploy Vercel)

# 3. Deploy to production
npx vercel --prod             # this is the step that actually goes live
```

---

## Services Offered

Dermabrasion, Ultrasonic Therapy, Galvanics, HIFU, Dermasonic, Hydrafacial,
Laser Removal of Skin Tags and Moles.
Each service card on services.html links to contact.html.

---

## Design Notes

- Color variables defined in `styles.css` (uses CSS custom properties)
- Key classes: `.btn`, `.btn-primary`, `.btn-terra`, `.btn-light`, `.link`
- Mobile nav toggled by `#menuBtn` → adds `.open` class to `#mobileNav`
- All "Book an Appointment" CTAs are `<a>` tags linking to `contact.html` (not `<button>`)
- Form date field has `min` set to today's date via JS on page load

---

## What NOT to Change Without Care

- `INTAKE_KEY` / `WEBSITE_INTAKE_KEY` must match, or every website booking 401s
- The slot list in `book.html` must match `api/intake.py` in the desk app
- The Meta Pixel ID `1227039256008469` — tied to the live Facebook Ads account
- The Google Ads tag `AW-16514287301` — tied to active Google Ads campaigns
- `vercel.json` rewrites — removing them breaks the /desk backend proxy
