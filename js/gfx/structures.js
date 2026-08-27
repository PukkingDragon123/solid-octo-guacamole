// Buildings, in both views. A cabin is a stone footing, a plank wall with
// visible grain, framed windows with mullions and curtains, a shingled roof
// with a ridge and an eaves shadow, and a chimney laid in courses. The same
// house is available from above for the scenes played that way, where the roof
// is the whole silhouette and the shadow tells you it has height.

import { sprite, px, rect, disc, line, frame as boxFrame } from './pixel.js';
import { RAMPS, ramp, mix, noise, speck, ao, rim, contact, ridgeCap, roofField,
         plankWall, shingles, brick, stonework, glass, plank, cloth, metal } from './paint.js';

const STYLES = {
  workshop: { wall: RAMPS.oak,    roof: RAMPS.shingle, trim: RAMPS.walnut, curtain: '#c04a4a' },
  bakery:   { wall: RAMPS.linen,  roof: ramp('#b5714f'), trim: RAMPS.oak,  curtain: '#e8a33c' },
  forge:    { wall: RAMPS.stone,  roof: RAMPS.slate,   trim: RAMPS.iron,   curtain: '#5a636e' },
  cottage:  { wall: ramp('#d8c79a'), roof: RAMPS.thatch, trim: RAMPS.walnut, curtain: '#4f8be8' },
  mill:     { wall: RAMPS.pine,   roof: RAMPS.shingle, trim: RAMPS.walnut, curtain: '#f2c14e' },
  riverside:{ wall: ramp('#7f9c6a'), roof: ramp('#5f7a52'), trim: RAMPS.walnut, curtain: '#3f8fc4' },
};

export const HOUSE_STYLES = Object.keys(STYLES);

/** A window: recess, frame, mullions, glass, sill, and curtains inside. */
export function windowUnit(ctx, x, y, w, h, style, opts = {}) {
  const st = STYLES[style] || STYLES.workshop;
  // recess shadow, so the opening looks cut into the wall
  rect(ctx, x - 1, y - 1, w + 2, h + 2, st.trim[0]);
  glass(ctx, x, y, w, h, RAMPS.glass, { lit: opts.lit ? '#f7cc55' : null });
  // curtains, drawn back to each side
  if (opts.curtains !== false) {
    cloth(ctx, x, y, Math.max(2, w >> 3), h, ramp(st.curtain), { fold: 0.5 });
    cloth(ctx, x + w - Math.max(2, w >> 3), y, Math.max(2, w >> 3), h, ramp(st.curtain), { fold: 0.5 });
  }
  // mullions
  rect(ctx, x + (w >> 1) - 1, y, 2, h, st.trim[2]);
  rect(ctx, x, y + (h >> 1) - 1, w, 2, st.trim[2]);
  px(ctx, x + (w >> 1) - 1, y, st.trim[3]);
  // frame and a sill that catches the light
  boxFrame(ctx, x - 2, y - 2, w + 4, h + 4, st.trim[2]);
  rect(ctx, x - 2, y - 2, w + 4, 1, st.trim[3]);
  boxFrame(ctx, x - 3, y - 3, w + 6, h + 6, st.trim[0]);
  rect(ctx, x - 4, y + h + 2, w + 8, 3, st.trim[2]);
  rect(ctx, x - 4, y + h + 2, w + 8, 1, st.trim[4]);
  rect(ctx, x - 4, y + h + 5, w + 8, 1, st.trim[0]);
}

/** A plank door with hinges, boards, a latch and a step. */
export function doorUnit(ctx, x, y, w, h, style, opts = {}) {
  const st = STYLES[style] || STYLES.workshop;
  rect(ctx, x - 1, y - 1, w + 2, h + 1, st.trim[0]);
  if (opts.open) {
    // the room beyond: dark at the top where the light does not reach, warm
    // toward the floor, with the floorboards catching the glow
    const inner = opts.lit ? '#8a5a2f' : '#3a2418';
    rect(ctx, x, y, w, h, inner);
    for (let i = 0; i < h; i++) {
      const t = i / h;
      const tone = opts.lit
        ? mix('#2a1a12', '#f7cc55', Math.pow(t, 1.6))
        : mix('#1d130e', '#5a3a24', Math.pow(t, 1.4));
      rect(ctx, x, y + i, w, 1, tone);
    }
    // floorboards inside, running away from the door
    for (let i = 0; i < 4; i++) {
      const fy = y + h - 2 - i * 3;
      rect(ctx, x + i, fy, w - i * 2, 1, opts.lit ? '#c98a4c' : '#4a3020');
    }
    for (let bx = x + 3; bx < x + w - 2; bx += 6) {
      rect(ctx, bx, y + h - 10, 1, 10, opts.lit ? '#8a5a2f' : '#2f1f14');
    }
    // a chair leg and a table edge, just enough to suggest a room
    if (opts.lit) {
      rect(ctx, x + 4, y + h - 14, 2, 8, '#6b4423');
      rect(ctx, x + w - 9, y + h - 18, 6, 2, '#6b4423');
    }
    // the light spilling out over the threshold
    if (opts.lit) {
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 6; i++) rect(ctx, x - i, y + h + i, w + i * 2, 1, '#fff3c4');
      ctx.globalAlpha = 1;
    }
    // the door itself, swung back flat against the wall
    plank(ctx, x + w + 1, y + 2, 5, h - 2, st.trim, { dir: 'v', knots: 0 });
    metal(ctx, x + w + 1, y + 6, 5, 2, RAMPS.iron);
    metal(ctx, x + w + 1, y + h - 10, 5, 2, RAMPS.iron);
  } else {
    plankWall(ctx, x, y, w, h, st.trim, { step: Math.max(4, w >> 2), dir: 'v' });
    // cross braces
    rect(ctx, x, y + 3, w, 2, st.trim[1]);
    rect(ctx, x, y + h - 6, w, 2, st.trim[1]);
    // hinges and latch
    for (const hy of [y + 3, y + h - 7]) {
      metal(ctx, x + 1, hy, Math.max(4, w >> 2), 2, RAMPS.iron);
    }
    disc(ctx, x + w - 4, y + (h >> 1), 1, RAMPS.brass[3]);
    px(ctx, x + w - 4, y + (h >> 1) - 1, RAMPS.brass[4]);
  }
  boxFrame(ctx, x - 2, y - 1, w + 4, h + 1, st.trim[2]);
  rect(ctx, x - 3, y - 3, w + 6, 3, st.trim[1]);      // lintel
  rect(ctx, x - 3, y - 3, w + 6, 1, st.trim[3]);
  rect(ctx, x - 4, y + h, w + 8, 3, RAMPS.stone[2]);  // step
  rect(ctx, x - 4, y + h, w + 8, 1, RAMPS.stone[4]);
}

/**
 * A cabin seen side-on. Returns a cached sprite: footing, wall, roof with
 * eaves, chimney, windows, door and a lamp, all textured.
 */
export function cabinSide(style = 'workshop', opts = {}) {
  const w = opts.w || 150, h = opts.h || 104;
  const st = STYLES[style] || STYLES.workshop;
  const key = `cabin:${style}:${w}:${h}:${opts.lit ? 1 : 0}:${opts.door || 'open'}`;
  return sprite(key, w + 20, h + 8, (ctx) => {
    const x = 10, y = 6;
    const roofH = Math.round(h * 0.3);
    const wallY = y + roofH;
    const wallH = h - roofH;

    contact(ctx, x + w / 2, y + h + 2, Math.round(w * 0.52), 4, 0.3);

    // ---- stone footing
    stonework(ctx, x - 2, y + h - 12, w + 4, 12, RAMPS.stone, { seed: 13 });
    // ---- plank wall
    plankWall(ctx, x, wallY, w, wallH - 10, st.wall, { step: 12, dir: 'v' });
    // corner posts
    plank(ctx, x - 3, wallY, 6, wallH - 10, st.trim, { dir: 'v', knots: 0 });
    plank(ctx, x + w - 3, wallY, 6, wallH - 10, st.trim, { dir: 'v', knots: 0 });
    // a beam across, and the eaves shadow beneath the roof
    plank(ctx, x - 4, wallY, w + 8, 5, st.trim, { dir: 'h', knots: 1 });
    ctx.globalAlpha = 0.35;
    rect(ctx, x - 4, wallY + 5, w + 8, 4, '#1b1424');
    ctx.globalAlpha = 1;

    // ---- roof: a gable, built course by course from the ridge down, each
    // course wider than the one above it so the pitch reads as a pitch
    const eaves = 13;
    const rowH = 5;
    const rows = Math.max(3, Math.round(roofH / rowH));
    const ridgeHalf = 9;
    const eavesHalf = (w + eaves * 2) / 2;
    const cx = x + w / 2;
    for (let i = 0; i < rows; i++) {
      const k = (i + 1) / rows;
      const half = Math.round(ridgeHalf + (eavesHalf - ridgeHalf) * Math.pow(k, 0.92));
      const py = y + 2 + i * rowH;
      shingles(ctx, Math.round(cx - half), py, half * 2, rowH, st.roof,
               { rowH, tileW: 8, seed: 90 + i * 13 });
      // the rake board along both sloping edges
      rect(ctx, Math.round(cx - half) - 1, py, 2, rowH, st.trim[1]);
      rect(ctx, Math.round(cx + half) - 1, py, 2, rowH, st.trim[1]);
    }
    ridgeCap(ctx, Math.round(cx - ridgeHalf - 2), y - 1, ridgeHalf * 2 + 4, st.roof, { tileW: 6, h: 4 });
    // fascia along the eaves, with the shadow it throws on the wall
    rect(ctx, Math.round(cx - eavesHalf), wallY - 4, eavesHalf * 2, 5, st.trim[1]);
    rect(ctx, Math.round(cx - eavesHalf), wallY - 4, eavesHalf * 2, 1, st.trim[3]);
    rect(ctx, Math.round(cx - eavesHalf), wallY + 1, eavesHalf * 2, 1, st.trim[0]);
    // rafter tails poking out under it
    for (let rx2 = Math.round(cx - eavesHalf) + 4; rx2 < cx + eavesHalf - 4; rx2 += 12) {
      rect(ctx, rx2, wallY + 1, 3, 3, st.trim[1]);
      px(ctx, rx2, wallY + 1, st.trim[3]);
    }

    // ---- chimney
    const chX = x + w - 40;
    brick(ctx, chX, y - 4, 18, roofH + 14, RAMPS.brick, { bh: 5, bw: 9, seed: 21 });
    rect(ctx, chX - 2, y - 7, 22, 4, RAMPS.stone[2]);
    rect(ctx, chX - 2, y - 7, 22, 1, RAMPS.stone[4]);
    ao(ctx, chX, y - 4, 18, roofH + 14, RAMPS.brick[0], 2);

    // ---- windows and door
    const winY = wallY + 18;
    windowUnit(ctx, x + 18, winY, 30, 24, style, { lit: opts.lit });
    windowUnit(ctx, x + w - 62, winY, 30, 24, style, { lit: opts.lit });
    const doorW = 26, doorH = 40;
    doorUnit(ctx, Math.round(x + w / 2 - doorW / 2), y + h - doorH - 10, doorW, doorH, style,
             { open: opts.door !== 'shut', lit: opts.lit });

    // ---- a lamp by the door, and a flower box under a window
    const lampX = Math.round(x + w / 2 + doorW / 2 + 10);
    rect(ctx, lampX, y + h - 34, 2, 20, RAMPS.iron[2]);
    rect(ctx, lampX - 3, y + h - 40, 8, 7, RAMPS.iron[1]);
    glass(ctx, lampX - 2, y + h - 39, 6, 5, RAMPS.glass, { lit: '#f7cc55' });
    rect(ctx, x + 14, winY + 27, 38, 6, RAMPS.walnut[2]);
    rect(ctx, x + 14, winY + 27, 38, 1, RAMPS.walnut[4]);
    const rng = noise(5);
    for (let i = 0; i < 9; i++) {
      px(ctx, x + 16 + i * 4, winY + 26 - ((rng() * 2) | 0), i % 2 ? '#e8626f' : '#f7cc55');
      px(ctx, x + 17 + i * 4, winY + 27, RAMPS.leafB[2]);
    }
  });
}

/**
 * The same house from above: roof, ridge, chimney, and a cast shadow. This is
 * what you see when you arrive at a customer's place.
 */
/**
 * A building as you meet it in the world: three-quarter view, so you see the
 * roof tilting away from you AND the front wall with its door. A flat overhead
 * roof reads as siding; this reads as a house immediately.
 */
export function houseTop(style = 'cottage', opts = {}) {
  const wallW = opts.w || 118;
  const wallH = opts.wallH || 54;
  const roofH = opts.roofH || 46;
  const st = STYLES[style] || STYLES.cottage;
  const eavesOver = 12;
  const totalW = wallW + eavesOver * 2 + 12;
  const totalH = roofH + wallH + 30;
  const key = `houseTop:${style}:${wallW}:${wallH}:${roofH}:${opts.lit ? 1 : 0}:${opts.sign || ''}`;
  return sprite(key, totalW, totalH, (ctx) => {
    const cx = Math.round(totalW / 2);
    const roofTop = 10;
    const eavesY = roofTop + roofH;
    const wallY = eavesY + 4;
    const wallX = Math.round(cx - wallW / 2);
    const ridgeHalf = Math.round(wallW * 0.3);
    const eavesHalf = Math.round(wallW / 2 + eavesOver);

    // ---- the shadow the building throws on the ground, down and right
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#1b1424';
    for (let i = 0; i < 14; i++) {
      rect(ctx, wallX + 8 + i, wallY + wallH + i, wallW - 4, 1, '#1b1424');
    }
    ctx.globalAlpha = 1;

    // ---- the roof: a trapezoid, courses parallel to the eaves and tightening
    // toward the ridge, darkening as the surface turns away
    const rows = [];
    let pos = 0;
    while (pos < roofH) {
      const k = pos / roofH;
      const step = Math.max(3, Math.round(9 - 6 * Math.pow(k, 0.7)));
      rows.push([pos, Math.min(roofH, pos + step)]);
      pos += step;
    }
    const rng = noise(101);
    for (let i = rows.length - 1; i >= 0; i--) {
      const [a, b] = rows[i];
      const kA = 1 - a / roofH;                       // 1 at the eaves
      const halfA = Math.round(ridgeHalf + (eavesHalf - ridgeHalf) * Math.pow(1 - a / roofH, 0.85));
      const halfB = Math.round(ridgeHalf + (eavesHalf - ridgeHalf) * Math.pow(1 - b / roofH, 0.85));
      const py = roofTop + a;
      const rh = b - a;
      const shade = 0.42 * (1 - kA);
      const tone = (t) => mix(t, '#26304f', shade);
      // each course is a horizontal band, its width interpolated down the slope
      for (let yy = 0; yy < rh; yy++) {
        const t = yy / Math.max(1, rh);
        const half = Math.round(halfA + (halfB - halfA) * t);
        const face = rng() > 0.65 ? st.roof[3] : rng() > 0.3 ? st.roof[2] : st.roof[1];
        rect(ctx, cx - half, py + yy, half * 2, 1, tone(yy === 0 ? mix(face, st.roof[4], 0.5)
                                                     : yy === rh - 1 ? st.roof[0] : face));
        // the rake board, followed pixel row by pixel row so the sloping edge
        // stays smooth instead of stepping once per course
        rect(ctx, cx - half - 1, py + yy, 2, 1, tone(st.trim[1]));
        rect(ctx, cx + half - 1, py + yy, 2, 1, tone(st.trim[1]));
        px(ctx, cx - half - 1, py + yy, tone(st.trim[3]));
      }
      // tile joints, sparse and staggered
      const tileW = 11;
      const off = (i % 3) * 4;
      for (let tx = cx - halfA + off; tx < cx + halfA; tx += tileW) {
        if (rng() > 0.5) continue;
        rect(ctx, Math.round(tx), py + 1, 1, Math.max(1, rh - 2), tone(mix(st.roof[1], st.roof[0], 0.6)));
      }
      // moss creeping up from the eaves
      if (kA > 0.65 && rng() > 0.55) {
        speck(ctx, cx - halfA + rng() * (halfA * 2 - 10), py, 9, rh,
              [RAMPS.leafB[1], RAMPS.leafB[2]], 6, (py * 17) | 0);
      }
    }

    // ---- ridge cap along the top
    ridgeCap(ctx, cx - ridgeHalf - 2, roofTop - 3, ridgeHalf * 2 + 4, st.roof, { tileW: 8, h: 4 });
    rect(ctx, cx - ridgeHalf - 2, roofTop - 4, ridgeHalf * 2 + 4, 1, mix(st.roof[4], '#ffffff', 0.4));

    // ---- chimney, standing behind the ridge
    const chX = cx + Math.round(ridgeHalf * 0.45);
    brick(ctx, chX, roofTop - 20, 15, 24, RAMPS.brick, { bh: 4, bw: 8, seed: 11 });
    rect(ctx, chX - 2, roofTop - 23, 19, 4, RAMPS.stone[2]);
    rect(ctx, chX - 2, roofTop - 23, 19, 1, RAMPS.stone[4]);
    rect(ctx, chX + 4, roofTop - 19, 8, 4, '#161018');
    ao(ctx, chX, roofTop - 20, 15, 24, RAMPS.brick[0], 2);

    // ---- fascia along the eaves, and the shadow it drops on the wall
    rect(ctx, cx - eavesHalf, eavesY, eavesHalf * 2, 5, st.trim[1]);
    rect(ctx, cx - eavesHalf, eavesY, eavesHalf * 2, 1, st.trim[3]);
    rect(ctx, cx - eavesHalf, eavesY + 5, eavesHalf * 2, 1, st.trim[0]);
    for (let rx = cx - eavesHalf + 5; rx < cx + eavesHalf - 4; rx += 13) {
      rect(ctx, rx, eavesY + 6, 3, 3, st.trim[1]);      // rafter tails
      px(ctx, rx, eavesY + 6, st.trim[3]);
    }

    // ---- the front wall
    plankWall(ctx, wallX, wallY, wallW, wallH, st.wall, { step: 12, dir: 'v' });
    ctx.globalAlpha = 0.4;
    rect(ctx, wallX, wallY, wallW, 5, '#1b1424');       // under-eaves shadow
    ctx.globalAlpha = 1;
    plank(ctx, wallX - 4, wallY, 6, wallH, st.trim, { dir: 'v', knots: 0 });
    plank(ctx, wallX + wallW - 2, wallY, 6, wallH, st.trim, { dir: 'v', knots: 0 });

    // ---- windows either side of the door
    const winY = wallY + 14;
    windowUnit(ctx, wallX + 12, winY, 26, 20, style, { lit: opts.lit });
    windowUnit(ctx, wallX + wallW - 38, winY, 26, 20, style, { lit: opts.lit });
    // flower boxes on the sills
    for (const bx of [wallX + 8, wallX + wallW - 42]) {
      rect(ctx, bx, winY + 25, 34, 6, RAMPS.walnut[2]);
      rect(ctx, bx, winY + 25, 34, 1, RAMPS.walnut[4]);
      rect(ctx, bx, winY + 30, 34, 1, RAMPS.walnut[0]);
      const fr = noise(bx | 0);
      for (let i = 0; i < 8; i++) {
        px(ctx, bx + 3 + i * 4, winY + 24 - ((fr() * 2) | 0), i % 2 ? '#e8626f' : '#f7cc55');
        px(ctx, bx + 4 + i * 4, winY + 25, RAMPS.leafB[2]);
      }
    }

    // ---- the door, dead centre, standing open with the room warm behind it
    const doorW = 26, doorH = 36;
    const doorX = Math.round(cx - doorW / 2);
    doorUnit(ctx, doorX, wallY + wallH - doorH, doorW, doorH, style,
             { open: opts.open !== false, lit: opts.lit });

    // ---- footing and step
    stonework(ctx, wallX - 4, wallY + wallH, wallW + 8, 7, RAMPS.stone, { seed: 3 });
    rect(ctx, doorX - 6, wallY + wallH + 6, doorW + 12, 4, RAMPS.stone[3]);
    rect(ctx, doorX - 6, wallY + wallH + 6, doorW + 12, 1, RAMPS.stone[4]);
    cloth(ctx, doorX + 1, wallY + wallH + 10, doorW - 2, 4, RAMPS.cloth, {});

    // ---- a lamp beside the door, lit
    const lampX = doorX + doorW + 8;
    rect(ctx, lampX, wallY + wallH - 30, 2, 22, RAMPS.iron[2]);
    rect(ctx, lampX - 4, wallY + wallH - 36, 10, 7, RAMPS.iron[1]);
    rect(ctx, lampX - 4, wallY + wallH - 36, 10, 1, RAMPS.iron[3]);
    glass(ctx, lampX - 3, wallY + wallH - 35, 8, 6, RAMPS.glass, { lit: '#f7cc55' });
    ctx.globalAlpha = 0.12;
    disc(ctx, lampX + 1, wallY + wallH - 32, 20, '#f7cc55');
    ctx.globalAlpha = 1;

    // ---- a hanging trade sign, if this place is a shop
    if (opts.sign) {
      const sx = wallX + 4;
      rect(ctx, sx, wallY + 8, 14, 2, RAMPS.iron[2]);
      rect(ctx, sx + 12, wallY + 10, 2, 5, RAMPS.iron[2]);
      plank(ctx, sx + 2, wallY + 15, 24, 12, RAMPS.oak, { dir: 'h', knots: 0 });
      boxFrame(ctx, sx + 2, wallY + 15, 24, 12, RAMPS.walnut[1]);
    }
  });
}

/** A stretch of paling fence, side-on. */
export function fenceSide(len = 60) {
  return sprite(`fenceSide:${len}`, len, 24, (ctx) => {
    const r = RAMPS.walnut;
    for (let i = 0; i < len; i += 8) {
      plank(ctx, i, 4, 5, 18, r, { dir: 'v', knots: 0, seed: 13 + i });
      px(ctx, i + 2, 3, r[3]);
    }
    plank(ctx, 0, 8, len, 3, r, { dir: 'h', knots: 0 });
    plank(ctx, 0, 16, len, 3, r, { dir: 'h', knots: 0 });
  });
}

/** The same fence from above: posts, rails, and their shadow. */
export function fenceTop(len = 60) {
  return sprite(`fenceTop:${len}`, len, 12, (ctx) => {
    const r = RAMPS.walnut;
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = '#1b1424';
    ctx.fillRect(3, 6, len - 3, 4);
    ctx.globalAlpha = 1;
    plank(ctx, 0, 2, len, 4, r, { dir: 'h', knots: 0 });
    for (let i = 0; i < len; i += 14) {
      rect(ctx, i, 0, 5, 8, r[2]);
      rect(ctx, i, 0, 5, 1, r[4]);
      rect(ctx, i + 4, 0, 1, 8, r[0]);
    }
  });
}

/** A vegetable bed for the yards: tilled rows with crops coming up. */
export function gardenBed(w = 56, h = 34, crop = 'leaf') {
  return sprite(`garden:${w}:${h}:${crop}`, w, h, (ctx) => {
    const d = RAMPS.soil;
    rect(ctx, 0, 0, w, h, d[2]);
    for (let y = 2; y < h; y += 6) {
      rect(ctx, 0, y, w, 3, d[1]);
      rect(ctx, 0, y, w, 1, d[3]);
      speck(ctx, 0, y, w, 3, [d[0], d[3]], w >> 1, y * 7);
    }
    boxFrame(ctx, 0, 0, w, h, RAMPS.walnut[1]);
    const rng = noise(19);
    for (let y = 3; y < h - 2; y += 6) {
      for (let x = 4; x < w - 3; x += 9) {
        const tone = crop === 'flower' ? ['#e8626f', '#f7cc55', '#a97ee0'][(rng() * 3) | 0] : RAMPS.leafC[3];
        px(ctx, x, y, RAMPS.leafB[2]);
        px(ctx, x - 1, y - 1, tone);
        px(ctx, x + 1, y - 1, tone);
        px(ctx, x, y - 2, crop === 'flower' ? tone : RAMPS.leafC[4]);
      }
    }
  });
}

/** A well: stone drum, timber frame, bucket on a rope. */
export function wellTop() {
  return sprite('wellTop', 34, 40, (ctx) => {
    contact(ctx, 17, 37, 14, 3, 0.3);
    stonework(ctx, 3, 10, 28, 22, RAMPS.stone, { seed: 7 });
    // the mouth, dark, with water glinting at the bottom
    ctx.fillStyle = '#141a24';
    for (let y = -6; y <= 6; y++) {
      const span = Math.round(11 * Math.sqrt(Math.max(0, 1 - (y * y) / 36)));
      ctx.fillRect(17 - span, 19 + y, span * 2, 1);
    }
    for (let i = 0; i < 6; i++) px(ctx, 12 + i * 2, 21 + (i % 2), RAMPS.water[3]);
    // frame and roof
    plank(ctx, 4, 0, 4, 14, RAMPS.walnut, { dir: 'v', knots: 0 });
    plank(ctx, 26, 0, 4, 14, RAMPS.walnut, { dir: 'v', knots: 0 });
    shingles(ctx, 0, -2, 34, 8, RAMPS.shingle, { rowH: 4, tileW: 7, seed: 3 });
    rect(ctx, 14, 4, 6, 5, RAMPS.walnut[1]);
    line(ctx, 17, 8, 17, 15, RAMPS.linen[1]);
    rect(ctx, 14, 14, 7, 5, RAMPS.iron[2]);
    rect(ctx, 14, 14, 7, 1, RAMPS.iron[4]);
  });
}

/** A hand-painted sign on a post. */
export function signPost(label = 'SHOP') {
  return sprite(`sign:${label}`, 56, 34, (ctx) => {
    contact(ctx, 28, 33, 8, 2, 0.28);
    plank(ctx, 26, 10, 4, 23, RAMPS.walnut, { dir: 'v', knots: 0 });
    plank(ctx, 4, 2, 48, 14, RAMPS.oak, { dir: 'h', knots: 1 });
    boxFrame(ctx, 4, 2, 48, 14, RAMPS.walnut[1]);
    rect(ctx, 6, 4, 44, 1, RAMPS.oak[4]);
  });
}
