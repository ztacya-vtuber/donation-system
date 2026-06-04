import { createClient } from '@supabase/supabase-js';

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, key);
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export const DEFAULT_SETTINGS = {
  name: 'Ztacya Melrovia',
  greeting: 'At this very hour, you are most welcome.',
  thankyou: 'ขอบคุณมากนะคะ ♡',

  avatarUrl: '',
  bannerUrl: '',
  bgUrl: '',
  qrUrl: '',

  bgColor: '#0a0208',
  accentColor: '#e8a4c8',

  overlayMinAmount: 20,
  overlayAlertSoundUrl: '',
  overlayMinSoundUrl: '',
  overlayImageUrl: '',

  ttsEnabled: true,
  ttsVoice: 'th-TH-PremwadeeNeural',
  ttsRate: 1,
  ttsPitch: 1,

  overlayDuration: 8,
  overlayPosition: 'bottom-left',
  overlayEffect: 'roses',
};
