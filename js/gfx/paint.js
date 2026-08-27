// The texturing toolkit: colour ramps and material surfaces.
//
// Flat pixel art is flat because every surface is one rectangle of one colour.
// Everything here exists to avoid that - a five-tone ramp per material, light
// from the top left, a darker line where two surfaces meet, grain and speckle
// broken up so no edge is a straight machine line, and a contact shadow
// wherever something touches the ground.
//
// Every helper takes a `ramp`: [darkest, dark, mid, light, lightest].

// ------------------------------------------------------------------ colour
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('')}`;
}

export function mix(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/**
 * A five-tone ramp from one base colour. Shadows shift cool and desaturate,
 * highlights shift warm - which is what stops a ramp looking like the same
 * colour with the brightness slider dragged about.
 */
export function ramp(base, opts = {}) {
  const shadow = opts.shadow || '#2a2140';    // cool violet for the dark end
  const light = opts.light || '#fff3c4';      // warm sun for the bright end
  const spread = opts.spread === undefined ? 1 : opts.spread;
  return [
    mix(base, shadow, 0.55 * spread),
    mix(base, shadow, 0.28 * spread),
    base,
    mix(base, light, 0.26 * spread),
    mix(base, light, 0.5 * spread),
  ];
}

export const RAMPS = {
  oak:    ramp('#8a5a2f'),
  pine:   ramp('#a9743c'),
  walnut: ramp('#5d3a20'),
  birch:  ramp('#c9ab7c'),
  leafA:  ramp('#4f9c33'),
  leafB:  ramp('#3d8a3a'),
  leafC:  ramp('#77b73f'),
  autumn: ramp('#d9641f', { light: '#ffe08a' }),
  grass:  ramp('#5aa83c'),
  dirt:   ramp('#8a5f38'),
  soil:   ramp('#6b4526'),
  stone:  ramp('#8b929c'),
  slate:  ramp('#5c6470'),
  brick:  ramp('#a85a42'),
  shingle: ramp('#7a4438'),
  thatch: ramp('#c2a35c'),
  cloth:  ramp('#d05a63'),
  linen:  ramp('#e0cfa8'),
  metal:  ramp('#9aa2ad'),
  iron:   ramp('#4a525c'),
  brass:  ramp('#c69a3c'),
  water:  ramp('#3f8fc4'),
  glass:  ramp('#9fd8ef'),
};

// ------------------------------------------------------------- primitives
const P = (ctx, x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); };
const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };

/** A tiny deterministic noise source, so a texture is the same every frame. */
export function noise(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Scattered single pixels in two tones - the base layer of any texture. */
export function speck(ctx, x, y, w, h, tones, count, seed = 7) {
  const rng = noise(seed);
  for (let i = 0; i < count; i++) {
    P(ctx, x + rng() * w, y + rng() * h, tones[(rng() * tones.length) | 0]);
  }
}

/** Ambient occlusion: darken the inside of a shape along its bottom and right. */
export function ao(ctx, x, y, w, h, tone, depth = 2) {
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < depth; i++) {
    R(ctx, x + i, y + h - 1 - i, w - i * 2, 1, tone);
    R(ctx, x + w - 1 - i, y + i, 1, h - i * 2, tone);
    ctx.globalAlpha *= 0.6;
  }
  ctx.globalAlpha = 1;
}

/** The matching highlight: one line along the top and left, where the sun is. */
export function rim(ctx, x, y, w, h, tone) {
  R(ctx, x, y, w - 1, 1, tone);
  R(ctx, x, y, 1, h - 1, tone);
}

/** A soft contact shadow, flattened, for anything standing on the ground. */
export function contact(ctx, cx, cy, rx, ry = Math.max(1, rx >> 2), alpha = 0.28) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1b1424';
  for (let dy = -ry; dy <= ry; dy++) {
    const span = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.01))));
    if (span > 0) ctx.fillRect((cx - span) | 0, (cy + dy) | 0, span * 2, 1);
  }
  ctx.globalAlpha = 1;
}

/** Ragged an edge so it never reads as a ruled line. */
export function edgeBreak(ctx, x, y, w, tone, seed = 3, amp = 2, horizontal = true) {
  const rng = noise(seed);
  for (let i = 0; i < w; i++) {
    const d = Math.round(rng() * amp);
    if (horizontal) R(ctx, x + i, y, 1, d, tone);
    else R(ctx, x, y + i, d, 1, tone);
  }
}

// -------------------------------------------------------------- materials
/**
 * One board, with grain running along it, a knot or two, and a lit edge.
 * `dir` is 'h' for a board lying flat or 'v' for one standing up.
 */
export function plank(ctx, x, y, w, h, r, opts = {}) {
  const dir = opts.dir || 'h';
  const seed = opts.seed || 11;
  const rng = noise(seed);
  R(ctx, x, y, w, h, r[2]);
  const along = dir === 'h' ? w : h;
  const across = dir === 'h' ? h : w;
  // one soft band of lighter heartwood, off centre - not a stripe per pixel
  const bandAt = Math.round(across * (0.25 + rng() * 0.4));
  const bandW = Math.max(1, Math.round(across * 0.3));
  for (let i = 0; i < across; i++) {
    const inBand = i >= bandAt && i < bandAt + bandW;
    const tone = inBand ? r[3] : i === 0 ? r[3] : i === across - 1 ? r[1] : r[2];
    if (dir === 'h') R(ctx, x, y + i, w, 1, tone);
    else R(ctx, x + i, y, 1, h, tone);
  }
  // a couple of grain lines, broken and low contrast
  const lines = opts.grain === 0 ? 0 : Math.max(1, Math.round(across / 7));
  for (let g = 0; g < lines; g++) {
    let pos = Math.round(rng() * across);
    const tone = mix(r[2], r[1], 0.7);
    for (let i = 0; i < along; i += 1) {
      if (rng() > 0.9) pos += rng() > 0.5 ? 1 : -1;
      pos = Math.max(0, Math.min(across - 1, pos));
      if (rng() > 0.62) {
        if (dir === 'h') P(ctx, x + i, y + pos, tone);
        else P(ctx, x + pos, y + i, tone);
      }
    }
  }
  // knots
  const knots = opts.knots === undefined ? 0 : opts.knots;
  for (let k = 0; k < knots; k++) {
    const kx = Math.round(x + 4 + rng() * Math.max(1, w - 8));
    const ky = Math.round(y + 1 + rng() * Math.max(1, h - 3));
    // the knot, and the grain parting around it
    R(ctx, kx, ky, 2, 2, r[0]);
    P(ctx, kx, ky, mix(r[0], r[1], 0.5));
    P(ctx, kx + 1, ky + 2, r[1]);
    P(ctx, kx - 1, ky - 1, r[1]);
    if (dir === 'v') {
      P(ctx, kx - 2, ky, r[1]); P(ctx, kx + 3, ky + 1, r[1]);
    } else {
      P(ctx, kx, ky - 2, r[1]); P(ctx, kx + 1, ky + 3, r[1]);
    }
  }
  if (opts.lit !== false) rim(ctx, x, y, w, h, r[4]);
  if (opts.ao !== false) ao(ctx, x, y, w, h, r[0], 1);
}

/** A wall of boards. Vertical by default, like a cabin. */
export function plankWall(ctx, x, y, w, h, r, opts = {}) {
  const step = opts.step || 16;
  const dir = opts.dir || 'v';
  let i = 0;
  if (dir === 'v') {
    for (let px0 = x; px0 < x + w; px0 += step) {
      const bw = Math.min(step - 1, x + w - px0);
      plank(ctx, px0, y, bw, h, r, { dir: 'v', seed: 31 + i * 7,
                                     grain: opts.grain === undefined ? 0 : opts.grain,
                                     knots: i % 5 === 0 ? 1 : 0, ao: false, lit: false });
      R(ctx, px0, y, 1, h, r[3]);               // the lit edge of each board
      R(ctx, px0 + bw, y, 1, h, mix(r[1], r[0], 0.6));   // and the shadowed gap
      i++;
    }
  } else {
    for (let py = y; py < y + h; py += step) {
      const bh = Math.min(step - 1, y + h - py);
      plank(ctx, x, py, w, bh, r, { dir: 'h', seed: 61 + i * 5,
                                    grain: opts.grain === undefined ? 0 : opts.grain,
                                    knots: i % 6 === 0 ? 1 : 0, ao: false, lit: false });
      R(ctx, x, py, w, 1, r[3]);
      R(ctx, x, py + bh, w, 1, mix(r[1], r[0], 0.6));
      i++;
    }
  }
}

/**
 * Shingles. Courses overlap, so what you see of each tile is its butt end: a
 * lit face, a scalloped bottom edge and a shadow cast on the course below. The
 * stagger is a third of a tile, not a half, or it reads as brickwork.
 */
export function shingles(ctx, x, y, w, h, r, opts = {}) {
  const rowH = opts.rowH || 5;
  const tileW = opts.tileW || 8;
  const rng = noise(opts.seed || 91);
  R(ctx, x, y, w, h, r[1]);
  let row = 0;
  for (let py = y; py < y + h; py += rowH) {
    const rh = Math.min(rowH, y + h - py);
    const off = ((row % 3) * tileW) / 3;
    // the shadow the course above throws on this one
    R(ctx, x, py, w, 1, r[0]);
    for (let px0 = x - off; px0 < x + w; px0 += tileW) {
      const left = Math.max(x, Math.round(px0));
      const right = Math.min(x + w, Math.round(px0 + tileW) - 1);
      const width = right - left;
      if (width <= 0) continue;
      const t = rng();
      const tone = t > 0.82 ? r[3] : t > 0.52 ? r[2] : t > 0.2 ? r[1] : mix(r[1], r[0], 0.4);
      R(ctx, left, py + 1, width, Math.max(1, rh - 1), tone);
      // lit face just under the shadow line
      R(ctx, left, py + 1, width, 1, mix(tone, r[4], 0.55));
      // scalloped butt: the bottom corners are clipped off
      if (rh > 2) {
        P(ctx, left, py + rh - 1, r[0]);
        P(ctx, right - 1, py + rh - 1, r[0]);
      }
      // the gap between tiles, only where tiles have parted
      if (t > 0.42) R(ctx, right - 1, py + 1, 1, Math.max(1, rh - 2), mix(tone, r[0], 0.7));
      if (t > 0.93 && rh > 3) P(ctx, left + 2, py + 2, r[0]);   // a split tile
      if (t < 0.08) speck(ctx, left, py + 1, width, rh - 1, [RAMPS.leafB[1]], 2, left + py);
    }
    row++;
  }
}

/**
 * A pitch of roof seen from above. Courses run parallel to the ridge and get
 * tighter as they approach it, which is the whole trick: even with no
 * perspective in the drawing, compressed spacing reads as a surface tilting
 * away. `dir` says which edge the ridge is on.
 */
export function roofField(ctx, x, y, w, h, r, opts = {}) {
  const dir = opts.dir || 'down';        // 'down': ridge at the top edge
  const tileW = opts.tileW || 11;
  const rng = noise(opts.seed || 41);
  const shade = opts.shade || 0;         // 0..1, how far into shadow this pitch is
  const tone = (t) => (shade ? mix(t, '#26304f', shade) : t);
  R(ctx, x, y, w, h, tone(r[1]));

  // Course positions, measured from the eaves inward: wide steps at the eaves,
  // tightening as they near the ridge. Compressed spacing is what makes a flat
  // field of tiles read as a plane tilting away from the camera.
  const nearStep = opts.near || 9;
  const farStep = opts.far || 4;
  const rows = [0];
  let pos = 0;
  while (pos < h) {
    const k = pos / h;                      // 0 at the eaves, 1 at the ridge
    const step = Math.max(farStep, Math.round(nearStep - (nearStep - farStep) * Math.pow(k, 0.75)));
    pos += step;
    rows.push(Math.min(h, pos));
  }

  for (let i = 0; i < rows.length - 1; i++) {
    // rows run from the eaves inward, so flip them for the pitch whose ridge
    // is at the top of the sprite
    const a = dir === 'up' ? rows[i] : h - rows[i + 1];
    const b = dir === 'up' ? rows[i + 1] : h - rows[i];
    const rh = b - a;
    if (rh <= 0) continue;
    const py = y + a;
    const t = rng();
    const base = t > 0.7 ? r[3] : t > 0.35 ? r[2] : r[1];
    R(ctx, x, py, w, rh, tone(base));
    // the lit lip of the course, and the shadow it throws on the next one
    R(ctx, x, py, w, 1, tone(mix(base, r[4], 0.55)));
    R(ctx, x, py + rh - 1, w, 1, tone(r[0]));
    // tile divisions: sparse, staggered, never a full grid
    const off = (i % 3) * (tileW / 3);
    for (let tx = x - off; tx < x + w; tx += tileW) {
      if (rng() > 0.45) continue;
      const gx = Math.round(tx);
      if (gx <= x || gx >= x + w - 1) continue;
      R(ctx, gx, py + 1, 1, Math.max(1, rh - 2), tone(mix(base, r[0], 0.55)));
    }
    // weathering: a few darker and lighter tiles, and moss low down
    for (let k = 0; k < w * 0.04; k++) {
      const sx = x + rng() * w;
      const tt = rng();
      if (tt > 0.6) R(ctx, sx, py + 1, 2 + ((rng() * 3) | 0), Math.max(1, rh - 2), tone(mix(base, r[0], 0.3)));
      else if (tt > 0.3) R(ctx, sx, py + 1, 2, 1, tone(mix(base, r[4], 0.3)));
    }
    const kk = 1 - a / h;
    if (kk > 0.6 && rng() > 0.5) {
      speck(ctx, x + rng() * (w - 10), py + 1, 8, Math.max(1, rh - 2),
            [tone(RAMPS.leafB[1]), tone(RAMPS.leafB[2])], 5, (py * 13) | 0);
    }
  }
}

/** A ridge cap: tiles laid over the apex, catching the most light. */
export function ridgeCap(ctx, x, y, w, r, opts = {}) {
  const tileW = opts.tileW || 7;
  const h = opts.h || 4;
  for (let px0 = x; px0 < x + w; px0 += tileW) {
    const width = Math.min(tileW - 1, x + w - px0);
    R(ctx, px0, y, width, h, r[2]);
    R(ctx, px0, y, width, 1, r[4]);
    R(ctx, px0, y + h - 1, width, 1, r[0]);
    R(ctx, px0 + width, y, 1, h, r[0]);
  }
}

/** Brick courses, with mortar and a lit top on every brick. */
export function brick(ctx, x, y, w, h, r, opts = {}) {
  const bh = opts.bh || 5, bw = opts.bw || 11;
  const mortar = opts.mortar || mix(r[3], '#e8e2d0', 0.5);
  const rng = noise(opts.seed || 17);
  R(ctx, x, y, w, h, mortar);
  let row = 0;
  for (let py = y; py < y + h; py += bh) {
    const off = (row % 2) * (bw >> 1);
    for (let px0 = x - off; px0 < x + w; px0 += bw) {
      const left = Math.max(x, px0);
      const width = Math.min(bw - 1, x + w - left, px0 + bw - 1 - left);
      const height = Math.min(bh - 1, y + h - py);
      if (width <= 0 || height <= 0) continue;
      const t = rng();
      const tone = t > 0.8 ? r[3] : t > 0.45 ? r[2] : r[1];
      R(ctx, left, py, width, height, tone);
      R(ctx, left, py, width, 1, mix(tone, r[4], 0.4));
      if (t > 0.6) P(ctx, left + 1 + (rng() * (width - 2)), py + 1 + (rng() * (height - 2)), r[0]);
    }
    row++;
  }
}

/** Rough stone: irregular blocks, chipped edges, speckled faces. */
export function stonework(ctx, x, y, w, h, r, opts = {}) {
  const rng = noise(opts.seed || 53);
  R(ctx, x, y, w, h, r[1]);
  let py = y;
  let row = 0;
  while (py < y + h) {
    const bh = 5 + ((rng() * 4) | 0);
    const height = Math.min(bh, y + h - py);
    let px0 = x - (row % 2) * 5;
    while (px0 < x + w) {
      const bw = 8 + ((rng() * 8) | 0);
      const left = Math.max(x, px0);
      const width = Math.min(bw - 1, x + w - left);
      if (width > 1 && height > 1) {
        const t = rng();
        const tone = t > 0.76 ? r[3] : t > 0.4 ? r[2] : r[1];
        R(ctx, left, py, width, height, tone);
        R(ctx, left, py, width - 1, 1, mix(tone, r[4], 0.45));
        R(ctx, left, py + height - 1, width, 1, r[0]);
        R(ctx, left + width - 1, py, 1, height, r[0]);
        speck(ctx, left + 1, py + 1, Math.max(1, width - 2), Math.max(1, height - 2),
              [r[0], r[3]], Math.round(width * 0.5), (px0 * 31 + py * 7) | 0);
      }
      px0 += bw;
    }
    py += bh;
    row++;
  }
}

/** Woven cloth: a weave grid, a fold, and a hem. */
export function cloth(ctx, x, y, w, h, r, opts = {}) {
  R(ctx, x, y, w, h, r[2]);
  // a weave you can feel rather than count: every third thread, low contrast
  for (let py = y + 1; py < y + h; py += 3) R(ctx, x, py, w, 1, mix(r[2], r[1], 0.55));
  for (let px0 = x + 1; px0 < x + w; px0 += 3) {
    for (let py = y; py < y + h; py += 3) P(ctx, px0, py, mix(r[2], r[3], 0.5));
  }
  if (opts.fold) {
    const fx = x + Math.round(w * (opts.fold || 0.6));
    R(ctx, fx, y, 1, h, r[0]);
    R(ctx, fx + 1, y, 1, h, r[3]);
  }
  rim(ctx, x, y, w, h, r[4]);
  ao(ctx, x, y, w, h, r[0], 1);
}

/** Beaten metal: a bright band across the middle, dark at both edges. */
export function metal(ctx, x, y, w, h, r, opts = {}) {
  const vertical = opts.vertical;
  const across = vertical ? w : h;
  for (let i = 0; i < across; i++) {
    const t = i / Math.max(1, across - 1);
    const tone = t < 0.18 ? r[1] : t < 0.36 ? r[3] : t < 0.5 ? r[4] : t < 0.72 ? r[2] : r[1];
    if (vertical) R(ctx, x + i, y, 1, h, tone);
    else R(ctx, x, y + i, w, 1, tone);
  }
  speck(ctx, x, y, w, h, [r[0], r[4]], Math.round(w * h * 0.04), opts.seed || 5);
  ao(ctx, x, y, w, h, r[0], 1);
}

/** Glass: a pale pane with a diagonal sheen and a bright corner. */
export function glass(ctx, x, y, w, h, r, opts = {}) {
  R(ctx, x, y, w, h, r[2]);
  R(ctx, x, y, w, Math.max(1, h >> 2), r[3]);
  // the sheen
  for (let i = 0; i < Math.min(w, h); i++) {
    P(ctx, x + i + 1, y + h - 2 - i, r[4]);
    P(ctx, x + i + 2, y + h - 2 - i, r[3]);
  }
  if (opts.lit) {
    R(ctx, x, y, w, h, opts.lit);
    R(ctx, x, y, w, Math.max(1, h >> 2), mix(opts.lit, '#ffffff', 0.4));
    for (let i = 0; i < Math.min(w, h); i++) P(ctx, x + i + 1, y + h - 2 - i, '#fff9e0');
  }
  ao(ctx, x, y, w, h, mix(r[0], '#000000', 0.2), 1);
}

/** A band of soil in cross-section: crumbs, pebbles, roots. */
export function soilBand(ctx, x, y, w, h, r, opts = {}) {
  const rng = noise(opts.seed || 71);
  R(ctx, x, y, w, h, r[2]);
  R(ctx, x, y, w, 2, r[3]);
  for (let i = 0; i < w * h * 0.16; i++) {
    const sx = x + rng() * w, sy = y + rng() * h;
    const t = rng();
    if (t > 0.9) { R(ctx, sx, sy, 2, 2, RAMPS.stone[2]); P(ctx, sx, sy, RAMPS.stone[4]); }
    else if (t > 0.5) P(ctx, sx, sy, r[1]);
    else P(ctx, sx, sy, r[3]);
  }
  // roots reaching down
  for (let k = 0; k < Math.max(1, w / 40); k++) {
    let rx = x + rng() * w;
    for (let d = 0; d < h * 0.7; d++) {
      if (rng() > 0.7) rx += rng() > 0.5 ? 1 : -1;
      P(ctx, rx, y + 2 + d, r[1]);
    }
  }
}

/** Turf seen side-on: a lit crown, a clumped edge and blades along the top. */
export function turf(ctx, x, y, w, h, r, opts = {}) {
  const rng = noise(opts.seed || 23);
  R(ctx, x, y, w, h, r[2]);
  R(ctx, x, y, w, 2, r[3]);
  R(ctx, x, y, w, 1, r[4]);
  for (let i = 0; i < w * h * 0.1; i++) {
    P(ctx, x + rng() * w, y + rng() * h, rng() > 0.5 ? r[1] : r[3]);
  }
  // blades standing up off the crown
  for (let i = 0; i < w; i += 2) {
    if (rng() > 0.45) continue;
    const bh = 1 + ((rng() * 3) | 0);
    const lean = rng() > 0.5 ? 1 : -1;
    for (let k = 0; k < bh; k++) P(ctx, x + i + (k === bh - 1 ? lean : 0), y - 1 - k, k === bh - 1 ? r[4] : r[3]);
  }
  ao(ctx, x, y, w, h, r[0], 2);
}

/** Water seen from above: banded depth, a couple of ripples, a glitter line. */
export function water(ctx, x, y, w, h, r, opts = {}) {
  const rng = noise(opts.seed || 37);
  R(ctx, x, y, w, h, r[2]);
  R(ctx, x, y, w, Math.max(2, h >> 3), r[1]);          // deeper at the far edge
  R(ctx, x, y + h - Math.max(2, h >> 3), w, Math.max(2, h >> 3), r[3]);
  const phase = opts.phase || 0;
  for (let i = 0; i < w * h * 0.03; i++) {
    const wx = x + ((rng() * w + phase * 7) % w);
    const wy = y + rng() * h;
    R(ctx, wx, wy, 2 + ((rng() * 3) | 0), 1, rng() > 0.5 ? r[4] : r[3]);
  }
  for (let i = 0; i < w; i += 3) {
    if ((i + Math.round(phase * 4)) % 9 < 3) P(ctx, x + i, y + Math.round(h * 0.4), r[4]);
  }
}
