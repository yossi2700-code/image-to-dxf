import { config } from 'dotenv';
config();

const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.log('NO KEY FOUND - OPENAI_API_KEY is not set');
} else {
  console.log('Key starts with:', key.substring(0, 20) + '...');
  console.log('Key length:', key.length);
  console.log('Key type (sk-proj or sk-):', key.startsWith('sk-proj') ? 'sk-proj (new format)' : 'sk- (old format)');
}

// Test the key
try {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${key}` }
  });
  const data = await response.json();
  if (response.ok) {
    console.log('✅ API Key is VALID - models accessible');
  } else {
    console.log('❌ API Key ERROR:', data.error?.code, data.error?.message);
  }
} catch (e) {
  console.log('Network error:', e.message);
}
