export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'site')
      .single();
    const merged = { ...DEFAULT_SETTINGS, ...(data?.value || {}) };
    
    // เพิ่มบรรทัดนี้บรรทัดเดียว ✨
    res.setHeader('Cache-Control', 'no-store');
    
    res.json(merged);
  } catch (e) {
    res.json(DEFAULT_SETTINGS);
  }
}
// api/settings.js
import { getSupabase, cors, DEFAULT_SETTINGS } from '../lib/supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'site')
      .single();

    const merged = { ...DEFAULT_SETTINGS, ...(data?.value || {}) };
    res.json(merged);
  } catch (e) {
    res.json(DEFAULT_SETTINGS);
  }
}
