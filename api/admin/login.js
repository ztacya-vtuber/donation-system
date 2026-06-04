import { cors, ADMIN_PASSWORD } from '../../lib/supabase.js';

export default function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({
      ok: false,
      error: 'ADMIN_PASSWORD is not set',
    });
  }

  const { password } = req.body || {};

  if (String(password || '') !== String(ADMIN_PASSWORD)) {
    return res.status(401).json({
      ok: false,
      error: 'รหัสผ่านไม่ถูกต้อง',
    });
  }

  return res.status(200).json({ ok: true });
}
