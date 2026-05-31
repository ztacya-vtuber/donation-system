// api/top.js
import { getSupabase, cors } from '../lib/supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const sb = getSupabase();
    const { data } = await sb.from('donations').select('name, amount');
    const rows = data || [];
    const totals = {};
    rows.forEach(d => {
      if (!totals[d.name]) totals[d.name] = { name: d.name, total: 0, count: 0 };
      totals[d.name].total += Number(d.amount);
      totals[d.name].count += 1;
    });
    const sorted = Object.values(totals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 100);
    res.json(sorted);
  } catch (e) {
    res.json([]);
  }
}
