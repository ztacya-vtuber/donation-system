import { getSupabase, cors, DEFAULT_SETTINGS } from '../lib/supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { display_name, message, amount, sound_id, meme_id } = req.body || {};
  if (!display_name?.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ' });
  }
  const parsed = Number(amount);
  if (!parsed || parsed <= 0) {
    return res.status(400).json({ error: 'จำนวนเงินไม่ถูกต้อง' });
  }

  const sb = getSupabase();

  const { data: settingsRow } = await sb
    .from('settings')
    .select('value')
    .eq('key', 'site')
    .maybeSingle();
  const settings = { ...DEFAULT_SETTINGS, ...(settingsRow?.value || {}) };

  // ยอด 10 บาทขึ้นไป เลือกเสียงและ/หรือมีมได้ทั้งคู่
  let resolved_sound_id = null;
  if (sound_id && parsed >= 10) {
    const soundOptions = Array.isArray(settings.soundOptions) ? settings.soundOptions : [];
    if (soundOptions.find(o => o.id === sound_id)) resolved_sound_id = sound_id;
  }

  let resolved_meme_id = null;
  if (meme_id && parsed >= 10) {
    const memeOptions = Array.isArray(settings.memeOptions) ? settings.memeOptions : [];
    if (memeOptions.find(o => o.id === meme_id)) resolved_meme_id = meme_id;
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
      const soundOptions = Array.isArray(settings.soundOptions) ? settings.soundOptions : [];
      const soundMatch = soundOptions.find(o => o.id === resolved_sound_id);
      if (soundMatch) sound_url = soundMatch.url;
    }

    let meme_url = null;
    if (resolved_meme_id) {
      const memeOptions = Array.isArray(settings.memeOptions) ? settings.memeOptions : [];
      const memeMatch = memeOptions.find(o => o.id === resolved_meme_id);
      if (memeMatch) meme_url = memeMatch.url;
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
      meme_url,
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
      payload: {
        name: display_name.trim(),
        message: message?.trim() || '',
        amount: parsed,
        sound_url,
        meme_url,
        id: donation?.id,
      },
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
    meme_id: resolved_meme_id,
    source: 'form',
    expires_at,
  }).select().single();

  if (error) {
    console.error('[donate]', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, status: 'pending', pendingId: pending?.id });
}
