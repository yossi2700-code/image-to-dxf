// Full pipeline benchmark with per-step timing
import sharp from 'sharp';
import { thinBinary, applyThreshold, traceCenterlines, erodeBinary } from './server/imageProcessor.ts';

// Create a realistic scanned image (dense content, thick lines)
const w = 1200, h = 1200;

// Simulate a complex scanned image with many thick diagonal lines
const pixels = new Uint8Array(w * h);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    // Dense cross-hatch pattern with 5px thick lines
    const isLine = (x % 15 < 5) || (y % 15 < 5) || (Math.abs(x - y) % 15 < 5);
    pixels[y * w + x] = isLine ? 0 : 255;
  }
}

console.log(`\nFull pipeline benchmark at ${w}x${h} (dense cross-hatch):`);
console.log('='.repeat(50));

// Step 1: applyThreshold
let t = Date.now();
const binary = applyThreshold(pixels, 128);
console.log(`applyThreshold:    ${Date.now() - t}ms`);

// Step 2: erodeBinary (2 passes)
t = Date.now();
const eroded = erodeBinary(binary, w, h, 2);
console.log(`erodeBinary (x2):  ${Date.now() - t}ms`);

// Step 3: thinBinary
t = Date.now();
const thinned = thinBinary(eroded, w, h);
console.log(`thinBinary:        ${Date.now() - t}ms`);

// Step 4: traceCenterlines
t = Date.now();
const polylines = traceCenterlines(thinned, w, h, 2);
console.log(`traceCenterlines:  ${Date.now() - t}ms  (${polylines.length} polylines)`);

console.log('='.repeat(50));

// Also test with 800x800
const w2 = 800, h2 = 800;
const pixels2 = new Uint8Array(w2 * h2);
for (let y = 0; y < h2; y++) {
  for (let x = 0; x < w2; x++) {
    const isLine = (x % 15 < 5) || (y % 15 < 5) || (Math.abs(x - y) % 15 < 5);
    pixels2[y * w2 + x] = isLine ? 0 : 255;
  }
}
console.log(`\nFull pipeline benchmark at ${w2}x${h2}:`);
const binary2 = applyThreshold(pixels2, 128);
t = Date.now(); erodeBinary(binary2, w2, h2, 2); console.log(`erodeBinary (x2):  ${Date.now() - t}ms`);
t = Date.now(); const thinned2 = thinBinary(binary2, w2, h2); console.log(`thinBinary:        ${Date.now() - t}ms`);
t = Date.now(); const pl2 = traceCenterlines(thinned2, w2, h2, 2); console.log(`traceCenterlines:  ${Date.now() - t}ms  (${pl2.length} polylines)`);
