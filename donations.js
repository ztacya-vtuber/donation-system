// api/admin/donations.js  (handles POST + GET)
import { getSupabase, cors, ADMIN_PASSWORD } from '../../lib/supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { password } = req.body || req.query || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });

  const sb = getSupabase();

  if (req.method === 'POST') {
    // Add manual donation
    const { name, amount, message, date } = req.body;
    const parsed = parseFloat(amount);
    if (!name?.trim() || isNaN(parsed) || parsed <= 0)
      return res.status(400).json({ error: 'Invalid data' });

    const { data: donation } = await sb.from('donations').insert({
      name: name.trim(),
      amount: parsed,
      message: (message || '').trim(),
      date: date || new Date().toISOString()
    }).select().single();

    // Broadcast to overlay
    await sb.channel('donations').send({
      type: 'broadcast',
      event: 'new_donation',
      payload: { name: donation.name, message: donation.message, amount: donation.amount, id: donation.id }
    });

    return res.json({ ok: true, donation });
  }

  res.status(405).end();
}
