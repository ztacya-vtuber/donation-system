import { getSupabase, cors, ADMIN_PASSWORD, DEFAULT_SETTINGS } from '../../lib/supabase.js';
const ALLOWED = [
  'name', 'greeting', 'thankyou',
  'avatarUrl', 'bannerUrl', 'bgUrl', 'bgColor', 'accentColor', 'qrUrl',
  'overlayMinAmount', 'overlayAlertSoundUrl', 'overlayMinSoundUrl', 'overlayImageUrl',
  'ttsEnabled', 'ttsVoice', 'ttsRate', 'ttsPitch',
  'overlayDuration', 'overlayPosition', 'overlayEffect',
  'goalAmount', 'goalMode', 'goalLabel', 'goalFrom', 'goalTo',
  'goalBarBg', 'goalBarFill',
  // เดิมไฟล์นี้ขาด 6 key ด้านล่างนี้ไป — ทำให้แม้ POST จะสำเร็จ (ขึ้น "บันทึกแล้ว")
  // แต่ค่าพวกนี้ถูกกรองทิ้งก่อนเขียนลง DB จริง เพราะไม่อยู่ใน whitelist ของ endpoint นี้
  // (เห็นได้ว่า pages/api/settings.js มีครบ แต่ admin panel ไม่ได้ยิงไปที่ endpoint นั้น)
  'adminNotifyEnabled', 'adminNotifyVolume', 'adminNotifySoundUrl',
  'soundOptions', 'soundMinAmount',
  'memeOptions',
];
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD is not set' });
  const { password, ...newSettings } = req.body || {};
  if (String(password || '') !== String(ADMIN_PASSWORD)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const sb = getSupabase();
    const { data: existing } = await sb.from('settings').select('value').eq('key', 'site').maybeSingle();
    const current = { ...DEFAULT_SETTINGS, ...(existing?.value || {}) };
    const filtered = {};
    for (const key of ALLOWED) {
      if (newSettings[key] !== undefined) filtered[key] = newSettings[key];
    }
    const merged = { ...current, ...filtered };
    const { error } = await sb.from('settings').upsert({ key: 'site', value: merged, updated_at: new Date().toISOString() });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, settings: merged });
  } catch (e) {
    console.error('[admin/settings]', e);
    return res.status(500).json({ error: e.message });
  }
}
