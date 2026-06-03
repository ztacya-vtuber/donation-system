import { getSupabase } from '../lib/supabase.js';
import Anthropic from '@anthropic-ai/sdk';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { image, name, message, pendingId } = req.body || {};
  if (!image || !name) return res.status(400).json({ error: 'Missing fields' });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const base64 = image.replace(/^data:image\/\w+;base64,/, '');
    const mediaType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          {
            type: 'text',
            text: 'นี่คือสลิปโอนเงิน กรุณาตรวจสอบว่าเป็นสลิปโอนเงินจริงหรือไม่ และระบุยอดเงินที่โอน ตอบเป็น JSON เท่านั้น: {"valid": true/false, "amount": number_or_null, "reason": "string"}'
          }
        ]
      }]
    });

    const text = response.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    if (!result.valid || !result.amount) {
      return res.json({ ok: false, error: 'ไม่พบสลิปโอนเงินที่ถูกต้อง' });
    }

    const sb = getSupabase();

    if (pendingId) {
      await sb.from('pending_donations').delete().eq('id', pendingId);
    }

    const { data: donation, error: insertError } = await sb.from('donations').insert({
      name,
      message: message || '',
      amount: result.amount
    }).select().single();

    if (insertError) {
      console.error('[verify-slip] Insert error:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    await sb.channel('donations').send({
      type: 'broadcast',
      event: 'new_donation',
      payload: { name, message: message || '', amount: result.amount, id: donation?.id }
    });

    res.json({ ok: true, amount: result.amount, donation });

  } catch (e) {
    console.error('[verify-slip]', e.message);
    res.status(500).json({ error: e.message });
  }
}
