/**
 * Renders the GlassDesk app icons without any external image tooling.
 * The mark is a frosted pane with a single periwinkle bookmark ribbon.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const SIZES = [16, 32, 48, 128];
const SS = 4;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuffer, data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function roundedRectSignedDistance(x, y, cx, cy, width, height, radius) {
  const dx = Math.abs(x - cx) - (width / 2 - radius);
  const dy = Math.abs(y - cy) - (height / 2 - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

function parseHex(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function blend(target, index, color, alpha) {
  if (alpha <= 0) return;
  const srcA = alpha;
  const dstA = target[index + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  for (let i = 0; i < 3; i++) {
    const dst = target[index + i];
    target[index + i] = Math.round((color[i] * srcA + dst * dstA * (1 - srcA)) / outA);
  }
  target[index + 3] = Math.round(outA * 255);
}

function paint(size) {
  const px = new Uint8Array(size * SS * size * SS * 4);
  const s = size * SS;
  const radius = s * 0.235;
  const top = parseHex('#f9fbff');
  const bottom = parseHex('#c8d9f2');
  const accentTop = parseHex('#7297d3');
  const accentBottom = parseHex('#4f73b0');

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;

      // Rounded app tile with a soft daylight gradient.
      const tile = roundedRectSignedDistance(x, y, s / 2, s / 2, s * 0.965, s * 0.965, radius);
      if (tile < 0.5) {
        const t = clamp01((x * 0.55 + y * 0.85) / (s * 1.4));
        const color = [
          mix(top[0], bottom[0], t),
          mix(top[1], bottom[1], t),
          mix(top[2], bottom[2], t),
        ];
        const edge = clamp01(-tile / (s * 0.02));
        blend(px, i, color, clamp01(tile < 0 ? 1 : 1 - tile));
        // Inner rim light.
        const rim = roundedRectSignedDistance(x, y, s / 2, s / 2, s * 0.93, s * 0.93, radius * 0.9);
        if (rim > -s * 0.012 && rim < 0) {
          blend(px, i, [255, 255, 255], 0.55 * edge);
        }
      }

      // Frosted pane.
      const paneW = s * 0.62;
      const paneH = s * 0.66;
      const paneR = s * 0.15;
      const pane = roundedRectSignedDistance(x, y, s * 0.5, s * 0.52, paneW, paneH, paneR);
      if (pane < 1) {
        const t = clamp01((x + y) / (s * 1.25));
        const paneAlpha = 0.68 - t * 0.18;
        blend(px, i, [255, 255, 255], paneAlpha * clamp01(1 - pane));
        const paneRim = roundedRectSignedDistance(x, y, s * 0.5, s * 0.52, paneW * 0.965, paneH * 0.97, paneR);
        if (paneRim > -s * 0.014 && paneRim < 0) {
          blend(px, i, [255, 255, 255], 0.9);
        }
        // A diagonal specular stroke across the pane.
        const diag = Math.abs((x - y * 0.55) - s * 0.1);
        if (diag < s * 0.035 && y > s * 0.18 && y < s * 0.78) {
          blend(px, i, [255, 255, 255], 0.35);
        }
      }

      // Bookmark ribbon.
      const ribbonHalf = s * 0.105;
      const ribbonTop = s * 0.3;
      const ribbonBottom = s * 0.72;
      const notch = s * 0.1;
      const cx = s * 0.5;
      const inRect =
        x > cx - ribbonHalf &&
        x < cx + ribbonHalf &&
        y > ribbonTop &&
        y < ribbonBottom - (1 - Math.abs(x - cx) / ribbonHalf) * notch;
      const topRound = roundedRectSignedDistance(
        x,
        y,
        cx,
        ribbonTop + ribbonHalf * 0.2,
        ribbonHalf * 2,
        ribbonHalf * 0.9,
        ribbonHalf * 0.45,
      );
      if ((inRect && y >= ribbonTop) || topRound < 0) {
        const t = clamp01((y - ribbonTop) / (ribbonBottom - ribbonTop));
        const color = [
          mix(accentTop[0], accentBottom[0], t),
          mix(accentTop[1], accentBottom[1], t),
          mix(accentTop[2], accentBottom[2], t),
        ];
        blend(px, i, color, 1);
        if (y >= ribbonTop && y < ribbonTop + s * 0.02) {
          blend(px, i, [255, 255, 255], 0.28);
        }
      }
    }
  }

  // Downsample with premultiplied alpha to keep the rounded corners clean.
  const out = Buffer.alloc(size * size * 4);
  const samples = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = (((y * SS + sy) * s) + (x * SS + sx)) * 4;
          const alpha = px[i + 3] / 255;
          r += px[i] * alpha;
          g += px[i + 1] * alpha;
          b += px[i + 2] * alpha;
          a += alpha;
        }
      }
      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / samples) * 255);
    }
  }
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const rgba = paint(size);
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), encodePng(size, size, rgba));
  console.log(`icons/icon-${size}.png`);
}
