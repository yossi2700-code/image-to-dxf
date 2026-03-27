import 'dotenv/config';
import fs from 'fs';
import { execSync } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OUT_DIR = "/home/ubuntu/grayscale_dolphin";
fs.mkdirSync(OUT_DIR, { recursive: true });

// Read the uploaded image
const srcPath = "/home/ubuntu/upload/IMG_4188.jpeg";
const srcBytes = fs.readFileSync(srcPath);
console.log(`Source: ${Math.round(srcBytes.length/1024)} KB`);

// Convert JPEG to PNG first using sharp
const sharp = require('./node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');
const pngBytes = await sharp(srcBytes).png().toBuffer();
fs.writeFileSync(`${OUT_DIR}/source.png`, pngBytes);
console.log(`Converted to PNG: ${Math.round(pngBytes.length/1024)} KB`);

console.log("Calling gpt-image-1 with grayscale + fidelity prompt...");

const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
const CRLF = '\r\n';

function formField(name, value) {
  return `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;
}
function formFile(name, filename, contentType, data) {
  return Buffer.concat([
    Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"; filename="${filename}"${CRLF}Content-Type: ${contentType}${CRLF}${CRLF}`),
    data,
    Buffer.from(CRLF)
  ]);
}

const promptText = `Convert this pencil sketch to a clean grayscale depth map for CNC/laser engraving.

CRITICAL RULES:
1. FIDELITY 98%: Reproduce every line, shape, dolphin, leaf, circle, dot, and letter exactly as drawn. Same positions, same proportions, same composition.
2. TEXT AS SHAPES: The Hebrew letters (א, ב, ג, ד, ה, ו, ח, ט) are decorative labels — treat them as pure graphic shapes. Copy their visual appearance exactly without reading or interpreting them.
3. CLEAN GRAYSCALE: White background, dark gray/black for pencil lines, light gray for shaded areas. Remove paper texture and scan artifacts.
4. NO CREATIVITY: Do not add or remove any element. Faithful technical reproduction only.
5. ENHANCE LINES: Make the pencil lines crisp and clear. The output should look like a clean ink drawing converted to grayscale.`;

const bodyParts = [
  Buffer.from(formField('model', 'gpt-image-1')),
  Buffer.from(formField('prompt', promptText)),
  Buffer.from(formField('n', '1')),
  Buffer.from(formField('size', '1024x1024')),
  Buffer.from(formField('quality', 'high')),
  formFile('image', 'drawing.png', 'image/png', pngBytes),
  Buffer.from(`--${boundary}--${CRLF}`)
];

const body = Buffer.concat(bodyParts);

const resp = await fetch("https://api.openai.com/v1/images/edits", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": `multipart/form-data; boundary=${boundary}`
  },
  body
});

if (!resp.ok) {
  const text = await resp.text();
  console.error("OpenAI error:", resp.status, text.substring(0, 800));
  process.exit(1);
}

const data = await resp.json();
const item = data.data?.[0];
if (!item) { console.error("No data:", JSON.stringify(data).substring(0,300)); process.exit(1); }

let imgBytes;
if (item.url) {
  const imgResp = await fetch(item.url);
  imgBytes = Buffer.from(await imgResp.arrayBuffer());
} else if (item.b64_json) {
  imgBytes = Buffer.from(item.b64_json, 'base64');
} else {
  console.error("No image in response"); process.exit(1);
}

const aiImgPath = `${OUT_DIR}/ai_grayscale.png`;
fs.writeFileSync(aiImgPath, imgBytes);
console.log(`Saved AI grayscale: ${aiImgPath} (${Math.round(imgBytes.length/1024)} KB)`);

console.log("Processing with Python...");
const pyScript = `
from PIL import Image, ImageEnhance, ImageFilter
img = Image.open("${aiImgPath}").convert("L")
img = img.resize((2000, 2000), Image.LANCZOS)
# Boost contrast to make lines crisp
enhanced = ImageEnhance.Contrast(img).enhance(2.5)
enhanced.save("${OUT_DIR}/enhanced.png")
for t in [80, 140, 200]:
    bw = enhanced.point(lambda p: 255 if p > t else 0, "1")
    bw.save(f"${OUT_DIR}/layer_{t}.bmp")
    print(f"Layer {t} saved")
`;
fs.writeFileSync('/tmp/proc_dolphin.py', pyScript);
execSync('python3 /tmp/proc_dolphin.py', { stdio: 'inherit' });

console.log("Vectorizing with potrace...");
const potrace = require('/home/ubuntu/image-to-dxf/node_modules/.pnpm/potrace@2.1.8/node_modules/potrace');

for (const t of [80, 140, 200]) {
  const bmpPath = `${OUT_DIR}/layer_${t}.bmp`;
  const svgPath = `${OUT_DIR}/vector_layer_${t}.svg`;
  await new Promise((resolve) => {
    potrace.trace(bmpPath, { turdSize: 2, alphaMax: 1.0, optCurve: true, threshold: 128, blackOnWhite: true }, (err, svg) => {
      if (err) { console.error(`Layer ${t}:`, err.message); resolve(); return; }
      fs.writeFileSync(svgPath, svg);
      console.log(`  Layer ${t}: ${Math.round(fs.statSync(svgPath).size/1024)} KB`);
      resolve();
    });
  });
}

console.log("Converting to PNG previews...");
for (const t of [80, 140, 200]) {
  const svgPath = `${OUT_DIR}/vector_layer_${t}.svg`;
  const pngPath = `${OUT_DIR}/vector_layer_${t}_preview.png`;
  if (fs.existsSync(svgPath)) {
    await sharp(fs.readFileSync(svgPath)).resize(900).png().toFile(pngPath);
    console.log(`  Preview ${t}: OK`);
  }
}

console.log("\nDone! Files:");
fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).sort().forEach(f => {
  console.log(`  ${f}  (${Math.round(fs.statSync(`${OUT_DIR}/${f}`).size/1024)} KB)`);
});
