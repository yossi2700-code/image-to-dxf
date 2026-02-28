import sharp from "sharp";
import { readFileSync } from "fs";
import { invokeLLM } from "./_core/llm";

async function main() {
  const imgPath = "/home/ubuntu/upload/IMG_3182.PNG";
  const imageBuffer = readFileSync(imgPath);

  const bwImage = await sharp(imageBuffer)
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .normalise()
    .linear(1.4, -30)
    .jpeg({ quality: 85 })
    .toBuffer();

  const dataUrl = `data:image/jpeg;base64,${bwImage.toString("base64")}`;

  const prompt = `You are a professional vector illustrator creating laser engraving files.

The image you see has been converted to black and white. Look carefully at it.

PHASE 1 — RECOGNIZE (think silently, do not output this):
- What is this object exactly?
- What specific visual details are visible?

PHASE 2 — TRACE (output only this):
Draw an SVG that traces exactly what you see in the image.

SVG RULES:
1. Output ONLY raw SVG XML — start with <svg and end with </svg>, nothing else
2. NO markdown fences, NO explanations, NO text before or after the SVG
3. First element: <rect width="100%" height="100%" fill="white"/>
4. viewBox must match proportions
5. ALL elements: stroke="black" stroke-width="2" fill="none"
6. 20 to 50 path elements

Output the SVG now:`;

  console.log("Calling LLM...");
  const completion = await invokeLLM({
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const raw = (completion.choices[0]?.message?.content as string) ?? "";
  console.log("\n=== RAW RESPONSE (first 1000 chars) ===");
  console.log(raw.substring(0, 1000));
  console.log("\n=== RESPONSE LENGTH:", raw.length);
  console.log("=== STARTS WITH:", JSON.stringify(raw.substring(0, 80)));
  console.log("=== HAS <svg:", raw.includes("<svg"));
  console.log("=== HAS </svg>:", raw.includes("</svg>"));
}

main().catch(console.error);
