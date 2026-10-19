// Gera a imagem Open Graph (og-image.png) ilustrando a criptografia visual:
// duas matrizes de ruído que, sobrepostas, revelam uma imagem oculta.
// Sem dependências externas: desenha num buffer RGBA e codifica o PNG na mão.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const W = 1200, H = 630;

// --- tela RGBA ---------------------------------------------------------------
const px = new Uint8Array(W * H * 4);
function set(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
}
function fillRect(x0, y0, w, h, r, g, b, a = 255) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) set(x, y, r, g, b, a);
}
function background(r, g, b) { fillRect(0, 0, W, H, r, g, b); }

// --- PRNG determinístico (mulberry32), igual ao do app -----------------------
function rand32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- fonte 5x7 completa (A-Z, 0-9 e símbolos usados) -------------------------
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00000', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

// --- fonte BOLD 7x9 para o segredo (traços grossos, bem mais visível) --------
const FONT_BOLD = {
  S: ['0111110', '1100000', '1100000', '1100000', '0111100', '0000110', '0000110', '0000110', '1111100'],
  E: ['1111111', '1100000', '1100000', '1100000', '1111110', '1100000', '1100000', '1100000', '1111111'],
  C: ['0111110', '1100011', '1100000', '1100000', '1100000', '1100000', '1100000', '1100011', '0111110'],
  R: ['1111110', '1100011', '1100011', '1100011', '1111110', '1111000', '1101100', '1100110', '1100011'],
  T: ['1111111', '0011100', '0011100', '0011100', '0011100', '0011100', '0011100', '0011100', '0011100'],
  A: ['0011100', '0110110', '1100011', '1100011', '1111111', '1100011', '1100011', '1100011', '1100011'],
  B: ['1111110', '1100011', '1100011', '1100011', '1111110', '1100011', '1100011', '1100011', '1111110'],
  D: ['1111100', '1100110', '1100011', '1100011', '1100011', '1100011', '1100011', '1100110', '1111100'],
  O: ['0111110', '1100011', '1100011', '1100011', '1100011', '1100011', '1100011', '1100011', '0111110'],
  ' ': ['0000000', '0000000', '0000000', '0000000', '0000000', '0000000', '0000000', '0000000', '0000000'],
};

// --- máscara do segredo: texto desenhado numa grade de bits (fonte bold) -----
function secretMask(gw, gh, text) {
  const mask = new Uint8Array(gw * gh);
  const glyphW = 7, glyphH = 9, spacing = 1;
  const totalCells = text.length * glyphW + (text.length - 1) * spacing;
  const scale = Math.max(1, Math.floor(Math.min(gw / (totalCells + 6), gh / (glyphH + 6))));
  const drawnW = totalCells * scale, drawnH = glyphH * scale;
  const ox = Math.floor((gw - drawnW) / 2), oy = Math.floor((gh - drawnH) / 2);
  let cursor = ox;
  for (const ch of text) {
    const rows = FONT_BOLD[ch] || FONT_BOLD[' '];
    for (let r = 0; r < glyphH; r++)
      for (let c = 0; c < glyphW; c++)
        if (rows[r][c] === '1')
          for (let sy = 0; sy < scale; sy++)
            for (let sx = 0; sx < scale; sx++) {
              const x = cursor + c * scale + sx, y = oy + r * scale + sy;
              if (x >= 0 && y >= 0 && x < gw && y < gh) mask[y * gw + x] = 1;
            }
    cursor += (glyphW + spacing) * scale;
  }
  return mask;
}

// --- dilatação: engrossa os traços da máscara (cada passo = +1 px ao redor) ---
function dilate(mask, gw, gh, steps = 1) {
  let cur = mask;
  for (let s = 0; s < steps; s++) {
    const next = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        if (cur[y * gw + x]) { next[y * gw + x] = 1; continue; }
        // vizinhança 4-conectada
        if ((x > 0 && cur[y * gw + x - 1]) ||
            (x < gw - 1 && cur[y * gw + x + 1]) ||
            (y > 0 && cur[(y - 1) * gw + x]) ||
            (y < gh - 1 && cur[(y + 1) * gw + x]))
          next[y * gw + x] = 1;
      }
    cur = next;
  }
  return cur;
}

// --- criptografia visual (random grid), igual ao do app ----------------------
function buildShares(mask, gw, gh, seed) {
  const a = new Uint8Array(gw * gh), b = new Uint8Array(gw * gh);
  const rnd = rand32(seed);
  for (let i = 0; i < mask.length; i++) {
    const p = rnd() < 0.5 ? 0 : 1;
    a[i] = p;
    b[i] = mask[i] ? 1 - p : p;
  }
  return { a, b };
}

// sobreposição = OR dos pixels "pretos"
function overlay(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] || b[i]) ? 1 : 0;
  return out;
}

// --- desenha uma grade de bits num painel ------------------------------------
function drawPanel(bits, gw, gh, px0, py0, panelW, panelH) {
  const cell = Math.min(panelW / gw, panelH / gh);
  const gridPxW = cell * gw, gridPxH = cell * gh;
  const offX = px0 + (panelW - gridPxW) / 2, offY = py0 + (panelH - gridPxH) / 2;
  // moldura clara
  fillRect(Math.floor(offX) - 7, Math.floor(offY) - 7,
    Math.ceil(gridPxW) + 14, Math.ceil(gridPxH) + 14, 81, 96, 112);
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      const v = bits[gy * gw + gx] ? 16 : 236;
      const x0 = Math.round(offX + gx * cell), y0 = Math.round(offY + gy * cell);
      const x1 = Math.round(offX + (gx + 1) * cell), y1 = Math.round(offY + (gy + 1) * cell);
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) set(x, y, v, v, v);
    }
}

// --- texto vetorial para os rótulos ------------------------------------------
function textWidth(text, scale) {
  return text.length * (5 + 1) * scale - scale;
}
function drawLabel(text, cx, y, scale, r, g, b) {
  const glyphW = 5, glyphH = 7, spacing = 1;
  let x = Math.round(cx - textWidth(text, scale) / 2);
  for (const ch of text.toUpperCase()) {
    const rows = FONT[ch] || FONT[' '];
    for (let rr = 0; rr < glyphH; rr++)
      for (let c = 0; c < glyphW; c++)
        if (rows[rr][c] === '1')
          fillRect(x + c * scale, y + rr * scale, scale, scale, r, g, b);
    x += (glyphW + spacing) * scale;
  }
}

// =============================================================================
// Composição
// =============================================================================
background(17, 22, 30); // mesmo fundo do app (#11161e)

// grade larga para a palavra bold caber nítida
const GW = 130, GH = 78;
const mask = dilate(secretMask(GW, GH, 'SECRET'), GW, GH, 1);
const { a, b } = buildShares(mask, GW, GH, 12345);
const comb = overlay(a, b);

const panelW = 330, panelH = 200, top = 190, gap = 44;
const totalRow = panelW * 3 + gap * 2;
const startX = (W - totalRow) / 2;

drawPanel(a, GW, GH, startX, top, panelW, panelH);
drawPanel(b, GW, GH, startX + (panelW + gap), top, panelW, panelH);
drawPanel(comb, GW, GH, startX + (panelW + gap) * 2, top, panelW, panelH);

// símbolos + e = entre os painéis
drawLabel('+', startX + panelW + gap / 2, top + panelH / 2 - 20, 7, 233, 237, 243);
drawLabel('=', startX + panelW * 2 + gap * 1.5, top + panelH / 2 - 20, 7, 233, 237, 243);

// rótulos sob cada painel
const labelY = top + panelH + 26;
drawLabel('MATRIZ A', startX + panelW / 2, labelY, 4, 174, 184, 198);
drawLabel('MATRIZ B', startX + panelW + gap + panelW / 2, labelY, 4, 174, 184, 198);
drawLabel('SOBREPOSICAO', startX + (panelW + gap) * 2 + panelW / 2, labelY, 4, 79, 145, 245);

// título e subtítulo
drawLabel('VISUAL CRYPTOGRAPHY STUDIO', W / 2, 70, 6, 233, 237, 243);
drawLabel('DUAS MATRIZES DE RUIDO. UMA IMAGEM OCULTA.', W / 2, 540, 4, 174, 184, 198);

// =============================================================================
// Codificação PNG (RGBA, sem filtro)
// =============================================================================
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type RGBA
ihdr[10] = 0;  // compression
ihdr[11] = 0;  // filter
ihdr[12] = 0;  // interlace

const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), y * (W * 4 + 1) + 1);
}
const idat = deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = join(__dirname, '..', 'og-image.png');
writeFileSync(outPath, png);
console.log('Escrito:', outPath, `(${png.length} bytes, ${W}x${H})`);
