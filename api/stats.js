// api/stats.js
import { getSupabase, cors } from '../lib/supabase.js';
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Cache-Control', 'no-store'); // ← กัน Vercel cache
  try {
    const sb = getSupabase();
    const { data } = await sb.from('donations').select('name, amount, date').eq('shown', true);
    const rows = data || [];
    const totalAmount  = rows.reduce((s,d)=>s+Number(d.amount),0);
    const todayStr     = new Date().toDateString();
    const todayAmount  = rows.filter(d=>new Date(d.date).toDateString()===todayStr).reduce((s,d)=>s+Number(d.amount),0);
    const uniqueDonors = new Set(rows.map(d=>d.name)).size;
    const from = req.query?.from;
    const to   = req.query?.to;
    let rangeAmount = null;
    let rangeCount  = null;
    if (from || to) {
      const fromDate = from ? new Date(from) : new Date(0);
      const toDate   = to   ? new Date(to)   : new Date('2099-12-31');
      toDate.setHours(23,59,59,999);
      const rangeRows = rows.filter(d => {
        const d2 = new Date(d.date);
        return d2 >= fromDate && d2 <= toDate;
      });
      rangeAmount = rangeRows.reduce((s,d)=>s+Number(d.amount),0);
      rangeCount  = rangeRows.length;
    }
    res.json({ totalAmount, totalCount: rows.length, todayAmount, uniqueDonors, rangeAmount, rangeCount });
  } catch(e) {
    res.json({ totalAmount:0, totalCount:0, todayAmount:0, uniqueDonors:0, rangeAmount:null, rangeCount:null });
  }
}
