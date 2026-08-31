import { getSupabase, cors, DEFAULT_SETTINGS } from '../lib/supabase.js';

const AMOUNT_REGEX = /เงินเข้า\s*([\d,]+\.?\d*)\s*บาท/;

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
  const tolerance = 0.005;

  // หา pending ฝั่ง 'form' ก่อน (กรณี user กรอกฟอร์มไว้ก่อนโอน)
  const { data: matches, error: findError } = await sb
    .from('pending')
    .select('*')
    .eq('source', 'form')
    .gte('amount', parsed - tolerance)
    .lte('amount', parsed + tolerance)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(1);

  if (findError) {
    console.error('[macrodroid] Lookup error:', findError);
    return res.status(500).json({ error: findError.message });
  }

  if (!matches || matches.length === 0) {
    // ยังไม่มีฟอร์มรอไว้ — เก็บ event นี้เป็น 'bank' ไว้ก่อน เผื่อ user
    // จะมากรอกฟอร์มทีหลัง (แทนที่จะทิ้งเงินโอนจริงไปเฉย ๆ)
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertPendingError } = await sb.from('pending').insert({
      amount: parsed,
      source: 'bank',
      expires_at,
    });
    if (insertPendingError) {
      console.error('[macrodroid] Failed to park unmatched bank event:', insertPendingError);
    }
    console.warn('[macrodroid] No form match yet — parked as bank event:', parsed);
    return res.json({ ok: true, matched: false, parked: true, extractedAmount: parsed });
  }

  const match = matches[0];

  const { data: settingsRow } = await sb
    .from('settings')
    .select('value')
    .eq('key', 'site')
    .maybeSingle();
  const settings = { ...DEFAULT_SETTINGS, ...(settingsRow?.value || {}) };

  let sound_url = null;
  if (match.sound_id) {
    const soundOptions = Array.isArray(settings.soundOptions) ? settings.soundOptions : [];
    const soundMatch = soundOptions.find(o => o.id === match.sound_id);
    if (soundMatch) sound_url = soundMatch.url;
  }

  let meme_url = null;
  if (match.meme_id) {
    const memeOptions = Array.isArray(settings.memeOptions) ? settings.memeOptions : [];
    const memeMatch = memeOptions.find(o => o.id === match.meme_id);
    if (memeMatch) meme_url = memeMatch.url;
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
    meme_url,
    ip_address,
    shown: true,
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
    payload: {
      name: match.name,
      message: match.message,
      amount: parsed,
      sound_url,
      meme_url,
      id: donation?.id,
    },
  });

  console.log('[macrodroid] Matched and promoted donation:', match.name, parsed);
  return res.json({ ok: true, matched: true, donation });
}
