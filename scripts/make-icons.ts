/**
 * App icons for the installable web app, drawn from the still-point emblem of
 * public/favicon.svg (two rings and a centre point) in gold on the night ground.
 *
 *   npm run icons     # writes public/icons/*.png
 *
 * - icon-192.png, icon-512.png   purpose "any": a rounded tile, for desktop and launchers
 * - icon-maskable-512.png        purpose "maskable": full bleed, emblem inside the
 *                                 central safe zone so Android's circle/squircle masks never clip it
 * - apple-touch-icon.png (180)   full bleed and opaque; iOS rounds the corners itself
 */
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const NIGHT = "#0b0d15";
const GLOW = "#1a1f30";
const GOLD = "#dcb870";

/** The emblem at `size` px, outer ring radius `r` as a fraction of the size. */
function svg(size: number, r: number, tile: boolean): string {
  const c = size / 2;
  const k = (r * size) / 27; // favicon units: outer ring r=27, stroke 3; inner r=15, stroke 2; point r=4.5
  const corner = tile ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><radialGradient id="g" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="${GLOW}"/><stop offset="1" stop-color="${NIGHT}"/></radialGradient></defs>
  <rect width="${size}" height="${size}" rx="${corner}" fill="url(#g)"/>
  <circle cx="${c}" cy="${c}" r="${27 * k}" fill="none" stroke="${GOLD}" stroke-width="${3 * k}"/>
  <circle cx="${c}" cy="${c}" r="${15 * k}" fill="none" stroke="${GOLD}" stroke-width="${2 * k}"/>
  <circle cx="${c}" cy="${c}" r="${4.5 * k}" fill="${GOLD}"/>
</svg>`;
}

const OUT = "public/icons";
const ICONS: Array<[file: string, size: number, r: number, tile: boolean]> = [
  ["icon-192.png", 192, 0.34, true],
  ["icon-512.png", 512, 0.34, true],
  // Safe zone for maskable icons is the central circle of radius 40%; stay well inside it.
  ["icon-maskable-512.png", 512, 0.28, false],
  ["apple-touch-icon.png", 180, 0.32, false],
];

mkdirSync(OUT, { recursive: true });
for (const [file, size, r, tile] of ICONS) {
  const img = sharp(Buffer.from(svg(size, r, tile)));
  // Full-bleed icons must be opaque (iOS shows transparency as black).
  if (!tile) img.flatten({ background: NIGHT });
  await img.png({ compressionLevel: 9 }).toFile(`${OUT}/${file}`);
  console.log(`${OUT}/${file}`);
}
