// Buildings, in both views. A cabin is a stone footing, a plank wall with
// visible grain, framed windows with mullions and curtains, a shingled roof
// with a ridge and an eaves shadow, and a chimney laid in courses. The same
// house is available from above for the scenes played that way, where the roof
// is the whole silhouette and the shadow tells you it has height.

import { sprite, px, rect, disc, line, frame as boxFrame } from './pixel.js';
import { RAMPS, ramp, mix, noise, speck, ao, rim, contact, ridgeCap, roofField,
         plankWall, shingles, brick, stonework, glass, plank, cloth, metal } from './paint.js';
import * as PROP from './props.js';

const STYLES = {
  workshop:  { wall: RAMPS.oak,          roof: ramp('#a8493a'), trim: RAMPS.walnut,
               paint: '#2f7ab0', door: '#c0392b', curtain: '#e8b04a' },
  bakery:    { wall: ramp('#f0dcb0'),    roof: ramp('#c05a3a'), trim: RAMPS.oak,
               paint: '#d8763c', door: '#3f7a86', curtain: '#e8a33c' },
  forge:     { wall: ramp('#8b929c'),    roof: ramp('#4a5560'), trim: RAMPS.iron,
               paint: '#c0392b', door: '#3f4650', curtain: '#8a929c' },
  cottage:   { wall: ramp('#e8d8a8'),    roof: ramp('#c2a35c'), trim: RAMPS.walnut,
               paint: '#4f8be8', door: '#3f8f6a', curtain: '#4f8be8' },
  mill:      { wall: ramp('#d8b878'),    roof: ramp('#8a5a3a'), trim: RAMPS.walnut,
               paint: '#e0a92c', door: '#8a4a2a', curtain: '#f2c14e' },
  riverside: { wall: ramp('#9fbe86'),    roof: ramp('#4f7a5a'), trim: RAMPS.walnut,
               paint: '#2f7ab0', door: '#c05a3a', curtain: '#3f8fc4' },
};

export const HOUSE_STYLES = Object.keys(STYLES);

/**
 * A window: a painted frame, shutters pinned back against the wall, glass with a
 * sheen, and a box of flowers on the sill. The paint is where the colour comes
 * from - the wall stays wood, the joinery is bright.
 */
export function windowUnit(ctx, x, y, w, h, style, opts = {}) {
  const st = STYLES[style] || STYLES.workshop;
  const paint = ramp(st.paint);
  // shutters, folded back either side
  if (opts.shutters !== false) {
    for (const sx of [x - 9, x + w + 1]) {
      rect(ctx, sx, y - 1, 8, h + 2, paint[2]);
      rect(ctx, sx, y - 1, 8, 1, paint[4]);
      rect(ctx, sx, y + h, 8, 1, paint[0]);
      for (let sy = y + 1; sy < y + h; sy += 3) rect(ctx, sx + 1, sy, 6, 1, paint[1]);
      rect(ctx, sx + (sx < x ? 7 : 0), y - 1, 1, h + 2, paint[0]);
    }
  }
  // the opening, recessed
  rect(ctx, x - 1, y - 1, w + 2, h + 2, mix(st.trim[0], '#000000', 0.2));
  glass(ctx, x, y, w, h, RAMPS.glass, { lit: opts.lit ? '#f8d777' : null });
  if (opts.lit) {
    // a warm glow and the shape of a room behind the glass
    rect(ctx, x, y + h - Math.max(2, h >> 2), w, Math.max(2, h >> 2), '#e8a33c');
    rect(ctx, x + 2, y + 2, Math.max(2, w >> 3), Math.max(2, h >> 3), '#fff3c4');
  }
  // curtains, drawn back
  cloth(ctx, x, y, Math.max(2, w >> 3), h, ramp(st.curtain), { fold: 0.5 });
  cloth(ctx, x + w - Math.max(2, w >> 3), y, Math.max(2, w >> 3), h, ramp(st.curtain), { fold: 0.5 });
  // glazing bars
  rect(ctx, x + (w >> 1) - 1, y, 2, h, paint[3]);
  rect(ctx, x, y + (h >> 1) - 1, w, 2, paint[3]);
  // painted frame with a lit top and a sill that catches the sun
  boxFrame(ctx, x - 2, y - 2, w + 4, h + 4, paint[2]);
  rect(ctx, x - 2, y - 2, w + 4, 1, paint[4]);
  boxFrame(ctx, x - 3, y - 3, w + 6, h + 6, mix(paint[0], '#000000', 0.15));
  rect(ctx, x - 5, y + h + 2, w + 10, 3, st.trim[2]);
  rect(ctx, x - 5, y + h + 2, w + 10, 1, st.trim[4]);
  rect(ctx, x - 5, y + h + 5, w + 10, 1, mix(st.trim[0], '#000000', 0.3));
  // the flower box
  if (opts.box !== false && w >= 20) {
    const bx = x - 4, bw = w + 8;
    rect(ctx, bx, y + h + 6, bw, 6, st.trim[1]);
    rect(ctx, bx, y + h + 6, bw, 1, st.trim[3]);
    rect(ctx, bx, y + h + 11, bw, 1, mix(st.trim[0], '#000000', 0.3));
    const rng = noise(x * 7 + y);
    for (let i = 2; i < bw - 2; i += 3) {
      const t = rng();
      px(ctx, bx + i, y + h + 5 - ((rng() * 2) | 0), t > 0.66 ? '#e8626f' : t > 0.33 ? '#f7cc55' : '#e08bab');
      px(ctx, bx + i + 1, y + h + 6, RAMPS.leafB[2]);
      if (t > 0.8) px(ctx, bx + i, y + h + 4, '#ffffff');
    }
  }
}

/** A painted plank door with a little window, hinges, a latch and a step. */
export function doorUnit(ctx, x, y, w, h, style, opts = {}) {
  const st = STYLES[style] || STYLES.workshop;
  const paint = ramp(st.door);
  rect(ctx, x - 1, y - 1, w + 2, h + 1, mix(st.trim[0], '#000000', 0.3));
  if (opts.open) {
    // the room beyond: dark up top, warm at the floor
    for (let i = 0; i < h; i++) {
      const t = i / h;
      const tone = opts.lit ? mix('#2a1a12', '#f0b45a', Math.pow(t, 1.5))
                            : mix('#1d130e', '#5a3a24', Math.pow(t, 1.4));
      rect(ctx, x, y + i, w, 1, tone);
    }
    // floorboards inside, running away
    for (let i = 0; i < 4; i++) {
      rect(ctx, x + i, y + h - 2 - i * 3, w - i * 2, 1, opts.lit ? '#d8a05c' : '#4a3020');
    }
    if (opts.lit) {
      // a chair leg, a table edge, a rug - enough to be a room
      rect(ctx, x + 4, y + h - 15, 2, 9, '#6b4423');
      rect(ctx, x + w - 10, y + h - 19, 7, 2, '#6b4423');
      rect(ctx, x + 3, y + h - 6, w - 6, 3, '#a8404a');
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 7; i++) rect(ctx, x - i, y + h + i, w + i * 2, 1, '#fff3c4');
      ctx.globalAlpha = 1;
    }
    // the door itself, swung back against the wall
    rect(ctx, x + w + 1, y + 2, 6, h - 2, paint[2]);
    rect(ctx, x + w + 1, y + 2, 6, 1, paint[4]);
    rect(ctx, x + w + 6, y + 2, 1, h - 2, paint[0]);
  } else {
    // painted boards, a top window, and hardware
    rect(ctx, x, y, w, h, paint[2]);
    for (let bx = x + 1; bx < x + w; bx += 7) {
      rect(ctx, bx, y, 1, h, paint[1]);
      rect(ctx, bx + 1, y, 1, h, paint[3]);
    }
    rect(ctx, x, y, w, 1, paint[4]);
    rect(ctx, x, y + h - 1, w, 1, paint[0]);
    glass(ctx, x + 4, y + 4, w - 8, Math.max(4, h >> 3), RAMPS.glass, { lit: opts.lit ? '#f8d777' : null });
    boxFrame(ctx, x + 3, y + 3, w - 6, Math.max(6, (h >> 3) + 2), paint[0]);
    for (const hy of [y + 6, y + h - 8]) metal(ctx, x + 1, hy, Math.max(4, w >> 2), 2, RAMPS.iron);
    disc(ctx, x + w - 5, y + (h >> 1), 1, RAMPS.brass[3]);
    px(ctx, x + w - 5, y + (h >> 1) - 1, RAMPS.brass[4]);
    // a wreath, because somebody lives here
    if (opts.wreath) {
      for (let a = 0; a < 14; a++) {
        const ang = (a / 14) * Math.PI * 2;
        px(ctx, Math.round(x + w / 2 + Math.cos(ang) * 5), Math.round(y + h * 0.42 + Math.sin(ang) * 5),
           a % 3 ? RAMPS.leafB[2] : RAMPS.leafB[3]);
      }
      px(ctx, Math.round(x + w / 2), Math.round(y + h * 0.42 - 5), '#e8626f');
    }
  }
  boxFrame(ctx, x - 2, y - 1, w + 4, h + 1, st.trim[2]);
  rect(ctx, x - 3, y - 4, w + 6, 4, st.trim[1]);
  rect(ctx, x - 3, y - 4, w + 6, 1, st.trim[3]);
  stonework(ctx, x - 5, y + h, w + 10, 4, RAMPS.stone, { seed: 8 });
}

/**
 * A cabin seen side-on: stone footing, boarded wall, a porch with posts and a
 * bench, painted joinery, and a shingled roof with a chunky ridge. Bold shapes
 * and colour do the work here, not fine texture.
 */
export function cabinSide(style = 'workshop', opts = {}) {
  const w = opts.w || 158, h = opts.h || 112;
  const st = STYLES[style] || STYLES.workshop;
  const key = `cabin2:${style}:${w}:${h}:${opts.lit ? 1 : 0}:${opts.door || 'open'}`;
  return sprite(key, w + 40, h + 16, (ctx) => {
    const x = 20, y = 8;
    const roofH = Math.round(h * 0.32);
    const wallY = y + roofH;
    const wallH = h - roofH;
    const cx = x + w / 2;
    const eaves = 16;

    contact(ctx, cx, y + h + 4, Math.round(w * 0.56), 5, 0.3);

    // ---- footing
    stonework(ctx, x - 3, y + h - 14, w + 6, 15, RAMPS.stone, { seed: 13 });
    rect(ctx, x - 3, y + h - 14, w + 6, 1, RAMPS.stone[4]);

    // ---- wall
    plankWall(ctx, x, wallY, w, wallH - 13, st.wall, { step: 20, dir: 'v' });
    ctx.globalAlpha = 0.32;
    rect(ctx, x, wallY, w, 8, '#1b1424');            // shadow under the eaves
    ctx.globalAlpha = 1;
    plank(ctx, x - 4, wallY, 7, wallH - 13, st.trim, { dir: 'v', knots: 0 });
    plank(ctx, x + w - 3, wallY, 7, wallH - 13, st.trim, { dir: 'v', knots: 0 });
    plank(ctx, x - 5, wallY + Math.round((wallH - 13) * 0.55), w + 10, 5, st.trim,
          { dir: 'h', knots: 1 });

    // ---- roof: a bold gable, few courses, strong ridge
    const rows = Math.max(3, Math.round(roofH / 9));
    const ridgeHalf = 11;
    const eavesHalf = w / 2 + eaves;
    for (let i = 0; i < rows; i++) {
      const kA = i / rows, kB = (i + 1) / rows;
      const halfA = Math.round(ridgeHalf + (eavesHalf - ridgeHalf) * Math.pow(kA, 0.9));
      const halfB = Math.round(ridgeHalf + (eavesHalf - ridgeHalf) * Math.pow(kB, 0.9));
      const py = y + 3 + Math.round(kA * roofH);
      const rh = Math.max(2, Math.round((kB - kA) * roofH));
      for (let yy = 0; yy < rh; yy++) {
        const half = Math.round(halfA + (halfB - halfA) * (yy / rh));
        const tone = yy === 0 ? st.roof[3] : yy === rh - 1 ? st.roof[0] : st.roof[2];
        rect(ctx, cx - half, py + yy, half * 2, 1, tone);
        rect(ctx, cx - half - 1, py + yy, 2, 1, st.trim[1]);
        rect(ctx, cx + half - 1, py + yy, 2, 1, st.trim[1]);
      }
      // tile joints, sparse - a roof, not a brick wall
      for (let tx = cx - halfA + (i % 2) * 9; tx < cx + halfA; tx += 18) {
        rect(ctx, Math.round(tx), py + 1, 1, Math.max(1, rh - 2), st.roof[1]);
      }
    }
    ridgeCap(ctx, Math.round(cx - ridgeHalf - 3), y - 1, ridgeHalf * 2 + 6, st.roof, { tileW: 7, h: 5 });
    rect(ctx, Math.round(cx - ridgeHalf - 3), y - 2, ridgeHalf * 2 + 6, 1,
         mix(st.roof[4], '#ffffff', 0.4));
    // fascia, painted
    const paint = ramp(st.paint);
    rect(ctx, Math.round(cx - eavesHalf), wallY - 5, eavesHalf * 2, 6, paint[2]);
    rect(ctx, Math.round(cx - eavesHalf), wallY - 5, eavesHalf * 2, 1, paint[4]);
    rect(ctx, Math.round(cx - eavesHalf), wallY + 1, eavesHalf * 2, 1, paint[0]);

    // ---- chimney with smoke stains
    const chX = x + Math.round(w * 0.62);
    brick(ctx, chX, y - 6, 20, roofH + 18, RAMPS.brick, { bh: 5, bw: 10, seed: 21 });
    rect(ctx, chX - 3, y - 10, 26, 5, RAMPS.stone[2]);
    rect(ctx, chX - 3, y - 10, 26, 1, RAMPS.stone[4]);
    ao(ctx, chX, y - 6, 20, roofH + 18, RAMPS.brick[0], 2);

    // ---- windows and door, with a porch over the door
    const winY = wallY + 24;
    windowUnit(ctx, x + 16, winY, 28, 22, style, { lit: opts.lit });
    windowUnit(ctx, x + w - 56, winY, 28, 22, style, { lit: opts.lit });
    const doorW = 30, doorH = 44;
    const doorX = Math.round(cx - doorW / 2);
    doorUnit(ctx, doorX, y + h - doorH - 12, doorW, doorH, style,
             { open: opts.door !== 'shut', lit: opts.lit, wreath: true });
    // ---- decoration, only where it cannot collide with the joinery: props sit
    // on the footing to left and right, and the lantern hangs beside the door
    ctx.drawImage(PROP.lantern(true), doorX + doorW + 6, y + h - 52);
    ctx.drawImage(PROP.barrel('closed'), x + 4, y + h - 40);
    ctx.drawImage(PROP.bucket(true), x + 28, y + h - 30);
    ctx.drawImage(PROP.firewood(30, 20), x + w - 40, y + h - 34);
    ctx.drawImage(PROP.pottedPlant(0), x + w - 66, y + h - 38);
    ctx.drawImage(PROP.pottedPlant(2), doorX - 26, y + h - 38);
    // a mat at the door, and boot prints on the step
    cloth(ctx, doorX + 3, y + h - 11, doorW - 6, 5, RAMPS.cloth, {});
    // ivy climbing the near corner
    const rng = noise(77);
    for (let i = 0; i < 70; i++) {
      const iy = wallY + 8 + rng() * (wallH - 30);
      const ix = x + 1 + rng() * 14 * (1 - (iy - wallY) / wallH);
      px(ctx, Math.round(ix), Math.round(iy), rng() > 0.5 ? RAMPS.leafB[1] : RAMPS.leafB[2]);
      if (rng() > 0.68) px(ctx, Math.round(ix) + 1, Math.round(iy) - 1, RAMPS.leafB[3]);
    }
    // a swallow's nest under the eaves, because detail should tell you something
    disc(ctx, x + Math.round(w * 0.28), wallY + 6, 4, RAMPS.dirt[1]);
    disc(ctx, x + Math.round(w * 0.28), wallY + 5, 3, RAMPS.dirt[2]);
  });
}

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
