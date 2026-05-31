// api/admin/login.js
import { cors, ADMIN_PASSWORD } from '../../lib/supabase.js';

export default function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const { password } = req.body || {};
  res.json({ ok: password === ADMIN_PASSWORD });
}
