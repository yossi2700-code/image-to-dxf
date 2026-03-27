import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const potracePkg = '/home/ubuntu/image-to-dxf/node_modules/.pnpm/potrace@2.1.8/node_modules/potrace';
const potrace = require(potracePkg);

const OUT_DIR = "/home/ubuntu/grayscale_test";

console.log("Vectorizing with potrace npm...");

// Vectorize each BMP layer
for (const t of [80, 140, 200]) {
  const bmpPath = `${OUT_DIR}/layer_${t}.bmp`;
  const svgPath = `${OUT_DIR}/vector_layer_${t}.svg`;
  
  await new Promise((resolve) => {
    potrace.trace(bmpPath, {
      turdSize: 2,
      alphaMax: 1.0,
      optCurve: true,
      optTolerance: 0.2,
      threshold: 128,
      blackOnWhite: true,
    }, (err, svg) => {
      if (err) { console.error(`Layer ${t} error:`, err.message); resolve(); return; }
      fs.writeFileSync(svgPath, svg);
      const size = Math.round(fs.statSync(svgPath).size / 1024);
      console.log(`  Layer ${t}: ${size} KB`);
      resolve();
    });
  });
}

// Posterize the enhanced grayscale (multi-level)
const enhPath = `${OUT_DIR}/ai_grayscale_enhanced.png`;
const posterSvgPath = `${OUT_DIR}/vector_posterized.svg`;

await new Promise((resolve) => {
  potrace.posterize(enhPath, {
    steps: 4,
    fillStrategy: potrace.Posterizer.FILL_MEAN,
    rangeDistribution: potrace.Posterizer.RANGES_AUTO,
    turdSize: 2,
    optCurve: true,
  }, (err, svg) => {
    if (err) { console.error('Posterize error:', err.message); resolve(); return; }
    fs.writeFileSync(posterSvgPath, svg);
    const size = Math.round(fs.statSync(posterSvgPath).size / 1024);
    console.log(`  Posterized (4 levels): ${size} KB`);
    resolve();
  });
});

console.log("\nSVG files:");
fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.svg')).sort().forEach(f => {
  const size = Math.round(fs.statSync(`${OUT_DIR}/${f}`).size / 1024);
  console.log(`  ${f}  (${size} KB)`);
});
