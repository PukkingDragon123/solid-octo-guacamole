// The pixel-art toolkit: a fixed palette, offscreen sprite surfaces, a 5x7
// bitmap font, and the handful of primitives everything else is drawn with.
// Nothing here uses anti-aliasing - every coordinate is a whole pixel.

export const PAL = {
  black:   '#0d0a09', ink:     '#1d1712', ink2:    '#2f2419',
  paper:   '#f2e2bf', paper2:  '#d7bd8d', paper3:  '#b1936a',
  white:   '#ffffff',

  grass0:  '#2f5a30', grass1:  '#3f7a37', grass2:  '#559a3f', grass3:  '#74b94d',
  grass4:  '#9ad35f',
  dry1:    '#5e7233', dry2:    '#7b8f3d', dry3:    '#9aab4e', dry4:    '#bcc45c',
  dirt0:   '#3f2a1b', dirt1:   '#5e402a', dirt2:   '#7f5a37', dirt3:   '#a37c4c',
  sand:    '#c8a468',

  water0:  '#12395e', water1:  '#1d5b8d', water2:  '#2f83b8', water3:  '#4fa9d8',
  water4:  '#8fd6f0', foam:    '#d6f2ff',

  wood0:   '#2e1c11', wood1:   '#4d301b', wood2:   '#7a4e29', wood3:   '#a3703f',
  wood4:   '#c99a5f',

  fur0:    '#33200f', fur1:    '#5c3a1e', fur2:    '#84552c', fur3:    '#a97a44',
  fur4:    '#cba169',

  stone0:  '#2c3138', stone1:  '#4a525c', stone2:  '#6d7783', stone3:  '#98a2ad',

  leaf0:   '#1f4325', leaf1:   '#2d6330', leaf2:   '#40853c', leaf3:   '#5aa74b',

  red:     '#c93b32', red2:    '#e8604a', blue:    '#3f5fc4', blue2:   '#5f8ae0',
  gold:    '#e0a02e', gold2:   '#f7cc55', pink:    '#e08bab', purple:  '#8256c4',
  purple2: '#a97ee0',

  sky0:    '#2a4a80', sky1:    '#4f83c4', sky2:    '#7fb6e6', sky3:    '#a9dcf5',
  sky4:    '#d6f0fb', sky5:    '#eafaff',
  dusk0:   '#3a2a52', dusk1:   '#7a4a6a', dusk2:   '#c4735f', dusk3:   '#efa96b',
  night0:  '#0e1230', night1:  '#1b2450', night2:  '#2f3a70',
};

/** A drawable offscreen bitmap. */
export function surface(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w | 0);
  canvas.height = Math.max(1, h | 0);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx, w: canvas.width, h: canvas.height };
}

const spriteCache = new Map();

/** Build (and remember) a sprite. `fn(ctx, w, h)` paints it once. */
export function sprite(key, w, h, fn) {
  let found = spriteCache.get(key);
  if (found) return found;
  const s = surface(w, h);
  fn(s.ctx, w, h);
  spriteCache.set(key, s.canvas);
  return s.canvas;
}

export function hasSprite(key) { return spriteCache.has(key); }
export function clearSprites() { spriteCache.clear(); }

// ------------------------------------------------------------- primitives
export function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, 1, 1);
}

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

export function frame(ctx, x, y, w, h, color) {
  rect(ctx, x, y, w, 1, color);
  rect(ctx, x, y + h - 1, w, 1, color);
  rect(ctx, x, y, 1, h, color);
  rect(ctx, x + w - 1, y, 1, h, color);
}

/** Filled circle, drawn span by span so the edge stays crisp. */
export function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const span = Math.floor(Math.sqrt(r * r - y * y + 0.25));
    ctx.fillRect((cx - span) | 0, (cy + y) | 0, span * 2 + 1, 1);
  }
}

export function ring(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    for (const [dx, dy] of [[x, y], [y, x], [-x, y], [-y, x], [-x, -y], [-y, -x], [x, -y], [y, -x]]) {
      ctx.fillRect((cx + dx) | 0, (cy + dy) | 0, 1, 1);
    }
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

export function line(ctx, x0, y0, x1, y1, color) {
  ctx.fillStyle = color;
  let x = x0 | 0, y = y0 | 0;
  const dx = Math.abs(x1 - x), sx = x < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y), sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 4096; guard++) {
    ctx.fillRect(x, y, 1, 1);
    if (x === (x1 | 0) && y === (y1 | 0)) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/** Checkerboard dither between two colours - the classic shading trick. */
export function dither(ctx, x, y, w, h, a, b, density = 0.5) {
  rect(ctx, x, y, w, h, a);
  ctx.fillStyle = b;
  const step = density >= 0.5 ? 1 : 2;
  for (let j = 0; j < h; j++) {
    for (let i = (j % 2) * step; i < w; i += 2 * step) {
      ctx.fillRect((x + i) | 0, (y + j) | 0, 1, 1);
    }
  }
}

/** A vertical gradient made of dithered bands - no smooth blending anywhere. */
export function gradientBands(ctx, x, y, w, h, colors) {
  const bands = colors.length;
  const band = h / bands;
  for (let i = 0; i < bands; i++) {
    const top = Math.round(y + i * band);
    const bottom = Math.round(y + (i + 1) * band);
    rect(ctx, x, top, w, bottom - top, colors[i]);
    if (i < bands - 1) {
      // scatter the next colour up into the seam
      ctx.fillStyle = colors[i + 1];
      for (let j = 0; j < 2; j++) {
        for (let k = ((bottom - 2 + j) % 2); k < w; k += 2) {
          ctx.fillRect((x + k) | 0, (bottom - 2 + j) | 0, 1, 1);
        }
      }
    }
  }
}

// ------------------------------------------------------------------- font
// 5x7 uppercase bitmap font. One line per glyph, '#' is ink.
const GLYPHS = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.####|#....|#....|#....|#....|#....|.####',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.####|#....|#....|#.###|#...#|#...#|.###.',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '#####|..#..|..#..|..#..|..#..|..#..|#####',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#...#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#...#|#.#.#|##.##|#...#',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
  3: '####.|....#|....#|.###.|....#|....#|####.',
  4: '#..#.|#..#.|#..#.|#####|...#.|...#.|...#.',
  5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '..##.|.#...|#....|####.|#...#|#...#|.###.',
  7: '#####|....#|...#.|..#..|.#...|.#...|.#...',
  8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  9: '.###.|#...#|#...#|.####|....#|...#.|.##..',
  ' ': '.....|.....|.....|.....|.....|.....|.....',
  '.': '.....|.....|.....|.....|.....|..##.|..##.',
  ',': '.....|.....|.....|.....|..##.|..##.|.#...',
  ':': '.....|..##.|..##.|.....|..##.|..##.|.....',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '?': '.###.|#...#|....#|..##.|..#..|.....|..#..',
  "'": '..#..|..#..|.....|.....|.....|.....|.....',
  '"': '.#.#.|.#.#.|.....|.....|.....|.....|.....',
  ';': '.....|..##.|..##.|.....|..##.|..##.|.#...',
  '-': '.....|.....|.....|#####|.....|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  '%': '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##',
  '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.',
  ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
  '<': '.....|...#.|..#..|.#...|..#..|...#.|.....',
  '>': '.....|.#...|..#..|...#.|..#..|.#...|.....',
  '=': '.....|.....|#####|.....|#####|.....|.....',
  '*': '.....|..#..|#.#.#|.###.|#.#.#|..#..|.....',
  '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.',
  '_': '.....|.....|.....|.....|.....|.....|#####',
};

export const FONT_H = 7;
export const FONT_W = 5;
export const FONT_ADVANCE = 6;

const glyphCache = new Map();

function glyphSurface(ch, color) {
  const key = ch + color;
  let found = glyphCache.get(key);
  if (found) return found;
  const rows = (GLYPHS[ch] || GLYPHS['?']).split('|');
  const s = surface(FONT_W, FONT_H);
  s.ctx.fillStyle = color;
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < FONT_W; x++) {
      if (rows[y][x] === '#') s.ctx.fillRect(x, y, 1, 1);
    }
  }
  if (glyphCache.size > 900) glyphCache.clear();
  glyphCache.set(key, s.canvas);
  return s.canvas;
}

export function textWidth(text) {
  return text.length ? text.length * FONT_ADVANCE - 1 : 0;
}

/**
 * Draw a string in the bitmap font.
 * opts: { shadow, align: 'left'|'center'|'right', wide }
 */
export function text(ctx, str, x, y, color = PAL.paper, opts = {}) {
  const s = String(str).toUpperCase();
  const width = textWidth(s);
  let ox = x | 0;
  if (opts.align === 'center') ox = (x - width / 2) | 0;
  else if (opts.align === 'right') ox = (x - width) | 0;
  const oy = y | 0;
  if (opts.shadow) {
    for (let i = 0; i < s.length; i++) {
      if (s[i] === ' ') continue;
      ctx.drawImage(glyphSurface(s[i], opts.shadow), ox + i * FONT_ADVANCE, oy + 1);
    }
  }
  for (let i = 0; i < s.length; i++) {
    if (s[i] === ' ') continue;
    ctx.drawImage(glyphSurface(s[i], color), ox + i * FONT_ADVANCE, oy);
  }
  return width;
}

/**
 * The same bitmap font, blown up by a whole number. Used for the title.
 * `outlineColor` traces the letters so they hold up against a busy sky.
 */
export function bigText(ctx, str, x, y, scale, color, outlineColor) {
  const s = String(str).toUpperCase();
  const width = s.length * (FONT_W + 1) * scale - scale;
  const ox = Math.round(x - width / 2);
  const draw = (col, dx, dy) => {
    for (let i = 0; i < s.length; i++) {
      if (s[i] === ' ') continue;
      const g = glyphSurface(s[i], col);
      ctx.drawImage(g, 0, 0, FONT_W, FONT_H,
                    ox + i * (FONT_W + 1) * scale + dx, Math.round(y) + dy,
                    FONT_W * scale, FONT_H * scale);
    }
  };
  if (outlineColor) {
    for (const [dx, dy] of [[-scale, 0], [scale, 0], [0, -scale], [0, scale],
                            [-scale, -scale], [scale, -scale], [-scale, scale], [scale, scale]]) {
      draw(outlineColor, dx, dy);
    }
  }
  draw(color, 0, 0);
  return width;
}

/** Word-wrap helper: returns an array of lines that fit `maxWidth` pixels. */
export function wrap(str, maxWidth) {
  const words = String(str).toUpperCase().split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate) <= maxWidth) current = candidate;
    else { if (current) lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

// ------------------------------------------------------------- seeded rng
export function rngFrom(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Trace a 1px outline around everything solid in the surface. This is the
 * single biggest readability win for small sprites - it separates a beaver
 * from the grass it is standing on. Semi-transparent pixels (drop shadows)
 * are ignored, so shadows stay soft and un-outlined.
 */
export function outline(ctx, w, h, color = PAL.ink, threshold = 128) {
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > threshold;
  const edge = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) edge.push(x, y);
    }
  }
  ctx.fillStyle = color;
  for (let i = 0; i < edge.length; i += 2) ctx.fillRect(edge[i], edge[i + 1], 1, 1);
}

/**
 * Paint the edges of a silhouette that face the light. Give it the direction
 * the light comes from and it finds every solid pixel with nothing beyond it
 * that way — which is exactly where a rim highlight belongs.
 */
export function rimLight(ctx, w, h, color, dirX = 1, dirY = -1, colorSoft = null) {
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 128;
  const hard = [];
  const soft = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      const openX = dirX && !solid(x + dirX, y);
      const openY = dirY && !solid(x, y + dirY);
      if (openX && openY) hard.push(x, y);
      else if (openX || openY) soft.push(x, y);
    }
  }
  ctx.fillStyle = colorSoft || color;
  for (let i = 0; i < soft.length; i += 2) ctx.fillRect(soft[i], soft[i + 1], 1, 1);
  ctx.fillStyle = color;
  for (let i = 0; i < hard.length; i += 2) ctx.fillRect(hard[i], hard[i + 1], 1, 1);
}

/** Slip a soft shadow in behind whatever has already been drawn. */
export function shadowUnder(ctx, cx, cy, rx, ry = Math.max(1, rx >> 1), alpha = 0.25) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = -ry; y <= ry; y++) {
    const span = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.001))));
    if (span > 0) ctx.fillRect((cx - span) | 0, (cy + y) | 0, span * 2, 1);
  }
  ctx.restore();
}
