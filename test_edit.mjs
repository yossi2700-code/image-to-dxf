import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 180000,
  maxRetries: 0
});

const imgBuffer = fs.readFileSync('/home/ubuntu/upload/IMG_3298.jpeg');

console.log('Buffer size:', imgBuffer.length);
console.log('Creating File...');

const file = new File([new Uint8Array(imgBuffer)], 'source.png', { type: 'image/png' });
console.log('File created, size:', file.size);

console.log('Calling images.edit...');
try {
  const response = await openai.images.edit({
    model: 'gpt-image-1',
    image: file,
    prompt: 'Redraw as clean black and white line art',
    n: 1,
    size: '1024x1024'
  });
  console.log('SUCCESS! Got response:', !!response.data?.[0]);
  console.log('Has b64_json:', !!response.data?.[0]?.b64_json);
} catch (err) {
  console.error('ERROR:', err.message);
  console.error('Status:', err.status);
  console.error('Code:', err.code);
}
