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
**→ Full detail in [`docs/booking-system.md`](docs/booking-system.md). Read it before
touching `book.html`, `api/*.mjs`, or the slot times.**

- Bookings write straight into the desk app's `Appointments` tab (`Source = "website"`)
- Two Vercel serverless functions (`api/book.mjs`, `api/availability.mjs`) hold a shared
  secret and stand between the browser and the desk API — **the browser must never call
  the desk directly**; that API has no auth and also serves the full patient list
- Vercel `INTAKE_KEY` must equal Fly `WEBSITE_INTAKE_KEY`, or every booking 401s
- Slots are 30-min, 11:00–13:30 and 18:00–20:30, Sunday closed. The list is duplicated in
  three files (`book.html`, `api/_shared.mjs`, desk `api/intake.py`) — change all three
- The three testimonials are written examples, not real patients (owner's decision).
  The 5.0 / 36 Google reviews rating is real.

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
git add <files> && git commit -m "description"
git push origin main               # updates GitHub — does NOT deploy
npx vercel deploy --prod --yes     # this is the step that goes live
```

`npx vercel --prod` prompts and does nothing non-interactively; use
`vercel deploy --prod --yes`. If the booking page or the desk API changed, follow
the ordered runbook in [`docs/booking-system.md`](docs/booking-system.md) instead —
sheet migration and the Fly deploy have to happen first.

---

## Services Offered

Dermabrasion, Ultrasonic Therapy, Galvanics, HIFU, Dermasonic, Hydrafacial,
Laser Removal of Skin Tags and Moles.
Each service card on services.html links to `/book`.

---

## Design Notes

- **Palette** (tokens at the top of `styles.css`): white ground, near-black text, two
  accents with distinct jobs — `--sage` `#16775c` brand green for actions and structure,
  `--terra` `#d2694a` warm coral for headline emphasis. Large dark surfaces (stats band,
  footer, about-quote) use `--deep` `#123f33`, **not** near-black; three slabs of black is
  what made the site read as dead. Tints: `--cream` mint, `--rose` blush.
- Key classes: `.btn`, `.btn-primary` (green), `.btn-terra` (coral), `.btn-light`, `.link`
- Mobile nav toggled by `#menuBtn` → adds `.open` class to `#mobileNav`
- All "Book an Appointment" CTAs are `<a>` tags pointing at `/book` (not `<button>`)
- `book.html` scopes its own tokens under `body.book-page, .book-page` — see the gotchas
  in [`docs/booking-system.md`](docs/booking-system.md)
- No browser in the agent environment; render with `qlmanage -t -s 1000 -o /tmp/out <file>.html`
  before shipping visual changes (it runs no JS — see the doc)

---

## What NOT to Change Without Care

- `INTAKE_KEY` / `WEBSITE_INTAKE_KEY` must match, or every website booking 401s
- The slot list is duplicated in `book.html`, `api/_shared.mjs` and the desk's `api/intake.py`
- `gtag_report_conversion()` must NOT return false — cancelling a `tel:` click breaks
  calling from the Instagram in-app browser
- The booking proxy timeout (22s) must stay well above 10s; a desk write takes ~9s
- Files in `api/` are `.mjs` on purpose — `.js` would be treated as CommonJS
- The Meta Pixel ID `1227039256008469` — tied to the live Facebook Ads account
- The Google Ads tag `AW-16514287301` — tied to active Google Ads campaigns
- `vercel.json` rewrites — removing them breaks the /desk backend proxy
