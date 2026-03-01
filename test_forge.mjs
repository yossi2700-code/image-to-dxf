import fs from 'fs';

const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;

console.log('FORGE_URL:', FORGE_URL ? FORGE_URL.substring(0, 30) + '...' : 'NOT SET');
console.log('FORGE_KEY:', FORGE_KEY ? 'SET' : 'NOT SET');

const imgBuffer = fs.readFileSync('/home/ubuntu/upload/IMG_3298.jpeg');
const b64 = imgBuffer.toString('base64');

const baseUrl = FORGE_URL.endsWith('/') ? FORGE_URL : FORGE_URL + '/';
const fullUrl = new URL('images.v1.ImageService/GenerateImage', baseUrl).toString();
console.log('Calling:', fullUrl);

const response = await fetch(fullUrl, {
  method: 'POST',
  headers: {
    'accept': 'application/json',
    'content-type': 'application/json',
    'connect-protocol-version': '1',
    'authorization': `Bearer ${FORGE_KEY}`,
  },
  body: JSON.stringify({
    prompt: 'Redraw as clean black and white line art, no text, no shading',
    original_images: [{ b64Json: b64, mimeType: 'image/jpeg' }]
  })
});

console.log('Status:', response.status);
if (response.ok) {
  const result = await response.json();
  console.log('SUCCESS! Has image:', !!result.image);
  console.log('b64 length:', result.image?.b64Json?.length);
} else {
  const text = await response.text();
  console.log('ERROR:', text.substring(0, 200));
}
