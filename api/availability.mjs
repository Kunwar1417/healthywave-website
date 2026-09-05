// GET /api/availability?date=YYYY-MM-DD
// Returns which of the 12 public slots are unbookable on that date.
// Times only — never the patient names/phones the desk's own list endpoint joins in.

import {
  DESK_BASE, INTAKE_KEY, PUBLIC_SLOTS, isIsoDate,
  fetchWithTimeout, rateLimited, clientIp,
} from './_shared.mjs';

// Per-date cache. Google Sheets allows ~60 reads/min for the whole clinic, and
// the staff app shares that budget — without this, every date tap by every
// visitor is a full-sheet read and a busy afternoon could blank the desk UI.
const CACHE_MS = 45_000;
const cache = new Map();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const date = String(req.query.date || '');
  if (!isIsoDate(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  if (rateLimited(clientIp(req), 120, 60_000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const hit = cache.get(date);
  if (hit && Date.now() < hit.expires) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(hit.body);
  }

  try {
    const r = await fetchWithTimeout(
      `${DESK_BASE}/availability?date=${encodeURIComponent(date)}`,
      { headers: { 'X-Intake-Key': INTAKE_KEY } },
    );
    if (!r.ok) throw new Error(`desk responded ${r.status}`);
    const data = await r.json();

    // Re-shape rather than pass through, so a future change on the desk side
    // can never start leaking extra fields to the browser.
    const body = {
      date,
      slots: Array.isArray(data.slots) && data.slots.length ? data.slots : PUBLIC_SLOTS,
      blocked: Array.isArray(data.blocked) ? data.blocked : [],
      live: true,
    };
    cache.set(date, { body, expires: Date.now() + CACHE_MS });
    if (cache.size > 200) {
      for (const [k, v] of cache) if (Date.now() > v.expires) cache.delete(k);
    }
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(body);
  } catch (err) {
    // Degrade to "everything open" rather than breaking the page. The booking
    // POST re-checks and returns 409 if the slot has gone, so the worst case is
    // one apologetic message, not a lost patient.
    console.error('availability lookup failed:', err.message);
    return res.status(200).json({ date, slots: PUBLIC_SLOTS, blocked: [], live: false });
  }
}
