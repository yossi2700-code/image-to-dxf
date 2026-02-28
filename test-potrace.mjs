import potrace from 'potrace';
import sharp from 'sharp';
import fs from 'fs';

// Create a simple test PNG: white background, thick black horizontal line
// Using raw pixel data
const width = 200;
const height = 200;
const pixels = new Uint8Array(width * height * 3);

// Fill with white
pixels.fill(255);

// Draw a thick horizontal line (10px wide) in the middle
for (let y = 90; y <= 110; y++) {
  for (let x = 20; x <= 180; x++) {
    const idx = (y * width + x) * 3;
    pixels[idx] = 0;
    pixels[idx+1] = 0;
    pixels[idx+2] = 0;
  }
}

// Also draw a diagonal line
for (let i = 20; i <= 180; i++) {
  const x = i;
  const y = Math.round(20 + (i - 20) * 0.5);
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = (py * width + px) * 3;
        pixels[idx] = 0;
        pixels[idx+1] = 0;
        pixels[idx+2] = 0;
      }
    }
  }
}

const buf = await sharp(Buffer.from(pixels), { raw: { width, height, channels: 3 } })
  .grayscale()
  .threshold(128)
  .png()
  .toBuffer();

fs.writeFileSync('/home/ubuntu/test-input.png', buf);
console.log('Input PNG saved');

// Now trace with potrace
potrace.trace(buf, {
  threshold: 128,
  turdSize: 0,
  optCurve: true,
  optTolerance: 0.2,
}, (err, svg) => {
  if (err) { console.error('potrace error:', err); return; }
  
  fs.writeFileSync('/home/ubuntu/test-output.svg', svg);
  
  const paths = svg.match(/<path/g) || [];
  console.log('Number of paths:', paths.length);
  
  // Check if paths have fill or stroke
  const fillMatch = svg.match(/fill="([^"]*)"/g);
  const strokeMatch = svg.match(/stroke/g);
  console.log('Fill attributes:', fillMatch ? fillMatch.slice(0,3) : 'none');
  console.log('Has stroke:', strokeMatch ? 'yes' : 'no');
  
  // Show first path d attribute
  const dMatch = svg.match(/d="([^"]{0,300})/);
  if (dMatch) console.log('First path d (300 chars):', dMatch[1]);
  
  console.log('\nConclusion:');
  console.log('potrace produces FILLED paths (outlines of shapes)');
  console.log('For a 10px thick line, it creates a CLOSED path around the rectangle');
  console.log('This means: 2 edges (top + bottom of the line) = double line effect in DXF');
});
