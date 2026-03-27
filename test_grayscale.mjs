import 'dotenv/config';
import fs from 'fs';
import { execSync } from 'child_process';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const IMAGE_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663365044246/jNvmsNWMmYHGpRhS.png";
const OUT_DIR = "/home/ubuntu/grayscale_test";
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log("Step 1: Downloading source image and calling gpt-image-1 edit...");

// Download the source image first
const srcResp = await fetch(IMAGE_URL);
const srcBytes = Buffer.from(await srcResp.arrayBuffer());
const srcPath = `${OUT_DIR}/source.png`;
fs.writeFileSync(srcPath, srcBytes);
console.log(`Downloaded source: ${Math.round(srcBytes.length/1024)} KB`);

// Use FormData with images/edits endpoint
const { FormData, File } = await import('node:buffer').catch(() => ({}));

// Build multipart form manually
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

const promptText = `Convert this mandala image into a precise grayscale engraving depth map. Reproduce every single detail, shape, pattern, and letter exactly as in the original mandala. Use ONLY grayscale tones (no color): white for background/raised areas, light gray for slightly raised details, medium gray for mid-depth, dark gray for deeper areas, black for deepest engraving/outlines. Professional grayscale depth map for CNC/laser engraving. Preserve maximum detail accuracy.`;

const bodyParts = [
  Buffer.from(formField('model', 'gpt-image-1')),
  Buffer.from(formField('prompt', promptText)),
  Buffer.from(formField('n', '1')),
  Buffer.from(formField('size', '1024x1024')),
  Buffer.from(formField('quality', 'high')),
  formFile('image', 'mandala.png', 'image/png', srcBytes),
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
  console.log("Downloading image from URL...");
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

console.log("\nStep 2: Processing with Python + potrace...");
const pyScript = `
from PIL import Image, ImageEnhance
import os

img = Image.open("${aiImgPath}").convert("L")
img = img.resize((2000, 2000), Image.LANCZOS)
enhanced = ImageEnhance.Contrast(img).enhance(2.0)
enhanced.save("${OUT_DIR}/ai_grayscale_enhanced.png")
print("Saved enhanced grayscale")

for t in [80, 140, 200]:
    bw = enhanced.point(lambda p: 255 if p > t else 0, "1")
    bw.save(f"${OUT_DIR}/layer_{t}.bmp")
    print(f"Saved BMP layer threshold={t}")
`;

fs.writeFileSync('/tmp/process_img.py', pyScript);
execSync('python3 /tmp/process_img.py', { stdio: 'inherit' });

console.log("\nStep 3: Running potrace...");
for (const t of [80, 140, 200]) {
  const bmpPath = `${OUT_DIR}/layer_${t}.bmp`;
  const svgPath = `${OUT_DIR}/vector_layer_${t}.svg`;
  try {
    execSync(`potrace --svg --turdsize 2 --alphamax 1.0 -o "${svgPath}" "${bmpPath}"`, { stdio: 'pipe' });
    const size = Math.round(fs.statSync(svgPath).size / 1024);
    console.log(`  Layer ${t}: ${size} KB → ${svgPath}`);
  } catch(e) {
    console.error(`  Layer ${t} failed:`, e.message);
  }
}

console.log("\nAll output files:");
fs.readdirSync(OUT_DIR).sort().forEach(f => {
  const size = Math.round(fs.statSync(`${OUT_DIR}/${f}`).size / 1024);
  console.log(`  ${f}  (${size} KB)`);
});
