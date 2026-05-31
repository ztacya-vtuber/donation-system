// lib/cloudinary.js
import crypto from 'crypto';
import https from 'https';

function cloudinaryRequest(CLOUD, path, formData) {
  return new Promise((resolve, reject) => {
    // ใช้ multipart แทน URLSearchParams เพื่อให้ base64 ไม่โดน encode ผิด
    const boundary = '----FormBoundary' + crypto.randomBytes(8).toString('hex');
    let body = '';
    for (const [key, value] of Object.entries(formData)) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
    }
    body += `--${boundary}--\r\n`;
    const buf = Buffer.from(body, 'utf8');
    const options = {
      hostname: 'api.cloudinary.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
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

export function uploadToCloudinary(base64Data, publicId) {
  const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;
  if (!CLOUD || !API_KEY || !API_SECRET) return Promise.reject(new Error('Missing Cloudinary env vars'));

  const imageData = base64Data.replace(/^data:[^;]+;base64,/, '');
  const timestamp = Math.floor(Date.now() / 1000);
  // signature: เรียง key alphabetically ไม่ใส่ resource_type สำหรับ image
  const sigStr = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
  const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

  return cloudinaryRequest(CLOUD, `/v1_1/${CLOUD}/image/upload`, {
    file: `data:image/png;base64,${imageData}`,
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: API_KEY,
    signature
  });
}

export function uploadAudioToCloudinary(base64Data, publicId) {
  const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;
  if (!CLOUD || !API_KEY || !API_SECRET) return Promise.reject(new Error('Missing Cloudinary env vars'));

  const audioData = base64Data.replace(/^data:[^;]+;base64,/, '');
  const timestamp = Math.floor(Date.now() / 1000);
  // signature: ไม่ใส่ resource_type — Cloudinary ไม่นับ resource_type ใน sig
  const sigStr = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
  const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

  return cloudinaryRequest(CLOUD, `/v1_1/${CLOUD}/video/upload`, {
    file: `data:audio/mpeg;base64,${audioData}`,
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: API_KEY,
    signature
  });
}
