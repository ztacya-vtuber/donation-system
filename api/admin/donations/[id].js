import { getSupabase, cors, ADMIN_PASSWORD } from '../../../lib/supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const body = req.body || {};
  const { password } = body;

  if (String(password || '') !== String(ADMIN_PASSWORD || '')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sb = getSupabase();

  if (req.method === 'PATCH') {
    const { action } = body;

    if (action === 'approve') {
      const { data: donation, error } = await sb
        .from('donations')
        .update({ status: 'approved' })
        .eq('id', id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });

      await sb.channel('donations').send({
        type: 'broadcast',
        event: 'new_donation',
        payload: {
          name: donation.name,
          message: donation.message || '',
          amount: donation.amount,
          id: donation.id,
        },
      });

      return res.json({ ok: true, donation });
    }

    if (action === 'reject') {
      const { error } = await sb
        .from('donations')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  if (req.method === 'PUT') {
    const { name, amount, message } = body;
    const parsed = parseFloat(amount);

    if (!name?.trim() || isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ error: 'Invalid data' });
    }

    const { error } = await sb
      .from('donations')
      .update({
        name: name.trim(),
        amount: parsed,
        message: (message || '').trim(),
      })
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { error } = await sb.from('donations').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
