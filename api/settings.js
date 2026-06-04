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
      .maybeSingle();

    if (error) throw error;

    res.json({
      ...DEFAULT_SETTINGS,
      ...(data?.value || {}),
    });
  } catch (e) {
    console.error('[settings]', e);
    res.json(DEFAULT_SETTINGS);
  }
}
