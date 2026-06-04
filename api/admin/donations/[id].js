import { getSupabase, cors, ADMIN_PASSWORD } from '../../../lib/supabase.js';

async function broadcastDonation(donation) {
  const url = `${process.env.SUPABASE_URL}/realtime/v1/api/broadcast`;
  const body = JSON.stringify({
    messages: [{
      topic: 'realtime:donations',
      event: 'new_donation',
      payload: {
        name: donation.name,
        message: donation.message || '',
        amount: donation.amount,
        id: donation.id,
      },
    }],
  });
  // Supabase broadcast REST ต้องใช้ anon key (ไม่ใช่ service role)
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
    },
    body,
  });
  const text = await r.text();
  console.log('[broadcast]', r.status, text);
  return r.status;
}

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
        .update({ shown: true })
        .eq('id', id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });

      const bStatus = await broadcastDonation(donation).catch(e => {
        console.warn('[broadcast] failed:', e.message);
        return 0;
      });

      return res.json({ ok: true, donation, broadcastStatus: bStatus });
    }

    if (action === 'reject') {
      const { error } = await sb.from('donations').delete().eq('id', id);
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
      .update({ name: name.trim(), amount: parsed, message: (message || '').trim() })
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
