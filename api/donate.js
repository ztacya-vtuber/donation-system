import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { display_name, message, amount } = req.body;

  // Validate
  if (!display_name || typeof display_name !== 'string' || !display_name.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกชื่อ' });
  }
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'จำนวนเงินไม่ถูกต้อง' });
  }

  // Get IP
  const ip_address =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;

  const { error } = await supabase.from('donations').insert({
    display_name: display_name.trim(),
    message: message?.trim() || null,
    amount: Number(amount),
    ip_address,
    status: 'pending',
  });

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ error: 'บันทึกข้อมูลไม่สำเร็จ' });
  }

  return res.status(200).json({ success: true });
}
