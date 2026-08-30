import { getSupabase, cors, DEFAULT_SETTINGS } from '../lib/supabase.js';

// Matches Thungngern's notification format, e.g. "เงินเข้า 1 บาท"
// Captures the numeric amount (supports thousands separators and decimals).
const AMOUNT_REGEX = /เงินเข้า\s*([\d,]+\.?\d*)\s*บาท/;

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Shared-secret check first, before touching anything else. Anyone who
  // doesn't have this token gets rejected immediately — this endpoint is
  // the only thing standing between "someone claims money arrived" and
  // "a donation actually appears on stream", so it must not be guessable.
  const token = req.headers['x-secret-token'];
  const expected = process.env.MACRODROID_SECRET;
  if (!expected) {
    console.error('[macrodroid] MACRODROID_SECRET is not set on the server');
    return res.status(500).json({ error: 'Server not configured' });
  }
  if (token !== expected) {
    console.warn('[macrodroid] Rejected request with invalid token');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Accept either a raw notification `text` (preferred — MacroDroid just
  // forwards [notification_text] with no processing needed on the phone)
  // or a pre-parsed `amount`, for flexibility.
  const { text, amount } = req.body || {};

  let parsed = null;
  if (typeof amount === 'number' || typeof amount === 'string') {
    parsed = Number(amount);
  }
  if ((!parsed || parsed <= 0) && typeof text === 'string') {
    const match = text.match(AMOUNT_REGEX);
    if (match) {
      parsed = Number(match[1].replace(/,/g, ''));
    }
  }

  if (!parsed || parsed <= 0 || Number.isNaN(parsed)) {
    console.warn('[macrodroid] Could not extract a valid amount from:', { text, amount });
    return res.status(400).json({ error: 'Could not extract a valid amount' });
  }

  const sb = getSupabase();
  const nowIso = new Date().toISOString();

  // Find the oldest still-valid pending donation with this exact amount.
  // Oldest-first (FIFO) is the safest default when two people donate the
  // same amount close together — it matches whichever donor has been
  // waiting longest, rather than guessing.
  const { data: matches, error: findError } = await sb
    .from('pending')
    .select('*')
    .eq('amount', parsed)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(1);

  if (findError) {
    console.error('[macrodroid] Lookup error:', findError);
    return res.status(500).json({ error: findError.message });
  }

  if (!matches || matches.length === 0) {
    // No matching pending donation — log it so it can be checked manually
    // later (e.g. money arrived but the amount typed in the form was wrong).
    console.warn('[macrodroid] No pending match for amount:', parsed);
    return res.json({ ok: true, matched: false, extractedAmount: parsed });
  }

  const match = matches[0];

  // Resolve sound_id -> actual sound_url the same way donate.js does,
  // re-checking against current settings rather than trusting stored state.
  let sound_url = null;
  if (match.sound_id) {
    const { data: settingsRow } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'site')
      .maybeSingle();
    const settings = { ...DEFAULT_SETTINGS, ...(settingsRow?.value || {}) };
    const options = Array.isArray(settings.soundOptions) ? settings.soundOptions : [];
    const soundMatch = options.find(o => o.id === match.sound_id);
    if (soundMatch) sound_url = soundMatch.url;
  }

  const ip_address =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;

  const { data: donation, error: insertError } = await sb.from('donations').insert({
    name: match.name,
    message: match.message,
    amount: parsed,
    sound_url,
    ip_address,
    shown: false, // still goes through the normal overlay display flow
    date: new Date().toISOString(),
  }).select().single();

  if (insertError) {
    console.error('[macrodroid] Insert error:', insertError);
    return res.status(500).json({ error: insertError.message });
  }

  await sb.from('pending').delete().eq('id', match.id);

  await sb.channel('donations').send({
    type: 'broadcast',
    event: 'new_donation',
    payload: { name: match.name, message: match.message, amount: parsed, id: donation?.id },
  });

  console.log('[macrodroid] Matched and promoted donation:', match.name, parsed);
  return res.json({ ok: true, matched: true, donation });
}
