// api/admin/upload.js
import { getSupabase, cors, ADMIN_PASSWORD, DEFAULT_SETTINGS } from '../../lib/supabase.js';
import { uploadToCloudinary, uploadAudioToCloudinary } from '../../lib/cloudinary.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const { password, filename, data, type, settingKey } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  if (!filename || !data) return res.status(400).json({ error: 'Missing fields' });
  try {
    const publicId = 'donation/' + filename.replace(/\.[^.]+$/, '');
    let url;
    if (type === 'audio') {
      url = await uploadAudioToCloudinary(data, publicId);
    } else {
      url = await uploadToCloudinary(data, publicId);
    }
    if (settingKey) {
      const sb = getSupabase();
      const { data: existing } = await sb.from('settings').select('value').eq('key','site').single();
      const current = { ...DEFAULT_SETTINGS, ...(existing?.value || {}) };
      const merged = { ...current, [settingKey]: url + '?t=' + Date.now() };
      await sb.from('settings').update({ value: merged, updated_at: new Date().toISOString() }).eq('key', 'site');
    }
    res.json({ ok: true, url });
  } catch (e) {
    console.error('[upload]', e.message);
    res.status(500).json({ error: e.message });
  }
}
