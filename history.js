// api/history.js
import { getSupabase, cors } from '../lib/supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const offset = (page - 1) * limit;

  try {
    const sb = getSupabase();
    const { data, count } = await sb
      .from('donations')
      .select('*', { count: 'exact' })
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    res.json({
      total: count || 0,
      page,
      limit,
      data: data || []
    });
  } catch (e) {
    console.error('[history]', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
}
