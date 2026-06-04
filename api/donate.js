import { getSupabase, cors } from '../lib/supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { display_name, message, amount } = req.body || {};

  if (!display_name?.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ' });
  }

  const parsed = Number(amount);
  if (!parsed || parsed <= 0) {
    return res.status(400).json({ error: 'จำนวนเงินไม่ถูกต้อง' });
  }

  const ip_address =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;

  const sb = getSupabase();

  const { error } = await sb.from('donations').insert({
    name: display_name.trim(),
    message: message?.trim() || '',
    amount: parsed,
    ip_address,
    shown: false,
  });

  if (error) {
    console.error('[donate]', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, status: 'pending' });
}
