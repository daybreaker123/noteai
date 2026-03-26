/**
 * Generates public/favicon.ico and public/apple-touch-icon.png from public/studara-mark.svg.
 * Run: npm run generate-favicon
 */
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

async function main() {
  const { default: pngToIco } = await import("png-to-ico");
  const root = path.join(__dirname, "..");
  const svgPath = path.join(root, "public", "studara-mark.svg");
  const svg = readFileSync(svgPath);
  const png16 = await sharp(svg).resize(16, 16).png().toBuffer();
  const png32 = await sharp(svg).resize(32, 32).png().toBuffer();
  const ico = await pngToIco([png16, png32]);
  writeFileSync(path.join(root, "public", "favicon.ico"), ico);
  await sharp(svg).resize(180, 180).png().toFile(path.join(root, "public", "apple-touch-icon.png"));
  console.log("Wrote public/favicon.ico and public/apple-touch-icon.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
