// api/donate.js
import { getSupabase, cors } from '../lib/supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, message } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Missing name' });

  try {
    const sb = getSupabase();
    // Insert into pending_donations for LINE webhook matching
    await sb.from('pending_donations').insert({
      name: name.trim(),
      message: (message || '').trim(),
    });

    // Clean up old pending (older than 15 min)
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await sb.from('pending_donations').delete().lt('created_at', cutoff);

    res.json({ ok: true });
  } catch (e) {
    console.error('[donate]', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
}
