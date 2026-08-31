import { getSupabase, cors, ADMIN_PASSWORD, DEFAULT_SETTINGS } from '../lib/supabase.js';

const ALLOWED = [
  'name', 'greeting', 'thankyou',
  'avatarUrl', 'bannerUrl', 'bgUrl', 'bgColor', 'accentColor', 'qrUrl',
  'overlayMinAmount', 'overlayAlertSoundUrl', 'overlayMinSoundUrl', 'overlayImageUrl',
  'ttsEnabled', 'ttsVoice', 'ttsRate', 'ttsPitch',
  'overlayDuration', 'overlayPosition', 'overlayEffect',
  'goalAmount', 'goalMode', 'goalLabel', 'goalFrom', 'goalTo',
  'goalBarBg', 'goalBarFill',
  'adminNotifyEnabled', 'adminNotifyVolume', 'adminNotifySoundUrl',
  'soundOptions', 'soundMinAmount',
  'memeOptions',
];

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getSupabase();

  // GET = อ่าน settings แบบสาธารณะ ไม่ต้องมีรหัสผ่าน — ใช้โดยหน้า
  // index.html, overlay.html, goal-overlay.html เพื่อดึงค่ามาแสดงผล
  if (req.method === 'GET') {
    try {
      const { data: existing, error } = await sb
        .from('settings')
        .select('value')
        .eq('key', 'site')
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      const merged = { ...DEFAULT_SETTINGS, ...(existing?.value || {}) };
      return res.json(merged);
    } catch (e) {
      console.error('[settings GET]', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // POST = แก้ settings — เฉพาะแอดมินที่มีรหัสผ่านถูกต้องเท่านั้น
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD is not set' });

  const { password, ...newSettings } = req.body || {};
  if (String(password || '') !== String(ADMIN_PASSWORD)) return res.status(401).json({ error: 'Unauthorized' });

  try {
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
