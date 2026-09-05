// Shared config for the booking proxy functions.
//
// These run on Vercel, server-side. They exist so the patient's browser never
// talks to the desk API directly: that API has no authentication and
// `allow_origins=["*"]`, and the same origin also serves the full patient list.
// The shared secret lives here and only here.

// Overridable so `vercel dev` can point at a desk app running locally.
export const DESK_BASE = process.env.DESK_BASE || 'https://healthywave-desk.fly.dev/api/v1/intake';
export const INTAKE_KEY = process.env.INTAKE_KEY || '';

// Must mirror api/intake.py — MORNING_SLOTS + EVENING_SLOTS.
export const PUBLIC_SLOTS = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
];

export const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

/** Last 10 digits, matching services/sheets.py normalize_phone. */
export const normalizePhone = (p) => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};

/** A real Indian mobile: 10 digits starting 6-9. Mirrors sheets.is_valid_phone. */
export const isValidPhone = (p) => /^[6-9]\d{9}$/.test(normalizePhone(p));

/** fetch with a hard timeout — the desk app is a 256MB Fly machine talking to
 *  Google Sheets, so a slow read must not hang the patient's request. */
export async function fetchWithTimeout(url, options = {}, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort per-IP rate limit. Module scope, so it resets on cold start and
 *  is per-instance — enough to stop a naive script, not a real defence. The
 *  real protection is that this is the only route to the Sheets-backed API. */
const hits = new Map();
export function rateLimited(ip, max, windowMs) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { n: 1, reset: now + windowMs });
    if (hits.size > 5000) hits.clear();   // crude bound on memory
    return false;
  }
  rec.n += 1;
  return rec.n > max;
}

export const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
