import { getSupabase, cors, ADMIN_PASSWORD } from '../../lib/supabase.js';

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD is not set' });
  }

  const password = req.method === 'GET'
    ? req.query?.password
    : req.body?.password;

  if (String(password || '') !== String(ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sb = getSupabase();

  if (req.method === 'POST') {
    const { name, amount, message, date } = req.body || {};
    const parsed = parseFloat(amount);

    if (!name?.trim() || isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ error: 'Invalid data' });
    }

    const { data: donation, error } = await sb
      .from('donations')
      .insert({
        name: name.trim(),
        amount: parsed,
        message: (message || '').trim(),
        date: date || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    await sb.channel('donations').send({
      type: 'broadcast',
      event: 'new_donation',
      payload: {
        name: donation.name,
        message: donation.message,
        amount: donation.amount,
        id: donation.id,
      },
    });

    return res.json({ ok: true, donation });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
