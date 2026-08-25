// Every sprite in DAM IT is generated here, pixel by pixel, from a seed.
// Nothing is loaded from disk.

import { PAL, sprite, surface, px, rect, frame, disc, line, dither, outline, shadowUnder, rngFrom, hashString } from './pixel.js';

export const T = 16; // tile size in pixels

const GRASS_RAMP = [PAL.grass0, PAL.grass1, PAL.grass2, PAL.grass3, PAL.grass4];
const DIRT_RAMP = [PAL.dirt0, PAL.dirt1, PAL.dirt2, PAL.dirt3];
const LEAF_SETS = [
  [PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3],
  [PAL.grass0, PAL.grass1, PAL.grass2, PAL.grass3],
  [PAL.leaf0, PAL.leaf1, PAL.grass2, PAL.grass4],
];

// ---------------------------------------------------------------- terrain
export function grassTile(variant, dry = false) {
  return sprite(`grass${variant}${dry ? 'D' : ''}`, T, T, (ctx) => {
    const rng = rngFrom(1000 + variant * 97);
    const base = dry ? PAL.dry2 : PAL.grass2;
    const lo = dry ? PAL.dry1 : PAL.grass1;
    const hi = dry ? PAL.dry3 : PAL.grass3;
    rect(ctx, 0, 0, T, T, base);
    // speckle two shades so the meadow has grain instead of flat colour
    for (let i = 0; i < 46; i++) {
      const x = (rng() * T) | 0, y = (rng() * T) | 0;
      px(ctx, x, y, rng() < 0.55 ? lo : hi);
    }
    if (variant === 1) {
      // a couple of blades
      for (const [bx, by] of [[4, 11], [10, 8], [13, 13]]) {
        px(ctx, bx, by, dry ? PAL.dry1 : PAL.grass0);
        px(ctx, bx, by - 1, lo);
        px(ctx, bx + 1, by - 2, lo);
      }
    } else if (variant === 2) {
      // tiny wildflowers
      const c = dry ? PAL.gold2 : [PAL.gold2, PAL.pink, PAL.white][(variant + 1) % 3];
      px(ctx, 5, 6, c); px(ctx, 6, 5, c); px(ctx, 6, 7, c); px(ctx, 7, 6, c);
      px(ctx, 6, 6, PAL.gold);
      px(ctx, 11, 12, c); px(ctx, 12, 12, PAL.gold);
    } else if (variant === 3) {
      // a worn patch showing the soil through
      for (let i = 0; i < 10; i++) px(ctx, 3 + ((rng() * 7) | 0), 8 + ((rng() * 5) | 0), PAL.dirt3);
    }
  });
}

export function dirtTile(variant) {
  return sprite(`dirt${variant}`, T, T, (ctx) => {
    const rng = rngFrom(2000 + variant * 131);
    rect(ctx, 0, 0, T, T, PAL.dirt2);
    for (let i = 0; i < 40; i++) {
      const x = (rng() * T) | 0, y = (rng() * T) | 0;
      px(ctx, x, y, rng() < 0.5 ? PAL.dirt1 : PAL.dirt3);
    }
    for (let i = 0; i < 4; i++) {
      const x = (rng() * (T - 2)) | 0, y = (rng() * (T - 1)) | 0;
      px(ctx, x, y, PAL.dirt0); px(ctx, x + 1, y, PAL.dirt0);
    }
    if (variant === 1) { px(ctx, 4, 5, PAL.sand); px(ctx, 5, 5, PAL.sand); px(ctx, 11, 10, PAL.sand); }
  });
}

export function rockTile(variant, dry = false) {
  return sprite(`rock${variant}${dry ? 'D' : ''}`, T, T, (ctx) => {
    const rng = rngFrom(3000 + variant * 53);
    // plain grass underneath, matching the ground around it
    ctx.drawImage(grassTile(0, dry), 0, 0);
    const boulder = (cx, cy, r) => {
      disc(ctx, cx, cy + 1, r, PAL.stone0);
      disc(ctx, cx, cy, r, PAL.stone1);
      disc(ctx, cx - 1, cy - 1, Math.max(1, r - 2), PAL.stone2);
      px(ctx, cx - 1, cy - 2, PAL.stone3);
      px(ctx, cx, cy - 2, PAL.stone3);
    };
    // four different scatters, so a boulder field never tiles visibly
    const layouts = [
      [[6, 9, 4], [11, 12, 3]],
      [[10, 8, 4], [4, 12, 3], [13, 4, 2]],
      [[8, 11, 5], [3, 5, 2]],
      [[5, 6, 3], [11, 10, 4], [7, 13, 2]],
    ][variant % 4];
    for (const [bx, by, r] of layouts) boulder(bx + ((rng() * 2) | 0), by, r);
  });
}

/** Water animates over four frames; ponds are calmer and lighter than the river. */
export function waterTile(still, animFrame, deepWater = false) {
  return sprite(`water${still ? 'P' : 'R'}${animFrame}${deepWater ? 'D' : ''}`, T, T, (ctx) => {
    const base = deepWater ? PAL.water1 : (still ? PAL.water2 : PAL.water1);
    const deep = deepWater ? PAL.water0 : (still ? PAL.water1 : PAL.water0);
    const mid = deepWater ? PAL.water2 : (still ? PAL.water3 : PAL.water2);
    const hi = deepWater ? PAL.water3 : (still ? PAL.water4 : PAL.water3);
    rect(ctx, 0, 0, T, T, base);
    const rng = rngFrom(4000 + (still ? 7 : 13));
    // mottled depth
    for (let i = 0; i < 30; i++) px(ctx, (rng() * T) | 0, (rng() * T) | 0, deep);
    for (let i = 0; i < 22; i++) px(ctx, (rng() * T) | 0, (rng() * T) | 0, mid);
    // drifting crests
    const shift = animFrame * (still ? 3 : 5);
    const crests = still ? [[2, 6], [7, 4], [11, 7], [14, 3]] : [[1, 7], [5, 5], [9, 8], [13, 4]];
    for (const [ry, len] of crests) {
      const x = (ry * 5 + shift) % T;
      for (let i = 0; i < len; i++) {
        const cx = (x + i) % T;
        px(ctx, cx, ry, hi);
        px(ctx, cx, ry + 1, mid);
      }
      px(ctx, x % T, ry, PAL.foam);
    }
    if (!still) {
      // the river runs, so give it a couple of streaks
      for (let i = 0; i < T; i += 4) px(ctx, (i + shift) % T, (i * 3) % T, PAL.water4);
    }
  });
}

/** Foam along the edge where water meets land. dir: 0=N 1=E 2=S 3=W */
export function foamEdge(dir) {
  return sprite(`foam${dir}`, T, T, (ctx) => {
    const rng = rngFrom(5000 + dir);
    for (let i = 0; i < T; i++) {
      const depth = 1 + (rng() < 0.4 ? 1 : 0);
      for (let d = 0; d < depth; d++) {
        const c = d === 0 ? PAL.foam : PAL.water4;
        if (dir === 0) px(ctx, i, d, c);
        else if (dir === 2) px(ctx, i, T - 1 - d, c);
        else if (dir === 3) px(ctx, d, i, c);
        else px(ctx, T - 1 - d, i, c);
      }
    }
  });
}

/** A finished dam segment: stacked logs with stakes driven through. */
export function damTile() {
  return sprite('dam', T, T, (ctx) => {
    rect(ctx, 0, 2, T, 12, PAL.wood0);
    for (let i = 0; i < 3; i++) {
      const y = 3 + i * 4;
      rect(ctx, 0, y, T, 3, PAL.wood2);
      rect(ctx, 0, y, T, 1, PAL.wood3);
      rect(ctx, 0, y + 2, T, 1, PAL.wood1);
      for (let k = 1; k < T; k += 5) px(ctx, k, y + 1, PAL.wood1);
    }
    for (const sx of [3, 9, 14]) {
      rect(ctx, sx, 1, 1, T - 3, PAL.wood1);
      px(ctx, sx, 1, PAL.wood4);
    }
    rect(ctx, 0, 1, T, 1, PAL.foam);
  });
}

// ------------------------------------------------------------------ trees
// Six species, each grown from a seed: trunk with bark and roots, real branch
// lines, a four-tone canopy and a broken leafy edge. Grown trees come in three
// sway frames — only the canopy moves, so the trunk stays planted.

const SPECIES = [
  { id: 'oak',    leaves: [PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3], bark: [PAL.wood0, PAL.wood1, PAL.wood2] },
  { id: 'pine',   leaves: ['#173a20', PAL.leaf0, PAL.leaf1, PAL.leaf2], bark: [PAL.wood0, PAL.wood1, '#6b4526'] },
  { id: 'birch',  leaves: [PAL.leaf1, PAL.leaf2, PAL.grass3, PAL.grass4], bark: ['#8f8b80', '#c9c4b6', '#eae5d8'] },
  { id: 'willow', leaves: [PAL.leaf1, '#4f8f3e', PAL.grass3, PAL.dry4], bark: [PAL.wood0, PAL.wood1, PAL.wood2] },
  { id: 'maple',  leaves: ['#7a3a18', '#a8541f', '#d2802c', PAL.gold2], bark: [PAL.wood0, PAL.wood1, PAL.wood3] },
  { id: 'bushy',  leaves: [PAL.leaf0, PAL.leaf1, PAL.grass2, PAL.grass4], bark: [PAL.wood0, PAL.wood1, PAL.wood2] },
];

export const TREE_SPECIES = SPECIES.length;

function trunkAndRoots(ctx, cx, baseY, height, width, bark, rng) {
  // roots flaring into the ground
  for (const dir of [-1, 1]) {
    const spread = width >= 3 ? 3 : 2;
    for (let i = 1; i <= spread; i++) {
      px(ctx, cx + dir * i, baseY - Math.max(0, i - 2), bark[0]);
      if (i < spread) px(ctx, cx + dir * i, baseY - 1, bark[1]);
    }
  }
  rect(ctx, cx - (width >> 1), baseY - height, width, height, bark[1]);
  rect(ctx, cx - (width >> 1), baseY - height, 1, height, bark[2]);          // lit edge
  rect(ctx, cx + (width >> 1) - (width > 2 ? 0 : 0), baseY - height, 1, height, bark[0]); // shaded edge
  // bark texture
  for (let i = 0; i < height - 2; i += 2) {
    if (rng() < 0.55) px(ctx, cx - (width >> 1) + 1 + ((rng() * Math.max(1, width - 2)) | 0), baseY - height + 1 + i, bark[0]);
  }
}

function branch(ctx, x0, y0, x1, y1, color) {
  line(ctx, x0, y0, x1, y1, color);
}

/** Ragged edge: scatter leaf pixels just outside the canopy silhouette. */
function leafFringe(ctx, rng, cx, cy, spread, count, color) {
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = spread * (0.75 + rng() * 0.35);
    px(ctx, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), color);
  }
}

export function treeSprite(variant, stage, sway = 1) {
  const spec = SPECIES[variant % SPECIES.length];
  const key = `tree${spec.id}s${stage}w${sway}`;
  const w = 28, h = 36;
  return sprite(key, w, h, (ctx) => {
    const rng = rngFrom(hashString(`${spec.id}${stage}`));
    const scale = stage;                       // 0..1
    const cx = w >> 1;
    const baseY = h - 3;
    const lean = (sway - 1);                   // -1, 0, +1 canopy drift
    const [d0, d1, d2, d3] = spec.leaves;

    const trunkH = Math.round(6 + 8 * scale);
    const trunkW = scale > 0.7 ? 3 : 2;
    trunkAndRoots(ctx, cx, baseY, trunkH, trunkW, spec.bark, rng);

    const topY = baseY - trunkH;

    if (spec.id === 'pine') {
      // conical tiers with needle strokes along each edge
      const tiers = scale > 0.7 ? 5 : 3;
      const rise = Math.min(scale > 0.7 ? 4.2 : 3, (topY - 2) / Math.max(1, tiers - 1));
      for (let i = 0; i < tiers; i++) {
        const t = i / (tiers - 1);
        const y = topY + 2 - Math.round(i * rise);
        const half = Math.round((9 - i * 1.6) * scale) + 1;
        const drift = Math.round(lean * t * 1.6);
        for (let k = 0; k <= half; k++) {
          const hh = Math.round((1 - k / (half + 1)) * 4) + 1;
          rect(ctx, cx + drift - k, y - hh, 1, hh + 2, k > half - 2 ? d0 : d1);
          rect(ctx, cx + drift + k, y - hh, 1, hh + 2, k > half - 2 ? d0 : d1);
        }
        rect(ctx, cx + drift - half + 1, y - 1, half * 2 - 1, 2, d1);
        rect(ctx, cx + drift - Math.round(half * 0.5), y - 3, Math.round(half * 0.8), 2, d2);
        px(ctx, cx + drift - Math.round(half * 0.5), y - 3, d3);
      }
      px(ctx, cx + Math.round(lean * 2), Math.max(0, topY + 1 - Math.round(rise * tiers)), d2);
    } else if (spec.id === 'willow') {
      const r = Math.round(4 + 5 * scale);
      const cy = Math.max(r + 1, topY + 2 - r);
      disc(ctx, cx + lean, cy, r, d0);
      disc(ctx, cx + lean - 1, cy - 1, r - 1, d1);
      disc(ctx, cx + lean - 2, cy - 2, Math.max(1, r - 4), d2);
      // drooping strands
      for (let i = -r + 1; i < r; i += 2) {
        const len = Math.round((r - Math.abs(i) * 0.55) * (0.8 + rng() * 0.6));
        for (let k = 0; k < len; k++) {
          const drift = Math.round((k / len) * lean * 2);
          px(ctx, cx + lean + i + drift, cy + 2 + k, k > len - 3 ? d3 : (k % 3 ? d1 : d0));
        }
      }
      leafFringe(ctx, rng, cx + lean, cy, r, 10, d3);
    } else {
      // broadleaf: branches first, then overlapping clumps. The canopy is sized
      // to the headroom above the trunk so nothing gets clipped by the sprite.
      const r = Math.round((spec.id === 'bushy' ? 5 : 4) + 5 * scale);
      const cy = Math.max(r + 1, topY + 2 - r);
      if (scale > 0.7) {
        branch(ctx, cx, topY + 3, cx - r + 3 + lean, cy + 2, spec.bark[0]);
        branch(ctx, cx, topY + 5, cx + r - 3 + lean, cy + 3, spec.bark[0]);
        branch(ctx, cx, topY + 1, cx + 1 + lean, cy - 2, spec.bark[1]);
      }
      const clumps = spec.id === 'bushy'
        ? [[0, 0, r], [-r + 2, 2, r - 2], [r - 2, 2, r - 2], [-2, -r + 4, r - 4], [3, -r + 5, r - 4]]
        : [[0, 0, r], [-r + 3, 1, r - 2], [r - 3, 1, r - 2], [0, -r + 4, r - 4]];
      for (const [dx, dy, rr] of clumps) disc(ctx, cx + dx + lean, cy + dy, rr, d0);
      for (const [dx, dy, rr] of clumps) disc(ctx, cx + dx + lean, cy + dy - 1, Math.max(1, rr - 1), d1);
      for (const [dx, dy, rr] of clumps) disc(ctx, cx + dx + lean - 1, cy + dy - 2, Math.max(1, rr - 3), d2);
      // sun catch, top-left
      disc(ctx, cx - Math.round(r * 0.45) + lean, cy - Math.round(r * 0.5), Math.max(1, Math.round(r * 0.35)), d3);
      // interior shading under the clumps
      for (let i = 0; i < 5 * scale; i++) {
        px(ctx, cx + lean - 3 + ((rng() * 7) | 0), cy + Math.round(r * 0.5) + ((rng() * 3) | 0), d0);
      }
      leafFringe(ctx, rng, cx + lean, cy, r + 1, Math.round(16 * scale), d2);
      leafFringe(ctx, rng, cx + lean, cy, r + 2, Math.round(7 * scale), d1);
      if (spec.id === 'birch') {
        // black dashes on the pale trunk
        for (let i = 2; i < trunkH; i += 3) {
          px(ctx, cx - 1, baseY - i, PAL.ink);
          if (rng() < 0.4) px(ctx, cx + 1, baseY - i - 1, PAL.ink);
        }
      }
      if (spec.id === 'maple' && scale > 0.7) {
        // a couple of leaves already on their way down
        px(ctx, cx + r - 1 + lean, cy + r, d2);
        px(ctx, cx - r + 2 + lean, cy + r + 3, d3);
      }
    }

    outline(ctx, w, h, PAL.ink);
    shadowUnder(ctx, cx, baseY + 1, Math.round(4 + 5 * scale), 2, 0.26);
  });
}

// -------------------------------------------------------------- undergrowth
// Scattered detail that makes the forest floor look lived in. None of it is
// interactive; it is there to be looked at.
const CLUTTER_ART = {
  mushroom: (ctx, rng, tint) => {
    const caps = [[5, 11, 3], [10, 12, 2], [7, 13, 2]];
    for (const [mx, my, r] of caps) {
      rect(ctx, mx - 1, my - 1, 2, 3, PAL.paper2);           // stalk
      disc(ctx, mx, my - 2, r, tint);
      disc(ctx, mx, my - 3, Math.max(1, r - 1), tint);
      px(ctx, mx - 1, my - 3, PAL.white);
      px(ctx, mx + 1, my - 2, PAL.white);
      rect(ctx, mx - r, my - 1, r * 2 + 1, 1, PAL.paper3);
    }
  },
  fern: (ctx, rng) => {
    for (const [fx, len, dir] of [[4, 8, -1], [8, 10, 0], [12, 7, 1]]) {
      for (let i = 0; i < len; i++) {
        const x = fx + Math.round(dir * i * 0.35);
        const y = 14 - i;
        px(ctx, x, y, i > len - 3 ? PAL.grass3 : PAL.leaf2);
        if (i % 2 === 0 && i > 1) {
          px(ctx, x - 1 - (i >> 2), y, PAL.leaf1);
          px(ctx, x + 1 + (i >> 2), y, PAL.leaf1);
        }
      }
    }
  },
  tallgrass: (ctx, rng) => {
    for (let i = 0; i < 7; i++) {
      const x = 2 + i * 2;
      const len = 4 + ((rng() * 6) | 0);
      const bend = rng() < 0.5 ? 1 : -1;
      for (let k = 0; k < len; k++) {
        px(ctx, x + (k > len - 3 ? bend : 0), 14 - k, k > len - 3 ? PAL.grass4 : PAL.grass2);
      }
    }
  },
  log: (ctx, rng) => {
    rect(ctx, 1, 9, 14, 5, PAL.wood1);
    rect(ctx, 1, 9, 14, 2, PAL.wood2);
    rect(ctx, 1, 13, 14, 1, PAL.wood0);
    disc(ctx, 2, 11, 2, PAL.wood3);
    px(ctx, 2, 11, PAL.wood1);
    for (let i = 4; i < 14; i += 4) px(ctx, i, 11, PAL.wood0);
    px(ctx, 6, 8, PAL.grass2); px(ctx, 7, 8, PAL.grass3);   // moss on top
    px(ctx, 11, 8, PAL.grass2);
  },
  stone: (ctx, rng) => {
    disc(ctx, 6, 12, 3, PAL.stone1);
    disc(ctx, 5, 11, 2, PAL.stone2);
    px(ctx, 4, 10, PAL.stone3);
    disc(ctx, 11, 13, 2, PAL.stone1);
    px(ctx, 10, 12, PAL.stone2);
  },
  flowers: (ctx, rng, tint) => {
    for (let i = 0; i < 5; i++) {
      const x = 2 + ((rng() * 12) | 0);
      const y = 10 + ((rng() * 4) | 0);
      px(ctx, x, y + 1, PAL.grass2);
      px(ctx, x, y, tint);
      px(ctx, x - 1, y, tint); px(ctx, x + 1, y, tint);
      px(ctx, x, y - 1, tint);
      px(ctx, x, y, PAL.white);
    }
  },
  lilypad: (ctx, rng) => {
    disc(ctx, 6, 11, 4, PAL.leaf2);
    disc(ctx, 6, 10, 3, PAL.leaf3);
    rect(ctx, 6, 11, 4, 1, PAL.leaf1);
    disc(ctx, 12, 13, 2, PAL.leaf2);
    px(ctx, 5, 8, PAL.white); px(ctx, 6, 8, PAL.pink);      // a flower on the pad
  },
};

const CLUTTER_TINTS = {
  mushroom: [PAL.red, PAL.red2, '#b06a3a', PAL.paper3],
  flowers: [PAL.pink, PAL.gold2, PAL.white, PAL.purple2, PAL.blue2],
};

export const CLUTTER_KINDS = ['mushroom', 'fern', 'tallgrass', 'log', 'stone', 'flowers'];

export function clutterSprite(kind, variant) {
  return sprite(`cl${kind}${variant}`, 16, 16, (ctx) => {
    const rng = rngFrom(hashString(`${kind}${variant}`));
    const tints = CLUTTER_TINTS[kind];
    const tint = tints ? tints[variant % tints.length] : PAL.grass3;
    (CLUTTER_ART[kind] || CLUTTER_ART.stone)(ctx, rng, tint);
    outline(ctx, 16, 16, PAL.ink);
  });
}

export function stumpSprite() {
  return sprite('stump', 12, 10, (ctx) => {
    rect(ctx, 2, 7, 8, 2, 'rgba(0,0,0,0.22)');
    rect(ctx, 3, 4, 6, 4, PAL.wood1);
    rect(ctx, 3, 3, 6, 2, PAL.wood3);
    rect(ctx, 4, 3, 4, 1, PAL.wood4);
    px(ctx, 5, 3, PAL.wood2); px(ctx, 6, 4, PAL.wood2);
    outline(ctx, 12, 10, PAL.ink);
  });
}

// ----------------------------------------------------------------- plants
const BERRY_COLORS = {
  sunberry: [PAL.red, PAL.red2],
  dewberry: [PAL.blue, PAL.blue2],
  goldberry: [PAL.gold, PAL.gold2],
};

export function bushSprite(id, ripe) {
  return sprite(`bush${id}${ripe ? 'R' : 'G'}`, 16, 14, (ctx) => {
    const rng = rngFrom(hashString(id));
    rect(ctx, 3, 11, 10, 2, 'rgba(0,0,0,0.2)');
    disc(ctx, 5, 8, 4, PAL.leaf1);
    disc(ctx, 10, 8, 4, PAL.leaf1);
    disc(ctx, 8, 5, 4, PAL.leaf1);
    disc(ctx, 5, 7, 3, PAL.leaf2);
    disc(ctx, 10, 7, 3, PAL.leaf2);
    disc(ctx, 8, 4, 3, PAL.leaf2);
    for (let i = 0; i < 8; i++) px(ctx, 3 + ((rng() * 10) | 0), 2 + ((rng() * 8) | 0), PAL.leaf3);
    if (ripe) {
      const [dark, light] = BERRY_COLORS[id] || BERRY_COLORS.sunberry;
      const spots = [[5, 6], [9, 5], [7, 9], [12, 8], [3, 9], [10, 10]];
      for (const [bx, by] of spots) {
        px(ctx, bx, by, dark); px(ctx, bx + 1, by, dark);
        px(ctx, bx, by + 1, dark); px(ctx, bx + 1, by + 1, dark);
        px(ctx, bx, by, light);
      }
    }
    outline(ctx, 16, 14, PAL.ink);
    shadowUnder(ctx, 8, 12, 5, 2, 0.24);
  });
}

export function flowerSprite(id) {
  return sprite(`flower${id}`, 16, 12, (ctx) => {
    const rng = rngFrom(hashString(id));
    rect(ctx, 4, 10, 8, 1, 'rgba(0,0,0,0.18)');
    const stems = [[4, 10, 4], [8, 10, 6], [12, 10, 5]];
    for (const [sx, sy, len] of stems) {
      for (let i = 0; i < len; i++) px(ctx, sx + (i > len - 3 ? 0 : 0), sy - i, PAL.grass1);
      const hy = sy - len;
      if (id === 'clover') {
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0]]) {
          px(ctx, sx + dx, hy + dy, PAL.grass3);
          px(ctx, sx + dx, hy + dy - 1, PAL.grass4);
        }
      } else if (id === 'sunflower') {
        for (const [dx, dy] of [[0, -2], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, 2], [-2, 0], [2, 0]]) {
          px(ctx, sx + dx, hy + dy, PAL.gold2);
        }
        px(ctx, sx, hy, PAL.wood1);
      } else { // bluebell
        px(ctx, sx, hy, PAL.purple2);
        px(ctx, sx - 1, hy, PAL.purple);
        px(ctx, sx, hy - 1, PAL.purple2);
        px(ctx, sx, hy + 1, PAL.purple);
      }
      if (rng() < 0.4) px(ctx, sx + 1, sy - 2, PAL.grass2);
    }
    outline(ctx, 16, 12, PAL.leaf0);
  });
}

export function reedSprite() {
  return sprite('reed', 16, 16, (ctx) => {
    const rng = rngFrom(7777);
    for (const [sx, len] of [[4, 9], [8, 12], [12, 8]]) {
      for (let i = 0; i < len; i++) {
        const bend = i > len - 4 ? 1 : 0;
        px(ctx, sx + bend, 14 - i, i > len - 5 ? PAL.grass3 : PAL.grass2);
      }
      const hy = 14 - len;
      rect(ctx, sx, hy - 2, 2, 4, PAL.wood2);
      px(ctx, sx, hy - 2, PAL.wood3);
      if (rng() < 0.5) px(ctx, sx + 2, hy + 2, PAL.grass1);
    }
    outline(ctx, 16, 16, PAL.leaf0);
  });
}

export function saplingSprite() {
  return sprite('sapling', 12, 14, (ctx) => {
    rect(ctx, 6, 7, 1, 5, PAL.wood2);
    px(ctx, 5, 11, PAL.wood1); px(ctx, 7, 11, PAL.wood1);
    disc(ctx, 6, 5, 2, PAL.leaf1);
    disc(ctx, 6, 4, 2, PAL.leaf2);
    px(ctx, 5, 3, PAL.leaf3);
    px(ctx, 9, 7, PAL.leaf2); px(ctx, 8, 8, PAL.leaf1);
    px(ctx, 3, 8, PAL.leaf2); px(ctx, 4, 9, PAL.leaf1);
    outline(ctx, 12, 14, PAL.ink);
    shadowUnder(ctx, 6, 12, 4, 1, 0.24);
  });
}

// -------------------------------------------------------------- creatures
const ROLE_TINT = {
  logger: PAL.red, hauler: PAL.blue2, engineer: PAL.purple2,
  gardener: PAL.grass4, forager: PAL.gold2, boss: PAL.gold,
};

/** Crew beaver seen from above-behind. Flip horizontally to face the other way. */
export function beaverSprite(role, frame, swimming) {
  const key = `bv${role}${frame}${swimming ? 'S' : ''}`;
  return sprite(key, 14, 16, (ctx) => {
    const tint = ROLE_TINT[role] || PAL.gold;
    const bob = frame === 1 ? 1 : 0;
    const y0 = 3 + bob;

    if (!swimming) {
      // the paddle tail: dark, narrow, clearly its own shape
      rect(ctx, 6, y0 + 9, 3, 4, PAL.fur0);
      px(ctx, 5, y0 + 10, PAL.fur0); px(ctx, 9, y0 + 10, PAL.fur0);
      px(ctx, 7, y0 + 11, PAL.fur1);
      // hind paws poking out either side
      px(ctx, 3, y0 + 7 - bob, PAL.fur1); px(ctx, 3, y0 + 8 - bob, PAL.fur1);
      px(ctx, 10, y0 + 7 + bob, PAL.fur1); px(ctx, 10, y0 + 8 + bob, PAL.fur1);
    }

    // body - mid brown with a lit back, so it never merges with the tail
    disc(ctx, 7, y0 + 5, 4, PAL.fur2);
    disc(ctx, 7, y0 + 4, 3, PAL.fur3);
    px(ctx, 6, y0 + 3, PAL.fur4); px(ctx, 8, y0 + 3, PAL.fur4);
    rect(ctx, 4, y0 + 8, 7, 1, PAL.fur0);      // shadow line above the tail

    // role neckerchief
    rect(ctx, 4, y0 + 2, 7, 2, tint);
    px(ctx, 7, y0 + 4, tint);

    // head, lighter still
    disc(ctx, 7, y0, 3, PAL.fur3);
    disc(ctx, 7, y0 - 1, 2, PAL.fur4);
    disc(ctx, 4, y0 - 2, 1, PAL.fur2);          // ears
    disc(ctx, 10, y0 - 2, 1, PAL.fur2);
    px(ctx, 5, y0 - 1, PAL.ink); px(ctx, 9, y0 - 1, PAL.ink);
    rect(ctx, 6, y0 + 1, 3, 1, PAL.fur2);       // snout
    px(ctx, 7, y0 + 2, PAL.white);              // tooth

    outline(ctx, 14, 16, PAL.ink);

    if (swimming) {
      ctx.clearRect(0, y0 + 6, 14, 16 - (y0 + 6));
      rect(ctx, 2, y0 + 5, 10, 1, PAL.water4);
      px(ctx, 1, y0 + 6, PAL.foam); px(ctx, 12, y0 + 6, PAL.foam);
      px(ctx, 3, y0 + 7, PAL.water4); px(ctx, 10, y0 + 7, PAL.water4);
    } else {
      shadowUnder(ctx, 7, y0 + 12, 5, 2, 0.28);
    }
  });
}

/** Carrying bubble: a tiny log or berry above a beaver's head. */
export function carrySprite(kind) {
  return sprite(`carry${kind}`, 9, 7, (ctx) => {
    if (kind === 'wood') {
      rect(ctx, 1, 2, 7, 3, PAL.wood2);
      rect(ctx, 1, 2, 7, 1, PAL.wood3);
      rect(ctx, 1, 4, 7, 1, PAL.wood1);
      px(ctx, 1, 3, PAL.wood4); px(ctx, 7, 3, PAL.wood4);
    } else {
      disc(ctx, 3, 4, 2, PAL.red); px(ctx, 2, 3, PAL.red2);
      disc(ctx, 6, 3, 2, PAL.blue); px(ctx, 5, 2, PAL.blue2);
      px(ctx, 4, 1, PAL.grass2);
    }
  });
}

const ANIMAL_ART = {
  duck: (ctx) => {
    rect(ctx, 3, 10, 7, 1, 'rgba(0,0,0,0.25)');
    disc(ctx, 6, 7, 3, PAL.paper2);
    disc(ctx, 6, 6, 2, PAL.paper);
    disc(ctx, 6, 3, 2, PAL.leaf2);
    px(ctx, 5, 3, PAL.ink); px(ctx, 7, 3, PAL.ink);
    px(ctx, 6, 1, PAL.gold); px(ctx, 6, 2, PAL.gold2);
    px(ctx, 3, 7, PAL.paper3); px(ctx, 9, 7, PAL.paper3);
  },
  frog: (ctx) => {
    rect(ctx, 3, 10, 7, 1, 'rgba(0,0,0,0.25)');
    disc(ctx, 6, 7, 4, PAL.grass1);
    disc(ctx, 6, 6, 3, PAL.grass2);
    px(ctx, 4, 3, PAL.grass3); px(ctx, 8, 3, PAL.grass3);
    px(ctx, 4, 3, PAL.white); px(ctx, 8, 3, PAL.white);
    px(ctx, 4, 4, PAL.ink); px(ctx, 8, 4, PAL.ink);
    px(ctx, 2, 8, PAL.grass1); px(ctx, 10, 8, PAL.grass1);
  },
  rabbit: (ctx) => {
    rect(ctx, 3, 10, 7, 1, 'rgba(0,0,0,0.25)');
    disc(ctx, 6, 7, 3, PAL.paper3);
    disc(ctx, 6, 6, 2, PAL.paper2);
    rect(ctx, 4, 1, 1, 4, PAL.paper3); rect(ctx, 8, 1, 1, 4, PAL.paper3);
    px(ctx, 4, 2, PAL.pink); px(ctx, 8, 2, PAL.pink);
    disc(ctx, 6, 4, 2, PAL.paper2);
    px(ctx, 5, 4, PAL.ink); px(ctx, 7, 4, PAL.ink);
    disc(ctx, 6, 10, 1, PAL.white);
  },
  hedgehog: (ctx) => {
    rect(ctx, 3, 10, 7, 1, 'rgba(0,0,0,0.25)');
    disc(ctx, 6, 6, 4, PAL.wood1);
    for (let i = 0; i < 10; i++) px(ctx, 2 + i % 9, 3 + ((i * 5) % 5), PAL.wood0);
    disc(ctx, 6, 9, 2, PAL.fur3);
    px(ctx, 5, 9, PAL.ink); px(ctx, 7, 9, PAL.ink);
    px(ctx, 6, 10, PAL.ink);
  },
  songbird: (ctx) => {
    rect(ctx, 3, 10, 6, 1, 'rgba(0,0,0,0.25)');
    disc(ctx, 6, 7, 3, PAL.gold);
    disc(ctx, 6, 6, 2, PAL.gold2);
    disc(ctx, 6, 3, 2, PAL.wood2);
    px(ctx, 5, 3, PAL.ink); px(ctx, 7, 3, PAL.ink);
    px(ctx, 6, 1, PAL.red2);
    px(ctx, 3, 7, PAL.wood1); px(ctx, 9, 7, PAL.wood1);
  },
  otter: (ctx) => {
    rect(ctx, 2, 10, 9, 1, 'rgba(0,0,0,0.25)');
    disc(ctx, 6, 7, 4, PAL.fur1);
    disc(ctx, 6, 6, 3, PAL.fur2);
    disc(ctx, 6, 3, 2, PAL.fur2);
    px(ctx, 5, 3, PAL.ink); px(ctx, 7, 3, PAL.ink);
    px(ctx, 6, 4, PAL.fur4);
    rect(ctx, 6, 10, 1, 2, PAL.fur1);
  },
  turtle: (ctx) => {
    rect(ctx, 3, 10, 7, 1, 'rgba(0,0,0,0.25)');
    disc(ctx, 6, 6, 4, PAL.leaf1);
    disc(ctx, 6, 6, 3, PAL.leaf2);
    for (const [hx, hy] of [[6, 4], [4, 7], [8, 7], [6, 8]]) px(ctx, hx, hy, PAL.leaf0);
    disc(ctx, 6, 2, 1, PAL.grass3);
    px(ctx, 5, 2, PAL.ink); px(ctx, 7, 2, PAL.ink);
  },
  squirrel: (ctx) => {
    // bushy tail curled up behind
    disc(ctx, 3, 5, 3, '#8a3f14');
    disc(ctx, 3, 4, 2, '#a8541f');
    px(ctx, 2, 2, '#a8541f'); px(ctx, 3, 2, '#c9682a');
    disc(ctx, 7, 8, 3, '#a8541f');
    disc(ctx, 7, 7, 2, '#c9682a');
    disc(ctx, 8, 4, 2, '#a8541f');
    px(ctx, 7, 3, '#8a3f14'); px(ctx, 9, 3, '#8a3f14');   // ears
    px(ctx, 7, 4, PAL.ink); px(ctx, 9, 4, PAL.ink);
    px(ctx, 8, 5, PAL.paper2);
    px(ctx, 6, 10, '#8a3f14'); px(ctx, 9, 10, '#8a3f14');
    px(ctx, 10, 7, PAL.wood2); px(ctx, 11, 7, PAL.wood3);  // a nut
  },
  bee: (ctx) => {
    ctx.globalAlpha = 0.75;
    disc(ctx, 3, 4, 2, PAL.paper);
    disc(ctx, 9, 4, 2, PAL.paper);
    ctx.globalAlpha = 1;
    disc(ctx, 6, 7, 4, PAL.gold);
    rect(ctx, 3, 6, 7, 1, PAL.ink);
    rect(ctx, 3, 8, 7, 1, PAL.ink);
    disc(ctx, 6, 4, 2, PAL.ink2);
    px(ctx, 5, 4, PAL.white); px(ctx, 7, 4, PAL.white);
    px(ctx, 5, 2, PAL.ink); px(ctx, 7, 2, PAL.ink);       // antennae
    px(ctx, 6, 11, PAL.ink);
  },
  kingfisher: (ctx) => {
    disc(ctx, 6, 7, 3, '#1d5b8d');
    disc(ctx, 6, 6, 2, '#2f83b8');
    px(ctx, 5, 9, '#c9682a'); px(ctx, 6, 9, '#c9682a'); px(ctx, 7, 9, '#c9682a');
    disc(ctx, 6, 3, 2, '#2f83b8');
    px(ctx, 5, 2, '#4fa9d8'); px(ctx, 7, 2, '#4fa9d8');
    px(ctx, 5, 3, PAL.ink); px(ctx, 7, 3, PAL.ink);
    rect(ctx, 6, 0, 1, 3, PAL.ink2);                       // long beak
    px(ctx, 3, 6, '#4fa9d8'); px(ctx, 9, 6, '#4fa9d8');
    px(ctx, 6, 10, PAL.gold);
  },
  dragonfly: (ctx) => {
    disc(ctx, 6, 6, 1, PAL.water3);
    rect(ctx, 6, 5, 1, 6, PAL.water2);
    px(ctx, 6, 11, PAL.water3);
    rect(ctx, 2, 4, 4, 1, PAL.water4);
    rect(ctx, 7, 4, 4, 1, PAL.water4);
    rect(ctx, 3, 6, 3, 1, PAL.foam);
    rect(ctx, 7, 6, 3, 1, PAL.foam);
    px(ctx, 5, 3, PAL.ink); px(ctx, 7, 3, PAL.ink);
  },
};

export function animalSprite(id, frame) {
  return sprite(`an${id}${frame}`, 14, 14, (ctx) => {
    ctx.save();
    ctx.translate(1, frame === 1 ? 0 : 1);
    (ANIMAL_ART[id] || ANIMAL_ART.duck)(ctx);
    ctx.restore();
    outline(ctx, 14, 14, PAL.ink);
    shadowUnder(ctx, 7, 12, 4, 2, 0.24);
  });
}

/** The heron you ride for the bird's-eye view, seen from above. */
export function birdSprite(flapFrame, withRider) {
  return sprite(`bird${flapFrame}${withRider ? 'R' : ''}`, 36, 30, (ctx) => {
    const beat = [0, -2, -5, -2][flapFrame % 4];  // wing lift for this frame
    const cx = 18, cy = 16;

    // tail: a short fan trailing behind
    for (let i = -2; i <= 2; i++) {
      rect(ctx, cx + i, cy + 6, 1, 6 - Math.abs(i) * 2, PAL.paper3);
    }

    // wings - wide at the shoulder, swept back and tapering to dark primaries
    for (const side of [-1, 1]) {
      for (let i = 1; i <= 15; i++) {
        const t = i / 15;
        const wx = cx + side * i;
        const front = cy - 5 + Math.round(i * 0.5) + Math.round(beat * t);
        const chord = Math.max(2, Math.round(9 - i * 0.5));
        rect(ctx, wx, front, 1, chord, t > 0.72 ? PAL.stone3 : PAL.paper2);
        px(ctx, wx, front, PAL.paper);                       // lit leading edge
        px(ctx, wx, front + chord - 1, t > 0.5 ? PAL.stone2 : PAL.paper3);
        if (t > 0.8) px(ctx, wx, front + chord - 2, PAL.stone2);
      }
    }

    // body
    disc(ctx, cx, cy + 2, 5, PAL.paper2);
    disc(ctx, cx, cy, 4, PAL.paper);
    px(ctx, cx - 2, cy - 2, PAL.white); px(ctx, cx + 2, cy - 2, PAL.white);

    // neck and head, reaching forward
    rect(ctx, cx - 1, cy - 8, 2, 5, PAL.paper);
    disc(ctx, cx, cy - 9, 2, PAL.paper);
    px(ctx, cx - 2, cy - 10, PAL.ink); px(ctx, cx + 2, cy - 10, PAL.ink);
    rect(ctx, cx - 1, cy - 12, 2, 2, PAL.gold);              // stubby beak
    px(ctx, cx, cy - 13, PAL.gold2);
    px(ctx, cx + 3, cy - 8, PAL.stone2); px(ctx, cx + 4, cy - 9, PAL.stone2); // crest

    if (withRider) {
      // the contractor, gripping on
      disc(ctx, cx, cy + 1, 3, PAL.fur1);
      disc(ctx, cx, cy, 2, PAL.fur3);
      px(ctx, cx - 1, cy - 1, PAL.ink); px(ctx, cx + 1, cy - 1, PAL.ink);
      rect(ctx, cx - 3, cy - 3, 7, 1, PAL.gold);             // hard-hat brim
      rect(ctx, cx - 2, cy - 4, 5, 1, PAL.gold2);
      px(ctx, cx - 4, cy + 1, PAL.fur2); px(ctx, cx + 4, cy + 1, PAL.fur2);
      rect(ctx, cx - 1, cy + 3, 3, 1, PAL.fur0);
    }
    outline(ctx, 36, 30, PAL.ink);
  });
}

export function shadowSprite(w) {
  return sprite(`shadow${w}`, w, Math.max(3, w >> 1), (ctx, sw, sh) => {
    disc(ctx, sw >> 1, sh >> 1, Math.min(sw, sh * 2) >> 1, 'rgba(0,0,0,0.22)');
  });
}

// ---------------------------------------------------------------- critters
// Small living things that do nothing but make the valley feel inhabited.

export function butterflySprite(tint, frame) {
  return sprite(`bfly${tint}${frame}`, 7, 6, (ctx) => {
    const open = frame === 0;
    px(ctx, 3, 2, PAL.ink); px(ctx, 3, 3, PAL.ink);
    px(ctx, 2, 1, PAL.ink); px(ctx, 4, 1, PAL.ink);
    if (open) {
      disc(ctx, 1, 2, 1, tint); disc(ctx, 5, 2, 1, tint);
      px(ctx, 1, 4, tint); px(ctx, 5, 4, tint);
      px(ctx, 1, 1, PAL.white); px(ctx, 5, 1, PAL.white);
    } else {
      px(ctx, 2, 2, tint); px(ctx, 4, 2, tint);
      px(ctx, 2, 3, tint); px(ctx, 4, 3, tint);
    }
  });
}

export function fireflySprite(bright) {
  return sprite(`ffly${bright ? 1 : 0}`, 5, 5, (ctx) => {
    if (bright) {
      disc(ctx, 2, 2, 2, 'rgba(247,204,85,0.35)');
      px(ctx, 2, 2, PAL.gold2);
      px(ctx, 1, 2, '#fff6c8'); px(ctx, 3, 2, '#fff6c8');
      px(ctx, 2, 1, '#fff6c8'); px(ctx, 2, 3, '#fff6c8');
    } else {
      px(ctx, 2, 2, PAL.gold);
    }
  });
}

export function fishSprite(frame) {
  return sprite(`fish${frame}`, 9, 5, (ctx) => {
    const tail = frame === 0 ? 0 : 1;
    ctx.globalAlpha = 0.55;
    rect(ctx, 2, 1, 5, 3, PAL.water0);
    px(ctx, 7, 1 + tail, PAL.water0); px(ctx, 7, 3 - tail, PAL.water0);
    px(ctx, 1, 2, PAL.water0);
    ctx.globalAlpha = 1;
    px(ctx, 2, 2, PAL.water4);
  });
}

export function flyingBirdSprite(frame) {
  return sprite(`fbird${frame}`, 9, 6, (ctx) => {
    const lift = [0, 1, 2, 1][frame % 4];
    px(ctx, 4, 3, PAL.ink); px(ctx, 4, 2, PAL.ink);
    for (let i = 1; i <= 3; i++) {
      px(ctx, 4 - i, 3 - Math.round((i / 3) * lift), PAL.ink);
      px(ctx, 4 + i, 3 - Math.round((i / 3) * lift), PAL.ink);
    }
    px(ctx, 1, 3 - lift, PAL.ink2); px(ctx, 7, 3 - lift, PAL.ink2);
  });
}

// ------------------------------------------------------------- structures
const STRUCTURE_ART = {
  duck_nest: (ctx) => {
    rect(ctx, 2, 12, 12, 2, 'rgba(0,0,0,0.22)');
    disc(ctx, 8, 9, 6, PAL.wood1);
    disc(ctx, 8, 9, 5, PAL.wood2);
    disc(ctx, 8, 9, 3, PAL.wood0);
    for (const [ex, ey] of [[7, 8], [9, 9], [7, 10]]) {
      px(ctx, ex, ey, PAL.paper); px(ctx, ex + 1, ey, PAL.paper);
      px(ctx, ex, ey + 1, PAL.paper2);
    }
    for (let i = 0; i < 6; i++) px(ctx, 2 + i * 2, 6 + (i % 2), PAL.wood3);
  },
  frog_log: (ctx) => {
    rect(ctx, 1, 11, 14, 2, 'rgba(0,0,0,0.2)');
    rect(ctx, 1, 5, 14, 7, PAL.wood1);
    rect(ctx, 1, 5, 14, 2, PAL.wood2);
    rect(ctx, 1, 10, 14, 1, PAL.wood0);
    disc(ctx, 4, 8, 2, PAL.ink);
    for (let i = 3; i < 14; i += 3) px(ctx, i, 8, PAL.wood0);
    px(ctx, 11, 4, PAL.grass2); px(ctx, 12, 4, PAL.grass3);
  },
  rabbit_burrow: (ctx) => {
    rect(ctx, 1, 12, 14, 2, 'rgba(0,0,0,0.2)');
    disc(ctx, 8, 11, 7, PAL.dirt2);
    disc(ctx, 8, 10, 6, PAL.dirt3);
    disc(ctx, 8, 11, 3, PAL.ink);
    disc(ctx, 8, 12, 2, PAL.black);
    for (let i = 0; i < 8; i++) px(ctx, 2 + i * 1.6, 7 + (i % 3), PAL.grass2);
    rect(ctx, 3, 13, 2, 1, PAL.dirt1);
  },
  hedgehog_hut: (ctx) => {
    disc(ctx, 8, 11, 7, PAL.leaf0);
    disc(ctx, 8, 10, 6, PAL.leaf1);
    disc(ctx, 7, 9, 4, PAL.leaf2);
    // scattered leaves catching the light
    for (const [lx, ly] of [[4, 7], [11, 7], [6, 5], [12, 10], [3, 11], [9, 4]]) {
      px(ctx, lx, ly, PAL.leaf3); px(ctx, lx + 1, ly, PAL.leaf3); px(ctx, lx, ly + 1, PAL.leaf2);
    }
    // twig doorway
    rect(ctx, 6, 11, 5, 5, PAL.ink);
    disc(ctx, 8, 13, 2, PAL.black);
    rect(ctx, 5, 10, 7, 1, PAL.wood2);
    px(ctx, 5, 11, PAL.wood1); px(ctx, 11, 11, PAL.wood1);
  },
  bird_house: (ctx) => {
    rect(ctx, 5, 14, 6, 2, 'rgba(0,0,0,0.25)');
    rect(ctx, 7, 9, 2, 6, PAL.wood1);
    rect(ctx, 3, 3, 10, 7, PAL.wood2);
    rect(ctx, 3, 3, 10, 2, PAL.wood3);
    line(ctx, 2, 3, 8, 0, PAL.red);
    line(ctx, 8, 0, 14, 3, PAL.red);
    rect(ctx, 2, 2, 12, 2, PAL.red2);
    disc(ctx, 8, 7, 2, PAL.ink);
    px(ctx, 8, 10, PAL.wood4);
  },
  otter_holt: (ctx) => {
    rect(ctx, 1, 13, 14, 2, 'rgba(0,0,0,0.22)');
    disc(ctx, 8, 11, 7, PAL.wood1);
    disc(ctx, 8, 10, 6, PAL.wood2);
    for (let i = 0; i < 9; i++) line(ctx, 2 + i, 14, 8, 4 + (i % 3), PAL.wood1);
    rect(ctx, 6, 11, 5, 4, PAL.ink);
    disc(ctx, 8, 12, 2, PAL.black);
    px(ctx, 3, 6, PAL.wood3); px(ctx, 13, 7, PAL.wood3);
  },
  turtle_bask: (ctx) => {
    rect(ctx, 2, 13, 12, 2, 'rgba(0,0,0,0.18)');
    for (let i = 0; i < 5; i++) rect(ctx, 2, 4 + i * 2, 12, 2, i % 2 ? PAL.wood2 : PAL.wood3);
    rect(ctx, 2, 4, 12, 1, PAL.wood4);
    rect(ctx, 2, 13, 12, 1, PAL.wood1);
    rect(ctx, 3, 14, 1, 2, PAL.wood0);
    rect(ctx, 12, 14, 1, 2, PAL.wood0);
  },
  squirrel_drey: (ctx) => {
    disc(ctx, 8, 9, 6, PAL.wood1);
    disc(ctx, 8, 8, 5, PAL.wood2);
    // twigs poking out in every direction
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      line(ctx, 8 + Math.cos(a) * 3, 8 + Math.sin(a) * 3, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 6,
           i % 2 ? PAL.wood1 : PAL.wood3);
    }
    disc(ctx, 8, 8, 3, PAL.leaf1);
    disc(ctx, 7, 7, 2, PAL.leaf2);
    px(ctx, 10, 10, PAL.ink);
    px(ctx, 5, 4, PAL.leaf3); px(ctx, 11, 5, PAL.leaf3);
  },
  bee_hive: (ctx) => {
    // a coiled straw skep
    for (let i = 0; i < 5; i++) {
      const w = 12 - i * 2;
      const y = 13 - i * 2;
      rect(ctx, 8 - (w >> 1), y, w, 2, i % 2 ? PAL.gold : '#c98a2a');
      rect(ctx, 8 - (w >> 1), y, w, 1, PAL.gold2);
    }
    disc(ctx, 8, 3, 2, PAL.gold);
    rect(ctx, 6, 12, 4, 3, PAL.ink);                     // doorway
    disc(ctx, 8, 13, 1, PAL.black);
    px(ctx, 3, 6, PAL.ink); px(ctx, 12, 8, PAL.ink);     // bees about
    px(ctx, 2, 5, PAL.gold2); px(ctx, 13, 7, PAL.gold2);
  },
  kingfisher_post: (ctx) => {
    rect(ctx, 7, 4, 3, 12, PAL.wood1);
    rect(ctx, 7, 4, 1, 12, PAL.wood2);
    rect(ctx, 3, 4, 11, 2, PAL.wood2);                   // crossbar
    rect(ctx, 3, 4, 11, 1, PAL.wood3);
    line(ctx, 5, 6, 8, 9, PAL.wood1);
    line(ctx, 12, 6, 9, 9, PAL.wood1);
    px(ctx, 4, 3, PAL.water3); px(ctx, 13, 3, PAL.water3);
    px(ctx, 11, 11, PAL.stone3); px(ctx, 12, 12, PAL.stone2);
  },
  lodge: (ctx) => {
    rect(ctx, 1, 17, 22, 3, 'rgba(0,0,0,0.25)');
    disc(ctx, 12, 14, 11, PAL.wood0);
    disc(ctx, 12, 13, 10, PAL.wood1);
    disc(ctx, 12, 12, 8, PAL.wood2);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      line(ctx, 12 + Math.cos(a) * 10, 13 + Math.sin(a) * 9, 12 + Math.cos(a) * 4, 13 + Math.sin(a) * 3.5,
           i % 2 ? PAL.wood1 : PAL.wood3);
    }
    rect(ctx, 9, 16, 6, 5, PAL.ink);
    disc(ctx, 12, 18, 3, PAL.black);
    rect(ctx, 8, 4, 3, 2, PAL.grass2);
    px(ctx, 16, 6, PAL.grass3);
  },
  shed: (ctx) => {
    rect(ctx, 1, 14, 14, 2, 'rgba(0,0,0,0.22)');
    rect(ctx, 2, 6, 12, 9, PAL.wood1);
    for (let i = 0; i < 4; i++) rect(ctx, 2 + i * 3, 6, 1, 9, PAL.wood0);
    rect(ctx, 1, 3, 14, 4, PAL.wood3);
    rect(ctx, 1, 3, 14, 1, PAL.wood4);
    rect(ctx, 5, 9, 6, 6, PAL.wood2);
    px(ctx, 9, 12, PAL.gold);
    rect(ctx, 3, 12, 2, 3, PAL.dirt3);
  },
};

export function structureSprite(id) {
  const big = id === 'lodge';
  const w = big ? 24 : 16, h = big ? 22 : 16;
  return sprite(`st${id}`, w, h, (ctx) => {
    (STRUCTURE_ART[id] || STRUCTURE_ART.shed)(ctx);
    outline(ctx, w, h, PAL.ink);
    shadowUnder(ctx, w >> 1, h - 2, (w >> 1) - 2, 2, 0.26);
  });
}

/** Scaffolding drawn over a site that is still being built. */
export function siteSprite(pass) {
  return sprite(`site${pass}`, 16, 18, (ctx) => {
    const post = pass ? PAL.wood3 : PAL.wood2;
    // scaffold posts and a cross brace
    rect(ctx, 2, 4, 1, 12, post);
    rect(ctx, 13, 4, 1, 12, post);
    rect(ctx, 2, 4, 12, 1, PAL.wood3);
    rect(ctx, 2, 9, 12, 1, PAL.wood1);
    line(ctx, 3, 15, 12, 5, PAL.wood1);
    // stack of planks waiting to go up
    rect(ctx, 4, 12, 8, 2, PAL.wood2);
    rect(ctx, 4, 12, 8, 1, PAL.wood3);
    rect(ctx, 5, 14, 8, 2, PAL.wood1);
    // a pennant so it stands out from the grass
    rect(ctx, 8, 0, 1, 5, PAL.wood1);
    rect(ctx, 9, 0, 4, 3, pass ? PAL.gold2 : PAL.gold);
    px(ctx, 12, 1, PAL.wood1);
    outline(ctx, 16, 18, PAL.ink);
    shadowUnder(ctx, 8, 16, 6, 2, 0.24);
  });
}

// ------------------------------------------------------------------ icons
export function icon(name) {
  return sprite(`ic${name}`, 9, 9, (ctx) => {
    if (name === 'wood') {
      rect(ctx, 0, 3, 9, 4, PAL.wood2);
      rect(ctx, 0, 3, 9, 1, PAL.wood3);
      rect(ctx, 0, 6, 9, 1, PAL.wood1);
      rect(ctx, 0, 3, 2, 4, PAL.wood4);
      px(ctx, 1, 5, PAL.wood1);
    } else if (name === 'berry') {
      disc(ctx, 3, 5, 2, PAL.red); px(ctx, 2, 4, PAL.red2);
      disc(ctx, 6, 6, 2, PAL.blue); px(ctx, 5, 5, PAL.blue2);
      px(ctx, 4, 2, PAL.grass2); px(ctx, 5, 1, PAL.grass3);
    } else if (name === 'seed') {
      disc(ctx, 4, 5, 3, PAL.wood2);
      disc(ctx, 4, 4, 2, PAL.wood3);
      px(ctx, 3, 3, PAL.wood4);
      px(ctx, 4, 1, PAL.grass2);
    } else if (name === 'heart') {
      for (const [hx, hy] of [[1, 2], [2, 1], [3, 1], [4, 2], [5, 1], [6, 1], [7, 2]]) px(ctx, hx, hy, PAL.red2);
      rect(ctx, 1, 2, 7, 3, PAL.red);
      rect(ctx, 2, 5, 5, 1, PAL.red);
      rect(ctx, 3, 6, 3, 1, PAL.red);
      px(ctx, 4, 7, PAL.red);
      px(ctx, 2, 2, PAL.red2); px(ctx, 3, 2, PAL.red2);
    } else if (name === 'axe') {
      line(ctx, 2, 8, 6, 2, PAL.wood2);
      rect(ctx, 4, 1, 4, 3, PAL.stone3);
      rect(ctx, 4, 1, 1, 3, PAL.stone2);
    } else if (name === 'hammer') {
      line(ctx, 2, 8, 5, 3, PAL.wood2);
      rect(ctx, 3, 1, 5, 3, PAL.stone2);
      rect(ctx, 3, 1, 5, 1, PAL.stone3);
    } else if (name === 'clock') {
      disc(ctx, 4, 4, 4, PAL.paper2);
      disc(ctx, 4, 4, 3, PAL.paper);
      rect(ctx, 4, 2, 1, 3, PAL.ink);
      rect(ctx, 4, 4, 3, 1, PAL.ink);
    } else if (name === 'drop') {
      px(ctx, 4, 0, PAL.water4);
      rect(ctx, 3, 1, 3, 2, PAL.water3);
      disc(ctx, 4, 5, 3, PAL.water3);
      disc(ctx, 4, 5, 2, PAL.water4);
      px(ctx, 3, 4, PAL.foam);
    } else if (name === 'spark') {
      px(ctx, 4, 0, PAL.gold2); px(ctx, 4, 8, PAL.gold2);
      px(ctx, 0, 4, PAL.gold2); px(ctx, 8, 4, PAL.gold2);
      disc(ctx, 4, 4, 2, PAL.gold2);
      px(ctx, 4, 4, PAL.white);
    }
  });
}

export const ROLE_COLOR = ROLE_TINT;

// ============================================================ side view ==
// The camp is played from the side, so everything below is a profile sprite.

/** The player: the contractor beaver, hard hat and tool belt. */
export function playerSprite(pose, frame) {
  return sprite(`pl${pose}${frame}`, 16, 18, (ctx) => {
    const walk = pose === 'walk';
    const legPhase = frame % 4;
    const bob = pose === 'idle' ? (frame % 2) : (legPhase === 1 || legPhase === 3 ? 1 : 0);
    const y0 = 2 + (pose === 'jump' ? -1 : bob);

    rect(ctx, 3, 16, 9, 1, 'rgba(0,0,0,0.25)');

    // tail, behind the body
    rect(ctx, 1, y0 + 8, 4, 4, PAL.fur0);
    px(ctx, 1, y0 + 8, PAL.fur1); px(ctx, 2, y0 + 10, PAL.fur1);

    // legs
    if (pose === 'jump') {
      rect(ctx, 5, y0 + 12, 2, 3, PAL.fur1);
      rect(ctx, 9, y0 + 11, 2, 3, PAL.fur1);
    } else if (walk) {
      const a = legPhase === 0 || legPhase === 1 ? 0 : 1;
      rect(ctx, 4 + a * 2, y0 + 12, 2, 4, PAL.fur1);
      rect(ctx, 9 - a * 2, y0 + 12, 2, 4, PAL.fur1);
      px(ctx, 4 + a * 2, y0 + 15, PAL.fur0);
      px(ctx, 9 - a * 2, y0 + 15, PAL.fur0);
    } else {
      rect(ctx, 5, y0 + 12, 2, 4, PAL.fur1);
      rect(ctx, 9, y0 + 12, 2, 4, PAL.fur1);
    }

    // body
    rect(ctx, 4, y0 + 6, 8, 7, PAL.fur1);
    rect(ctx, 5, y0 + 6, 6, 6, PAL.fur2);
    rect(ctx, 6, y0 + 8, 4, 4, PAL.fur3);
    // tool belt
    rect(ctx, 4, y0 + 11, 8, 1, PAL.wood1);
    px(ctx, 9, y0 + 11, PAL.gold);

    // arm
    rect(ctx, 11, y0 + 7, 2, 4, PAL.fur1);
    if (pose === 'jump') rect(ctx, 11, y0 + 5, 2, 3, PAL.fur1);

    // head
    rect(ctx, 5, y0 + 1, 8, 6, PAL.fur2);
    rect(ctx, 6, y0, 6, 2, PAL.fur2);
    rect(ctx, 11, y0 + 3, 3, 3, PAL.fur3);   // snout
    px(ctx, 13, y0 + 4, PAL.fur4);
    rect(ctx, 12, y0 + 6, 2, 1, PAL.white);  // teeth
    px(ctx, 10, y0 + 3, PAL.ink);            // eye
    px(ctx, 5, y0 + 1, PAL.fur1);            // ear
    px(ctx, 4, y0 + 2, PAL.fur1);

    // hard hat
    rect(ctx, 4, y0 - 1, 10, 2, PAL.gold);
    rect(ctx, 6, y0 - 3, 6, 2, PAL.gold);
    rect(ctx, 6, y0 - 3, 6, 1, PAL.gold2);
    px(ctx, 13, y0 - 1, PAL.gold2);
    outline(ctx, 16, 18, PAL.ink);
    shadowUnder(ctx, 8, 17, 5, 1, 0.3);
  });
}

/** Crew beavers milling about the camp, in profile. */
export function crewSideSprite(role, frame) {
  return sprite(`cs${role}${frame}`, 14, 15, (ctx) => {
    const tint = ROLE_TINT[role] || PAL.gold;
    const y0 = 3 + (frame % 2);
    rect(ctx, 1, y0 + 6, 3, 3, PAL.fur0);
    rect(ctx, 4, y0 + 10, 2, 3, PAL.fur1);
    rect(ctx, 8, y0 + 10, 2, 3, PAL.fur1);
    rect(ctx, 3, y0 + 5, 7, 6, PAL.fur1);
    rect(ctx, 4, y0 + 5, 5, 5, PAL.fur2);
    rect(ctx, 3, y0 + 8, 7, 1, tint);
    rect(ctx, 4, y0 + 1, 7, 5, PAL.fur2);
    rect(ctx, 9, y0 + 3, 3, 2, PAL.fur3);
    px(ctx, 8, y0 + 2, PAL.ink);
    px(ctx, 4, y0 + 1, PAL.fur1);
    rect(ctx, 10, y0 + 5, 2, 1, PAL.white);
    outline(ctx, 14, 15, PAL.ink);
    shadowUnder(ctx, 7, 14, 4, 1, 0.28);
  });
}

/** The heron waiting on its perch, in profile. */
export function heronSideSprite(frame) {
  return sprite(`heron${frame}`, 22, 28, (ctx) => {
    const lift = frame ? -1 : 0;
    // legs
    rect(ctx, 9, 21, 1, 6, PAL.gold);
    rect(ctx, 12, 21, 1, 6, PAL.gold);
    px(ctx, 8, 27, PAL.gold); px(ctx, 13, 27, PAL.gold);
    // body
    disc(ctx, 11, 17 + lift, 5, PAL.paper2);
    disc(ctx, 11, 16 + lift, 4, PAL.paper);
    // folded wing
    for (let i = 0; i < 7; i++) rect(ctx, 4 + i, 15 + lift + Math.round(i * 0.5), 1, 4, i > 4 ? PAL.stone3 : PAL.paper2);
    // trailing tail
    rect(ctx, 3, 19 + lift, 4, 2, PAL.paper3);
    // neck: an S-curve, the way a heron holds it
    px(ctx, 12, 12 + lift, PAL.paper); px(ctx, 12, 11 + lift, PAL.paper);
    px(ctx, 13, 10 + lift, PAL.paper); px(ctx, 13, 9 + lift, PAL.paper);
    px(ctx, 12, 8 + lift, PAL.paper); px(ctx, 12, 13 + lift, PAL.paper);
    // head
    disc(ctx, 13, 7 + lift, 2, PAL.paper);
    px(ctx, 14, 6 + lift, PAL.ink);
    rect(ctx, 15, 7 + lift, 5, 1, PAL.gold);
    px(ctx, 19, 8 + lift, PAL.gold2);
    // crest feathers
    px(ctx, 11, 5 + lift, PAL.stone2); px(ctx, 10, 4 + lift, PAL.stone2);
    outline(ctx, 22, 28, PAL.ink);
  });
}

const PROP_ART = {
  // A plank board on two posts, papers pinned to it: the job board.
  jobboard: (ctx) => {
    rect(ctx, 2, 34, 30, 2, 'rgba(0,0,0,0.25)');
    rect(ctx, 5, 20, 3, 15, PAL.wood1);
    rect(ctx, 26, 20, 3, 15, PAL.wood1);
    rect(ctx, 5, 20, 1, 15, PAL.wood2);
    rect(ctx, 26, 20, 1, 15, PAL.wood2);
    rect(ctx, 2, 8, 30, 14, PAL.wood2);
    for (let i = 0; i < 4; i++) rect(ctx, 2, 8 + i * 4, 30, 1, PAL.wood1);
    rect(ctx, 2, 8, 30, 1, PAL.wood3);
    // little shingle roof
    rect(ctx, 0, 4, 34, 4, PAL.wood1);
    rect(ctx, 0, 4, 34, 1, PAL.wood3);
    rect(ctx, 1, 3, 32, 1, PAL.wood0);
    // pinned notes
    for (const [nx, ny, nw, nh] of [[5, 11, 8, 7], [16, 10, 9, 8], [6, 19, 7, 3]]) {
      rect(ctx, nx, ny, nw, nh, PAL.paper);
      rect(ctx, nx, ny, nw, 1, PAL.paper2);
      rect(ctx, nx + 1, ny + 2, nw - 3, 1, PAL.paper3);
      rect(ctx, nx + 1, ny + 4, nw - 4, 1, PAL.paper3);
      px(ctx, nx + (nw >> 1), ny, PAL.red);
    }
  },
  // Lean-to over crates, barrels and sacks: the stores.
  storehouse: (ctx) => {
    rect(ctx, 1, 30, 38, 2, 'rgba(0,0,0,0.25)');
    rect(ctx, 2, 8, 2, 22, PAL.wood1);
    rect(ctx, 34, 10, 2, 20, PAL.wood1);
    rect(ctx, 0, 5, 40, 4, PAL.wood2);
    rect(ctx, 0, 5, 40, 1, PAL.wood3);
    rect(ctx, 0, 9, 40, 1, PAL.wood0);
    // crates
    for (const [cx, cy, cs] of [[7, 20, 10], [19, 22, 8], [28, 19, 9]]) {
      rect(ctx, cx, cy, cs, cs, PAL.wood2);
      frame(ctx, cx, cy, cs, cs, PAL.wood1);
      line(ctx, cx, cy + cs - 1, cx + cs - 1, cy, PAL.wood3);
      px(ctx, cx + 2, cy + 2, PAL.wood4);
    }
    // barrel
    rect(ctx, 8, 12, 8, 8, PAL.wood1);
    rect(ctx, 8, 13, 8, 1, PAL.wood3);
    rect(ctx, 8, 18, 8, 1, PAL.wood3);
    rect(ctx, 9, 12, 6, 1, PAL.wood2);
    // sack of berries
    disc(ctx, 24, 15, 4, PAL.paper3);
    disc(ctx, 24, 14, 3, PAL.paper2);
    px(ctx, 23, 11, PAL.red); px(ctx, 25, 11, PAL.blue);
  },
  // Where the crew sleeps.
  bunkhouse: (ctx) => {
    rect(ctx, 1, 32, 42, 2, 'rgba(0,0,0,0.25)');
    disc(ctx, 22, 26, 20, PAL.wood0);
    disc(ctx, 22, 25, 18, PAL.wood1);
    for (let i = 0; i < 18; i++) {
      const a = Math.PI + (i / 17) * Math.PI;
      line(ctx, 22 + Math.cos(a) * 19, 26 + Math.sin(a) * 17, 22 + Math.cos(a) * 6, 22, i % 2 ? PAL.wood2 : PAL.wood1);
    }
    rect(ctx, 17, 22, 10, 12, PAL.ink);
    rect(ctx, 17, 22, 10, 1, PAL.wood3);
    disc(ctx, 22, 30, 3, PAL.black);
    rect(ctx, 30, 18, 6, 5, PAL.gold);       // lit window
    frame(ctx, 30, 18, 6, 5, PAL.wood1);
    px(ctx, 33, 20, PAL.wood1);
    rect(ctx, 8, 10, 4, 3, PAL.grass2);      // moss on the roof
    px(ctx, 30, 8, PAL.grass3);
  },
  // The log pile you slam.
  logpile: (ctx) => {
    rect(ctx, 1, 17, 26, 2, 'rgba(0,0,0,0.25)');
    for (let row = 0; row < 3; row++) {
      const count = 3 - row;
      for (let i = 0; i < count; i++) {
        const x = 2 + row * 4 + i * 8;
        const y = 12 - row * 5;
        rect(ctx, x, y, 8, 5, PAL.wood2);
        rect(ctx, x, y, 8, 1, PAL.wood3);
        rect(ctx, x, y + 4, 8, 1, PAL.wood1);
        disc(ctx, x + 1, y + 2, 1, PAL.wood4);
      }
    }
  },
  // A post with a crossbar for the heron.
  perch: (ctx) => {
    rect(ctx, 6, 38, 12, 2, 'rgba(0,0,0,0.25)');
    rect(ctx, 10, 10, 4, 29, PAL.wood1);
    rect(ctx, 10, 10, 1, 29, PAL.wood2);
    rect(ctx, 2, 10, 20, 3, PAL.wood2);
    rect(ctx, 2, 10, 20, 1, PAL.wood3);
    line(ctx, 6, 14, 11, 20, PAL.wood1);
    line(ctx, 18, 14, 13, 20, PAL.wood1);
    for (let i = 0; i < 3; i++) px(ctx, 4 + i * 6, 13, PAL.paper3);   // feathers
  },
  // Odds and ends around the camp.
  sawhorse: (ctx) => {
    rect(ctx, 1, 13, 18, 1, 'rgba(0,0,0,0.2)');
    rect(ctx, 1, 4, 18, 2, PAL.wood2);
    line(ctx, 4, 6, 2, 13, PAL.wood1);
    line(ctx, 5, 6, 8, 13, PAL.wood1);
    line(ctx, 14, 6, 11, 13, PAL.wood1);
    line(ctx, 15, 6, 17, 13, PAL.wood1);
  },
  lantern: (ctx) => {
    rect(ctx, 3, 15, 5, 1, 'rgba(0,0,0,0.2)');
    rect(ctx, 5, 0, 1, 4, PAL.stone1);
    rect(ctx, 2, 4, 7, 8, PAL.stone2);
    rect(ctx, 3, 5, 5, 6, PAL.gold2);
    rect(ctx, 4, 7, 3, 3, PAL.white);
    rect(ctx, 2, 12, 7, 2, PAL.stone1);
  },
  bucket: (ctx) => {
    rect(ctx, 1, 11, 10, 1, 'rgba(0,0,0,0.2)');
    rect(ctx, 2, 4, 8, 7, PAL.stone2);
    rect(ctx, 2, 4, 8, 1, PAL.stone3);
    rect(ctx, 3, 5, 6, 2, PAL.water3);
    line(ctx, 2, 4, 6, 1, PAL.stone1);
    line(ctx, 6, 1, 10, 4, PAL.stone1);
  },
};

export function propSprite(id) {
  const sizes = {
    jobboard: [34, 37], storehouse: [40, 33], bunkhouse: [44, 35],
    logpile: [28, 20], perch: [24, 41], sawhorse: [20, 15],
    lantern: [11, 17], bucket: [12, 13],
  };
  const [w, h] = sizes[id] || [16, 16];
  return sprite(`prop${id}`, w, h, (ctx) => {
    (PROP_ART[id] || PROP_ART.bucket)(ctx);
    outline(ctx, w, h, PAL.ink);
    shadowUnder(ctx, w >> 1, h - 2, (w >> 1) - 1, 2, 0.24);
  });
}

/** Parallax scenery for the camp background. */
export function bgTreeSprite(variant, small = false) {
  const w = small ? 16 : 26, h = small ? 24 : 40;
  return sprite(`bgtree${variant}${small ? 'S' : ''}`, w, h, (ctx) => {
    const rng = rngFrom(900 + variant + (small ? 40 : 0));
    // trees further away read as flatter and bluer
    const dark = small ? PAL.leaf0 : (variant === 0 ? PAL.leaf0 : PAL.leaf1);
    const mid = small ? PAL.leaf1 : (variant === 0 ? PAL.leaf1 : PAL.leaf2);
    const cx = w >> 1;
    const trunkH = small ? 8 : 18;
    rect(ctx, cx - 1, h - trunkH, small ? 2 : 4, trunkH, PAL.wood0);
    const tiers = small ? 3 : 4;
    for (let i = 0; i < tiers; i++) {
      const y = h - trunkH - 2 - i * (small ? 4 : 5);
      const r = (small ? 6 : 11) - i * 2;
      disc(ctx, cx, y, Math.max(1, r), dark);
      disc(ctx, cx - 1, y - 1, Math.max(1, r - 2), mid);
    }
    if (!small) for (let i = 0; i < 8; i++) px(ctx, 6 + ((rng() * 14) | 0), 4 + ((rng() * 16) | 0), PAL.leaf3);
    outline(ctx, w, h, PAL.leaf0);
  });
}

export function cloudSprite(variant) {
  return sprite(`cloud${variant}`, 46, 18, (ctx) => {
    const rng = rngFrom(600 + variant * 31);
    const puffs = [[10, 11, 6], [19, 9, 7], [28, 11, 6], [36, 12, 4]];
    if (variant === 1) puffs.push([24, 7, 5]);
    for (const [cx, cy, r] of puffs) disc(ctx, cx, cy, r, PAL.white);
    rect(ctx, 6, 11, 34, 4, PAL.white);
    // flat, shaded belly
    rect(ctx, 7, 14, 32, 1, PAL.sky4);
    rect(ctx, 10, 15, 24, 1, PAL.sky3);
    for (let i = 0; i < 4; i++) px(ctx, 12 + ((rng() * 22) | 0), 13, PAL.sky4);
    outline(ctx, 46, 18, PAL.sky2);
  });
}

export function hillSprite(variant) {
  return sprite(`hill${variant}`, 120, 48, (ctx) => {
    const rng = rngFrom(400 + variant * 17);
    const base = variant === 0 ? PAL.grass0 : PAL.leaf0;
    const top = variant === 0 ? PAL.grass1 : PAL.leaf1;
    for (let x = 0; x < 120; x++) {
      const h = 18 + Math.round(Math.sin(x / 14 + variant) * 8 + Math.sin(x / 5) * 2);
      rect(ctx, x, 48 - h, 1, h, base);
      rect(ctx, x, 48 - h, 1, 2, top);
    }
    for (let i = 0; i < 14; i++) {
      const x = (rng() * 116) | 0;
      const y = 48 - (16 + ((rng() * 8) | 0));
      disc(ctx, x, y, 2, top);
      rect(ctx, x, y, 1, 3, base);
    }
  });
}

/** The camp's ground: turf over packed earth, tiled horizontally. */
export function groundStrip() {
  return sprite('groundstrip', 16, 40, (ctx) => {
    const rng = rngFrom(321);
    rect(ctx, 0, 0, 16, 40, PAL.dirt1);
    rect(ctx, 0, 0, 16, 6, PAL.grass1);
    rect(ctx, 0, 0, 16, 3, PAL.grass2);
    rect(ctx, 0, 0, 16, 1, PAL.grass3);
    for (let i = 0; i < 26; i++) px(ctx, (rng() * 16) | 0, 7 + ((rng() * 32) | 0), rng() < 0.5 ? PAL.dirt0 : PAL.dirt2);
    for (let i = 0; i < 5; i++) px(ctx, (rng() * 16) | 0, 2 + ((rng() * 4) | 0), PAL.grass3);
    // pebbles
    px(ctx, 4, 14, PAL.stone1); px(ctx, 5, 14, PAL.stone2);
    px(ctx, 11, 22, PAL.stone1);
  });
}
