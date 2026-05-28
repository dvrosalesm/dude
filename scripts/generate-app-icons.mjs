import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(repoRoot, "public", "assets");
const electronIconPath = path.join(repoRoot, "electron", "icon.png");
const sourcePath = path.join(assetsDir, "dude-icon-kind-expression-flat.png");
const macMasterPath = path.join(assetsDir, "dude-icon-mac.png");
const dockIconPath = path.join(assetsDir, "dude-icon-dock.png");
const CANVAS = 1024;
const SQUIRCLE_RADIUS = 224;
const GLYPH_SCALE_MAC = 0.62;
const GLYPH_SCALE_DOCK = 0.52;
const DOCK_TILE_SCALE = 0.86;
const BG = { r: 250, g: 252, b: 254, alpha: 1 };

const pngTargets = [
  { name: "favicon.png", size: 32 },
  { name: "logo.png", size: 256 },
  { name: "icon.png", size: 512 },
];

const iconsetSizes = [
  { file: "icon_16x16.png", size: 16 },
  { file: "icon_16x16@2x.png", size: 32 },
  { file: "icon_32x32.png", size: 32 },
  { file: "icon_32x32@2x.png", size: 64 },
  { file: "icon_128x128.png", size: 128 },
  { file: "icon_128x128@2x.png", size: 256 },
  { file: "icon_256x256.png", size: 256 },
  { file: "icon_256x256@2x.png", size: 512 },
  { file: "icon_512x512.png", size: 512 },
  { file: "icon_512x512@2x.png", size: 1024 },
];

function isStrokePixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;

  if (max > 238 && saturation < 18) return false;
  if (max > 225 && saturation < 10) return false;

  return saturation >= 18 || b >= r + 8;
}

async function extractGlyph(scale) {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const stroke = Buffer.alloc(info.width * info.height * 4, 0);
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      if (!isStrokePixel(r, g, b)) continue;

      stroke[index] = r;
      stroke[index + 1] = g;
      stroke[index + 2] = b;
      stroke[index + 3] = 255;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX <= minX || maxY <= minY) {
    throw new Error("Could not detect icon strokes in source image");
  }

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const targetSize = Math.round(CANVAS * scale);

  const glyph = await sharp(stroke, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract({ left: minX, top: minY, width: cropWidth, height: cropHeight })
    .resize(targetSize, targetSize, { fit: "inside" })
    .png()
    .toBuffer();

  const glyphMeta = await sharp(glyph).metadata();
  const left = Math.round((CANVAS - (glyphMeta.width ?? targetSize)) / 2);
  const top = Math.round((CANVAS - (glyphMeta.height ?? targetSize)) / 2);

  return { glyph, left, top };
}

async function composeOnCanvas(glyph, left, top, background) {
  return sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background,
    },
  })
    .composite([{ input: glyph, left, top }])
    .png()
    .toBuffer();
}

function squircleMaskSvg() {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}">
      <rect width="${CANVAS}" height="${CANVAS}" rx="${SQUIRCLE_RADIUS}" fill="white"/>
    </svg>`,
  );
}

async function buildMacMaster(glyph, left, top) {
  await composeOnCanvas(glyph, left, top, BG).then((buffer) =>
    sharp(buffer).toFile(macMasterPath),
  );
  return macMasterPath;
}

async function buildDockIcon(glyph, left, top) {
  const filled = await composeOnCanvas(glyph, left, top, BG);
  const masked = await sharp(filled)
    .ensureAlpha()
    .composite([{ input: squircleMaskSvg(), blend: "dest-in" }])
    .png()
    .toBuffer();

  const tileSize = Math.round(CANVAS * DOCK_TILE_SCALE);
  const inset = Math.round((CANVAS - tileSize) / 2);
  const scaledTile = await sharp(masked).resize(tileSize, tileSize).png().toBuffer();

  await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaledTile, left: inset, top: inset }])
    .png()
    .toFile(dockIconPath);

  fs.mkdirSync(path.dirname(electronIconPath), { recursive: true });
  await sharp(dockIconPath).toFile(electronIconPath);

  return dockIconPath;
}

async function writePng(outputPath, size, inputPath) {
  await sharp(inputPath).resize(size, size).png().toFile(outputPath);
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `Missing app icon source at ${sourcePath}. Add the master PNG there first.`,
    );
  }

  fs.mkdirSync(assetsDir, { recursive: true });
  const macGlyph = await extractGlyph(GLYPH_SCALE_MAC);
  await buildMacMaster(macGlyph.glyph, macGlyph.left, macGlyph.top);
  console.log(`Wrote ${path.relative(repoRoot, macMasterPath)} (macOS master)`);

  const dockGlyph = await extractGlyph(GLYPH_SCALE_DOCK);
  await buildDockIcon(dockGlyph.glyph, dockGlyph.left, dockGlyph.top);
  console.log(`Wrote ${path.relative(repoRoot, dockIconPath)} (dock/dev)`);
  console.log(`Wrote ${path.relative(repoRoot, electronIconPath)} (electron bundle)`);

  for (const target of pngTargets) {
    const outputPath = path.join(assetsDir, target.name);
    await writePng(outputPath, target.size, macMasterPath);
    console.log(`Wrote ${path.relative(repoRoot, outputPath)} (${target.size}px)`);
  }

  const iconsetDir = path.join(assetsDir, "dude.iconset");
  fs.rmSync(iconsetDir, { recursive: true, force: true });
  fs.mkdirSync(iconsetDir, { recursive: true });

  for (const entry of iconsetSizes) {
    const outputPath = path.join(iconsetDir, entry.file);
    await writePng(outputPath, entry.size, macMasterPath);
  }

  const icnsPath = path.join(assetsDir, "dude.icns");
  execFileSync("iconutil", ["-c", "icns", iconsetDir, "-o", icnsPath], {
    stdio: "inherit",
  });
  fs.rmSync(iconsetDir, { recursive: true, force: true });

  console.log(`Wrote ${path.relative(repoRoot, icnsPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
