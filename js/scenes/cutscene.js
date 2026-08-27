// The story scenes, played as a little film: letterbox bars, a camera that
// pushes and pans, hard cuts where they hurt, and dialogue that types itself
// out. Every frame is painted with the same pixel toolkit as the game, into an
// offscreen buffer that the camera then crops - that is where the push comes
// from.

import { VIEW_W, VIEW_H } from '../config.js';
import { PAL, surface, rect, frame, px, disc, line, text, textWidth, bigText, wrap, rngFrom }
  from '../gfx/pixel.js';
import { hero, elder, granny, foxMedic, SUN } from '../gfx/actors.js';
import { pressed, input } from '../input.js';
import { sfx } from '../audio.js';

export const cut = {
  active: false, script: null, shot: 0, t: 0, total: 0, bars: 0,
  onEnd: null, lineIndex: -1, lineT: 0, flash: 0, shake: 0, ended: false,
};

const buf = surface(VIEW_W, VIEW_H);

// --------------------------------------------------------------- figures
// The cast is the game's own sprite bank, blown up by a whole number - so the
// beaver in the cutscene is the beaver you play, not a lookalike.

const tintCache = new Map();

/** A silhouette of any sprite, for the shots that want shapes and no detail. */
function silhouette(img, colour) {
  const key = `${img.width}x${img.height}:${colour}:${img.__id || (img.__id = Math.random())}`;
  let found = tintCache.get(key);
  if (found) return found;
  const s = surface(img.width, img.height);
  s.ctx.drawImage(img, 0, 0);
  s.ctx.globalCompositeOperation = 'source-in';
  s.ctx.fillStyle = colour;
  s.ctx.fillRect(0, 0, img.width, img.height);
  if (tintCache.size > 40) tintCache.clear();
  tintCache.set(key, s.canvas);
  return s.canvas;
}

/** Blit a sprite standing on (x, base), scaled and optionally facing left. */
function actor(ctx, img, x, base, scale, face, tone) {
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

/**
 * The one call every shot uses. `opts` keeps the old vocabulary - glasses means
 * grandpa, shawl means grandma - and picks the right sprite and pose for it.
 */
function beaver(ctx, x, base, h, opts = {}) {
  const face = opts.face === undefined ? 1 : opts.face;
  const scale = h >= 24 ? 2 : 1;
  const pose = opts.pose || 'stand';
  const frame = opts.frame === undefined ? 0 : opts.frame;
  let img;
  if (opts.shawl && (pose === 'lie' || pose === 'sit')) {
    img = granny(pose === 'lie' ? 'lie' : 'sit');
  } else if (opts.glasses) {
    const map = { sit: 'sit', kneel: 'kneel', stand: opts.reach ? 'hold' : 'idle', run: 'walk' };
    img = elder(map[pose] || 'idle', frame);
  } else {
    const map = { stand: 'idle', sit: 'sit', kneel: 'kneel', run: 'run', lie: 'sit' };
    img = hero(map[pose] || 'idle', frame);
  }
  actor(ctx, img, x, base, scale, face, opts.fur === PAL.black ? PAL.ink : null);
}

/** A fox medic, same treatment. */
function fox(ctx, x, base, h, opts = {}) {
  const face = opts.face === undefined ? 1 : opts.face;
  const scale = h >= 24 ? 2 : 1;
  actor(ctx, foxMedic(opts.frame || 0, !!opts.reach), x, base, scale, face, null);
}

// ---------------------------------------------------------------- weather
function rain(ctx, t, count = 90, alpha = 0.5, slant = 2) {
  ctx.globalAlpha = alpha;
  const rng = rngFrom(31);
  for (let i = 0; i < count; i++) {
    const speed = 150 + rng() * 220;
    const x0 = rng() * (VIEW_W + 80) - 40;
    const y0 = (rng() * VIEW_H + t * speed) % (VIEW_H + 20);
    const len = 3 + Math.round(rng() * 4);
    line(ctx, x0 + y0 / 12 * slant, y0, x0 + y0 / 12 * slant - slant, y0 + len, PAL.sky3);
  }
  ctx.globalAlpha = 1;
}

function dustMotes(ctx, t, x, y, w, h, count = 26) {
  const rng = rngFrom(7717);
  for (let i = 0; i < count; i++) {
    const bx = x + rng() * w;
    const drift = Math.sin(t * 0.6 + i) * 6;
    const by = y + ((rng() * h + t * 6 + i * 3) % h);
    px(ctx, Math.round(bx + drift), Math.round(by), i % 4 ? PAL.paper2 : PAL.white);
  }
}

/** Vignette: the cheapest way to make a flat pixel scene feel photographed. */
function vignette(ctx, strength = 0.35) {
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    ctx.globalAlpha = (strength / steps) * (i / steps + 0.4);
    ctx.fillStyle = PAL.black;
    ctx.fillRect(0, i * 2, VIEW_W, 2);
    ctx.fillRect(0, VIEW_H - i * 2 - 2, VIEW_W, 2);
    ctx.fillRect(i * 2, 0, 2, VIEW_H);
    ctx.fillRect(VIEW_W - i * 2 - 2, 0, 2, VIEW_H);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ rooms
// Everything is composed above y=196: the letterbox and the dialogue box own
// the bottom of the frame, so that is where the floor goes, not the acting.
const FLOOR = 158;      // where the characters stand
const ACT = 176;        // the lowest a subject's feet may sit

/** Grandpa's living room: panelled walls, a rug, a rain-streaked window. */
function paintLivingRoom(ctx, t, opts = {}) {
  // panelled wall, lit warm - the room should feel like somewhere you live
  rect(ctx, 0, 0, VIEW_W, FLOOR, SUN.wall1);
  for (let x = 0; x < VIEW_W; x += 22) {
    rect(ctx, x, 0, 2, FLOOR, SUN.wall0);
    rect(ctx, x + 2, 0, 1, FLOOR, SUN.wall2);
  }
  rect(ctx, 0, FLOOR - 26, VIEW_W, 4, SUN.wood2);       // dado rail
  rect(ctx, 0, FLOOR - 26, VIEW_W, 1, SUN.wood4);
  // floorboards, receding
  rect(ctx, 0, FLOOR, VIEW_W, VIEW_H - FLOOR, SUN.floor1);
  for (let y = FLOOR; y < VIEW_H; y += 7) rect(ctx, 0, y, VIEW_W, 1, SUN.floor0);
  for (let x = -20; x < VIEW_W + 40; x += 40) line(ctx, x, FLOOR, x - 16, VIEW_H, SUN.floor0);
  // rug
  rect(ctx, 116, FLOOR + 12, 236, 38, '#c04a4a');
  frame(ctx, 116, FLOOR + 12, 236, 38, '#e8626f');
  frame(ctx, 122, FLOOR + 16, 224, 30, '#8e3b3b');
  for (let i = 0; i < 10; i++) px(ctx, 136 + i * 22, FLOOR + 30, PAL.gold);

  // window, with the rain on the outside where it belongs
  rect(ctx, 26, 26, 58, 62, PAL.night1);
  for (let i = 0; i < 24; i++) {
    const rx = 28 + ((i * 13) % 54);
    const ry = 28 + ((i * 29 + t * 60) % 58);
    rect(ctx, rx, ry, 1, 3, PAL.sky2);
  }
  if (opts.storm && Math.sin(t * 1.7) > 0.985) rect(ctx, 27, 27, 56, 60, PAL.sky4);
  frame(ctx, 26, 26, 58, 62, PAL.wood1);
  rect(ctx, 54, 26, 2, 62, PAL.wood1);
  rect(ctx, 26, 56, 58, 2, PAL.wood1);
  rect(ctx, 22, 22, 66, 4, PAL.wood2);

  // shelf, with a framed photo of grandma on it
  rect(ctx, 372, 74, 84, 3, PAL.wood2);
  rect(ctx, 398, 54, 26, 20, PAL.wood1);
  rect(ctx, 401, 57, 20, 14, PAL.paper2);
  beaver(ctx, 411, 70, 13, { fur: PAL.fur3, shawl: PAL.purple2, closed: true });
  rect(ctx, 368, 62, 8, 12, PAL.grass2);
  disc(ctx, 372, 60, 4, PAL.grass3);
}

/** The television: the only real light in the room, and it flickers. */
function paintTV(ctx, t, opts = {}) {
  const x = 200, y = 62, w = 84, h = 60;
  const flick = 0.75 + Math.sin(t * 22) * 0.06 + Math.sin(t * 7.3) * 0.05;
  // the light it throws into the room, as one soft falloff
  const cx = x + w / 2, cy = y + h / 2;
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 190);
  g.addColorStop(0, `rgba(169, 220, 245, ${0.16 * flick})`);
  g.addColorStop(0.5, `rgba(169, 220, 245, ${0.06 * flick})`);
  g.addColorStop(1, 'rgba(169, 220, 245, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // cabinet
  rect(ctx, x - 6, y - 6, w + 12, h + 16, PAL.wood1);
  frame(ctx, x - 6, y - 6, w + 12, h + 16, PAL.wood0);
  rect(ctx, x - 4, y + h + 4, w + 8, 4, PAL.wood0);
  rect(ctx, x - 2, y + h + 8, 6, 12, PAL.wood0);
  rect(ctx, x + w - 4, y + h + 8, 6, 12, PAL.wood0);
  // the picture
  if (opts.static) {
    for (let sy = 0; sy < h; sy++) {
      for (let sx = 0; sx < w; sx += 2) {
        const v = Math.random();
        px(ctx, x + sx + (sy % 2), y + sy, v > 0.6 ? PAL.paper : v > 0.3 ? PAL.stone2 : PAL.ink);
      }
    }
  } else {
    rect(ctx, x, y, w, h, '#2f5a6a');
    rect(ctx, x, y + 28, w, h - 28, '#3a6b4a');
    rect(ctx, x, y + 40, w, 11, '#2f6f8a');
    for (let i = 0; i < 4; i++) {
      const hx = x + i * 24 - 8;
      for (let k = 0; k < 13; k++) rect(ctx, hx + k, y + 28 - k / 2, 24 - k * 2, 1, '#2b5540');
    }
    const bird = Math.round((t * 18) % (w + 20)) - 10;
    if (bird > 0 && bird < w - 4) {
      const flap = Math.sin(t * 12) * 2;
      line(ctx, x + bird, y + 16, x + bird + 3, y + 16 - flap, PAL.ink);
      line(ctx, x + bird + 3, y + 16 - flap, x + bird + 6, y + 16, PAL.ink);
    }
    ctx.globalAlpha = 0.18;
    for (let sy = 0; sy < h; sy += 2) rect(ctx, x, y + sy, w, 1, PAL.black);
    ctx.globalAlpha = 1;
  }
  frame(ctx, x, y, w, h, PAL.ink);
}

function paintArmchair(ctx, x, base) {
  // a wing chair big enough for a grandfather to disappear into
  rect(ctx, x - 28, base - 46, 56, 46, '#7a557a');
  rect(ctx, x - 28, base - 46, 56, 4, '#9a719a');
  rect(ctx, x - 34, base - 30, 8, 30, '#664666');
  rect(ctx, x + 26, base - 30, 8, 30, '#664666');
  rect(ctx, x - 34, base - 30, 8, 3, '#8a648a');
  rect(ctx, x + 26, base - 30, 8, 3, '#8a648a');
  rect(ctx, x - 26, base - 16, 52, 8, '#8a648a');   // the seat cushion
  rect(ctx, x - 26, base - 16, 52, 2, '#a97ea9');
  for (let i = 0; i < 5; i++) px(ctx, x - 18 + i * 9, base - 34, '#9a719a');
  rect(ctx, x - 24, base, 5, 4, PAL.wood0);
  rect(ctx, x + 19, base, 5, 4, PAL.wood0);
}

/** The kitchen, seen from the doorway: cupboards, a stove, tiles, warm light. */
function paintKitchen(ctx, t) {
  const floorY = 138;
  // wall: sage above a tiled splashback
  rect(ctx, 0, 0, VIEW_W, floorY, '#9cbc90');
  rect(ctx, 0, 0, VIEW_W, 40, '#a8c69c');
  for (let y = 0; y < floorY; y += 14) rect(ctx, 0, y, VIEW_W, 1, '#8aa87f');
  rect(ctx, 0, 74, VIEW_W, 30, '#e8e2d0');
  for (let x = 0; x < VIEW_W; x += 12) rect(ctx, x, 74, 1, 30, '#cfc8b4');
  for (let y = 74; y < 104; y += 10) rect(ctx, 0, y, VIEW_W, 1, '#cfc8b4');
  rect(ctx, 0, 104, VIEW_W, 3, '#b5714f');

  // floor tiles, in proper perspective rows
  rect(ctx, 0, floorY, VIEW_W, VIEW_H - floorY, '#e0c9a0');
  for (let i = 0; i < 9; i++) {
    const y = floorY + i * 14;
    rect(ctx, 0, y, VIEW_W, 1, '#c4a97c');
    const off = (i % 2) * 16;
    for (let x = -16; x < VIEW_W + 32; x += 32) {
      rect(ctx, x + off - Math.round(i * 2.5), y, 1, 14, '#c4a97c');
    }
  }

  // run of cupboards along the right, with a worktop
  rect(ctx, 250, 104, 230, 8, '#c58a45');
  rect(ctx, 250, 104, 230, 2, '#e6b166');
  rect(ctx, 250, 112, 230, 26, '#7c5130');
  for (let i = 0; i < 4; i++) {
    const cx = 258 + i * 56;
    rect(ctx, cx, 116, 48, 18, '#96602f');
    rect(ctx, cx, 116, 48, 1, '#c58a45');
    frame(ctx, cx, 116, 48, 18, '#5a3a24');
    rect(ctx, cx + 20, 122, 8, 2, '#e0d7cb');
  }
  // open shelf with jars
  rect(ctx, 268, 58, 200, 4, '#c58a45');
  rect(ctx, 268, 62, 200, 2, '#7c5130');
  for (let i = 0; i < 6; i++) {
    const jx = 276 + i * 32;
    rect(ctx, jx, 44, 14, 14, i % 2 ? '#e8e2d0' : '#a3ddfa');
    rect(ctx, jx, 44, 14, 3, '#f2f2f2');
    rect(ctx, jx + 2, 48, 10, 8, i % 3 ? '#e8626f' : '#f2c14e');
    frame(ctx, jx, 44, 14, 14, '#5a3a24');
  }

  // the stove: black iron, one ring lit, the kettle still on it
  rect(ctx, 44, 100, 78, 38, '#3f4650');
  rect(ctx, 44, 100, 78, 4, '#6d7783');
  rect(ctx, 48, 110, 70, 24, '#2f353d');
  rect(ctx, 52, 114, 30, 16, '#4a525c');
  rect(ctx, 52, 114, 30, 2, '#7c8189');
  disc(ctx, 96, 122, 7, '#1d2228');
  disc(ctx, 96, 122, 5, Math.floor(t * 3) % 2 ? '#e8626f' : '#f0a13c');
  ctx.globalAlpha = 0.14;
  for (let i = 1; i <= 3; i++) disc(ctx, 96, 122, 6 + i * 5, '#f0a13c');
  ctx.globalAlpha = 1;
  // kettle
  disc(ctx, 66, 96, 9, '#8a919b');
  disc(ctx, 66, 94, 7, '#a9b0b8');
  rect(ctx, 60, 86, 12, 8, '#8a919b');
  rect(ctx, 72, 88, 5, 2, '#cfd5dc');
  rect(ctx, 62, 84, 8, 2, '#5a636e');
  for (let i = 0; i < 4; i++) {
    const sy = 80 - ((t * 13 + i * 7) % 26);
    ctx.globalAlpha = 0.6 - i * 0.12;
    disc(ctx, 66 + Math.round(Math.sin(sy * 0.3) * 4), Math.round(sy), 2 + i, PAL.paper2);
    ctx.globalAlpha = 1;
  }

  // a strip of light from the doorway we are standing in
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#fff0c0';
  ctx.fillRect(340, floorY, 140, VIEW_H - floorY);
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ shots
// Each shot paints one frame given `u` (0..1 through the shot) and `t`.

const SHOTS = {
  livingroom(ctx, u, t) {
    paintLivingRoom(ctx, t, { storm: true });
    paintTV(ctx, t);
    paintArmchair(ctx, 358, ACT - 6);
    beaver(ctx, 354, ACT - 12, 34, { pose: 'sit', fur: PAL.fur1, light: PAL.fur2, glasses: true,
                                     face: -1, shawl: '#3f5fc4' });
    beaver(ctx, 190, ACT, 30, { pose: 'sit', face: -1 });
    // popcorn, between them on the rug
    disc(ctx, 250, ACT - 2, 8, PAL.paper2);
    rect(ctx, 242, ACT - 8, 16, 4, PAL.paper);
    vignette(ctx, 0.45);
  },

  crash(ctx, u, t) {
    paintLivingRoom(ctx, t, { storm: true });
    paintTV(ctx, t, { static: u > 0.25 });
    paintArmchair(ctx, 358, ACT - 6);
    // both of them snapped round toward the noise
    beaver(ctx, 354, ACT - 12, 34, { pose: 'sit', fur: PAL.fur1, light: PAL.fur2, glasses: true,
                                     face: 1, shawl: '#3f5fc4' });
    beaver(ctx, 190, ACT, 32, { pose: 'stand', face: 1 });
    // the bowl, mid-air, and the corn going everywhere
    const bowlY = ACT - 2 - Math.sin(Math.min(1, u * 3) * Math.PI) * 28;
    disc(ctx, 250, Math.round(bowlY), 8, PAL.paper2);
    for (let i = 0; i < 14; i++) {
      const a = i * 0.45 + u * 6;
      px(ctx, Math.round(250 + Math.cos(a) * (10 + u * 44)), Math.round(bowlY + Math.sin(a) * (6 + u * 26)), PAL.paper);
    }
    if (u < 0.14) {
      ctx.fillStyle = PAL.white;
      ctx.globalAlpha = 1 - u / 0.14;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
    if (u > 0.08 && u < 0.62) {
      const scale = 2 + (Math.sin(Math.min(1, (u - 0.08) * 4) * Math.PI) > 0.5 ? 1 : 0);
      bigText(ctx, 'CRASH', 300, 34, scale, PAL.red2, PAL.black);
    }
    vignette(ctx, 0.5);
  },

  hallway(ctx, u, t) {
    rect(ctx, 0, 0, VIEW_W, VIEW_H, '#241a14');
    const cx = VIEW_W / 2, cy = 104;
    for (let i = 10; i >= 0; i--) {
      const k = i / 10;
      const w = 54 + k * 520, h = 40 + k * 260;
      rect(ctx, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h),
           ['#3a2a1e', '#33251b', '#2c2018'][i % 3]);
    }
    // the doorway at the end, spilling light
    const glow = 0.7 + Math.sin(t * 9) * 0.05;
    ctx.globalAlpha = 0.3 * glow;
    for (let i = 5; i > 0; i--) disc(ctx, cx, cy, 26 + i * 12, '#f0d79a');
    ctx.globalAlpha = 1;
    rect(ctx, Math.round(cx - 26), Math.round(cy - 20), 52, 40, '#f0d79a');
    // two of you, running away from camera into it
    const run = Math.min(1, u * 1.4);
    const scale = 1 - run * 0.45;
    beaver(ctx, Math.round(cx - 30 + run * 16), Math.round(cy + 62 - run * 34), Math.round(56 * scale),
           { pose: 'run', fur: PAL.black, light: PAL.ink, dark: PAL.black, face: 1 });
    beaver(ctx, Math.round(cx + 26 - run * 10), Math.round(cy + 70 - run * 38), Math.round(68 * scale),
           { pose: 'run', fur: PAL.black, light: PAL.ink, dark: PAL.black, face: 1 });
    vignette(ctx, 0.7);
  },

  grandma(ctx, u, t) {
    paintKitchen(ctx, t);
    // the chair she went down with
    rect(ctx, 300, 150, 34, 8, PAL.wood2);
    rect(ctx, 300, 158, 8, 20, PAL.wood1);
    rect(ctx, 326, 158, 8, 13, PAL.wood1);
    // spilled tea, and the cup in pieces
    ctx.globalAlpha = 0.75;
    disc(ctx, 196, ACT - 2, 22, '#7a5230');
    disc(ctx, 196, ACT - 2, 15, '#8f6238');
    ctx.globalAlpha = 1;
    for (const [sx, sy, w] of [[172, ACT - 10, 5], [182, ACT + 2, 4], [216, ACT - 6, 6], [208, ACT + 4, 3]]) {
      rect(ctx, sx, sy, w, 3, PAL.paper);
      rect(ctx, sx, sy, w, 1, PAL.white);
    }
    // the light on her, then her, then the two of you
    ctx.globalAlpha = 0.14;
    disc(ctx, 186, ACT - 14, 58, PAL.gold2);
    ctx.globalAlpha = 1;
    beaver(ctx, 160, ACT - 6, 44, { pose: 'lie', fur: PAL.fur3, light: PAL.fur4, shawl: PAL.purple2 });
    beaver(ctx, 246, ACT, 40, { pose: 'kneel', fur: PAL.fur1, light: PAL.fur2, glasses: true,
                                face: -1, reach: 9 });
    beaver(ctx, 396, ACT, 34, { pose: 'stand', face: -1 });
    vignette(ctx, 0.5);
  },

  phonecall(ctx, u, t) {
    rect(ctx, 0, 0, VIEW_W, VIEW_H, '#2b1f18');
    ctx.globalAlpha = 0.2;
    disc(ctx, 240, 70, 150, PAL.gold);
    ctx.globalAlpha = 1;
    rect(ctx, 148, 16, 184, 172, '#1d2a35');
    frame(ctx, 148, 16, 184, 172, PAL.ink);
    rect(ctx, 154, 22, 172, 34, '#0f1a22');
    // the number, one digit at a time
    const digits = ['1', '1', '2'];
    const shown = Math.min(3, Math.floor(u * 5));
    for (let i = 0; i < shown; i++) bigText(ctx, digits[i], 198 + i * 40, 28, 3, PAL.grass4, PAL.black);
    // keypad
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const kx = 164 + c * 56, ky = 66 + r * 29;
        const key = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'][r * 3 + c];
        const lit = (key === '1' && shown >= 1 && u < 0.5) || (key === '2' && shown >= 3);
        rect(ctx, kx, ky, 46, 22, lit ? PAL.gold2 : '#33424f');
        rect(ctx, kx, ky, 46, 2, lit ? PAL.white : '#48596a');
        frame(ctx, kx, ky, 46, 22, PAL.ink);
        text(ctx, key, kx + 23, ky + 8, lit ? PAL.ink : PAL.paper2, { align: 'center' });
      }
    }
    // a paw, pressing
    const pawY = 118 + Math.round(Math.sin(t * 8) * 2);
    disc(ctx, 212, pawY, 9, PAL.fur3);
    rect(ctx, 204, pawY + 8, 16, 44, PAL.fur2);
    if (u > 0.62) {
      const r = ((u - 0.62) * 300) % 80;
      ctx.globalAlpha = Math.max(0, 0.5 - r / 190);
      for (let i = 0; i < 3; i++) {
        frame(ctx, Math.round(240 - r - i * 8), Math.round(100 - r / 2 - i * 4),
              Math.round(r * 2 + i * 16), Math.round(r + i * 8), PAL.sky4);
      }
      ctx.globalAlpha = 1;
      text(ctx, 'RINGING', 240, 192, PAL.paper2, { align: 'center', shadow: PAL.black });
    }
    vignette(ctx, 0.6);
  },

  ambulance(ctx, u, t) {
    // outside the cabin, in the rain, blue and red washing over everything
    const beat = Math.floor(t * 6) % 2;
    rect(ctx, 0, 0, VIEW_W, VIEW_H, '#1b1836');
    rect(ctx, 0, 0, VIEW_W, 70, '#231d42');
    // a few stars where the cloud breaks
    const stars = rngFrom(88);
    for (let i = 0; i < 30; i++) {
      px(ctx, Math.round(stars() * VIEW_W), Math.round(stars() * 60),
         stars() > 0.7 ? PAL.white : '#8f9ac4');
    }
    // wet grass, and the path up to the door
    rect(ctx, 0, 116, VIEW_W, VIEW_H - 116, '#25401f');
    rect(ctx, 0, 116, VIEW_W, 3, '#31521f');
    const gr = rngFrom(4242);
    for (let i = 0; i < 200; i++) {
      const gx = Math.round(gr() * VIEW_W), gy = 118 + Math.round(gr() * (VIEW_H - 120));
      px(ctx, gx, gy, gr() > 0.6 ? '#31521f' : '#1d3319');
    }
    // stepping stones, running from the door down to where the van waits
    for (let i = 0; i < 10; i++) {
      const sx2 = 350 - i * 30, sy2 = 152 + i * 8;
      rect(ctx, sx2, sy2, 24, 7, '#4a4f52');
      rect(ctx, sx2, sy2, 24, 2, '#6a7075');
      px(ctx, sx2 + 4, sy2 + 4, '#3a3f42');
    }

    // ---- the cabin: same build as the workshop, at night, door standing open
    const hx = 372, hb = 150, hw = 128, hh = 78;
    ctx.globalAlpha = 0.3;
    rect(ctx, hx - hw / 2 - 4, hb - 2, hw + 8, 4, PAL.black);
    ctx.globalAlpha = 1;
    rect(ctx, hx - hw / 2, hb - hh + 22, hw, hh - 22, '#4a3524');
    for (let i = 0; i < 4; i++) rect(ctx, hx - hw / 2, hb - hh + 28 + i * 12, hw, 1, '#3a2a1c');
    rect(ctx, hx - hw / 2, hb - hh + 22, 5, hh - 22, '#5f4229');
    rect(ctx, hx + hw / 2 - 5, hb - hh + 22, 5, hh - 22, '#5f4229');
    for (let r = 0; r < 3; r++) {
      const rw = hw + 14 - r * 10, rx = hx - rw / 2, ry = hb - hh + 16 - r * 7;
      rect(ctx, rx, ry, rw, 8, r === 0 ? '#5f2f24' : '#73382a');
      rect(ctx, rx, ry, rw, 2, '#8a4433');
      for (let k = 0; k < rw; k += 9) px(ctx, rx + k + (r % 2 ? 4 : 0), ry + 5, '#4a241b');
    }
    // chimney
    rect(ctx, hx + hw / 2 - 34, hb - hh - 14, 14, 22, '#4a5058');
    rect(ctx, hx + hw / 2 - 36, hb - hh - 16, 18, 3, '#5f676f');
    // windows: one lit, one dark
    [[hx - 40, true], [hx + 26, false]].forEach(([wx, lit]) => {
      rect(ctx, wx, hb - hh + 34, 24, 20, lit ? '#f7cc55' : '#1d2a35');
      if (lit) rect(ctx, wx, hb - hh + 34, 24, 6, '#fff3c4');
      frame(ctx, wx - 2, hb - hh + 32, 28, 24, '#5f4229');
      rect(ctx, wx + 11, hb - hh + 34, 2, 20, '#5f4229');
      if (lit) {
        ctx.globalAlpha = 0.12;
        disc(ctx, wx + 12, hb - hh + 44, 24, PAL.gold2);
        ctx.globalAlpha = 1;
      }
    });
    // the front door, open, light spilling down the step
    rect(ctx, hx - 12, hb - 38, 24, 38, '#2a1f18');
    rect(ctx, hx - 10, hb - 36, 20, 36, '#f7cc55');
    rect(ctx, hx + 12, hb - 38, 6, 38, '#5f4229');
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#fff0c0';
    ctx.beginPath();
    ctx.moveTo(hx - 10, hb); ctx.lineTo(hx + 10, hb);
    ctx.lineTo(hx + 30, VIEW_H); ctx.lineTo(hx - 34, VIEW_H);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ---- the ambulance: a stubby van, lights going
    const vanX = Math.round(20 + (1 - Math.min(1, u * 2.2)) * -80);
    const vb = 152;
    ctx.globalAlpha = 0.3;
    rect(ctx, vanX + 4, vb - 2, 108, 4, PAL.black);
    ctx.globalAlpha = 1;
    rect(ctx, vanX, vb - 52, 116, 44, '#e8e8ea');
    rect(ctx, vanX, vb - 52, 116, 6, '#c9c9cc');
    rect(ctx, vanX, vb - 24, 116, 6, PAL.red);
    rect(ctx, vanX + 74, vb - 46, 40, 20, '#2a3a48');      // cab windows
    rect(ctx, vanX + 78, vb - 43, 14, 14, '#3f5666');
    rect(ctx, vanX + 96, vb - 43, 14, 14, '#3f5666');
    rect(ctx, vanX + 10, vb - 44, 36, 24, PAL.red);        // the cross
    rect(ctx, vanX + 24, vb - 44, 8, 24, PAL.white);
    rect(ctx, vanX + 10, vb - 36, 36, 8, PAL.white);
    rect(ctx, vanX + 56, vb - 44, 12, 20, '#c9c9cc');      // rear doors
    for (const wx of [vanX + 26, vanX + 92]) {
      disc(ctx, wx, vb - 6, 9, '#1d1712');
      disc(ctx, wx, vb - 6, 5, '#5a636e');
      px(ctx, wx, vb - 6, '#a9b0b8');
    }
    // light bar, and the cones it throws
    rect(ctx, vanX + 38, vb - 58, 18, 7, beat ? '#ff5a4a' : '#5a1a1a');
    rect(ctx, vanX + 58, vb - 58, 18, 7, beat ? '#1a2a5a' : '#6f9aff');
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = beat ? '#ff5a4a' : '#6f9aff';
    ctx.beginPath();
    ctx.moveTo(vanX + 47, vb - 55);
    ctx.lineTo(VIEW_W, vb - 96);
    ctx.lineTo(VIEW_W, vb + 10);
    ctx.fill();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = beat ? '#ff5a4a' : '#6f9aff';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;

    // ---- the fox crew, carrying her down the path
    const march = Math.min(1, Math.max(0, (u - 0.25) * 1.8));
    const fx = Math.round(330 - march * 180);
    const bob = Math.sin(t * 9) * 1.5;
    const step = Math.floor(t * 8) % 4;
    fox(ctx, fx + 52, Math.round(184 + bob), 40, { face: -1, frame: step, reach: true });
    fox(ctx, fx - 6, Math.round(186 - bob), 40, { face: -1, frame: (step + 2) % 4, reach: true });
    // the stretcher between them, with her shawl over it
    rect(ctx, fx - 6, Math.round(160 + bob * 0.4), 62, 5, '#8a919b');
    rect(ctx, fx - 6, Math.round(160 + bob * 0.4), 62, 2, '#cfd5dc');
    rect(ctx, fx, Math.round(154 + bob * 0.4), 50, 6, PAL.purple2);
    rect(ctx, fx + 4, Math.round(152 + bob * 0.4), 14, 4, '#c9a678');
    fox(ctx, fx + 104, 188, 36, { face: -1, frame: (step + 1) % 4 });
    // you and grandpa in the doorway, watching them go
    beaver(ctx, hx - 4, hb, 30, { pose: 'stand', face: -1, glasses: true });
    beaver(ctx, hx + 18, hb, 26, { pose: 'stand', face: -1 });
    rain(ctx, t, 140, 0.5, 3);
    vignette(ctx, 0.5);
  },

  hospital(ctx, u, t) {
    rect(ctx, 0, 0, VIEW_W, VIEW_H, '#7f9a8a');
    rect(ctx, 0, 0, VIEW_W, 70, '#a8c0b0');
    rect(ctx, 0, 66, VIEW_W, 5, '#6b8378');
    rect(ctx, 0, ACT + 6, VIEW_W, VIEW_H - ACT - 6, '#b9c9bd');
    for (let x = -20; x < VIEW_W + 40; x += 40) line(ctx, x, ACT + 6, x - 30, VIEW_H, '#a3b5a8');
    for (let i = 0; i < 3; i++) {
      rect(ctx, 60 + i * 150, 12, 60, 5, PAL.white);
      ctx.globalAlpha = 0.12;
      disc(ctx, 90 + i * 150, 18, 34, PAL.white);
      ctx.globalAlpha = 1;
    }
    // double doors
    rect(ctx, 186, 74, 120, 104, '#8fa899');
    frame(ctx, 186, 74, 120, 104, '#6b8378');
    rect(ctx, 245, 74, 2, 104, '#6b8378');
    disc(ctx, 216, 108, 12, '#cfe0d4');
    disc(ctx, 276, 108, 12, '#cfe0d4');
    // the clock, hands crawling
    disc(ctx, 404, 44, 18, PAL.paper);
    disc(ctx, 404, 44, 16, PAL.white);
    frame(ctx, 386, 26, 37, 37, PAL.stone1);
    const min = t * 0.9;
    line(ctx, 404, 44, Math.round(404 + Math.cos(min) * 12), Math.round(44 + Math.sin(min) * 12), PAL.ink);
    line(ctx, 404, 44, Math.round(404 + Math.cos(min / 12 - 1) * 7), Math.round(44 + Math.sin(min / 12 - 1) * 7), PAL.ink);
    // the bench, and the wait
    rect(ctx, 40, ACT - 22, 116, 8, PAL.wood2);
    rect(ctx, 40, ACT - 14, 116, 4, PAL.wood1);
    rect(ctx, 48, ACT - 10, 6, 16, PAL.wood0);
    rect(ctx, 142, ACT - 10, 6, 16, PAL.wood0);
    beaver(ctx, 72, ACT - 22, 32, { pose: 'sit', fur: PAL.fur1, light: PAL.fur2, glasses: true,
                                    face: 1, closed: true });
    beaver(ctx, 114, ACT - 22, 27, { pose: 'sit', face: -1, closed: u > 0.5 });
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = PAL.night1;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
    vignette(ctx, 0.4);
  },

  bill(ctx, u, t) {
    rect(ctx, 0, 0, VIEW_W, VIEW_H, '#20180f');
    ctx.globalAlpha = 0.22;
    disc(ctx, 240, 20, 180, PAL.gold2);
    ctx.globalAlpha = 1;
    const y = 22 - Math.round(u * 6);
    rect(ctx, 132, y, 216, 170, PAL.paper);
    rect(ctx, 132, y, 216, 4, PAL.white);
    rect(ctx, 132, y + 166, 216, 4, PAL.paper3);
    text(ctx, 'VALLEY INFIRMARY', 240, y + 12, PAL.ink, { align: 'center' });
    rect(ctx, 152, y + 24, 176, 1, PAL.paper3);
    const rows = [
      ['STRETCHER TEAM (FOXES)', '340'],
      ['SPLINT AND WRAP', '620'],
      ['NIGHT WARD, 6 NIGHTS', '1980'],
      ['MEDICINE', '710'],
      ['OWL SPECIALIST', '1150'],
    ];
    rows.forEach((r, i) => {
      const ry = y + 34 + i * 15;
      text(ctx, r[0], 152, ry, PAL.ink2);
      if (u > 0.1 + i * 0.06) text(ctx, r[1], 328, ry, PAL.ink, { align: 'right' });
      rect(ctx, 152, ry + 9, 176, 1, '#e2d2ae');
    });
    rect(ctx, 152, y + 114, 176, 2, PAL.ink);
    text(ctx, 'TOTAL DUE', 152, y + 121, PAL.ink);
    if (u > 0.5) {
      bigText(ctx, '4800', 262, y + 132, 2, PAL.red, PAL.paper2);
      text(ctx, 'ACORNS', 328, y + 152, PAL.red, { align: 'right' });
    }
    if (u > 0.72) text(ctx, 'PAYABLE IN FULL', 240, y + 158, PAL.ink2, { align: 'center' });
    // a paw holding the corner
    disc(ctx, 140, y + 162, 12, PAL.fur2);
    disc(ctx, 152, y + 168, 8, PAL.fur3);
    vignette(ctx, 0.55);
  },

  workshop(ctx, u, t) {
    rect(ctx, 0, 0, VIEW_W, VIEW_H, '#3b2a1c');
    for (let x = 0; x < VIEW_W; x += 20) rect(ctx, x, 0, 1, ACT + 4, '#33241a');
    rect(ctx, 0, ACT + 4, VIEW_W, VIEW_H - ACT - 4, PAL.wood1);
    for (let y = ACT + 8; y < VIEW_H; y += 8) rect(ctx, 0, y, VIEW_W, 1, PAL.wood0);
    // the window, and the shaft of morning through it
    rect(ctx, 34, 20, 72, 62, '#d8e8f0');
    frame(ctx, 34, 20, 72, 62, PAL.wood2);
    rect(ctx, 69, 20, 2, 62, PAL.wood2);
    rect(ctx, 34, 50, 72, 2, PAL.wood2);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.moveTo(36, 82); ctx.lineTo(106, 82); ctx.lineTo(240, VIEW_H); ctx.lineTo(88, VIEW_H);
    ctx.fill();
    ctx.globalAlpha = 1;
    dustMotes(ctx, t, 54, 74, 170, 130, 40);
    // tool board
    rect(ctx, 254, 18, 194, 70, '#4d3524');
    frame(ctx, 254, 18, 194, 70, PAL.wood0);
    for (let i = 0; i < 5; i++) {
      const hx = 270 + i * 37;
      rect(ctx, hx, 28, 3, 36, PAL.wood2);
      rect(ctx, hx - 6, 22, 15, 8, PAL.stone2);
      px(ctx, hx - 4, 24, PAL.stone3);
    }
    for (let i = 0; i < 4; i++) {
      rect(ctx, 276 + i * 42, 72, 32, 3, PAL.stone2);
      for (let k = 0; k < 32; k += 2) px(ctx, 276 + i * 42 + k, 75, PAL.stone3);
    }
    // the bench, the vice, and a stool half made on it
    rect(ctx, 150, 128, 206, 11, PAL.wood2);
    rect(ctx, 150, 128, 206, 3, PAL.wood3);
    rect(ctx, 160, 139, 10, 32, PAL.wood1);
    rect(ctx, 336, 139, 10, 32, PAL.wood1);
    rect(ctx, 176, 110, 40, 18, PAL.wood3);
    rect(ctx, 180, 102, 8, 8, PAL.wood2);
    rect(ctx, 204, 102, 8, 8, PAL.wood2);
    rect(ctx, 300, 116, 26, 12, PAL.stone1);
    rect(ctx, 300, 122, 26, 3, PAL.stone0);
    // sawdust
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 90; i++) {
      const r = rngFrom(500 + i)();
      px(ctx, Math.round(200 + r * 140), Math.round(ACT + 8 + (r * 7 % 4)), r > 0.5 ? PAL.wood4 : PAL.paper2);
    }
    ctx.globalAlpha = 1;
    // grandpa handing over the axe
    const hand = Math.min(1, Math.max(0, (u - 0.35) * 2.5));
    beaver(ctx, 300, ACT + 2, 42, { pose: 'stand', fur: PAL.fur1, light: PAL.fur2, glasses: true,
                                    face: -1, apron: '#6b5330', reach: Math.round(6 + hand * 12) });
    beaver(ctx, 214, ACT + 2, 34, { pose: 'stand', face: 1, reach: Math.round(4 + hand * 14) });
    const ax = Math.round(276 - hand * 22);
    rect(ctx, ax, ACT - 30, 3, 26, PAL.wood2);
    rect(ctx, ax - 5, ACT - 34, 13, 7, PAL.stone2);
    rect(ctx, ax - 5, ACT - 34, 13, 2, PAL.stone3);
    vignette(ctx, 0.45);
  },
};

// ------------------------------------------------------------------ script
// dur is seconds; `lines` are [speaker, words, atFraction].
const INTRO = {
  id: 'intro',
  shots: [
    { shot: 'livingroom', dur: 7.5, push: [1.0, 1.06], pan: [0, 0],
      lines: [['GRANDPA', 'Sit down, sit down. The heron programme is on.', 0.05],
              ['YOU', 'Grandma is still in the kitchen.', 0.42],
              ['GRANDPA', 'She always is. She will come when the tea is done.', 0.66]] },
    { shot: 'crash', dur: 3.2, push: [1.22, 1.05], hardCut: true, shake: 1.6, sound: 'crash',
      lines: [['', '', 0]] },
    { shot: 'hallway', dur: 3.4, push: [1.0, 1.3],
      lines: [['GRANDPA', 'MARGUERITE!', 0.1]] },
    { shot: 'grandma', dur: 6.5, push: [1.14, 1.0],
      lines: [['YOU', 'Grandma? Grandma, can you hear me?', 0.1],
              ['GRANDPA', 'Her leg. Do not move her. The phone, lad. Now.', 0.48]] },
    { shot: 'phonecall', dur: 4.6, push: [1.3, 1.08], sound: 'ring',
      lines: [['YOU', 'Ambulance. My grandmother has fallen.', 0.4]] },
    { shot: 'ambulance', dur: 6.8, push: [1.0, 1.1], sound: 'siren',
      lines: [['FOX MEDIC', 'Stretcher! Mind the step. We have got her.', 0.2],
              ['FOX MEDIC', 'You can follow us. Bring her shawl.', 0.6]] },
    { shot: 'hospital', dur: 5.4, push: [1.06, 1.0],
      lines: [['NURSE', 'She is stable. Sleeping. It was a clean break.', 0.08],
              ['GRANDPA', 'Thank you. Truly.', 0.52]] },
    { shot: 'bill', dur: 7.5, push: [1.0, 1.16], sound: 'bad',
      lines: [['GRANDPA', 'Four thousand eight hundred. I have not got it.', 0.36],
              ['YOU', 'Then I will get it.', 0.72]] },
    { shot: 'workshop', dur: 8.0, push: [1.1, 1.0], sound: 'good',
      lines: [['GRANDPA', 'Your grandmother mended this valley for forty years.', 0.06],
              ['GRANDPA', 'Everything I know is in this room. Take the axe.', 0.34],
              ['GRANDPA', 'We will build her way home. Piece by piece.', 0.66]] },
  ],
  card: { title: 'DAM IT', sub: 'CHAPTER ONE - GRANDPA\'S WORKSHOP' },
};

const SCRIPTS = { intro: INTRO };

// ------------------------------------------------------------------- play
export function playCutscene(id, onEnd) {
  const script = SCRIPTS[id];
  if (!script) { if (onEnd) onEnd(); return false; }
  Object.assign(cut, {
    active: true, script, shot: 0, t: 0, bars: 0, onEnd: onEnd || null,
    lineIndex: -1, lineT: 0, flash: 0, shake: 0, ended: false,
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

export function updateCutscene(dt) {
  if (!cut.active) return;
  const shots = cut.script.shots;
  const shot = shots[cut.shot];
  cut.t += dt;
  cut.lineT += dt;
  cut.bars = Math.min(1, cut.bars + dt * 2.4);
  if (cut.shake > 0) cut.shake = Math.max(0, cut.shake - dt * 1.8);

  // fire the line whose cue we have just passed
  if (shot.lines) {
    const u = cut.t / shot.dur;
    let idx = -1;
    for (let i = 0; i < shot.lines.length; i++) if (u >= shot.lines[i][2]) idx = i;
    if (idx !== cut.lineIndex) { cut.lineIndex = idx; cut.lineT = 0; }
  }

  // skip the whole scene, or hurry along one shot
  if (pressed('Escape')) { endCutscene(); return; }
  if (pressed('Enter', 'Space', 'KeyE') || input.clicked) {
    nextShot();
    return;
  }
  if (cut.t >= shot.dur) nextShot();
}

function nextShot() {
  const shots = cut.script.shots;
  if (cut.shot >= shots.length - 1) {
    // hold the chapter card for a beat, then hand control back
    if (!cut.ended) { cut.ended = true; cut.t = 0; return; }
    endCutscene();
    return;
  }
  cut.shot++;
  cut.t = 0;
  cut.lineIndex = -1;
  cut.lineT = 0;
  const shot = shots[cut.shot];
  if (shot.shake) cut.shake = shot.shake;
  if (shot.sound && sfx[shot.sound]) sfx[shot.sound]();
}

// ------------------------------------------------------------------- draw
export function drawCutscene(ctx, t) {
  if (!cut.active) return;
  const shot = cut.script.shots[cut.shot];
  const u = Math.max(0, Math.min(1, cut.t / shot.dur));

  // paint the shot into the buffer, then crop it for the camera move
  buf.ctx.imageSmoothingEnabled = false;
  const paint = SHOTS[shot.shot] || SHOTS.livingroom;
  paint(buf.ctx, u, t);

  const zoom = shot.push ? shot.push[0] + (shot.push[1] - shot.push[0]) * u : 1;
  const panX = shot.pan ? shot.pan[0] * (1 - u) + (shot.pan[1] || 0) * u : 0;
  const sw = VIEW_W / zoom, sh = VIEW_H / zoom;
  const sx = (VIEW_W - sw) / 2 + panX;
  const sy = (VIEW_H - sh) / 2;
  const kick = cut.shake > 0 ? cut.shake : 0;
  const ox = kick ? Math.round((Math.random() - 0.5) * kick * 9) : 0;
  const oy = kick ? Math.round((Math.random() - 0.5) * kick * 9) : 0;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf.canvas, sx, sy, sw, sh, ox, oy, VIEW_W, VIEW_H);

  // ---- letterbox
  const barH = Math.round(20 * cut.bars);
  rect(ctx, 0, 0, VIEW_W, barH, PAL.black);
  rect(ctx, 0, VIEW_H - barH, VIEW_W, barH, PAL.black);

  // ---- the chapter card, at the very end
  if (cut.ended) {
    ctx.fillStyle = 'rgba(13,10,9,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const card = cut.script.card;
    bigText(ctx, card.title, VIEW_W / 2, 96, 4, PAL.gold2, PAL.black);
    text(ctx, card.sub, VIEW_W / 2, 148, PAL.paper, { align: 'center', shadow: PAL.black });
    if (Math.floor(t * 1.6) % 2 === 0) {
      text(ctx, 'PRESS ENTER', VIEW_W / 2, 176, PAL.paper3, { align: 'center', shadow: PAL.black });
    }
    return;
  }

  // ---- dialogue, typed out
  const lines = shot.lines || [];
  const cur = cut.lineIndex >= 0 ? lines[cut.lineIndex] : null;
  if (cur && cur[1]) {
    const wrapped = wrap(cur[1], VIEW_W - 96);
    const boxH = 15 + wrapped.length * 9;
    const boxY = VIEW_H - barH - boxH - 6;
    ctx.fillStyle = 'rgba(13,10,9,0.78)';
    ctx.fillRect(28, boxY, VIEW_W - 56, boxH);
    rect(ctx, 28, boxY, VIEW_W - 56, 1, PAL.wood2);
    rect(ctx, 28, boxY + boxH - 1, VIEW_W - 56, 1, PAL.wood0);
    if (cur[0]) {
      const nw = textWidth(cur[0]) + 8;
      rect(ctx, 34, boxY - 5, nw, 10, PAL.wood1);
      frame(ctx, 34, boxY - 5, nw, 10, PAL.wood0);
      text(ctx, cur[0], 38, boxY - 3, PAL.gold2);
    }
    // typewriter: 34 characters a second, then it just sits there
    const shown = Math.floor(cut.lineT * 34);
    let used = 0;
    wrapped.forEach((ln, i) => {
      const take = Math.max(0, Math.min(ln.length, shown - used));
      used += ln.length;
      if (take > 0) text(ctx, ln.slice(0, take), 38, boxY + 6 + i * 9, PAL.paper);
    });
  }

  if (Math.floor(t) % 2 === 0) {
    text(ctx, 'ENTER SKIP', VIEW_W - 8, VIEW_H - barH - 10, 'rgba(177,147,106,0.7)', { align: 'right' });
  }
}
