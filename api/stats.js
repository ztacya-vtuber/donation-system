// api/stats.js
import { getSupabase, cors } from '../lib/supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const sb = getSupabase();
    const { data } = await sb.from('donations').select('name, amount, date');
    const rows = data || [];

    const totalAmount = rows.reduce((s, d) => s + Number(d.amount), 0);
    const todayStr = new Date().toDateString();
    const todayAmount = rows
      .filter(d => new Date(d.date).toDateString() === todayStr)
      .reduce((s, d) => s + Number(d.amount), 0);
    const uniqueDonors = new Set(rows.map(d => d.name)).size;

    res.json({ totalAmount, totalCount: rows.length, todayAmount, uniqueDonors });
  } catch (e) {
    res.json({ totalAmount: 0, totalCount: 0, todayAmount: 0, uniqueDonors: 0 });
  }
}
