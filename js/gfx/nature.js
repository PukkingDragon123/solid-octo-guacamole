// Everything that grows. Trees are the centrepiece: a tapered trunk with bark
// texture, a branch skeleton, and a canopy assembled from overlapping leaf
// clusters - each cluster lit on its top left, notched at the edge, and shaded
// underneath by the cluster above it. That layering is what makes a canopy read
// as foliage rather than as a green circle.

import { sprite, px, rect, disc, line } from './pixel.js';
import { RAMPS, ramp, mix, noise, speck, ao, rim, contact, turf, plank } from './paint.js';

export const TREES = [
  { id: 'oak',    bark: ramp('#6b4423'),  leaf: RAMPS.leafA,  shape: 'broad',   h: 96 },
  { id: 'pine',   bark: ramp('#4f3320'),  leaf: RAMPS.leafB,  shape: 'conifer', h: 112 },
  { id: 'birch',  bark: ramp('#b0a184'),  leaf: RAMPS.leafC,  shape: 'slender', h: 88 },
  { id: 'maple',  bark: ramp('#7a4a28'),  leaf: RAMPS.autumn, shape: 'broad',   h: 92 },
];

export const TREE_KINDS = TREES.length;

/**
 * One clump of leaves. Drawn as a squashed mass with a notched silhouette, a lit
 * crown, a shaded underside, and a scatter of individual leaves proud of the
 * edge so the outline never looks smooth.
 */
function leafClump(ctx, cx, cy, r, lr, seed, opts = {}) {
  const rng = noise(seed);
  const squash = opts.squash || 0.74;
  const fill = (rad, tone, oy = 0) => {
    ctx.fillStyle = tone;
    for (let y = -Math.round(rad * squash); y <= Math.round(rad * squash); y++) {
      const span = Math.round(rad * Math.sqrt(Math.max(0, 1 - (y * y) / (rad * rad * squash * squash + 0.01))));
      if (span > 0) ctx.fillRect(cx - span, cy + y + oy, span * 2 + 1, 1);
    }
  };
  fill(r, lr[1]);                       // the mass
  fill(r - 1, lr[2], -1);               // lit toward the top
  fill(Math.max(1, r - 3), lr[3], -2);  // the crown catching the sun
  fill(Math.max(1, r - 6), lr[4], -3);
  // shaded underside
  ctx.fillStyle = lr[0];
  for (let y = Math.round(r * squash * 0.15); y <= Math.round(r * squash); y++) {
    const span = Math.round(r * Math.sqrt(Math.max(0, 1 - (y * y) / (r * r * squash * squash + 0.01))));
    if (span > 1 && rng() > 0.35) ctx.fillRect(cx - span + 1, cy + y, span * 2 - 2, 1);
  }
  // notched edge: little leaf tips and gaps around the silhouette
  const steps = Math.max(12, r * 6);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r + (rng() > 0.62 ? 1 : 0) - (rng() > 0.78 ? 1 : 0);
    const lx = Math.round(cx + Math.cos(a) * rr);
    const ly = Math.round(cy + Math.sin(a) * rr * squash);
    const up = Math.sin(a) < -0.25;
    px(ctx, lx, ly, up ? lr[3] : rng() > 0.5 ? lr[1] : lr[0]);
    if (rng() > 0.88) {                 // a leaf sticking out on its own
      px(ctx, Math.round(cx + Math.cos(a) * (rr + 1)), Math.round(cy + Math.sin(a) * (rr + 1) * squash),
         up ? lr[4] : lr[1]);
    }
  }
  // holes you can see sky through, and clusters of individual leaves inside
  for (let i = 0; i < r * 1.6; i++) {
    const a = rng() * Math.PI * 2, rr = rng() * r * 0.8;
    const lx = Math.round(cx + Math.cos(a) * rr), ly = Math.round(cy + Math.sin(a) * rr * squash);
    const t = rng();
    if (t > 0.82) px(ctx, lx, ly, lr[0]);
    else if (t > 0.5) { px(ctx, lx, ly, lr[3]); px(ctx, lx + 1, ly, lr[2]); }
  }
}

/** Bark: vertical furrows that wander, plus lenticels or plates by species. */
function bark(ctx, x, y, w, h, br, kind, seed) {
  const rng = noise(seed);
  for (let i = 0; i < w; i++) {
    const t = i / Math.max(1, w - 1);
    // a cylinder: light on the left third, dark on the right
    const tone = t < 0.12 ? br[1] : t < 0.34 ? br[3] : t < 0.5 ? br[2] : t < 0.78 ? br[1] : br[0];
    rect(ctx, x + i, y, 1, h, tone);
  }
  if (kind === 'birch') {
    // papery bark: a few short dark dashes, never spanning the trunk
    for (let k = 0; k < h * 0.18; k++) {
      if (rng() > 0.5) continue;
      const by = y + rng() * h;
      const bw = 1 + ((rng() * Math.max(1, w * 0.35)) | 0);
      const bx = x + rng() * Math.max(1, w - bw);
      rect(ctx, bx, by, bw, 1, br[0]);
      if (rng() > 0.6) px(ctx, bx + bw, by, br[3]);
    }
  } else {
    // furrowed bark: broken vertical grooves
    for (let g = 0; g < Math.max(3, w * 1.1); g++) {
      let gx = x + rng() * w;
      let gy = y + rng() * h * 0.4;
      const len = h * (0.3 + rng() * 0.6);
      for (let d = 0; d < len; d++) {
        if (rng() > 0.85) gx += rng() > 0.5 ? 1 : -1;
        if (gx < x || gx > x + w - 1) break;
        if (rng() > 0.2) px(ctx, gx, gy + d, rng() > 0.7 ? br[0] : br[1]);
        if (rng() > 0.9) px(ctx, gx + 1, gy + d, br[3]);
      }
    }
  }
}

/**
 * A whole tree. `stage` 0..1 is growth; `size` 0..1 varies the height so a
 * stand never looks stamped out.
 */
export function tree(kind, stage = 1, size = 0.5) {
  const sp = TREES[kind % TREES.length];
  const step = Math.max(1, Math.round(stage * 4));
  const bucket = Math.max(0, Math.min(2, Math.round(size * 2)));
  const grow = step / 4;
  const h = Math.round(sp.h * (0.34 + grow * 0.66) * (0.86 + bucket * 0.13));
  const w = Math.round(h * (sp.shape === 'conifer' ? 0.66 : 0.94));
  return sprite(`tree:${sp.id}:${step}:${bucket}`, w, h + 4, (ctx) => {
    const cx = w >> 1;
    const base = h + 2;
    const rng = noise(kind * 977 + step * 31 + bucket * 7);
    const trunkW = Math.max(3, Math.round(h * (sp.shape === 'slender' ? 0.05 : 0.07)));
    const crownY = Math.round(h * (sp.shape === 'conifer' ? 0.2 : 0.44));

    // ---- roots flaring into the ground
    for (let i = -2; i <= 2; i++) {
      const rw = trunkW + Math.abs(i) * 2;
      rect(ctx, cx - (rw >> 1), base - 4 + Math.abs(i), rw, 2, sp.bark[i < 0 ? 3 : 1]);
    }
    contact(ctx, cx, base, Math.round(w * 0.3), 3, 0.3);

    // ---- trunk, tapering, with bark
    for (let y = base - 3; y > crownY; y--) {
      const k = (base - y) / (base - crownY);
      const tw = Math.max(2, Math.round(trunkW * (1.18 - k * 0.42)));
      const lean = Math.round(Math.sin(k * 2.4 + kind) * (h * 0.02));
      bark(ctx, cx - tw + lean, y, tw * 2, 1, sp.bark, sp.id, (y * 31 + kind) | 0);
    }

    // ---- branch skeleton, then the canopy hung on it
    const clumps = [];
    if (sp.shape === 'conifer') {
      const tiers = 6;
      for (let i = 0; i < tiers; i++) {
        const k = i / (tiers - 1);
        const ty = Math.round(h * 0.08 + k * (h * 0.62));
        const spread = Math.round((w * 0.5) * (0.22 + k * 0.78));
        // the bough: a dark line out to each side
        line(ctx, cx, ty, cx - spread, ty + 6, sp.bark[1]);
        line(ctx, cx, ty, cx + spread, ty + 6, sp.bark[1]);
        clumps.push([cx, ty, Math.max(3, Math.round(spread * 0.55)), 0.5]);
        clumps.push([cx - Math.round(spread * 0.62), ty + 4, Math.max(3, Math.round(spread * 0.45)), 0.42]);
        clumps.push([cx + Math.round(spread * 0.6), ty + 4, Math.max(3, Math.round(spread * 0.42)), 0.42]);
      }
    } else {
      // A broad crown: clumps arranged round an irregular dome, each at its own
      // height and radius. Laying them out at one height gives a flat slab, and
      // branches drawn out past the foliage read as legs under a table - so the
      // branch stubs stay inside the mass.
      const r = Math.round(w * 0.19);
      const domeY = crownY - Math.round(r * 0.5);
      const ring = [
        [0.00, -1.05, 1.05], [-0.86, -0.34, 0.95], [0.88, -0.40, 0.92],
        [-0.52, 0.34, 0.82], [0.56, 0.30, 0.86], [0.00, -0.20, 1.00],
        [-1.05, -0.86, 0.62], [1.02, -0.80, 0.66],
      ];
      for (const [ox, oy, rr] of ring) {
        const jx = (rng() - 0.5) * r * 0.22;
        const jy = (rng() - 0.5) * r * 0.22;
        clumps.push([
          Math.round(cx + ox * r * 1.05 + jx),
          Math.round(domeY + oy * r * 0.92 + jy),
          Math.max(3, Math.round(r * rr * (0.9 + rng() * 0.2))),
          0.76,
        ]);
      }
      // two short limbs, kept under the foliage
      for (const side of [-1, 1]) {
        const bx = Math.round(cx + side * r * 0.6);
        const by = Math.round(crownY + 6);
        line(ctx, cx, crownY + 12, bx, by, sp.bark[1]);
        line(ctx, cx + side, crownY + 12, bx + side, by, sp.bark[0]);
      }
    }
    // back to front, so upper clumps shade the ones beneath
    clumps.sort((a, b) => a[1] - b[1]);
    clumps.forEach((c, i) => leafClump(ctx, c[0], c[1], c[2], sp.leaf, 100 + i * 37 + kind * 11,
                                      { squash: c[3] }));
  });
}

/** The stump left behind, with a bright sawn face and the axe notch showing. */
export function stump(kind) {
  const sp = TREES[kind % TREES.length];
  return sprite(`stump:${sp.id}`, 26, 18, (ctx) => {
    contact(ctx, 13, 17, 11, 3, 0.3);
    bark(ctx, 4, 6, 18, 11, sp.bark, sp.id, 5);
    // the cut face: rings, in perspective
    for (let r = 9; r > 0; r--) {
      ctx.fillStyle = r % 3 === 0 ? mix(sp.bark[3], '#ffe9b0', 0.4) : sp.bark[3];
      for (let y = -Math.round(r * 0.4); y <= Math.round(r * 0.4); y++) {
        const span = Math.round(r * Math.sqrt(Math.max(0, 1 - (y * y) / (r * r * 0.16 + 0.01))));
        ctx.fillRect(13 - span, 6 + y, span * 2, 1);
      }
    }
    px(ctx, 13, 6, sp.bark[1]);
    rect(ctx, 4, 8, 7, 4, sp.bark[0]);       // the notch
    rect(ctx, 4, 8, 7, 1, sp.bark[1]);
    ao(ctx, 4, 6, 18, 11, sp.bark[0], 1);
  });
}

/** A felled log lying on the ground. */
export function log(kind, len = 90) {
  const sp = TREES[kind % TREES.length];
  return sprite(`log:${sp.id}:${len}`, len, 20, (ctx) => {
    contact(ctx, len >> 1, 19, len >> 1, 3, 0.28);
    for (let y = 0; y < 13; y++) {
      const t = y / 12;
      const tone = t < 0.14 ? sp.bark[1] : t < 0.34 ? sp.bark[3] : t < 0.52 ? sp.bark[2] : t < 0.8 ? sp.bark[1] : sp.bark[0];
      rect(ctx, 0, 4 + y, len, 1, tone);
    }
    bark(ctx, 0, 4, len, 1, sp.bark, sp.id, 9);
    const rng = noise(43);
    for (let i = 0; i < len * 0.8; i++) {
      const bx = rng() * len, by = 5 + rng() * 11;
      px(ctx, bx, by, rng() > 0.6 ? sp.bark[0] : sp.bark[1]);
    }
    // sawn end, rings on an ellipse
    for (let r = 6; r > 0; r--) {
      ctx.fillStyle = r % 2 ? mix(sp.bark[3], '#ffe9b0', 0.35) : sp.bark[3];
      for (let y = -r; y <= r; y++) {
        const span = Math.round(3 * Math.sqrt(Math.max(0, 1 - (y * y) / (r * r))));
        ctx.fillRect(len - 3 - span, 10 + y, span * 2 + 1, 1);
      }
    }
    ao(ctx, 0, 4, len, 13, sp.bark[0], 1);
  });
}

/** A bush: three clumps and a woody base. */
export function bush(variant = 0, berry = null) {
  const lr = [RAMPS.leafA, RAMPS.leafB, RAMPS.leafC][variant % 3];
  return sprite(`bush:${variant}:${berry || 'none'}`, 34, 26, (ctx) => {
    contact(ctx, 17, 25, 13, 3, 0.3);
    rect(ctx, 16, 18, 3, 7, RAMPS.walnut[1]);
    line(ctx, 17, 20, 12, 16, RAMPS.walnut[1]);
    line(ctx, 17, 20, 23, 16, RAMPS.walnut[1]);
    leafClump(ctx, 11, 15, 8, lr, 21, { squash: 0.8 });
    leafClump(ctx, 24, 16, 8, lr, 33, { squash: 0.8 });
    leafClump(ctx, 17, 10, 9, lr, 45, { squash: 0.78 });
    if (berry) {
      const rng = noise(77);
      for (let i = 0; i < 9; i++) {
        const bx = 6 + rng() * 22, by = 6 + rng() * 14;
        px(ctx, bx, by, berry);
        px(ctx, bx + 1, by, mix(berry, '#ffffff', 0.45));
      }
    }
  });
}

/** A bush at one of three sizes, for scattering along a treeline. */
export function scrubBush(size = 1, variant = 0) {
  const lr = [RAMPS.leafA, RAMPS.leafB, RAMPS.leafC][variant % 3];
  const d = [22, 32, 44][size % 3];
  return sprite(`scrub:${size}:${variant}`, d, Math.round(d * 0.72) + 3, (ctx) => {
    const h = Math.round(d * 0.72);
    contact(ctx, d >> 1, h + 1, Math.round(d * 0.36), 2, 0.28);
    const r = Math.round(d * 0.3);
    leafClump(ctx, Math.round(d * 0.32), h - r, r, lr, 900 + size * 7 + variant, { squash: 0.8 });
    leafClump(ctx, Math.round(d * 0.7), h - r + 2, Math.round(r * 0.9), lr, 930 + size, { squash: 0.8 });
    leafClump(ctx, Math.round(d * 0.5), h - r * 1.7, Math.round(r * 0.95), lr, 960 + variant, { squash: 0.78 });
  });
}

/** A tuft of grass, for scattering over turf. */
export function grassTuft(variant = 0) {
  return sprite(`tuft:${variant}`, 12, 10, (ctx) => {
    const r = RAMPS.grass;
    const rng = noise(200 + variant);
    for (let i = 0; i < 7; i++) {
      const bx = 1 + i + ((rng() * 3) | 0);
      const bh = 3 + ((rng() * 6) | 0);
      const lean = rng() > 0.5 ? 1 : -1;
      for (let k = 0; k < bh; k++) {
        const t = k / bh;
        px(ctx, bx + Math.round(lean * t * 2), 9 - k, k === bh - 1 ? r[4] : t > 0.4 ? r[3] : r[2]);
      }
    }
    rect(ctx, 2, 9, 8, 1, r[1]);
  });
}

/** A flower, three species, on a stem with a leaf. */
export function flower(kind = 0) {
  const petal = ['#f2f2f2', '#f7cc55', '#e8626f', '#a97ee0'][kind % 4];
  return sprite(`flower:${kind}`, 9, 12, (ctx) => {
    const g = RAMPS.grass;
    rect(ctx, 4, 5, 1, 7, g[2]);
    px(ctx, 3, 8, g[3]);
    px(ctx, 2, 9, g[2]);
    px(ctx, 6, 7, g[3]);
    // petals round a centre
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1]]) {
      px(ctx, 4 + dx, 3 + dy, petal);
    }
    px(ctx, 4, 3, kind === 1 ? '#8a5a2f' : '#f7cc55');
    px(ctx, 3, 2, mix(petal, '#ffffff', 0.5));
  });
}

/** A rock: faceted, speckled, mossy on the shaded side. */
export function rock(size = 1) {
  const w = 12 + size * 10, h = 8 + size * 7;
  return sprite(`rock:${size}`, w, h + 3, (ctx) => {
    const r = RAMPS.stone;
    contact(ctx, w >> 1, h + 1, (w >> 1) - 1, 2, 0.3);
    // a chunky faceted mass
    const rng = noise(300 + size);
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const span = Math.round((w / 2) * Math.sqrt(Math.max(0, 1 - Math.pow(t * 1.7 - 0.7, 2))));
      const tone = t < 0.2 ? r[4] : t < 0.42 ? r[3] : t < 0.68 ? r[2] : r[1];
      rect(ctx, (w >> 1) - span, y + 1, span * 2, 1, tone);
    }
    // facet lines and chips
    line(ctx, (w >> 1) - 2, 2, 3, h - 2, r[1]);
    line(ctx, (w >> 1) + 2, 3, w - 3, h - 3, r[1]);
    speck(ctx, 2, 2, w - 4, h - 3, [r[0], r[4]], Math.round(w * 1.2), 8);
    // moss where the light does not reach
    for (let i = 0; i < w * 0.4; i++) {
      const mx = 2 + rng() * (w - 4);
      px(ctx, mx, h - 2 - ((rng() * 2) | 0), rng() > 0.5 ? RAMPS.leafB[1] : RAMPS.leafB[2]);
    }
    ao(ctx, 1, 1, w - 2, h, r[0], 2);
  });
}

/** A fern, for the forest floor. */
export function fern() {
  return sprite('fern', 18, 14, (ctx) => {
    const r = RAMPS.leafB;
    for (let f = 0; f < 5; f++) {
      const a = -2.5 + f * 0.5;
      const len = 7 + (f % 2) * 3;
      for (let d = 0; d < len; d++) {
        const fx = 9 + Math.round(Math.cos(a) * d);
        const fy = 13 + Math.round(Math.sin(a) * d);
        px(ctx, fx, fy, d > len - 3 ? r[3] : r[2]);
        if (d % 2 === 0) {
          px(ctx, fx - 1, fy - 1, r[1]);
          px(ctx, fx + 1, fy, r[3]);
        }
      }
    }
  });
}

/** A mushroom pair. */
export function mushroom(kind = 0) {
  const cap = kind ? '#e8626f' : '#c98a4c';
  return sprite(`mushroom:${kind}`, 12, 10, (ctx) => {
    contact(ctx, 6, 9, 4, 1, 0.25);
    rect(ctx, 4, 5, 2, 4, '#e8e2d0');
    rect(ctx, 2, 3, 7, 3, cap);
    rect(ctx, 2, 3, 7, 1, mix(cap, '#ffffff', 0.4));
    px(ctx, 4, 4, '#f2f2f2'); px(ctx, 7, 4, '#f2f2f2');
    rect(ctx, 8, 7, 2, 2, '#e8e2d0');
    rect(ctx, 7, 6, 4, 2, mix(cap, '#000000', 0.15));
  });
}

// ------------------------------------------------------------- from above
/** A tree seen from above: a canopy of clumps with a shadow offset below it. */
export function treeTop(kind, size = 1) {
  const sp = TREES[kind % TREES.length];
  const d = Math.round(30 + size * 18);
  return sprite(`treeTop:${sp.id}:${size}`, d + 8, d + 12, (ctx) => {
    const cx = (d + 8) >> 1, cy = (d + 12) >> 1;
    // the shadow it throws on the ground, down and right
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = '#1b1424';
    for (let y = -d / 2; y <= d / 2; y++) {
      const span = Math.round((d / 2) * Math.sqrt(Math.max(0, 1 - (y * y) / ((d / 2) * (d / 2)))));
      if (span > 0) ctx.fillRect(cx - span + 5, cy + y + 6, span * 2, 1);
    }
    ctx.globalAlpha = 1;
    const rng = noise(500 + kind * 13 + size);
    const clumps = [[0, 0, d * 0.3]];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng();
      clumps.push([Math.cos(a) * d * 0.26, Math.sin(a) * d * 0.26, d * (0.2 + rng() * 0.08)]);
    }
    clumps.forEach((c, i) => leafClump(ctx, cx + Math.round(c[0]), cy + Math.round(c[1]),
                                      Math.round(c[2]), sp.leaf, 600 + i * 29 + kind, { squash: 1 }));
    // a glimpse of trunk at the centre
    px(ctx, cx, cy, sp.bark[1]);
  });
}

/** A patch of turf tile for top-down scenes: clumps, not a flat green square. */
export function grassTile(variant = 0, size = 16) {
  return sprite(`grassTile:${variant}:${size}`, size, size, (ctx) => {
    const r = RAMPS.grass;
    const rng = noise(700 + variant * 37);
    // a base that is not one flat tone
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = rng();
        px(ctx, x, y, t > 0.86 ? r[3] : t > 0.62 ? r[2] : t > 0.2 ? r[2] : r[1]);
      }
    }
    // blades: short strokes leaning both ways, brightest at the tip
    for (let i = 0; i < 10 + variant * 2; i++) {
      const bx = rng() * size, by = rng() * size;
      const bh = 2 + ((rng() * 3) | 0);
      const lean = rng() > 0.5 ? 1 : -1;
      for (let k = 0; k < bh; k++) {
        px(ctx, bx + (k === bh - 1 ? lean : 0), by - k, k === bh - 1 ? r[4] : r[3]);
      }
    }
  });
}

/**
 * Low-frequency variation over a field of grass tiles: mown patches, richer
 * green in the hollows, clover, daisies and bare scuffs. A tiled field without
 * this reads as one flat colour however good the tile is.
 */
export function grassPatches(ctx, x, y, w, h, seed = 1) {
  const r = RAMPS.grass;
  const rng = noise(seed);
  // broad blotches, darker and lighter
  for (let i = 0; i < 26; i++) {
    const bx = x + rng() * w, by = y + rng() * h;
    const rad = 10 + rng() * 26;
    const tone = rng() > 0.5 ? r[1] : r[3];
    ctx.globalAlpha = 0.4;
    for (let dy = -rad; dy <= rad; dy++) {
      const span = Math.round(rad * Math.sqrt(Math.max(0, 1 - (dy * dy) / (rad * rad))));
      const wobble = Math.round(Math.sin(dy * 0.4 + i) * 3);
      if (span > 0) ctx.fillStyle = tone, ctx.fillRect(bx - span + wobble, by + dy, span * 2, 1);
    }
    ctx.globalAlpha = 1;
  }
  // clover and daisies, in clusters rather than evenly spread
  for (let c = 0; c < 14; c++) {
    const cx = x + rng() * w, cy = y + rng() * h;
    const n = 4 + ((rng() * 8) | 0);
    for (let i = 0; i < n; i++) {
      const px0 = cx + (rng() - 0.5) * 24, py = cy + (rng() - 0.5) * 18;
      const t = rng();
      if (t > 0.7) { px(ctx, px0, py, '#f2f2f2'); px(ctx, px0 + 1, py, '#e8e2d0'); px(ctx, px0, py + 1, r[1]); }
      else if (t > 0.4) { px(ctx, px0, py, r[4]); px(ctx, px0 + 1, py + 1, r[3]); }
      else px(ctx, px0, py, r[1]);
    }
  }
  // scuffed bare earth where feet go
  for (let i = 0; i < 8; i++) {
    const bx = x + rng() * w, by = y + rng() * h;
    for (let k = 0; k < 14; k++) {
      px(ctx, bx + (rng() - 0.5) * 12, by + (rng() - 0.5) * 8, rng() > 0.5 ? RAMPS.dirt[1] : RAMPS.dirt[2]);
    }
  }
}

/** Beaten earth for paths, seen from above. */
export function dirtTile(variant = 0, size = 16) {
  return sprite(`dirtTile:${variant}:${size}`, size, size, (ctx) => {
    const r = RAMPS.dirt;
    const rng = noise(800 + variant);
    rect(ctx, 0, 0, size, size, r[2]);
    for (let i = 0; i < size * size * 0.28; i++) {
      px(ctx, rng() * size, rng() * size, rng() > 0.55 ? r[1] : r[3]);
    }
    for (let i = 0; i < 2 + variant; i++) {
      const sx = rng() * size, sy = rng() * size;
      rect(ctx, sx, sy, 2, 2, RAMPS.stone[2]);
      px(ctx, sx, sy, RAMPS.stone[4]);
    }
  });
}
