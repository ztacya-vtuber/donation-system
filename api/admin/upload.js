import { getSupabase, cors, ADMIN_PASSWORD, DEFAULT_SETTINGS } from '../../lib/supabase.js';
import { uploadToCloudinary, uploadAudioToCloudinary } from '../../lib/cloudinary.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, filename, data, type, settingKey } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  if (!filename || !data) return res.status(400).json({ error: 'Missing fields' });

  try {
    const baseName = filename.replace(/\.[^.]+$/, '');
    const publicId = 'donation/' + baseName + '_' + Date.now();

    const url = type === 'audio'
      ? await uploadAudioToCloudinary(data, publicId)
      : await uploadToCloudinary(data, publicId);

    if (settingKey) {
      const sb = getSupabase();

      const { data: existing } = await sb
        .from('settings')
        .select('value')
        .eq('key', 'site')
        .maybeSingle();

      const current = { ...DEFAULT_SETTINGS, ...(existing?.value || {}) };
      const merged = { ...current, [settingKey]: url };

      const { error } = await sb.from('settings').upsert({
        key: 'site',
        value: merged,
        updated_at: new Date().toISOString(),
      });

      if (error) return res.status(500).json({ error: error.message });
    }

    res.json({ ok: true, url });
  } catch (e) {
    console.error('[upload]', e);
    res.status(500).json({ error: e.message });
  }
}
