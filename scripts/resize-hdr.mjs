// Downscale a Radiance .hdr (RGBE) by an integer factor.
//
// Pure Node — the project has no image tooling, and an environment map is the
// single heaviest asset the 3D scene loads, so it is worth shrinking properly
// rather than shipping a 2k sky nobody looks at directly.
//
// Box-filters in LINEAR light: RGBE stores a shared exponent per pixel, so
// averaging the raw bytes across pixels with different exponents produces
// garbage. Decode to float, average, re-encode.
//
//   node scripts/resize-hdr.mjs in.hdr out.hdr 2

import { readFileSync, writeFileSync } from 'node:fs';

function readHdr(path) {
  const data = readFileSync(path);
  // Header is text, terminated by a blank line, then a resolution line.
  const headerEnd = data.indexOf('\n\n') + 2;
  const eol = data.indexOf('\n', headerEnd);
  const res = data.toString('ascii', headerEnd, eol).trim().split(/\s+/);
  if (res[0] !== '-Y' || res[2] !== '+X') throw new Error(`unsupported orientation: ${res.join(' ')}`);
  const height = Number(res[1]);
  const width = Number(res[3]);

  const out = new Uint8Array(width * height * 4);
  let pos = eol + 1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    // New-style RLE scanlines start 0x02 0x02 <width-hi> <width-lo>.
    const rle =
      width >= 8 && width <= 0x7fff && data[pos] === 2 && data[pos + 1] === 2 &&
      ((data[pos + 2] << 8) | data[pos + 3]) === width;

    if (!rle) {
      for (let i = 0; i < width * 4; i += 1) out[row + i] = data[pos + i];
      pos += width * 4;
      continue;
    }
    pos += 4;
    // Channels are stored separately in RLE scanlines.
    for (let c = 0; c < 4; c += 1) {
      let x = 0;
      while (x < width) {
        const n = data[pos++];
        if (n > 128) {
          const value = data[pos++];
          for (let k = 0; k < n - 128; k += 1) out[row + (x++) * 4 + c] = value;
        } else {
          for (let k = 0; k < n; k += 1) out[row + (x++) * 4 + c] = data[pos++];
        }
      }
    }
  }
  return { rgbe: out, width, height };
}

/** RGBE -> linear float. Shared exponent: value = mantissa * 2^(e-128) / 256. */
function toLinear(rgbe, width, height) {
  const lin = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < rgbe.length; i += 4, j += 3) {
    const e = rgbe[i + 3];
    const scale = e === 0 ? 0 : Math.pow(2, e - 136);
    lin[j] = rgbe[i] * scale;
    lin[j + 1] = rgbe[i + 1] * scale;
    lin[j + 2] = rgbe[i + 2] * scale;
  }
  return lin;
}

function toRgbe(lin, width, height) {
  const out = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p += 1) {
    const r = lin[p * 3];
    const g = lin[p * 3 + 1];
    const b = lin[p * 3 + 2];
    const peak = Math.max(r, g, b);
    if (peak < 1e-32) continue; // leaves 0,0,0,0 — the encoding for black
    // frexp: peak = mantissa * 2^exp, mantissa in [0.5, 1)
    const exp = Math.ceil(Math.log2(peak));
    const scale = 256 / Math.pow(2, exp);
    out[p * 4] = Math.min(255, Math.max(0, Math.round(r * scale)));
    out[p * 4 + 1] = Math.min(255, Math.max(0, Math.round(g * scale)));
    out[p * 4 + 2] = Math.min(255, Math.max(0, Math.round(b * scale)));
    out[p * 4 + 3] = exp + 128;
  }
  return out;
}

const [src, dst, factorRaw] = process.argv.slice(2);
const factor = Number(factorRaw || 2);
const { rgbe, width, height } = readHdr(src);
console.log(`source ${width}x${height}`);

const lin = toLinear(rgbe, width, height);
const nw = Math.floor(width / factor);
const nh = Math.floor(height / factor);
const small = new Float32Array(nw * nh * 3);

for (let y = 0; y < nh; y += 1) {
  for (let x = 0; x < nw; x += 1) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < factor; dy += 1) {
      for (let dx = 0; dx < factor; dx += 1) {
        const s = ((y * factor + dy) * width + (x * factor + dx)) * 3;
        r += lin[s]; g += lin[s + 1]; b += lin[s + 2];
      }
    }
    const n = factor * factor;
    const d = (y * nw + x) * 3;
    small[d] = r / n; small[d + 1] = g / n; small[d + 2] = b / n;
  }
}

// Flat (non-RLE) scanlines: a valid Radiance file and far simpler to emit.
const header = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${nh} +X ${nw}\n`, 'ascii');
writeFileSync(dst, Buffer.concat([header, Buffer.from(toRgbe(small, nw, nh))]));
console.log(`wrote  ${nw}x${nh} -> ${dst}`);
