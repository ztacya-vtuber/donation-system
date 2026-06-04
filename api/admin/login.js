import { cors } from '../../lib/supabase.js';

export default function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const { password } = req.body || {};

  if (password === 'admin123') {
    return res.json({ ok: true });
  }

  return res.status(401).json({ ok: false });
}
