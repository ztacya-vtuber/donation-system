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

  const sb = getSupabase();

  // Resolve the donor's chosen sound server-side — never trust a raw URL from
  // the client, only accept the id of something the admin actually configured,
  // and only if the donor's amount actually clears the threshold.
  let resolved_sound_id = null;
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
      if (match) resolved_sound_id = sound_id;
    }
  }

  // Instead of writing straight to `donations`, we park this as a pending
  // record waiting for MacroDroid to confirm the matching bank notification.
  // expires_at gives the matcher a window to find this record; after that
  // it's stale and won't be auto-matched anymore.
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data: pending, error } = await sb.from('pending').insert({
    name: display_name.trim(),
    message: message?.trim() || '',
    amount: parsed,
    sound_id: resolved_sound_id,
    expires_at,
  }).select().single();

  if (error) {
    console.error('[donate]', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, status: 'pending', pendingId: pending?.id });
}
