import fs from "fs";
import sharp from "sharp";

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const imagePath = "/home/ubuntu/upload/IMG_4225(1).jpeg";
const imageBuffer = fs.readFileSync(imagePath);

// Resize to 1024x1024
const resized = await sharp(imageBuffer)
  .resize(1024, 1024, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png({ compressionLevel: 6 })
  .toBuffer();

const b64Input = resized.toString("base64");

const editPrompt =
  `This image will be converted to a vector file for laser engraving or CNC cutting. ` +
  `Convert it to clean black and white line art by following the EXACT lines and shapes visible in this image. ` +
  `DO NOT redraw from memory or imagination — trace what you actually see in the image. ` +
  `Draw ONLY clean continuous pen strokes — like drawing with a fine-tip pen on paper. ` +
  `Every line must be a single continuous stroke with no breaks, no gaps, no rough edges. ` +
  `Preserve ALL details: every curve, shape, decoration, and element exactly as shown. ` +
  `Pure white (#FFFFFF) background. Pure black (#000000) lines only. No shading, no grey tones, no gradients, no fills. ` +
  `The lines must be smooth, flowing, and connected — suitable for a laser to follow as a single path. ` +
  `No text, no letters, no numbers, no logos, no watermarks anywhere.`;

console.log("Sending to Forge ImageService with image editing...");

const baseUrl = FORGE_API_URL.endsWith("/") ? FORGE_API_URL : `${FORGE_API_URL}/`;
const fullUrl = new URL("images.v1.ImageService/GenerateImage", baseUrl).toString();

const response = await fetch(fullUrl, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    "connect-protocol-version": "1",
    authorization: `Bearer ${FORGE_API_KEY}`,
  },
  body: JSON.stringify({
    prompt: editPrompt,
    original_images: [{ b64Json: b64Input, mimeType: "image/png" }],
  }),
});

if (!response.ok) {
  const detail = await response.text().catch(() => "");
  throw new Error(`Failed (${response.status}): ${detail}`);
}

const result = await response.json();
const outBuffer = Buffer.from(result.image.b64Json, "base64");
const outPath = "/home/ubuntu/mandala_test/direct_no_analysis.png";
fs.mkdirSync("/home/ubuntu/mandala_test", { recursive: true });
fs.writeFileSync(outPath, outBuffer);
console.log("Saved to:", outPath);
