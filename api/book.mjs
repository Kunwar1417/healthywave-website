// POST /api/book — the only write path from the public site into the desk app.
//
// Validates, forwards to the guarded intake endpoint with the shared secret,
// and falls back to the legacy Apps Script sheet if the desk is unreachable so
// a lead is never silently lost.

import {
  DESK_BASE, INTAKE_KEY, PUBLIC_SLOTS, isIsoDate, isValidPhone, normalizePhone,
  fetchWithTimeout, rateLimited, clientIp,
} from './_shared.mjs';

// The pre-existing leads sheet. Kept only as a safety net for when the desk app
// is down; staff work out of the desk app, not this sheet.
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzHN5xUGi-fOuSx8cQW9Xd6wvqNgS2rLAexj9IvJnbwdgpmwKfXcxO9RxSrVUBQvD-mtA/exec';

const MAX_CONCERNS = 6;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (rateLimited(clientIp(req), 8, 60_000)) {
    return res.status(429).json({ error: 'Too many booking attempts. Please call us instead.' });
  }

  const b = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});

  // Bots fill every field they can see, including the one nobody can.
  if (b.company) return res.status(200).json({ ok: true, synced: true });
  // ...and they submit faster than a human can read the form.
  if (typeof b.elapsed === 'number' && b.elapsed < 2500) {
    return res.status(400).json({ error: 'That was too quick — please try again.' });
  }

  const name = String(b.name || '').trim().slice(0, 80);
  const phone = String(b.phone || '').trim();
  const email = String(b.email || '').trim().slice(0, 120);
  const date = String(b.date || '');
  const time = String(b.time || '');
  const concerns = Array.isArray(b.concerns)
    ? b.concerns.filter((c) => typeof c === 'string' && c.trim()).slice(0, MAX_CONCERNS)
    : [];

  // Same rules the desk enforces, checked here so the patient sees them inline
  // rather than as a bare 400.
  if (name.length < 2)   return res.status(400).json({ error: 'Please enter your full name.', field: 'name' });
  if (!isValidPhone(phone)) return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.', field: 'phone' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'That email address does not look right.', field: 'email' });
  }
  if (!isIsoDate(date))  return res.status(400).json({ error: 'Please pick a date.', field: 'date' });
  if (!PUBLIC_SLOTS.includes(time)) return res.status(400).json({ error: 'Please pick an appointment time.', field: 'time' });

  const payload = {
    patient_name: name,
    phone: normalizePhone(phone),
    email,
    date,
    time,
    concerns,
  };

  try {
    // 22s, not the 6s default: a booking write is several Sheets round-trips
    // and aborting early does not undo the row the desk has already written.
    const r = await fetchWithTimeout(`${DESK_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Intake-Key': INTAKE_KEY },
      body: JSON.stringify(payload),
    }, 22000);

    if (r.ok) {
      const data = await r.json();
      return res.status(200).json({ ok: true, synced: true, id: data.id, date, time });
    }

    // A taken slot is a real answer, not a failure — the page recovers by
    // refreshing availability and asking for another time.
    if (r.status === 409) {
      const data = await r.json().catch(() => ({}));
      return res.status(409).json({
        error: data.detail || 'Sorry, that time was just taken. Please pick another.',
        field: 'time',
      });
    }
    if (r.status === 400) {
      const data = await r.json().catch(() => ({}));
      return res.status(400).json({ error: detailOf(data) || 'Please check your details and try again.' });
    }
    throw new Error(`desk responded ${r.status}`);
  } catch (err) {
    console.error('desk booking failed, falling back to Apps Script:', err.message);
    // synced:false — the page must say "we'll call you to confirm" rather than
    // claim a slot the clinic's system has never seen.
    const saved = await appsScriptFallback({ name, phone, email, date, time, concerns });
    if (saved) return res.status(200).json({ ok: true, synced: false, date, time });
    return res.status(502).json({
      error: 'We could not save your booking just now. Please call us on +91 96285 91786.',
    });
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }

function detailOf(data) {
  const d = data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace(/^Value error, /, '');
  return '';
}

async function appsScriptFallback(f) {
  try {
    const r = await fetchWithTimeout(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        name: f.name,
        phone: f.phone,
        email: f.email,
        concern: f.concerns.join(', '),
        appt_date: f.date,
        appt_time: f.time,
        message: '[via /book — desk app unreachable, not in the appointments system]',
      }),
    }, 5000);
    return r.ok || r.status === 302;   // Apps Script redirects on success
  } catch (err) {
    console.error('Apps Script fallback also failed:', err.message);
    return false;
  }
}
