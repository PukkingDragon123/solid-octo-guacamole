// Small shared helpers: RNG, maths, grid pathfinding, canvas shapes.

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const chebyshev = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Smooth value noise on a coarse lattice, sampled at grid resolution. */
export function valueNoise(rng, w, h, cell) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  const grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  const out = new Float32Array(w * h);
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x / cell, gy = y / cell;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const tx = smooth(gx - x0), ty = smooth(gy - y0);
      const a = grid[y0 * gw + x0], b = grid[y0 * gw + x0 + 1];
      const c = grid[(y0 + 1) * gw + x0], d = grid[(y0 + 1) * gw + x0 + 1];
      out[y * w + x] = lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
    }
  }
  return out;
}

/**
 * A* over a small grid. `passable(x, y)` decides walkability; the goal tile is
 * always enterable so beavers can step onto a work site.
 * Returns an array of {x, y} tiles (excluding the start) or null.
 */
export function findPath(sx, sy, gx, gy, w, h, passable) {
  if (sx === gx && sy === gy) return [];
  const idx = (x, y) => y * w + x;
  const open = [idx(sx, sy)];
  const came = new Map();
  const gScore = new Float64Array(w * h).fill(Infinity);
  const fScore = new Float64Array(w * h).fill(Infinity);
  gScore[idx(sx, sy)] = 0;
  fScore[idx(sx, sy)] = chebyshev(sx, sy, gx, gy);
  const goal = idx(gx, gy);
  const inOpen = new Set([idx(sx, sy)]);
  let guard = 0;

  while (open.length && guard++ < 20000) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[best]]) best = i;
    const cur = open.splice(best, 1)[0];
    inOpen.delete(cur);
    if (cur === goal) {
      const path = [];
      let n = cur;
      while (came.has(n)) { path.push({ x: n % w, y: (n / w) | 0 }); n = came.get(n); }
      return path.reverse();
    }
    const cx = cur % w, cy = (cur / w) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = idx(nx, ny);
        if (ni !== goal && !passable(nx, ny)) continue;
        // no cutting diagonally past a blocked corner
        if (dx && dy && !passable(cx + dx, cy) && !passable(cx, cy + dy)) continue;
        const step = dx && dy ? 1.414 : 1;
        const tentative = gScore[cur] + step;
        if (tentative < gScore[ni]) {
          came.set(ni, cur);
          gScore[ni] = tentative;
          fScore[ni] = tentative + chebyshev(nx, ny, gx, gy);
          if (!inOpen.has(ni)) { open.push(ni); inOpen.add(ni); }
        }
      }
    }
  }
  return null;
}

// ------------------------------------------------------------ canvas shapes
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.closePath();
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

export const BEAVER_NAMES = [
  'Birch', 'Willow', 'Maple', 'Hazel', 'Alder', 'Rowan', 'Aspen', 'Juniper',
  'Pip', 'Bramble', 'Chip', 'Splash', 'Muddy', 'Nib', 'Timber', 'Ripple',
  'Gnaw', 'Cedar', 'Poppy', 'Fern', 'Cobble', 'Whisker', 'Twig', 'Nutmeg',
];
