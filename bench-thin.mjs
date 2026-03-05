// Quick benchmark for thinBinary at 1200x1200
import { thinBinary } from './server/imageProcessor.ts';

// Create a 1200x1200 test image with thick grid lines (worst case)
const w = 1200, h = 1200;
const binary = new Uint8Array(w * h);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const isLine = (x % 20 < 5) || (y % 20 < 5);
    binary[y * w + x] = isLine ? 0 : 255;
  }
}

console.log('Testing thinBinary at 1200x1200 (thick grid)...');
const start = Date.now();
thinBinary(binary, w, h);
console.log('thinBinary 1200x1200 took:', Date.now() - start, 'ms');

// Also test 800x800
const w2 = 800, h2 = 800;
const binary2 = new Uint8Array(w2 * h2);
for (let y = 0; y < h2; y++) {
  for (let x = 0; x < w2; x++) {
    const isLine = (x % 20 < 5) || (y % 20 < 5);
    binary2[y * w2 + x] = isLine ? 0 : 255;
  }
}
const start2 = Date.now();
thinBinary(binary2, w2, h2);
console.log('thinBinary 800x800 took:', Date.now() - start2, 'ms');
