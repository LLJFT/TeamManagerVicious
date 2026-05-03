import sharp from "sharp";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const logos = resolve(root, "brand/logos");
const exportsDir = resolve(root, "brand/exports");
const publicDir = resolve(root, "client/public");

const ONYX = "#0E1117";

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function renderAppIcon(size, outPath) {
  const svg = await readFile(resolve(logos, "vicious-app-icon.svg"));
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`✓ ${outPath} (${size}x${size})`);
}

async function renderOgImage(outPath) {
  const W = 1200;
  const H = 630;

  const lockupSvg = await readFile(resolve(logos, "vicious-horizontal-dark.svg"), "utf8");
  const lockupWidth = 900;
  const lockupHeight = Math.round((96 / 480) * lockupWidth);

  const lockupPng = await sharp(Buffer.from(lockupSvg), { density: 600 })
    .resize(lockupWidth, lockupHeight, { fit: "contain" })
    .png()
    .toBuffer();

  const tagline = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="${ONYX}"/>
      <text x="${W / 2}" y="${H / 2 + 110}"
            font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
            font-weight="500" font-size="22" letter-spacing="4"
            fill="#9CA3AF" text-anchor="middle">
        TACTICAL COMMAND CENTER FOR ESPORTS
      </text>
    </svg>`;

  const left = Math.round((W - lockupWidth) / 2);
  const top = Math.round((H - lockupHeight) / 2) - 40;

  await sharp(Buffer.from(tagline))
    .composite([{ input: lockupPng, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`✓ ${outPath} (${W}x${H})`);
}

await ensureDir(exportsDir);
await ensureDir(publicDir);

await renderAppIcon(512, resolve(exportsDir, "vicious-app-icon-512.png"));
await renderAppIcon(1024, resolve(exportsDir, "vicious-app-icon-1024.png"));
await renderOgImage(resolve(exportsDir, "vicious-og-1200x630.png"));

await copyFile(
  resolve(exportsDir, "vicious-og-1200x630.png"),
  resolve(publicDir, "vicious-og.png"),
);
console.log(`✓ copied OG image to client/public/vicious-og.png`);
