import { getSupabase, cors, ADMIN_PASSWORD } from '../../lib/supabase.js';
import { uploadToCloudinary, uploadAudioToCloudinary } from '../../lib/cloudinary.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { password, filename, data, type, settingKey } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  if (!filename || !data) return res.status(400).json({ error: 'Missing fields' });

  try {
    const baseName = filename.replace(/\.[^.]+$/, '');
    const publicId = 'donation/' + baseName + '_' + Date.now();  // ← เพิ่ม timestamp
    let url;
    if (type === 'audio') {
      url = await uploadAudioToCloudinary(data, publicId);
    } else {
      url = await uploadToCloudinary(data, publicId);
    }

    if (settingKey) {
      const sb = getSupabase();
      const { error } = await sb.rpc('set_setting_key', { p_key: settingKey, p_value: url });
      if (error) {
        console.error('[upload] rpc error:', error);
        return res.status(500).json({ error: error.message });
      }
    }

    res.json({ ok: true, url });
  } catch (e) {
    console.error('[upload]', e.message);
    res.status(500).json({ error: e.message });
  }
}
