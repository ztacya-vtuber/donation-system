import { getSupabase, cors, DEFAULT_SETTINGS } from '../lib/supabase.js';
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { display_name, message, amount, sound_id } = req.body || {};
  if (!display_name?.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ' });
  }
  const parsed = Number(amount);
  if (!parsed || parsed <= 0) {
    return res.status(400).json({ error: 'จำนวนเงินไม่ถูกต้อง' });
  }
  const ip_address =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;
  const sb = getSupabase();

  // Resolve the donor's chosen sound server-side — never trust a raw URL from
  // the client, only accept the id of something the admin actually configured,
  // and only if the donor's amount actually clears the threshold.
  let sound_url = null;
  if (sound_id) {
    const { data: settingsRow } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'site')
      .maybeSingle();
    const settings = { ...DEFAULT_SETTINGS, ...(settingsRow?.value || {}) };
    const minAmount = Number(settings.soundMinAmount ?? DEFAULT_SETTINGS.soundMinAmount);
    if (parsed >= minAmount) {
      const options = Array.isArray(settings.soundOptions) ? settings.soundOptions : [];
      const match = options.find(o => o.id === sound_id);
      if (match) sound_url = match.url;
    }
  }

  const { error } = await sb.from('donations').insert({
    name: display_name.trim(),
    message: message?.trim() || '',
    amount: parsed,
    sound_url,
    ip_address,
    shown: false,
    date: new Date().toISOString(), // ← เพิ่มตรงนี้
  });
  if (error) {
    console.error('[donate]', error);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ ok: true, status: 'pending' });
}
