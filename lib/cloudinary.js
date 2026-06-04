import crypto from 'crypto';
import FormData from 'form-data';
import https from 'https';

function parseBase64(base64Data, fallbackMime) {
  const match = String(base64Data).match(/^data:([^;]+);base64,(.*)$/);
  if (match) {
    return {
      buffer: Buffer.from(match[2], 'base64'),
      mimeType: match[1],
    };
  }

  return {
    buffer: Buffer.from(base64Data, 'base64'),
    mimeType: fallbackMime,
  };
}

function makeSignature(publicId, timestamp, apiSecret) {
  const sigStr = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  return crypto.createHash('sha1').update(sigStr).digest('hex');
}

async function cloudinaryUpload(cloudName, endpoint, formFields, fileBuffer, mimeType) {
  const form = new FormData();

  for (const [key, value] of Object.entries(formFields)) {
    form.append(key, value);
  }

  form.append('file', fileBuffer, {
    contentType: mimeType,
    filename: 'upload',
  });

  return new Promise((resolve, reject) => {
    const formBuffer = form.getBuffer();
    const headers = {
      ...form.getHeaders(),
      'Content-Length': formBuffer.length,
    };

    const req = https.request({
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${cloudName}/${endpoint}`,
      method: 'POST',
      headers,
    }, (response) => {
      let body = '';

      response.on('data', chunk => {
        body += chunk;
      });

      response.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.secure_url) return resolve(result.secure_url);
          reject(new Error(result.error?.message || 'Upload failed'));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(formBuffer);
    req.end();
  });
}

export async function uploadToCloudinary(base64Data, publicId) {
  const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD || !API_KEY || !API_SECRET) {
    throw new Error('Missing Cloudinary env vars');
  }

  const { buffer, mimeType } = parseBase64(base64Data, 'image/png');
  const timestamp = Math.floor(Date.now() / 1000);

  return cloudinaryUpload(CLOUD, 'image/upload', {
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: API_KEY,
    signature: makeSignature(publicId, timestamp, API_SECRET),
  }, buffer, mimeType);
}

export async function uploadAudioToCloudinary(base64Data, publicId) {
  const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD || !API_KEY || !API_SECRET) {
    throw new Error('Missing Cloudinary env vars');
  }

  const { buffer, mimeType } = parseBase64(base64Data, 'audio/mpeg');
  const timestamp = Math.floor(Date.now() / 1000);

  return cloudinaryUpload(CLOUD, 'video/upload', {
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: API_KEY,
    signature: makeSignature(publicId, timestamp, API_SECRET),
  }, buffer, mimeType);
}
