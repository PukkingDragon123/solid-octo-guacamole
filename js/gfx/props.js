// The clutter that makes a place look lived in: barrels, crates, sacks, jars,
// tools on hooks, lamps, plants, bunting, pictures, firewood, brooms, ladders.
//
// These are deliberately simple - bold shape, three or four tones, one lit edge,
// one shadow. Detail goes into how many there are and how they are arranged, not
// into pixel-level fuss on each one.

import { sprite, px, rect, disc, line, frame as boxFrame } from './pixel.js';
import { RAMPS, ramp, mix, noise, contact, ao, rim, plank, cloth, metal, glass, stonework }
  from './paint.js';

const P = px, R = rect;

/** A barrel, hooped, with a lid or open. */
export function barrel(kind = 'closed') {
  return sprite(`barrel:${kind}`, 22, 28, (ctx) => {
    const w = RAMPS.oak, m = RAMPS.iron;
    contact(ctx, 11, 27, 10, 2, 0.3);
    // staves, bulging in the middle
    for (let y = 0; y < 24; y++) {
      const bulge = Math.round(Math.sin((y / 23) * Math.PI) * 2);
      const x0 = 2 - bulge, wd = 18 + bulge * 2;
      for (let i = 0; i < wd; i++) {
        const t = i / wd;
        const tone = t < 0.14 ? w[1] : t < 0.32 ? w[3] : t < 0.5 ? w[2] : t < 0.78 ? w[2] : w[1];
        P(ctx, x0 + i, y + 3, tone);
      }
      if (y % 6 === 0) R(ctx, x0, y + 3, wd, 1, mix(w[1], w[0], 0.4));
    }
    // hoops
    for (const hy of [6, 14, 22]) {
      const bulge = Math.round(Math.sin(((hy - 3) / 23) * Math.PI) * 2);
      metal(ctx, 2 - bulge, hy, 18 + bulge * 2, 2, m);
    }
    if (kind === 'open') {
      disc(ctx, 11, 4, 9, '#20303a');
      for (let i = 0; i < 5; i++) P(ctx, 6 + i * 2, 3 + (i % 2), RAMPS.water[3]);
    } else {
      disc(ctx, 11, 4, 9, w[3]);
      disc(ctx, 11, 3, 6, w[4]);
      P(ctx, 11, 3, w[2]);
    }
    ao(ctx, 0, 3, 22, 24, w[0], 1);
  });
}

/** A crate, slatted, sometimes with something in it. */
export function crate(fill = null) {
  return sprite(`crate:${fill || 'empty'}`, 24, 22, (ctx) => {
    const w = RAMPS.pine;
    contact(ctx, 12, 21, 11, 2, 0.3);
    plank(ctx, 1, 2, 22, 18, w, { dir: 'h', knots: 1 });
    for (const sy of [4, 10, 16]) R(ctx, 1, sy, 22, 1, mix(w[1], w[0], 0.5));
    plank(ctx, 1, 2, 4, 18, RAMPS.oak, { dir: 'v', knots: 0 });
    plank(ctx, 19, 2, 4, 18, RAMPS.oak, { dir: 'v', knots: 0 });
    if (fill === 'apples') {
      for (let i = 0; i < 5; i++) {
        disc(ctx, 5 + (i % 3) * 7, i < 3 ? 2 : -1, 3, '#d8443c');
        P(ctx, 4 + (i % 3) * 7, i < 3 ? 1 : -2, '#f0705c');
      }
    } else if (fill === 'timber') {
      for (let i = 0; i < 4; i++) {
        R(ctx, 3, 0 - i * 3, 18, 3, RAMPS.pine[3]);
        R(ctx, 3, 0 - i * 3, 18, 1, RAMPS.pine[4]);
      }
    }
    ao(ctx, 1, 2, 22, 18, w[0], 1);
  });
}

/** A sack, tied at the neck. */
export function sack(tone = '#d8c79a') {
  return sprite(`sack:${tone}`, 20, 24, (ctx) => {
    const r = ramp(tone);
    contact(ctx, 10, 23, 9, 2, 0.3);
    for (let y = 6; y < 22; y++) {
      const k = (y - 6) / 16;
      const wd = Math.round(8 + k * 8);
      R(ctx, 10 - wd / 2, y, wd, 1, k < 0.3 ? r[3] : k < 0.7 ? r[2] : r[1]);
    }
    R(ctx, 7, 4, 6, 3, r[1]);
    R(ctx, 6, 3, 8, 1, r[3]);
    metal(ctx, 6, 6, 8, 2, RAMPS.brass);
    // a crease down the belly
    for (let y = 10; y < 21; y++) P(ctx, 8 + Math.round(Math.sin(y * 0.5) * 1), y, r[1]);
    ao(ctx, 4, 6, 12, 17, r[0], 1);
  });
}

/** A glass jar with something in it. */
export function jar(contentTone = '#e8626f') {
  return sprite(`jar:${contentTone}`, 12, 16, (ctx) => {
    contact(ctx, 6, 15, 5, 1, 0.25);
    glass(ctx, 1, 3, 10, 12, RAMPS.glass, {});
    R(ctx, 2, 7, 8, 7, contentTone);
    R(ctx, 2, 7, 8, 1, mix(contentTone, '#ffffff', 0.4));
    metal(ctx, 1, 1, 10, 3, RAMPS.brass);
    P(ctx, 3, 5, '#ffffff');
  });
}

/** A bottle - the glassblower's stock, the kitchen shelf. */
export function bottle(tone = '#5aa83c') {
  return sprite(`bottle:${tone}`, 8, 18, (ctx) => {
    const r = ramp(tone);
    contact(ctx, 4, 17, 3, 1, 0.25);
    R(ctx, 2, 6, 4, 11, r[2]);
    R(ctx, 2, 6, 1, 11, r[3]);
    R(ctx, 5, 6, 1, 11, r[1]);
    R(ctx, 3, 2, 2, 4, r[2]);
    R(ctx, 3, 1, 2, 1, RAMPS.walnut[2]);
    P(ctx, 2, 8, '#ffffff');
    P(ctx, 2, 9, mix(tone, '#ffffff', 0.6));
  });
}

/** Tools, for hanging on a wall: saw, hammer, chisel, square, plane, axe. */
export function tool(kind) {
  const size = { saw: [30, 14], hammer: [10, 22], chisel: [6, 20], square: [18, 18],
                 plane: [22, 12], axe: [14, 26], mallet: [12, 22], brace: [16, 22] }[kind] || [16, 16];
  return sprite(`tool:${kind}`, size[0], size[1], (ctx) => {
    const w = RAMPS.oak, m = RAMPS.metal, i = RAMPS.iron;
    if (kind === 'saw') {
      metal(ctx, 0, 3, 24, 6, m);
      for (let x = 0; x < 24; x += 2) P(ctx, x, 9, m[4]);
      plank(ctx, 22, 1, 8, 11, w, { dir: 'h', knots: 0 });
      boxFrame(ctx, 22, 1, 8, 11, w[0]);
    } else if (kind === 'hammer') {
      plank(ctx, 4, 6, 3, 16, w, { dir: 'v', knots: 0 });
      metal(ctx, 1, 0, 9, 7, i);
      R(ctx, 1, 0, 9, 1, i[4]);
    } else if (kind === 'chisel') {
      plank(ctx, 2, 8, 3, 12, w, { dir: 'v', knots: 0 });
      metal(ctx, 2, 0, 3, 9, m, { vertical: true });
      P(ctx, 3, 0, '#ffffff');
    } else if (kind === 'square') {
      metal(ctx, 0, 0, 4, 18, i, { vertical: true });
      metal(ctx, 0, 14, 18, 4, i);
      P(ctx, 1, 1, m[4]);
    } else if (kind === 'plane') {
      plank(ctx, 0, 2, 22, 9, w, { dir: 'h', knots: 1 });
      metal(ctx, 8, 0, 5, 8, i, { vertical: true });
      R(ctx, 0, 10, 22, 2, w[0]);
    } else if (kind === 'axe') {
      plank(ctx, 6, 6, 3, 20, w, { dir: 'v', knots: 0 });
      metal(ctx, 2, 0, 11, 8, i);
      R(ctx, 2, 0, 11, 1, i[4]);
      P(ctx, 2, 4, '#ffffff');
    } else if (kind === 'mallet') {
      plank(ctx, 5, 8, 3, 14, w, { dir: 'v', knots: 0 });
      plank(ctx, 1, 0, 11, 9, RAMPS.walnut, { dir: 'h', knots: 1 });
    } else if (kind === 'brace') {
      metal(ctx, 6, 0, 4, 16, i, { vertical: true });
      metal(ctx, 2, 8, 12, 3, i);
      plank(ctx, 5, 16, 6, 6, w, { dir: 'h', knots: 0 });
    }
  });
}

/** An oil lamp or a hanging lantern. */
export function lantern(hanging = false) {
  return sprite(`lantern:${hanging ? 1 : 0}`, 14, hanging ? 26 : 18, (ctx) => {
    const oy = hanging ? 8 : 0;
    if (hanging) {
      R(ctx, 6, 0, 2, 6, RAMPS.iron[2]);
      disc(ctx, 7, 6, 2, RAMPS.iron[3]);
    }
    metal(ctx, 2, oy + 1, 10, 3, RAMPS.iron);
    glass(ctx, 3, oy + 4, 8, 9, RAMPS.glass, { lit: '#f7cc55' });
    R(ctx, 5, oy + 7, 4, 5, '#ffdf8a');
    P(ctx, 6, oy + 8, '#ffffff');
    metal(ctx, 2, oy + 13, 10, 3, RAMPS.iron);
    for (const bx of [2, 11]) R(ctx, bx, oy + 4, 1, 9, RAMPS.iron[1]);
  });
}

/** A potted plant, three shapes. */
export function pottedPlant(kind = 0) {
  return sprite(`pot:${kind}`, 20, 26, (ctx) => {
    const clay = ramp('#b5714f');
    contact(ctx, 10, 25, 8, 2, 0.3);
    // the pot, tapering
    for (let y = 0; y < 10; y++) {
      const wd = 14 - y;
      R(ctx, 10 - wd / 2, 16 + y, wd, 1, y < 2 ? clay[3] : y < 6 ? clay[2] : clay[1]);
    }
    R(ctx, 2, 14, 16, 3, clay[3]);
    R(ctx, 2, 14, 16, 1, clay[4]);
    R(ctx, 3, 17, 14, 1, '#4a3020');
    const g = [RAMPS.leafA, RAMPS.leafB, RAMPS.leafC][kind % 3];
    if (kind % 3 === 0) {
      // a leafy bush of a thing
      for (const [cx, cy, r] of [[10, 8, 6], [5, 11, 4], [15, 11, 4], [10, 4, 4]]) {
        disc(ctx, cx, cy, r, g[1]);
        disc(ctx, cx - 1, cy - 1, Math.max(1, r - 2), g[2]);
        disc(ctx, cx - 1, cy - 2, Math.max(1, r - 4), g[3]);
      }
    } else if (kind % 3 === 1) {
      // spiky, upright
      for (let i = 0; i < 7; i++) {
        const lx = 4 + i * 2, h = 6 + ((i * 3) % 8);
        for (let k = 0; k < h; k++) P(ctx, lx + Math.round(Math.sin(k * 0.4) * 1), 15 - k, k > h - 3 ? g[3] : g[2]);
      }
    } else {
      // trailing, over the rim
      for (const [cx, cy, r] of [[10, 9, 5], [4, 12, 3], [16, 12, 3]]) {
        disc(ctx, cx, cy, r, g[1]);
        disc(ctx, cx - 1, cy - 1, Math.max(1, r - 2), g[3]);
      }
      for (let i = 0; i < 5; i++) { P(ctx, 2, 17 + i, g[2]); P(ctx, 18, 18 + i, g[2]); }
      P(ctx, 8, 5, '#f7cc55');
      P(ctx, 13, 7, '#e8626f');
    }
  });
}

/** A framed picture for a wall. */
export function picture(kind = 0) {
  return sprite(`picture:${kind}`, 28, 24, (ctx) => {
    plank(ctx, 0, 0, 28, 24, RAMPS.walnut, { dir: 'h', knots: 0 });
    boxFrame(ctx, 0, 0, 28, 24, RAMPS.walnut[0]);
    R(ctx, 3, 3, 22, 18, '#e8dcc0');
    if (kind === 0) {
      // a valley, in paint
      R(ctx, 3, 3, 22, 8, '#8fd3ff');
      R(ctx, 3, 11, 22, 10, RAMPS.grass[2]);
      for (let i = 0; i < 3; i++) disc(ctx, 7 + i * 7, 11, 4, RAMPS.leafB[2]);
      disc(ctx, 20, 6, 3, '#f7cc55');
    } else if (kind === 1) {
      // a portrait
      disc(ctx, 14, 12, 6, RAMPS.oak[3]);
      disc(ctx, 14, 10, 4, RAMPS.oak[4]);
      P(ctx, 12, 10, '#1d1712'); P(ctx, 16, 10, '#1d1712');
      R(ctx, 9, 17, 10, 4, '#8256c4');
    } else {
      // a plan, pinned behind glass
      R(ctx, 3, 3, 22, 18, '#cfe0ee');
      for (let i = 5; i < 24; i += 4) R(ctx, i, 4, 1, 16, '#9fc0d8');
      for (let i = 5; i < 21; i += 4) R(ctx, 4, i, 20, 1, '#9fc0d8');
      R(ctx, 8, 8, 10, 7, '#4a6a8a');
    }
    R(ctx, 3, 3, 22, 1, '#ffffff');
  });
}

/** Bunting, strung along a beam - instant cheer. */
export function bunting(len = 80) {
  return sprite(`bunting:${len}`, len, 14, (ctx) => {
    const tones = ['#e8626f', '#f7cc55', '#4f8be8', '#5cba48', '#e08bab'];
    for (let x = 0; x < len; x++) {
      const sag = Math.round(Math.sin((x / len) * Math.PI) * 3);
      P(ctx, x, 1 + sag, '#e8e2d0');
    }
    for (let i = 0; i * 14 < len - 8; i++) {
      const bx = 3 + i * 14;
      const sag = Math.round(Math.sin((bx / len) * Math.PI) * 3);
      const tone = tones[i % tones.length];
      for (let k = 0; k < 8; k++) {
        R(ctx, bx + k, 2 + sag, 1, 8 - k, tone);
        if (k === 0) R(ctx, bx + k, 2 + sag, 1, 8 - k, mix(tone, '#ffffff', 0.4));
      }
      for (let k = 0; k < 8; k++) R(ctx, bx + 8 + k, 2 + sag, 1, k, mix(tone, '#000000', 0.2));
    }
  });
}

/** A stack of firewood, seen end-on. */
export function firewood(w = 34, h = 22) {
  return sprite(`firewood:${w}:${h}`, w, h + 3, (ctx) => {
    const rng = noise(31);
    contact(ctx, w >> 1, h + 2, (w >> 1) - 1, 2, 0.3);
    for (let y = h - 6; y >= 0; y -= 7) {
      for (let x = 1; x < w - 6; x += 7) {
        const jitter = Math.round(rng() * 2) - 1;
        const r = [RAMPS.oak, RAMPS.pine, RAMPS.walnut][(rng() * 3) | 0];
        disc(ctx, x + 3 + jitter, y + 3, 3, r[1]);
        disc(ctx, x + 3 + jitter, y + 3, 2, r[3]);
        P(ctx, x + 3 + jitter, y + 3, r[4]);
        for (let k = 0; k < 3; k++) P(ctx, x + 2 + jitter + k, y + 1, r[2]);
      }
    }
  });
}

/** A broom leaning against something. */
export function broom() {
  return sprite('broom', 12, 34, (ctx) => {
    contact(ctx, 7, 33, 5, 1, 0.25);
    plank(ctx, 5, 0, 3, 26, RAMPS.oak, { dir: 'v', knots: 0 });
    const s = ramp('#c2a35c');
    for (let i = 0; i < 9; i++) {
      const bx = 2 + i;
      for (let k = 0; k < 8; k++) P(ctx, bx + Math.round(k * 0.2), 25 + k, k > 5 ? s[1] : s[2]);
    }
    metal(ctx, 3, 24, 8, 2, RAMPS.iron);
  });
}

/** A ladder against a wall. */
export function ladder(h = 60) {
  return sprite(`ladder:${h}`, 18, h, (ctx) => {
    plank(ctx, 0, 0, 4, h, RAMPS.oak, { dir: 'v', knots: 1 });
    plank(ctx, 14, 0, 4, h, RAMPS.oak, { dir: 'v', knots: 1 });
    for (let y = 5; y < h - 3; y += 9) {
      plank(ctx, 3, y, 12, 3, RAMPS.pine, { dir: 'h', knots: 0 });
    }
  });
}

/** A bucket, empty or full. */
export function bucket(full = false) {
  return sprite(`bucket:${full ? 1 : 0}`, 16, 18, (ctx) => {
    contact(ctx, 8, 17, 6, 1, 0.28);
    for (let y = 0; y < 13; y++) {
      const wd = 12 - Math.round(y * 0.3);
      R(ctx, 8 - wd / 2, 4 + y, wd, 1, y < 2 ? RAMPS.metal[3] : y < 8 ? RAMPS.metal[2] : RAMPS.metal[1]);
    }
    metal(ctx, 2, 4, 12, 2, RAMPS.metal);
    if (full) {
      R(ctx, 3, 6, 10, 2, RAMPS.water[3]);
      P(ctx, 5, 6, RAMPS.water[4]);
    }
    // handle
    for (let i = 0; i < 12; i++) {
      P(ctx, 2 + i, 3 - Math.round(Math.sin((i / 11) * Math.PI) * 3), RAMPS.iron[2]);
    }
  });
}

/** A three-legged stool - every workshop has one. */
export function stool() {
  return sprite('stool', 20, 20, (ctx) => {
    contact(ctx, 10, 19, 8, 2, 0.3);
    plank(ctx, 2, 4, 16, 4, RAMPS.oak, { dir: 'h', knots: 1 });
    R(ctx, 2, 4, 16, 1, RAMPS.oak[4]);
    for (const [lx, lean] of [[4, -1], [14, 1], [9, 0]]) {
      for (let k = 0; k < 11; k++) P(ctx, lx + Math.round(lean * k * 0.2), 8 + k, RAMPS.walnut[2]);
      for (let k = 0; k < 11; k++) P(ctx, lx + 1 + Math.round(lean * k * 0.2), 8 + k, RAMPS.walnut[1]);
    }
  });
}

/** A shelf with a few things on it, ready to hang on a wall. */
export function shelf(len = 60, stock = 'jars') {
  return sprite(`shelf:${len}:${stock}`, len, 26, (ctx) => {
    plank(ctx, 0, 18, len, 5, RAMPS.oak, { dir: 'h', knots: 1 });
    R(ctx, 0, 18, len, 1, RAMPS.oak[4]);
    R(ctx, 0, 23, len, 1, RAMPS.oak[0]);
    // brackets
    for (const bx of [3, len - 8]) {
      for (let k = 0; k < 5; k++) R(ctx, bx, 23 + k, 5 - k, 1, RAMPS.walnut[1]);
    }
    const rng = noise(len);
    for (let x = 4; x < len - 10; x += 13) {
      if (stock === 'jars') ctx.drawImage(jar(['#e8626f', '#f7cc55', '#5cba48'][(rng() * 3) | 0]), x, 3);
      else if (stock === 'bottles') ctx.drawImage(bottle(['#5aa83c', '#8fd6f0', '#c2a35c'][(rng() * 3) | 0]), x + 2, 1);
      else if (stock === 'books') {
        for (let i = 0; i < 4; i++) {
          const bt = ['#c04a4a', '#4f8be8', '#f2c14e', '#8256c4'][(i + x) % 4];
          R(ctx, x + i * 3, 6, 2, 12, bt);
          R(ctx, x + i * 3, 6, 2, 1, mix(bt, '#ffffff', 0.4));
        }
      }
    }
  });
}

/** A rug, woven, for any floor that looks bare. */
export function rug(w = 70, h = 34, tone = '#a8404a') {
  return sprite(`rug:${w}:${h}:${tone}`, w, h + 4, (ctx) => {
    const r = ramp(tone);
    cloth(ctx, 0, 2, w, h, r, {});
    boxFrame(ctx, 0, 2, w, h, mix(r[4], '#ffffff', 0.3));
    boxFrame(ctx, 4, 6, w - 8, h - 8, r[1]);
    for (let i = 0; i < Math.floor(w / 18); i++) {
      const dx = 12 + i * 18;
      for (let k = 0; k < 5; k++) {
        P(ctx, dx + k - 2, 2 + h / 2 - 2 + Math.abs(k - 2), r[4]);
        P(ctx, dx + k - 2, 2 + h / 2 + 2 - Math.abs(k - 2), r[4]);
      }
    }
    for (let x = 0; x < w; x += 3) {
      R(ctx, x, 0, 1, 2, r[3]);
      R(ctx, x, h + 2, 1, 2, r[3]);
    }
  });
}

/** A wall hook with something hanging off it. */
export function wallHook(what = 'apron') {
  return sprite(`hook:${what}`, 16, 30, (ctx) => {
    metal(ctx, 6, 0, 4, 4, RAMPS.iron);
    P(ctx, 9, 4, RAMPS.iron[3]);
    if (what === 'apron') {
      cloth(ctx, 3, 4, 11, 20, ramp('#8a6a3f'), { fold: 0.5 });
      R(ctx, 3, 4, 11, 1, '#a88a5f');
      for (let i = 0; i < 5; i++) P(ctx, 4 + i * 2, 12, '#6b5330');
    } else if (what === 'hat') {
      disc(ctx, 8, 10, 6, '#c9a03c');
      R(ctx, 2, 12, 13, 3, '#d8b04c');
      R(ctx, 2, 12, 13, 1, '#f0cc70');
    } else if (what === 'coil') {
      for (let i = 0; i < 4; i++) {
        disc(ctx, 8, 8 + i * 4, 5, '#c2a35c');
        disc(ctx, 8, 8 + i * 4, 3, '#a88a4c');
      }
    }
  });
}
