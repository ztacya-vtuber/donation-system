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

  const nowIso = new Date().toISOString();
  const tolerance = 0.005;

  // เช็คก่อนว่ามี "bank event" ที่ยอดตรงกันรออยู่แล้วไหม (กรณีโอนเงินก่อน
  // แล้วเพิ่งมากรอกฟอร์มทีหลัง) — ถ้ามี ให้ยืนยันเป็นโดเนทได้เลยทันที
  const { data: bankMatches, error: findError } = await sb
    .from('pending')
    .select('*')
    .eq('source', 'bank')
    .gte('amount', parsed - tolerance)
    .lte('amount', parsed + tolerance)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(1);

  if (findError) {
    console.error('[donate] Lookup error:', findError);
    return res.status(500).json({ error: findError.message });
  }

  if (bankMatches && bankMatches.length > 0) {
    const bankEvent = bankMatches[0];

    let sound_url = null;
    if (resolved_sound_id) {
      const { data: settingsRow } = await sb
        .from('settings')
        .select('value')
        .eq('key', 'site')
        .maybeSingle();
      const settings = { ...DEFAULT_SETTINGS, ...(settingsRow?.value || {}) };
      const options = Array.isArray(settings.soundOptions) ? settings.soundOptions : [];
      const soundMatch = options.find(o => o.id === resolved_sound_id);
      if (soundMatch) sound_url = soundMatch.url;
    }

    const ip_address =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    const { data: donation, error: insertError } = await sb.from('donations').insert({
      name: display_name.trim(),
      message: message?.trim() || '',
      amount: parsed,
      sound_url,
      ip_address,
      shown: true,
      date: new Date().toISOString(),
    }).select().single();

    if (insertError) {
      console.error('[donate] Insert error:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    await sb.from('pending').delete().eq('id', bankEvent.id);

    await sb.channel('donations').send({
      type: 'broadcast',
      event: 'new_donation',
      payload: { name: display_name.trim(), message: message?.trim() || '', amount: parsed, id: donation?.id },
    });

    console.log('[donate] Bank event arrived first — matched immediately:', display_name.trim(), parsed);
    return res.status(200).json({ ok: true, status: 'confirmed', donation });
  }

  // ยังไม่มี bank event รอไว้ — parking เป็น pending ฝั่ง 'form' ตามเดิม
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data: pending, error } = await sb.from('pending').insert({
    name: display_name.trim(),
    message: message?.trim() || '',
    amount: parsed,
    sound_id: resolved_sound_id,
    source: 'form',
    expires_at,
  }).select().single();

  if (error) {
    console.error('[donate]', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, status: 'pending', pendingId: pending?.id });
}
