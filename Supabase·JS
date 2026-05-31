// lib/supabase.js
import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getSupabase() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    _client = createClient(url, key);
  }
  return _client;
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export const DEFAULT_SETTINGS = {
  name: 'Ztacya Melrovia',
  greeting: 'At this very hour, you are most welcome.',
  thankyou: 'ขอบคุณมากนะคะ ♡',
  avatarUrl: '',
  bannerUrl: '',
  bgUrl: '',
  bgColor: '#0a0208',
  accentColor: '#e8a4c8',
  qrUrl: '',
  // Overlay settings
  overlayMinAmount: 20,          // ยอดขั้นต่ำที่จะอ่าน TTS
  overlayAlertSoundUrl: '',      // เสียงแจ้งเตือนปกติ (ต่ำกว่าขั้นต่ำ)
  overlayMinSoundUrl: '',        // เสียงแจ้งเตือนพิเศษ (ถึงขั้นต่ำ)
  overlayImageUrl: '',           // รูป/gif ใน alert
  ttsEnabled: true,
  ttsVoice: 'th-TH-PremwadeeNeural',
  ttsRate: 1,
  ttsPitch: 1,
  overlayDuration: 8,
  overlayPosition: 'bottom-left',
  overlayEffect: 'roses',        // 'roses' | 'glow' | 'both' | 'none'
};
