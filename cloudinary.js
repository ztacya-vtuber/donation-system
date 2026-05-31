// lib/cloudinary.js
import crypto from 'crypto';
import https from 'https';

export function uploadToCloudinary(base64Data, publicId) {
  return new Promise((resolve, reject) => {
    const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
    const API_KEY = process.env.CLOUDINARY_API_KEY;
    const API_SECRET = process.env.CLOUDINARY_API_SECRET;
    if (!CLOUD || !API_KEY || !API_SECRET) return reject(new Error('Missing Cloudinary env vars'));

    const imageData = base64Data.replace(/^data:[^;]+;base64,/, '');
    const timestamp = Math.floor(Date.now() / 1000);
    const sigStr = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
    const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

    const body = new URLSearchParams({
      file: `data:image/png;base64,${imageData}`,
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: API_KEY,
      signature
    }).toString();

    const buf = Buffer.from(body);
    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUD}/image/upload`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': buf.length
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
    req.write(buf);
    req.end();
  });
}

export function uploadAudioToCloudinary(base64Data, publicId) {
  return new Promise((resolve, reject) => {
    const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
    const API_KEY = process.env.CLOUDINARY_API_KEY;
    const API_SECRET = process.env.CLOUDINARY_API_SECRET;
    if (!CLOUD || !API_KEY || !API_SECRET) return reject(new Error('Missing Cloudinary env vars'));

    const audioData = base64Data.replace(/^data:[^;]+;base64,/, '');
    const timestamp = Math.floor(Date.now() / 1000);
    const sigStr = `public_id=${publicId}&resource_type=video&timestamp=${timestamp}${API_SECRET}`;
    const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

    const body = new URLSearchParams({
      file: `data:audio/mpeg;base64,${audioData}`,
      public_id: publicId,
      resource_type: 'video',
      timestamp: String(timestamp),
      api_key: API_KEY,
      signature
    }).toString();

    const buf = Buffer.from(body);
    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUD}/video/upload`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': buf.length
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
    req.write(buf);
    req.end();
  });
}
