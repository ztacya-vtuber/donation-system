import crypto from 'crypto';
import FormData from 'form-data';
import https from 'https';

async function cloudinaryUpload(CLOUD, endpoint, formFields, fileBuffer, mimeType) {
  const form = new FormData();
  
  for (const [key, value] of Object.entries(formFields)) {
    form.append(key, value);
  }
  form.append('file', fileBuffer, { contentType: mimeType, filename: 'upload' });

  return new Promise((resolve, reject) => {
    const headers = form.getHeaders();
    const formBuffer = form.getBuffer();

    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUD}/${endpoint}`,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': formBuffer.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.secure_url) resolve(result.secure_url);
          else reject(new Error(result.error?.message || 'Upload failed'));
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(formBuffer);
    req.end();
  });
}

function makeSignature(publicId, timestamp, apiSecret) {
  const sigStr = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  return crypto.createHash('sha1').update(sigStr).digest('hex');
}

export async function uploadToCloudinary(base64Data, publicId) {
  const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;
  if (!CLOUD || !API_KEY || !API_SECRET) throw new Error('Missing Cloudinary env vars');

  const imageData = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(imageData, 'base64');
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = makeSignature(publicId, timestamp, API_SECRET);

  return cloudinaryUpload(CLOUD, 'image/upload', {
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: API_KEY,
    signature
  }, buffer, 'image/png');
}

export async function uploadAudioToCloudinary(base64Data, publicId) {
  const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;
  if (!CLOUD || !API_KEY || !API_SECRET) throw new Error('Missing Cloudinary env vars');

  const audioData = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(audioData, 'base64');
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = makeSignature(publicId, timestamp, API_SECRET);

  return cloudinaryUpload(CLOUD, 'video/upload', {
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: API_KEY,
    signature
  }, buffer, 'audio/mpeg');
}
