// The opening film. Sixteen shots, each with a framing, a camera move and a
// transition out of it: wide establishing shots that push in, close-ups on
// handheld, a dolly down the hallway, an insert on the dial pad, and a comic
// impact frame on the crash with a burst, a shout balloon and a tilted camera.
//
// Sets are painted at full frame into a buffer; the camera crops that buffer, so
// a push is a real optical move rather than sprites growing. Actors are the
// game's own sprite bank, animated on the same cycles they use in play.

import { VIEW_W, VIEW_H } from '../config.js';
import { PAL, surface, rect, frame as boxFrame, px, disc, line, text, textWidth, bigText,
         wrap, rngFrom } from '../gfx/pixel.js';
import { RAMPS, ramp, mix, noise, speck, ao, rim, contact, plank, plankWall, cloth, metal,
         glass, brick, stonework, shingles, soilBand, turf } from '../gfx/paint.js';
import * as N from '../gfx/nature.js';
import * as B from '../gfx/structures.js';
import { hero, elder, granny, foxMedic, SUN } from '../gfx/actors.js';
import { pressed, input } from '../input.js';
import { sfx } from '../audio.js';
import { ease, tween, renderShot, letterbox, inset, speedLines, impactBurst, shout, flash,
         wipe, filmGrain, caption, titleCard } from './camera.js';

export const cut = {
  active: false, script: null, shot: 0, t: 0, bars: 0, onEnd: null,
  lineIndex: -1, lineT: 0, shake: 0, flash: 0, ended: false, endT: 0, inT: 0,
};

// ------------------------------------------------------------------ actors
const tintCache = new Map();

function silhouette(img, colour) {
  const key = `${img.width}x${img.height}:${colour}:${img.__sid || (img.__sid = tintCache.size)}`;
  let found = tintCache.get(key);
  if (found) return found;
  const s = surface(img.width, img.height);
  s.ctx.drawImage(img, 0, 0);
  s.ctx.globalCompositeOperation = 'source-in';
  s.ctx.fillStyle = colour;
  s.ctx.fillRect(0, 0, img.width, img.height);
  if (tintCache.size > 60) tintCache.clear();
  tintCache.set(key, s.canvas);
  return s.canvas;
}

/** Put a sprite on the stage, standing on (x, base), scaled up whole. */
function put(ctx, img, x, base, scale = 2, face = 1, tone = null) {
  const src = tone ? silhouette(img, tone) : img;
  const w = img.width * scale, h = img.height * scale;
  const dx = Math.round(x - w / 2), dy = Math.round(base - h);
  ctx.save();
  if (face < 0) {
    ctx.translate(dx + w, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0, img.width, img.height, 0, 0, w, h);
  } else {
    ctx.drawImage(src, 0, 0, img.width, img.height, dx, dy, w, h);
  }
  ctx.restore();
}

const cycle = (t, rate) => Math.floor(t * rate) % 4;

// -------------------------------------------------------------------- sets
const FLOOR = 168;

/** The living room: panelled walls, boards, a rug, the window, the television. */
function setLiving(ctx, u, t, opts = {}) {
  plankWall(ctx, 0, 0, VIEW_W, FLOOR, ramp('#7c5233'), { step: 26, dir: 'v' });
  ctx.globalAlpha = 0.3;
  rect(ctx, 0, 0, VIEW_W, 26, '#1b1424');
  ctx.globalAlpha = 1;
  // dado rail and skirting
  plank(ctx, 0, FLOOR - 30, VIEW_W, 5, RAMPS.walnut, { dir: 'h', knots: 1 });
  plank(ctx, 0, FLOOR - 6, VIEW_W, 7, RAMPS.walnut, { dir: 'h', knots: 0 });
  // floorboards running away from us
  for (let i = 0; i < 9; i++) {
    plank(ctx, -20, FLOOR + i * 12, VIEW_W + 40, 12, RAMPS.pine, { dir: 'h', seed: 40 + i, knots: i % 3 === 0 ? 1 : 0 });
  }
  // rug, woven
  cloth(ctx, 96, FLOOR + 14, 270, 46, ramp('#a8404a'), { fold: 0 });
  boxFrame(ctx, 96, FLOOR + 14, 270, 46, PAL.paper2);
  boxFrame(ctx, 102, FLOOR + 20, 258, 34, 'rgba(255,255,255,0.3)');
  for (let i = 0; i < 6; i++) {
    const dx = 140 + i * 40;
    for (let k = 0; k < 5; k++) {
      px(ctx, dx + k - 2, FLOOR + 36 + Math.abs(k - 2), PAL.paper2);
      px(ctx, dx + k - 2, FLOOR + 38 - Math.abs(k - 2), PAL.paper2);
    }
  }
  for (let x = 96; x < 366; x += 3) {
    rect(ctx, x, FLOOR + 12, 1, 2, PAL.paper2);
    rect(ctx, x, FLOOR + 60, 1, 2, PAL.paper2);
  }

  // the window, rain running down the outside of it
  const wx = 26, wy = 28, ww = 66, wh = 74;
  rect(ctx, wx - 4, wy - 4, ww + 8, wh + 8, RAMPS.walnut[1]);
  rect(ctx, wx, wy, ww, wh, '#1b2340');
  for (let i = 0; i < 60; i++) {
    const rx = wx + ((i * 13) % ww);
    const ry = wy + ((i * 29 + t * 90) % wh);
    rect(ctx, rx, ry, 1, 3, '#5f86c4');
    px(ctx, rx, ry + 3, '#8fb6e0');
  }
  if (opts.storm && Math.sin(t * 1.7) > 0.984) {
    rect(ctx, wx, wy, ww, wh, '#c8dcf0');
  }
  rect(ctx, wx + ww / 2 - 1, wy, 2, wh, RAMPS.walnut[2]);
  rect(ctx, wx, wy + wh / 2 - 1, ww, 2, RAMPS.walnut[2]);
  boxFrame(ctx, wx - 4, wy - 4, ww + 8, wh + 8, RAMPS.walnut[2]);
  plank(ctx, wx - 8, wy + wh + 4, ww + 16, 5, RAMPS.walnut, { dir: 'h', knots: 0 });
  cloth(ctx, wx - 6, wy - 6, 14, wh + 10, ramp('#7a4a6a'), { fold: 0.4 });
  cloth(ctx, wx + ww - 8, wy - 6, 14, wh + 10, ramp('#7a4a6a'), { fold: 0.6 });

  // the shelf: a photograph of grandma, a plant, a clock
  plank(ctx, 372, 60, 92, 5, RAMPS.walnut, { dir: 'h', knots: 0 });
  plank(ctx, 396, 34, 28, 26, RAMPS.oak, { dir: 'v', knots: 0 });
  rect(ctx, 399, 37, 22, 20, PAL.paper2);
  put(ctx, granny('sit'), 410, 57, 1, 1);
  disc(ctx, 378, 52, 6, RAMPS.leafB[2]);
  disc(ctx, 376, 50, 4, RAMPS.leafB[3]);
  rect(ctx, 374, 54, 9, 7, '#a3583f');
  disc(ctx, 444, 48, 7, PAL.paper);
  disc(ctx, 444, 48, 6, PAL.white);
  line(ctx, 444, 48, 444, 43, PAL.ink);
  line(ctx, 444, 48, 447, 50, PAL.ink);

  // the television, and the light it throws
  const tx = 196, ty = 74, tw = 88, th = 62;
  const flick = 0.8 + Math.sin(t * 21) * 0.07;
  const g = ctx.createRadialGradient(tx + tw / 2, ty + th / 2, 16, tx + tw / 2, ty + th / 2, 210);
  g.addColorStop(0, `rgba(150, 210, 240, ${0.2 * flick})`);
  g.addColorStop(0.45, `rgba(150, 210, 240, ${0.07 * flick})`);
  g.addColorStop(1, 'rgba(150, 210, 240, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  plank(ctx, tx - 8, ty - 8, tw + 16, th + 22, RAMPS.walnut, { dir: 'h', knots: 1 });
  boxFrame(ctx, tx - 8, ty - 8, tw + 16, th + 22, RAMPS.walnut[0]);
  rect(ctx, tx - 6, ty + th + 8, 8, 14, RAMPS.walnut[1]);
  rect(ctx, tx + tw - 2, ty + th + 8, 8, 14, RAMPS.walnut[1]);
  if (opts.static) {
    const rng = rngFrom(Math.floor(t * 30));
    for (let sy = 0; sy < th; sy++) {
      for (let sx = 0; sx < tw; sx += 2) {
        const v = rng();
        px(ctx, tx + sx + (sy % 2), ty + sy, v > 0.62 ? PAL.paper : v > 0.3 ? PAL.stone2 : PAL.ink);
      }
    }
  } else {
    // a nature programme: hills, a lake, a heron crossing
    rect(ctx, tx, ty, tw, th, '#3f7a96');
    rect(ctx, tx, ty + 26, tw, th - 26, '#3f7a4a');
    rect(ctx, tx, ty + 38, tw, 12, '#3f8fc4');
    for (let i = 0; i < 4; i++) {
      const hx = tx + i * 24 - 8;
      for (let k = 0; k < 14; k++) rect(ctx, hx + k, ty + 26 - k / 2, 24 - k * 2, 1, '#2f6b3f');
    }
    const bird = Math.round((t * 20) % (tw + 24)) - 12;
    if (bird > 0 && bird < tw - 6) {
      const flap = Math.sin(t * 11) * 2.5;
      line(ctx, tx + bird, ty + 14, tx + bird + 4, ty + 14 - flap, PAL.ink);
      line(ctx, tx + bird + 4, ty + 14 - flap, tx + bird + 8, ty + 14, PAL.ink);
    }
    ctx.globalAlpha = 0.16;
    for (let sy = 0; sy < th; sy += 2) rect(ctx, tx, ty + sy, tw, 1, PAL.black);
    ctx.globalAlpha = 1;
  }
  glass(ctx, tx, ty, tw, 6, RAMPS.glass, {});
  boxFrame(ctx, tx, ty, tw, th, PAL.ink);
}

/** Grandpa's armchair, upholstered. */
function armchair(ctx, x, base) {
  const r = ramp('#7a557a');
  contact(ctx, x, base + 1, 34, 4, 0.3);
  cloth(ctx, x - 30, base - 50, 60, 50, r, { fold: 0 });
  cloth(ctx, x - 36, base - 32, 10, 32, r, { fold: 0.5 });
  cloth(ctx, x + 26, base - 32, 10, 32, r, { fold: 0.5 });
  cloth(ctx, x - 28, base - 18, 56, 10, ramp('#8f6a8f'), { fold: 0 });
  for (let i = 0; i < 5; i++) px(ctx, x - 18 + i * 9, base - 40, mix(r[4], '#ffffff', 0.2));
  plank(ctx, x - 26, base - 4, 6, 6, RAMPS.walnut, { dir: 'v', knots: 0 });
  plank(ctx, x + 20, base - 4, 6, 6, RAMPS.walnut, { dir: 'v', knots: 0 });
}

/** The kitchen: tiled splashback, cupboards, an iron stove, the kettle. */
function setKitchen(ctx, u, t) {
  const floorY = 146;
  rect(ctx, 0, 0, VIEW_W, floorY, '#9cbc90');
  for (let y = 0; y < floorY; y += 16) {
    rect(ctx, 0, y, VIEW_W, 1, '#88a87e');
    rect(ctx, 0, y + 1, VIEW_W, 1, '#a8c69c');
  }
  // tiles
  rect(ctx, 0, 74, VIEW_W, 34, '#e8e2d0');
  for (let x = 0; x < VIEW_W; x += 13) {
    rect(ctx, x, 74, 1, 34, '#c9c2ae');
    rect(ctx, x + 1, 74, 1, 34, '#f4f0e4');
  }
  for (let y = 74; y < 108; y += 11) rect(ctx, 0, y, VIEW_W, 1, '#c9c2ae');
  plank(ctx, 0, 108, VIEW_W, 4, RAMPS.walnut, { dir: 'h', knots: 0 });
  // the floor, in perspective: rows deepen toward us and the seams converge on
  // a vanishing point, which is what makes a flat fill read as a floor
  rect(ctx, 0, floorY, VIEW_W, VIEW_H - floorY, '#dcc39a');
  const vpx = 240;
  const rows = [];
  let fy = floorY, fstep = 5;
  while (fy < VIEW_H) { rows.push(fy); fy += fstep; fstep *= 1.32; }
  rows.push(VIEW_H);
  for (let i = 0; i < rows.length - 1; i++) {
    const y0 = rows[i], y1 = rows[i + 1];
    const k = (y0 - floorY) / (VIEW_H - floorY);
    // nearer rows are lighter, and every other row a shade off
    const tone = mix('#c9ac80', '#e8d0a6', k);
    rect(ctx, 0, y0, VIEW_W, y1 - y0, i % 2 ? tone : mix(tone, '#f0dcb4', 0.35));
    rect(ctx, 0, y0, VIEW_W, 1, mix(tone, '#a88c62', 0.6));
  }
  // converging seams
  for (let i = -8; i <= 8; i++) {
    const spread = i * 46;
    for (let y = floorY; y < VIEW_H; y++) {
      const k = (y - floorY) / (VIEW_H - floorY);
      const x = Math.round(vpx + spread * (0.25 + k * 1.5));
      if (x >= 0 && x < VIEW_W) px(ctx, x, y, 'rgba(150,120,80,0.45)');
    }
  }
  // a sheen where the light from the doorway falls
  ctx.globalAlpha = 0.08;
  rect(ctx, 300, floorY, 180, VIEW_H - floorY, '#fff0c0');
  ctx.globalAlpha = 1;
  // cupboard run
  plank(ctx, 250, 108, 230, 9, RAMPS.oak, { dir: 'h', knots: 1 });
  plankWall(ctx, 250, 117, 230, 30, RAMPS.oak, { step: 56, dir: 'v' });
  for (let i = 0; i < 4; i++) {
    const cx = 258 + i * 56;
    boxFrame(ctx, cx, 121, 46, 22, RAMPS.oak[0]);
    metal(ctx, cx + 18, 130, 10, 2, RAMPS.brass);
  }
  // open shelf with jars
  plank(ctx, 268, 58, 200, 4, RAMPS.oak, { dir: 'h', knots: 0 });
  for (let i = 0; i < 6; i++) {
    const jx = 276 + i * 32;
    glass(ctx, jx, 42, 15, 16, RAMPS.glass, {});
    rect(ctx, jx + 2, 48, 11, 9, i % 3 ? '#e8626f' : '#f2c14e');
    rect(ctx, jx, 40, 15, 3, RAMPS.metal[2]);
    contact(ctx, jx + 7, 59, 7, 1, 0.25);
  }
  // the stove: cast iron, a firebox with the coals in, a hot plate on top
  rect(ctx, 42, 100, 84, 48, '#232830');
  rect(ctx, 42, 100, 84, 5, '#4a525c');
  rect(ctx, 42, 104, 84, 2, '#5f6874');
  rect(ctx, 44, 106, 80, 40, '#2b3138');
  ao(ctx, 42, 100, 84, 48, '#0f1216', 2);
  // firebox door, glowing through the grate
  rect(ctx, 50, 114, 40, 26, '#191c22');
  boxFrame(ctx, 50, 114, 40, 26, '#5f6874');
  rect(ctx, 53, 117, 34, 20, '#3a1a10');
  for (let i = 0; i < 5; i++) {
    const gy = 119 + i * 4;
    rect(ctx, 54, gy, 32, 2, i % 2 ? '#e8781a' : '#c85a18');
    if (i === 2) rect(ctx, 54, gy, 32, 1, '#f7cc55');
  }
  ctx.globalAlpha = 0.2;
  for (let k = 1; k <= 3; k++) disc(ctx, 70, 128, 10 + k * 7, '#f0a13c');
  ctx.globalAlpha = 1;
  metal(ctx, 96, 112, 24, 8, RAMPS.iron);
  rect(ctx, 96, 138, 26, 8, '#191c22');
  for (const ly of [124, 132]) rect(ctx, 98, ly, 20, 2, '#4a525c');
  disc(ctx, 100, 124, 8, '#1d2228');
  disc(ctx, 100, 124, 5, Math.floor(t * 3) % 2 ? '#e8626f' : '#f0a13c');
  ctx.globalAlpha = 0.16;
  for (let i = 1; i <= 3; i++) disc(ctx, 100, 124, 7 + i * 6, '#f0a13c');
  ctx.globalAlpha = 1;
  metal(ctx, 58, 92, 22, 13, RAMPS.metal);
  rect(ctx, 62, 86, 12, 7, RAMPS.metal[2]);
  rect(ctx, 78, 90, 6, 2, RAMPS.metal[4]);
  for (let i = 0; i < 5; i++) {
    const sy = 82 - ((t * 15 + i * 7) % 30);
    ctx.globalAlpha = Math.max(0, 0.55 - i * 0.1);
    disc(ctx, 68 + Math.round(Math.sin(sy * 0.24) * 5), Math.round(sy), 2 + i, PAL.paper2);
    ctx.globalAlpha = 1;
  }
}

/** Extreme close-up: the wall telephone. */
function setPhone(ctx, u, t) {
  rect(ctx, 0, 0, VIEW_W, VIEW_H, '#241a16');
  plankWall(ctx, 0, 0, VIEW_W, VIEW_H, ramp('#4a3020'), { step: 40, dir: 'v' });
  ctx.globalAlpha = 0.35;
  const g = ctx.createRadialGradient(240, 90, 20, 240, 90, 240);
  g.addColorStop(0, 'rgba(255,226,150,0.5)');
  g.addColorStop(1, 'rgba(255,226,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.globalAlpha = 1;
  // the body of the telephone
  plank(ctx, 132, 18, 216, 200, RAMPS.oak, { dir: 'v', knots: 1 });
  boxFrame(ctx, 132, 18, 216, 200, RAMPS.walnut[0]);
  boxFrame(ctx, 136, 22, 208, 192, RAMPS.walnut[2]);
  // the bell domes at the top
  for (const bx of [172, 292]) {
    metal(ctx, bx - 18, 26, 36, 30, RAMPS.brass);
    disc(ctx, bx, 42, 15, RAMPS.brass[2]);
    disc(ctx, bx - 3, 39, 10, RAMPS.brass[3]);
    disc(ctx, bx - 5, 37, 5, RAMPS.brass[4]);
  }
  // keypad
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  const shown = Math.min(3, Math.floor(u * 5));
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const kx = 160 + c * 56, ky = 74 + r * 32;
      const key = digits[r * 3 + c];
      const lit = (key === '1' && shown >= 1 && u < 0.5) || (key === '2' && shown >= 3);
      metal(ctx, kx, ky, 46, 26, lit ? RAMPS.brass : RAMPS.metal);
      boxFrame(ctx, kx, ky, 46, 26, RAMPS.iron[1]);
      text(ctx, key, kx + 23, ky + 9, lit ? PAL.ink : PAL.ink2, { align: 'center' });
      if (lit) {
        ctx.globalAlpha = 0.3;
        disc(ctx, kx + 23, ky + 13, 22, '#f7cc55');
        ctx.globalAlpha = 1;
      }
    }
  }
  // the paw pressing, and the cord swinging
  const pawY = 118 + Math.round(Math.sin(t * 7) * 3) + shown * 4;
  disc(ctx, 214, pawY, 11, RAMPS.oak[3]);
  disc(ctx, 210, pawY - 3, 7, RAMPS.oak[4]);
  rect(ctx, 204, pawY + 8, 20, 60, RAMPS.oak[2]);
  for (let i = 0; i < 40; i++) {
    const cy = 150 + i * 2;
    px(ctx, 352 + Math.round(Math.sin(i * 0.7 + t * 2) * 7), cy, PAL.ink2);
    px(ctx, 353 + Math.round(Math.sin(i * 0.7 + t * 2) * 7), cy, '#4a4a52');
  }
  if (u > 0.6) {
    const r = ((u - 0.6) * 260) % 90;
    ctx.globalAlpha = Math.max(0, 0.45 - r / 200);
    for (let i = 0; i < 3; i++) {
      boxFrame(ctx, Math.round(240 - r - i * 9), Math.round(110 - r / 2 - i * 5),
               Math.round(r * 2 + i * 18), Math.round(r + i * 10), '#cdeeff');
    }
    ctx.globalAlpha = 1;
  }
}

/** Outside the cabin, night, rain - the ambulance shot. */
function setPorch(ctx, u, t, opts = {}) {
  rect(ctx, 0, 0, VIEW_W, VIEW_H, '#1b1836');
  rect(ctx, 0, 0, VIEW_W, 78, '#241d44');
  const stars = rngFrom(88);
  for (let i = 0; i < 40; i++) {
    px(ctx, Math.round(stars() * VIEW_W), Math.round(stars() * 70), stars() > 0.7 ? PAL.white : '#8f9ac4');
  }
  // wet grass and a road across the front
  turf(ctx, 0, 150, VIEW_W, 40, ramp('#2f5a28'), { seed: 4 });
  rect(ctx, 0, 190, VIEW_W, VIEW_H - 190, '#2a2732');
  speck(ctx, 0, 190, VIEW_W, VIEW_H - 190, ['#232030', '#3a3644'], 400, 3);
  // puddles catching the light bar
  const beat = Math.floor(t * 6) % 2;
  for (const [pxx, pw] of [[70, 40], [180, 30], [330, 46]]) {
    ctx.globalAlpha = 0.5;
    for (let dy = 0; dy < 5; dy++) {
      const span = Math.round((pw / 2) * Math.sqrt(Math.max(0, 1 - Math.pow((dy - 2) / 2.5, 2))));
      rect(ctx, pxx - span, 206 + dy, span * 2, 1, beat ? '#5a2a30' : '#2a3a5a');
    }
    ctx.globalAlpha = 1;
  }
  // the cabin, lit, with the door open
  const cabin = B.cabinSide('workshop', { lit: true, door: 'open' });
  ctx.drawImage(cabin, 300, 40);
  // the ambulance driving in from the left
  const vanX = Math.round(tween(-130, 24, Math.min(1, u * 2.4), 'outCubic'));
  drawVan(ctx, vanX, 176, t);
  // rain, on top of everything
  rainfall(ctx, t, 150, 0.5, 3);
}

function drawVan(ctx, x, base, t) {
  const beat = Math.floor(t * 6) % 2;
  contact(ctx, x + 58, base + 2, 58, 5, 0.35);
  // body
  const white = ramp('#e6e8ec');
  rect(ctx, x, base - 52, 116, 44, white[2]);
  rect(ctx, x, base - 52, 116, 6, white[3]);
  rect(ctx, x, base - 12, 116, 4, white[1]);
  rect(ctx, x, base - 26, 116, 6, PAL.red);
  rect(ctx, x, base - 26, 116, 1, '#f06a5a');
  // panel lines
  rect(ctx, x + 56, base - 52, 1, 44, white[1]);
  rect(ctx, x + 74, base - 52, 1, 44, white[1]);
  // cab glass
  glass(ctx, x + 78, base - 46, 34, 20, ramp('#3a5266'), {});
  rect(ctx, x + 94, base - 46, 2, 20, white[1]);
  // the cross
  rect(ctx, x + 12, base - 46, 34, 22, PAL.red);
  rect(ctx, x + 25, base - 46, 8, 22, PAL.white);
  rect(ctx, x + 12, base - 38, 34, 7, PAL.white);
  // wheels with hubs
  for (const wx of [x + 26, x + 92]) {
    disc(ctx, wx, base - 5, 10, '#191520');
    disc(ctx, wx, base - 5, 6, RAMPS.iron[2]);
    disc(ctx, wx, base - 5, 3, RAMPS.metal[3]);
    px(ctx, wx, base - 5, PAL.white);
  }
  // light bar and the cones it throws
  rect(ctx, x + 40, base - 58, 18, 7, beat ? '#ff5a4a' : '#5a1a1a');
  rect(ctx, x + 60, base - 58, 18, 7, beat ? '#1a2a5a' : '#6f9aff');
  rect(ctx, x + 40, base - 59, 38, 1, RAMPS.metal[3]);
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = beat ? '#ff5a4a' : '#6f9aff';
  ctx.beginPath();
  ctx.moveTo(x + 49, base - 55);
  ctx.lineTo(VIEW_W, base - 110);
  ctx.lineTo(VIEW_W, base + 20);
  ctx.fill();
  ctx.globalAlpha = 0.08;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.globalAlpha = 1;
}

function rainfall(ctx, t, count = 120, alpha = 0.5, slant = 3) {
  ctx.globalAlpha = alpha;
  const rng = rngFrom(31);
  for (let i = 0; i < count; i++) {
    const speed = 220 + rng() * 260;
    const x0 = rng() * (VIEW_W + 90) - 45;
    const y0 = (rng() * VIEW_H + t * speed) % (VIEW_H + 20);
    const len = 4 + Math.round(rng() * 5);
    line(ctx, x0 + (y0 / 10) * slant, y0, x0 + (y0 / 10) * slant - slant, y0 + len, '#a9dcf5');
  }
  ctx.globalAlpha = 1;
  // splashes on the ground
  const rng2 = rngFrom(Math.floor(t * 12));
  for (let i = 0; i < 20; i++) {
    const sx = rng2() * VIEW_W, sy = 190 + rng2() * (VIEW_H - 190);
    px(ctx, sx, sy, 'rgba(200,230,255,0.5)');
    px(ctx, sx + 1, sy - 1, 'rgba(200,230,255,0.3)');
  }
}

/** The infirmary corridor. */
function setHospital(ctx, u, t) {
  rect(ctx, 0, 0, VIEW_W, VIEW_H, '#8aa89a');
  rect(ctx, 0, 0, VIEW_W, 80, '#a8c0b0');
  for (let y = 0; y < 80; y += 14) rect(ctx, 0, y, VIEW_W, 1, '#98b0a2');
  rect(ctx, 0, 76, VIEW_W, 6, '#6b8378');
  rect(ctx, 0, 76, VIEW_W, 1, '#c0d4c6');
  // floor, polished, with a reflection band
  rect(ctx, 0, 186, VIEW_W, VIEW_H - 186, '#c2d2c6');
  for (let i = 0; i < 8; i++) {
    const y = 186 + i * 12;
    rect(ctx, 0, y, VIEW_W, 1, '#aebfb2');
    for (let x = -20; x < VIEW_W + 40; x += 40) rect(ctx, x - i * 4, y, 1, 12, '#aebfb2');
  }
  ctx.globalAlpha = 0.16;
  rect(ctx, 0, 190, VIEW_W, 24, PAL.white);
  ctx.globalAlpha = 1;
  // strip lights
  for (let i = 0; i < 3; i++) {
    const lx = 60 + i * 150;
    rect(ctx, lx, 14, 62, 7, PAL.white);
    rect(ctx, lx, 21, 62, 2, '#c9d8cd');
    ctx.globalAlpha = 0.13;
    for (let k = 1; k <= 3; k++) disc(ctx, lx + 31, 20, 16 + k * 10, PAL.white);
    ctx.globalAlpha = 1;
  }
  // double doors with portholes
  plankWall(ctx, 182, 82, 128, 104, ramp('#7f9c8c'), { step: 32, dir: 'v' });
  rect(ctx, 245, 82, 3, 104, '#5f7a6c');
  for (const dx of [214, 278]) {
    disc(ctx, dx, 116, 14, '#cfe0d4');
    disc(ctx, dx - 3, 113, 9, '#e4f0e8');
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      px(ctx, Math.round(dx + Math.cos(ang) * 14), Math.round(116 + Math.sin(ang) * 14), '#5f7a6c');
    }
  }
  metal(ctx, 236, 130, 6, 22, RAMPS.metal);
  metal(ctx, 250, 130, 6, 22, RAMPS.metal);
  // the clock, hands crawling
  disc(ctx, 408, 44, 19, PAL.paper2);
  disc(ctx, 408, 44, 17, PAL.white);
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    px(ctx, Math.round(408 + Math.cos(ang) * 14), Math.round(44 + Math.sin(ang) * 14), PAL.ink2);
  }
  const min = t * 0.9;
  line(ctx, 408, 44, Math.round(408 + Math.cos(min) * 13), Math.round(44 + Math.sin(min) * 13), PAL.ink);
  line(ctx, 408, 44, Math.round(408 + Math.cos(min / 12 - 1) * 8), Math.round(44 + Math.sin(min / 12 - 1) * 8), PAL.ink);
  disc(ctx, 408, 44, 1, PAL.red);
  boxFrame(ctx, 388, 24, 41, 41, RAMPS.metal[2]);
  // the bench
  plank(ctx, 36, 162, 124, 8, RAMPS.oak, { dir: 'h', knots: 1 });
  plank(ctx, 36, 170, 124, 5, RAMPS.oak, { dir: 'h', knots: 0 });
  plank(ctx, 44, 175, 7, 18, RAMPS.walnut, { dir: 'v', knots: 0 });
  plank(ctx, 146, 175, 7, 18, RAMPS.walnut, { dir: 'v', knots: 0 });
  contact(ctx, 98, 194, 62, 3, 0.25);
}

/** The bill, on a desk under a lamp. */
function setBill(ctx, u, t) {
  rect(ctx, 0, 0, VIEW_W, VIEW_H, '#20180f');
  plank(ctx, 0, 150, VIEW_W, 120, RAMPS.walnut, { dir: 'h', knots: 1 });
  const g = ctx.createRadialGradient(240, 40, 20, 240, 40, 250);
  g.addColorStop(0, 'rgba(255,226,150,0.35)');
  g.addColorStop(1, 'rgba(255,226,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const y = 26;
  // the sheet, with a shadow under it and a curled corner
  ctx.globalAlpha = 0.4;
  rect(ctx, 138, y + 6, 216, 174, PAL.black);
  ctx.globalAlpha = 1;
  rect(ctx, 132, y, 216, 172, PAL.paper);
  rect(ctx, 132, y, 216, 3, PAL.white);
  speck(ctx, 132, y, 216, 172, ['#e8dcc0', '#f8f0dc'], 300, 9);
  text(ctx, 'VALLEY INFIRMARY', 240, y + 12, PAL.ink, { align: 'center' });
  rect(ctx, 152, y + 24, 176, 1, PAL.paper3);
  rect(ctx, 152, y + 26, 176, 1, '#e2d2ae');
  const rows = [
    ['STRETCHER TEAM (FOXES)', '340'],
    ['SPLINT AND WRAP', '620'],
    ['NIGHT WARD, 6 NIGHTS', '1980'],
    ['MEDICINE', '710'],
    ['OWL SPECIALIST', '1150'],
  ];
  rows.forEach((r, i) => {
    const ry = y + 36 + i * 15;
    text(ctx, r[0], 152, ry, PAL.ink2);
    if (u > 0.08 + i * 0.05) text(ctx, r[1], 328, ry, PAL.ink, { align: 'right' });
    rect(ctx, 152, ry + 9, 176, 1, '#eadfc4');
  });
  rect(ctx, 152, y + 116, 176, 2, PAL.ink);
  text(ctx, 'TOTAL DUE', 152, y + 123, PAL.ink);
  if (u > 0.45) {
    const pop = ease.outBack(Math.min(1, (u - 0.45) * 4));
    const sc = Math.max(1, Math.round(2 * pop));
    bigText(ctx, '4800', 262, y + 134, sc, PAL.red, PAL.paper2);
    if (u > 0.6) text(ctx, 'ACORNS', 328, y + 156, PAL.red, { align: 'right' });
  }
  if (u > 0.75) text(ctx, 'PAYABLE IN FULL', 240, y + 162, PAL.ink2, { align: 'center' });
  // a paw holding the corner down
  disc(ctx, 140, y + 164, 13, RAMPS.oak[3]);
  disc(ctx, 152, y + 170, 9, RAMPS.oak[4]);
}

/** The workshop at dawn. */
function setWorkshop(ctx, u, t) {
  plankWall(ctx, 0, 0, VIEW_W, 190, ramp('#7c5233'), { step: 28, dir: 'v' });
  ctx.globalAlpha = 0.34;
  rect(ctx, 0, 0, VIEW_W, 34, '#1b1424');
  ctx.globalAlpha = 1;
  for (let i = 0; i < 7; i++) {
    plank(ctx, -20, 190 + i * 12, VIEW_W + 40, 12, RAMPS.pine, { dir: 'h', seed: 70 + i });
  }
  // window with dawn behind it
  const wx = 30, wy = 22, ww = 76, wh = 66;
  rect(ctx, wx, wy, ww, wh, '#f0c08a');
  rect(ctx, wx, wy, ww, 22, '#f8d8a8');
  rect(ctx, wx, wy + wh - 20, ww, 20, '#c8a06a');
  for (let i = 0; i < 4; i++) disc(ctx, wx + 10 + i * 20, wy + wh - 16, 10, '#8a9c62');
  rect(ctx, wx + ww / 2 - 1, wy, 2, wh, RAMPS.walnut[2]);
  rect(ctx, wx, wy + wh / 2 - 1, ww, 2, RAMPS.walnut[2]);
  boxFrame(ctx, wx - 3, wy - 3, ww + 6, wh + 6, RAMPS.walnut[2]);
  plank(ctx, wx - 7, wy + wh + 3, ww + 14, 5, RAMPS.walnut, { dir: 'h', knots: 0 });
  // the shaft of light, and the dust in it
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.moveTo(wx, wy + wh); ctx.lineTo(wx + ww, wy + wh);
  ctx.lineTo(wx + ww + 150, VIEW_H); ctx.lineTo(wx + 30, VIEW_H);
  ctx.fill();
  ctx.globalAlpha = 1;
  const rng = rngFrom(7717);
  for (let i = 0; i < 60; i++) {
    const bx = wx + rng() * (ww + 120);
    const by = wy + wh + ((rng() * 160 + t * 9 + i * 3) % 160);
    px(ctx, Math.round(bx + Math.sin(t * 0.6 + i) * 5), Math.round(by), i % 3 ? PAL.paper2 : PAL.white);
  }
  // tool board
  plankWall(ctx, 250, 22, 200, 74, RAMPS.walnut, { step: 24, dir: 'v' });
  boxFrame(ctx, 250, 22, 200, 74, RAMPS.walnut[0]);
  for (let i = 0; i < 5; i++) {
    const hx = 266 + i * 38;
    plank(ctx, hx, 38, 3, 40, RAMPS.oak, { dir: 'v', knots: 0 });
    metal(ctx, hx - 7, 30, 17, 9, RAMPS.iron);
  }
  for (let i = 0; i < 3; i++) {
    metal(ctx, 268 + i * 60, 84, 46, 4, RAMPS.metal);
    for (let k = 0; k < 46; k += 3) px(ctx, 268 + i * 60 + k, 88, RAMPS.metal[4]);
  }
  // the bench, a vice, a half-made stool
  plank(ctx, 150, 138, 210, 12, RAMPS.oak, { dir: 'h', knots: 1 });
  plank(ctx, 160, 150, 12, 40, RAMPS.walnut, { dir: 'v', knots: 0 });
  plank(ctx, 338, 150, 12, 40, RAMPS.walnut, { dir: 'v', knots: 0 });
  metal(ctx, 300, 124, 28, 14, RAMPS.iron);
  plank(ctx, 176, 118, 44, 20, RAMPS.pine, { dir: 'h', knots: 0 });
  plank(ctx, 182, 110, 8, 8, RAMPS.pine, { dir: 'v', knots: 0 });
  plank(ctx, 206, 110, 8, 8, RAMPS.pine, { dir: 'v', knots: 0 });
  contact(ctx, 255, 191, 100, 4, 0.3);
  // sawdust and shavings on the floor
  const rng2 = rngFrom(500);
  for (let i = 0; i < 140; i++) {
    px(ctx, 150 + rng2() * 220, 192 + rng2() * 10, rng2() > 0.5 ? RAMPS.pine[4] : PAL.paper2);
  }
}

// ------------------------------------------------------------------ script
// Each shot: a set, a framing and a move, what the actors do, and how we leave.
const SHOTS = [
  { set: setLiving, dur: 4.2, framing: 'wide', to: 'full', move: 'push', focus: [240, 130],
    setOpts: { storm: true }, out: 'fade',
    stage(ctx, u, t) {
      armchair(ctx, 366, 200);
      put(ctx, elder('sit', cycle(t, 1.2)), 364, 186, 2, -1);
      put(ctx, hero('sit', cycle(t, 1.2)), 190, 210, 2, -1);
      disc(ctx, 258, 206, 9, PAL.paper2);
      rect(ctx, 249, 198, 18, 5, PAL.paper);
    },
    lines: [['GRANDPA', 'Sit down, sit down. The heron programme is on.', 0.1]] },

  { set: setLiving, dur: 3.6, framing: 'medium', to: 'close', move: 'handheld', focus: [352, 150],
    setOpts: { storm: true }, out: 'cut',
    stage(ctx, u, t) {
      armchair(ctx, 366, 200);
      put(ctx, elder('sit', cycle(t, 1.4)), 364, 186, 2, -1);
    },
    lines: [['GRANDPA', 'She always is. She will come when the tea is done.', 0.05]] },

  { set: setLiving, dur: 3.0, framing: 'close', move: 'handheld', focus: [196, 176],
    setOpts: { storm: true }, out: 'cut',
    stage(ctx, u, t) { put(ctx, hero('sit', cycle(t, 1.6)), 190, 210, 2, -1); },
    lines: [['YOU', 'Grandma is still in the kitchen.', 0.06]] },

  // the crash: hard cut in tight, tilted, with the comic works
  { set: setLiving, dur: 2.6, framing: 'insert', to: 'medium', move: 'pull', focus: [240, 150],
    setOpts: { storm: true, static: true }, tilt: -4, shake: 2.2, sound: 'crash', flash: 1,
    out: 'flashcut',
    stage(ctx, u, t) {
      armchair(ctx, 366, 200);
      put(ctx, elder('sit', 2), 364, 186, 2, 1);
      put(ctx, hero('jump', 1), 190, 208, 2, 1);
      // the bowl and its contents, thrown
      const by = 206 - ease.out(Math.min(1, u * 2)) * 40;
      disc(ctx, 258, Math.round(by), 9, PAL.paper2);
      for (let i = 0; i < 16; i++) {
        const a = i * 0.4 + u * 7;
        px(ctx, Math.round(258 + Math.cos(a) * (12 + u * 60)),
           Math.round(by + Math.sin(a) * (8 + u * 34)), PAL.paper);
      }
      if (u < 0.5) impactBurst(ctx, 430, 150, u * 2, 'rgba(255,255,255,0.8)');
      speedLines(ctx, Math.max(0, 0.9 - u * 2), -1, 'rgba(255,240,200,0.5)', 11);
      if (u > 0.1) shout(ctx, 'CRASH', 330, 96, 3, (u - 0.1) * 2.2);
    },
    lines: [] },

  // reaction, with grandpa's face in an inset panel
  { set: setLiving, dur: 3.0, framing: 'close', move: 'handheld', focus: [196, 168],
    setOpts: { storm: true, static: true }, out: 'iris',
    stage(ctx, u, t) {
      put(ctx, hero('idle', cycle(t, 6)), 190, 208, 2, 1);
      inset(ctx, 300, 40, 140, 84, (c) => {
        // grandpa, close, in the panel
        c.fillStyle = '#3f2b1e';
        c.fillRect(300, 40, 140, 84);
        const g = c.createRadialGradient(370, 82, 10, 370, 82, 90);
        g.addColorStop(0, 'rgba(150,210,240,0.35)');
        g.addColorStop(1, 'rgba(150,210,240,0)');
        c.fillStyle = g;
        c.fillRect(300, 40, 140, 84);
        put(c, elder('idle', 1), 370, 124, 3, 1);
      }, u, t);
    },
    lines: [['GRANDPA', 'MARGUERITE!', 0.1]] },

  // the kitchen, revealed on a crane down
  { set: setKitchen, dur: 4.6, framing: 'wide', to: 'full', move: 'crane', focus: [220, 150],
    sound: 'bad', out: 'fade',
    stage(ctx, u, t) {
      // knocked chair
      plank(ctx, 300, 150, 36, 9, RAMPS.oak, { dir: 'h', knots: 0 });
      plank(ctx, 300, 159, 9, 22, RAMPS.oak, { dir: 'v', knots: 0 });
      plank(ctx, 328, 159, 9, 15, RAMPS.oak, { dir: 'v', knots: 0 });
      // spilled tea, spreading across the tiles behind her
      ctx.globalAlpha = 0.75;
      for (let dy = -7; dy <= 7; dy++) {
        const span = Math.round(30 * Math.sqrt(Math.max(0, 1 - (dy * dy) / 52)));
        const wob = Math.round(Math.sin(dy * 0.7) * 3);
        rect(ctx, 214 - span + wob, 204 + dy, span * 2, 1, dy < -2 ? '#8f6238' : '#7a5230');
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 14; i++) px(ctx, 190 + i * 4, 200 + (i % 3), 'rgba(180,140,90,0.5)');
      for (const [sx, sy, w] of [[168, 188, 6], [180, 202, 5], [216, 192, 7], [206, 206, 4]]) {
        rect(ctx, sx, sy, w, 3, PAL.paper);
        rect(ctx, sx, sy, w, 1, PAL.white);
        px(ctx, sx + 1, sy + 2, PAL.paper3);
      }
      put(ctx, granny('lie'), 170, 200, 2, 1);
      put(ctx, elder('kneel', cycle(t, 1.4)), 250, 206, 2, -1);
      put(ctx, hero('idle', cycle(t, 1.6)), 400, 208, 2, -1);
    },
    lines: [['YOU', 'Grandma? Grandma, can you hear me?', 0.08],
            ['GRANDPA', 'Her leg. Do not move her. The phone, lad. Now.', 0.52]] },

  // insert: the dial pad
  { set: setPhone, dur: 4.0, framing: 'insert', to: 'close', move: 'pull', focus: [240, 110],
    sound: 'ring', out: 'fade',
    stage() {},
    lines: [['YOU', 'Ambulance. My grandmother has fallen.', 0.42]] },

  // the ambulance arrives
  { set: setPorch, dur: 4.4, framing: 'wide', move: 'pan', focus: [300, 140], panTo: [180, 150],
    sound: 'siren', out: 'cut',
    stage(ctx, u, t) {
      put(ctx, elder('idle', cycle(t, 1.4)), 372, 168, 1, -1);
      put(ctx, hero('idle', cycle(t, 1.4)), 392, 168, 1, -1);
    },
    lines: [['FOX MEDIC', 'Stretcher! Mind the step. We have got her.', 0.24]] },

  // tracking the stretcher
  { set: setPorch, dur: 4.2, framing: 'full', to: 'medium', move: 'handheld', focus: [240, 160],
    out: 'fade',
    stage(ctx, u, t) {
      const march = ease.inOut(Math.min(1, u * 1.1));
      const fx = Math.round(330 - march * 200);
      const bob = Math.sin(t * 9) * 2;
      const step = cycle(t, 9);
      put(ctx, foxMedic(step, true), fx + 56, Math.round(196 + bob), 2, -1);
      put(ctx, foxMedic((step + 2) % 4, true), fx - 8, Math.round(198 - bob), 2, -1);
      // stretcher and her shawl
      metal(ctx, fx - 10, Math.round(160 + bob * 0.4), 74, 5, RAMPS.metal);
      cloth(ctx, fx - 2, Math.round(150 + bob * 0.4), 58, 10, ramp('#8256c4'), { fold: 0.5 });
      put(ctx, granny('sit'), fx + 10, Math.round(152 + bob * 0.4), 1, 1);
      rainfall(ctx, t, 140, 0.5, 3);
    },
    lines: [['FOX MEDIC', 'You can follow us. Bring her shawl.', 0.2]] },

  // the corridor
  { set: setHospital, dur: 4.4, framing: 'wide', to: 'full', move: 'push', focus: [200, 130],
    out: 'fade',
    stage(ctx, u, t) {
      put(ctx, elder('sit', cycle(t, 0.8)), 72, 168, 2, 1);
      put(ctx, hero('sit', cycle(t, 0.9)), 118, 168, 2, -1);
    },
    lines: [['NURSE', 'She is stable. Sleeping. It was a clean break.', 0.1]] },

  // the bill, insert, the number landing
  { set: setBill, dur: 5.2, framing: 'full', to: 'insert', move: 'push', focus: [240, 120],
    panTo: [240, 150], sound: 'bad', out: 'fade',
    stage(ctx, u, t) {
      if (u > 0.46 && u < 0.72) impactBurst(ctx, 262, 160, (u - 0.46) * 3.6, 'rgba(200,60,50,0.35)');
    },
    lines: [['GRANDPA', 'Four thousand eight hundred. I have not got it.', 0.3],
            ['YOU', 'Then I will get it.', 0.72]] },

  // dawn in the workshop, the axe changing hands
  { set: setWorkshop, dur: 6.4, framing: 'wide', to: 'full', move: 'push', focus: [258, 158],
    sound: 'good', out: 'fade',
    stage(ctx, u, t) {
      const hand = ease.inOut(Math.min(1, Math.max(0, (u - 0.3) * 2.2)));
      put(ctx, elder(hand > 0.1 ? 'hold' : 'idle', cycle(t, 1.2)), 302, 214, 2, -1);
      put(ctx, hero('idle', cycle(t, 1.2)), 214, 214, 2, 1);
      // the axe passing between them
      const ax = Math.round(tween(280, 244, hand, 'inOut'));
      plank(ctx, ax, 168, 4, 30, RAMPS.oak, { dir: 'v', knots: 0 });
      metal(ctx, ax - 7, 160, 18, 10, RAMPS.iron);
      px(ctx, ax - 6, 161, RAMPS.metal[4]);
      if (hand > 0.9) {
        ctx.globalAlpha = 0.5 - (hand - 0.9) * 4;
        impactBurst(ctx, ax, 168, (hand - 0.9) * 6, 'rgba(255,226,150,0.5)');
        ctx.globalAlpha = 1;
      }
    },
    lines: [['GRANDPA', 'Your grandmother mended this valley for forty years.', 0.06],
            ['GRANDPA', 'Everything I know is in this room. Take the axe.', 0.36],
            ['GRANDPA', 'We will build her way home. Piece by piece.', 0.68]] },
];

const SCRIPT = { id: 'intro', shots: SHOTS, card: { title: 'DAM IT', sub: 'CHAPTER ONE - GRANDPA\'S WORKSHOP' } };
const SCRIPTS = { intro: SCRIPT };

// -------------------------------------------------------------------- play
export function playCutscene(id, onEnd) {
  const script = SCRIPTS[id];
  if (!script) { if (onEnd) onEnd(); return false; }
  Object.assign(cut, {
    active: true, script, shot: 0, t: 0, bars: 0, onEnd: onEnd || null,
    lineIndex: -1, lineT: 0, shake: 0, flash: 0, ended: false, endT: 0, inT: 1,
  });
  return true;
}

export function endCutscene() {
  if (!cut.active) return;
  cut.active = false;
  const done = cut.onEnd;
  cut.onEnd = null;
  if (done) done();
}

function nextShot() {
  const shots = cut.script.shots;
  if (cut.shot >= shots.length - 1) {
    if (!cut.ended) { cut.ended = true; cut.endT = 0; return; }
    endCutscene();
    return;
  }
  cut.shot++;
  cut.t = 0;
  cut.lineIndex = -1;
  cut.lineT = 0;
  cut.inT = 1;
  const shot = shots[cut.shot];
  cut.shake = shot.shake || 0;
  cut.flash = shot.flash || 0;
  if (shot.sound && sfx[shot.sound]) sfx[shot.sound]();
}

export function updateCutscene(dt) {
  if (!cut.active) return;
  const shot = cut.script.shots[cut.shot];
  cut.t += dt;
  cut.lineT += dt;
  cut.bars = Math.min(1, cut.bars + dt * 2.6);
  if (cut.shake > 0) cut.shake = Math.max(0, cut.shake - dt * 2.2);
  if (cut.flash > 0) cut.flash = Math.max(0, cut.flash - dt * 3.4);
  if (cut.inT > 0) cut.inT = Math.max(0, cut.inT - dt * 3);
  if (cut.ended) { cut.endT += dt; }

  if (shot.lines && shot.lines.length) {
    const u = cut.t / shot.dur;
    let idx = -1;
    for (let i = 0; i < shot.lines.length; i++) if (u >= shot.lines[i][2]) idx = i;
    if (idx !== cut.lineIndex) { cut.lineIndex = idx; cut.lineT = 0; }
  }

  if (pressed('Escape')) { endCutscene(); return; }
  if (pressed('Enter', 'Space', 'KeyE') || input.clicked) { nextShot(); return; }
  if (!cut.ended && cut.t >= shot.dur) nextShot();
}

// -------------------------------------------------------------------- draw
export function drawCutscene(ctx, t) {
  if (!cut.active) return;
  const shot = cut.script.shots[cut.shot];
  const u = Math.max(0, Math.min(1, cut.t / shot.dur));

  renderShot(ctx, shot, u, t, (bctx, uu, tt) => {
    shot.set(bctx, uu, tt, shot.setOpts || {});
    if (shot.stage) shot.stage(bctx, uu, tt);
  }, { shake: cut.shake });

  // the way out of the shot, played over the tail of it
  const tail = 1 - u;
  if (shot.out === 'fade' && tail < 0.12) wipe(ctx, 'fade', (0.12 - tail) / 0.12);
  if (shot.out === 'iris' && tail < 0.16) wipe(ctx, 'iris', (0.16 - tail) / 0.16);
  if (shot.out === 'diagonal' && tail < 0.14) wipe(ctx, 'diagonal', (0.14 - tail) / 0.14);
  if (shot.out === 'bars' && tail < 0.16) wipe(ctx, 'bars', (0.16 - tail) / 0.16);
  // and the way in
  if (cut.inT > 0 && shot.out !== 'cut') wipe(ctx, 'fade', cut.inT * 0.9);
  flash(ctx, cut.flash);

  filmGrain(ctx, t, 0.05);
  const bar = letterbox(ctx, cut.bars, 16);

  if (cut.ended) {
    titleCard(ctx, cut.script.card.title, cut.script.card.sub, Math.min(1, cut.endT * 1.4));
    if (Math.floor(t * 1.6) % 2 === 0) {
      text(ctx, 'PRESS ENTER', VIEW_W / 2, 178, PAL.paper3, { align: 'center', shadow: PAL.black });
    }
    return;
  }

  const cur = cut.lineIndex >= 0 && shot.lines ? shot.lines[cut.lineIndex] : null;
  if (cur && cur[1]) caption(ctx, cur[0], cur[1], cut.lineT, bar);

  // shot number and the skip hint, like a rough cut
  if (Math.floor(t) % 2 === 0) {
    text(ctx, 'ENTER SKIP', VIEW_W - 8, VIEW_H - bar - 11, 'rgba(190,170,130,0.6)', { align: 'right' });
  }
  text(ctx, `${cut.shot + 1}/${cut.script.shots.length}`, 8, VIEW_H - bar - 11,
       'rgba(190,170,130,0.4)');
}
