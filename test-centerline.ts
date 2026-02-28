import { potraceToSingleLine } from "./server/potraceToSingleLine";
import potrace from "potrace";
import sharp from "sharp";

const width = 200, height = 200;
const pixels = new Uint8Array(width * height * 3).fill(255);
// Draw a thick diagonal line (8px wide)
for (let i = 0; i < 150; i++) {
  for (let t = -4; t <= 4; t++) {
    const x = 25 + i + t, y = 25 + i;
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const idx = (y * width + x) * 3;
      pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = 0;
    }
  }
}

const buf = await sharp(Buffer.from(pixels), { raw: { width, height, channels: 3 } })
  .grayscale().threshold(128).png().toBuffer();

potrace.trace(buf, { threshold: 128, turdSize: 0, optCurve: true }, (err: Error | null, svg: string) => {
  if (err) { console.error(err); return; }
  console.log("potrace SVG:", svg.substring(0, 200));
  const result = potraceToSingleLine(svg, 1.5, 80);
  console.log("segmentCount:", result.segmentCount);
  console.log("realWidth:", result.realWidth.toFixed(1), "realHeight:", result.realHeight.toFixed(1));
  console.log("SVG preview (first 400):", result.svgPreview.substring(0, 400));
});
