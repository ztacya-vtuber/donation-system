import { getSupabase, cors, ADMIN_PASSWORD } from '../../lib/supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // รับ password จาก header หรือ query string
  const password = req.headers['x-admin-password'] || req.query.password || '';
  if (String(password) !== String(ADMIN_PASSWORD || '')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from('donations')
    .select('*')
    .eq('shown', false)
    .order('date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, data: data || [] });
}
