import 'dotenv/config';
import fs from 'fs';
import { execSync } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const IMAGE_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663365044246/jNvmsNWMmYHGpRhS.png";
const OUT_DIR = "/home/ubuntu/grayscale_test_v2";
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log("Step 1: Downloading source image...");
const srcResp = await fetch(IMAGE_URL);
const srcBytes = Buffer.from(await srcResp.arrayBuffer());
const srcPath = `${OUT_DIR}/source.png`;
fs.writeFileSync(srcPath, srcBytes);
console.log(`Downloaded source: ${Math.round(srcBytes.length/1024)} KB`);

console.log("Step 2: Calling gpt-image-1 with improved fidelity + text-as-shape prompt...");

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

// Improved prompt: 98% fidelity + treat text as graphic shapes
const promptText = `Convert this image to a precise grayscale depth map for CNC/laser engraving.

CRITICAL RULES:
1. FIDELITY: Reproduce the original image with 98% accuracy. Every shape, pattern, curve, leaf, spiral, circle, dot, and decorative element must be in exactly the same position and size as the original.
2. TEXT AS SHAPES: Any text, letters, or writing in the image must be treated as pure graphic shapes - do NOT read, interpret, translate, or modify the text in any way. Copy the visual shape of each letter exactly as it appears, as if it were a decorative pattern, not words.
3. GRAYSCALE ONLY: Use only grayscale tones (no color): white=background/raised, light gray=shallow areas, medium gray=mid-depth, dark gray=deep areas, black=deepest/outlines.
4. NO CREATIVITY: Do not add, remove, or change any element. This is a faithful technical reproduction, not an artistic interpretation.
5. SAME COMPOSITION: Keep the exact same layout, proportions, and circular composition as the original.`;

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
  const imgResp = await fetch(item.url);
  imgBytes = Buffer.from(await imgResp.arrayBuffer());
} else if (item.b64_json) {
  imgBytes = Buffer.from(item.b64_json, 'base64');
} else {
  console.error("No image in response"); process.exit(1);
}

const aiImgPath = `${OUT_DIR}/ai_grayscale_v2.png`;
fs.writeFileSync(aiImgPath, imgBytes);
console.log(`Saved AI grayscale v2: ${aiImgPath} (${Math.round(imgBytes.length/1024)} KB)`);

console.log("\nStep 3: Processing with Python...");
const pyScript = `
from PIL import Image, ImageEnhance
img = Image.open("${aiImgPath}").convert("L")
img = img.resize((2000, 2000), Image.LANCZOS)
enhanced = ImageEnhance.Contrast(img).enhance(2.0)
enhanced.save("${OUT_DIR}/enhanced_v2.png")
for t in [80, 140, 200]:
    bw = enhanced.point(lambda p: 255 if p > t else 0, "1")
    bw.save(f"${OUT_DIR}/layer_{t}.bmp")
    print(f"Layer {t} saved")
`;
fs.writeFileSync('/tmp/proc_v2.py', pyScript);
execSync('python3 /tmp/proc_v2.py', { stdio: 'inherit' });

console.log("\nStep 4: Vectorizing with potrace...");
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

// Posterize
const posterSvgPath = `${OUT_DIR}/vector_posterized.svg`;
await new Promise((resolve) => {
  potrace.posterize(`${OUT_DIR}/enhanced_v2.png`, {
    steps: 4, fillStrategy: potrace.Posterizer.FILL_MEAN,
    rangeDistribution: potrace.Posterizer.RANGES_AUTO, turdSize: 2, optCurve: true
  }, (err, svg) => {
    if (err) { console.error('Posterize:', err.message); resolve(); return; }
    fs.writeFileSync(posterSvgPath, svg);
    console.log(`  Posterized: ${Math.round(fs.statSync(posterSvgPath).size/1024)} KB`);
    resolve();
  });
});

console.log("\nConverting SVGs to PNG previews...");
const cairoScript = `
import cairosvg, os
out = "${OUT_DIR}"
for name in ["vector_layer_80", "vector_layer_140", "vector_layer_200", "vector_posterized"]:
    svg = f"{out}/{name}.svg"
    png = f"{out}/{name}_preview.png"
    if os.path.exists(svg):
        try:
            cairosvg.svg2png(url=svg, write_to=png, output_width=800)
            print(f"OK: {name}")
        except Exception as e:
            print(f"ERR {name}: {e}")
`;
fs.writeFileSync('/tmp/cairo_v2.py', cairoScript);
execSync('python3 /tmp/cairo_v2.py', { stdio: 'inherit' });

console.log("\nDone! Files in:", OUT_DIR);
fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).sort().forEach(f => {
  console.log(`  ${f}  (${Math.round(fs.statSync(`${OUT_DIR}/${f}`).size/1024)} KB)`);
});
