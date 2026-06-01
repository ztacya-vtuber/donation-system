// api/webhook.js
import crypto from 'crypto';
import { getSupabase } from '../lib/supabase.js';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-line-signature'];
  const secret = process.env.LINE_CHANNEL_SECRET || '';

  if (secret) {
    const hash = crypto.createHmac('SHA256', secret).update(rawBody).digest('base64');
    if (hash !== signature) {
      console.warn('[webhook] Invalid LINE signature');
      return res.status(401).send('Unauthorized');
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    return res.status(400).send('Bad JSON');
  }

  const sb = getSupabase();

  for (const event of (parsed.events || [])) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue;

    const text = event.message.text;
    console.log('[LINE] Received:', text);

    const m = text.match(/([\d,]+\.?\d*)\s*(บาท|THB|thb|฿)/i);
    if (!m) continue;

    const amount = parseFloat(m[1].replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) continue;

    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: pending } = await sb
      .from('pending_donations')
      .select('*')
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1);

    let name = 'Anonymous';
    let message = '';

    if (pending && pending.length > 0) {
      const match = pending[0];
      name = match.name;
      message = match.message;
      await sb.from('pending_donations').delete().eq('id', match.id);
    }

    const { data: donation, error: insertError } = await sb.from('donations').insert({
      name,
      message,
      amount
    }).select().single();

    if (insertError) {
      console.error('[webhook] Insert error:', insertError);
      continue;
    }

    await sb.channel('donations').send({
      type: 'broadcast',
      event: 'new_donation',
      payload: { name, message, amount, id: donation?.id }
    });

    console.log('[LINE] Matched donation:', name, amount);
  }

  res.json({ ok: true });
}
