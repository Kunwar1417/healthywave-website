# HealthyWave Website — Project Guide

## What This Is
Static HTML/CSS website for **Healthy Wave Skin and Aesthetic Clinic**, Bareilly, UP, India.
Doctor: **Dr. Aman Jeet Handa** — BMS, specialization in cosmetology, 14 years experience.
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
├── contact.html        # Booking form + contact info (PRIMARY CONVERSION PAGE)
├── privacy.html        # Privacy policy
├── terms.html          # Terms of service
├── disclaimer.html     # Medical disclaimer
├── styles.css          # Single global stylesheet (all pages share this)
├── vercel.json         # Vercel config — rewrites /desk/* to fly.dev backend
└── assets/
    ├── logo.png
    ├── dr-handa.png
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
| `InitiateCheckout` | "Book an Appointment" CTA click | index, about, services, contact |
| `Contact` | Phone number (`tel:`) click | All 7 |
| `Lead` | Booking form submitted successfully | contact.html only |

- Event tracking script is a `<script>` block before `</body>` using `querySelectorAll` listeners.
- On contact.html, `fbq('track', 'Lead')` fires inside the fetch `.then()` callback on form success.

### Booking Form (contact.html)
- Form ID: `#inquiry`
- Submits via `fetch()` with `mode: 'no-cors'` to Google Apps Script
- Apps Script URL: `https://script.google.com/macros/s/AKfycbzHN5xUGi-fOuSx8cQW9Xd6wvqNgS2rLAexj9IvJnbwdgpmwKfXcxO9RxSrVUBQvD-mtA/exec`
- Fields: name, phone, email, concern (dropdown), appt_date, appt_time, message
- On success: shows `#success` div, fires `fbq('track', 'Lead')`, resets form
- On failure: shows alert with phone number

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

- The Apps Script URL in contact.html — changing it breaks the booking form
- The Meta Pixel ID `1227039256008469` — tied to the live Facebook Ads account
- The Google Ads tag `AW-16514287301` — tied to active Google Ads campaigns
- `vercel.json` rewrites — removing them breaks the /desk backend proxy
