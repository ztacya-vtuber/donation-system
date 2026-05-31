// api/settings.js
import { getSupabase, cors, DEFAULT_SETTINGS } from '../lib/supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 'no-store');
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('settings')
      .select('value')
      .eq('key', 'site')
      .single();
    console.log('[settings] data:', JSON.stringify(data), 'error:', error?.message);
    if (error) throw error;
    const merged = { ...DEFAULT_SETTINGS, ...data.value };
    res.json(merged);
  } catch (e) {
    console.error('[settings] catch:', e.message);
    res.json(DEFAULT_SETTINGS);
  }
}
