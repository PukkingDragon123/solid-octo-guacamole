// The story scenes, played as a little film: letterbox bars, a camera that
// pushes and pans, hard cuts where they hurt, and dialogue that types itself
// out. Every frame is painted with the same pixel toolkit as the game, into an
// offscreen buffer that the camera then crops - that is where the push comes
// from.

import { VIEW_W, VIEW_H } from '../config.js';
import { PAL, surface, rect, frame, px, disc, line, text, textWidth, bigText, wrap, rngFrom }
  from '../gfx/pixel.js';
import { pressed, input } from '../input.js';
import { sfx } from '../audio.js';

export const cut = {
  active: false, script: null, shot: 0, t: 0, total: 0, bars: 0,
  onEnd: null, lineIndex: -1, lineT: 0, flash: 0, shake: 0, ended: false,
};

const buf = surface(VIEW_W, VIEW_H);

// --------------------------------------------------------------- figures
/**
 * A beaver, drawn at any height. Small enough to be cheap, big enough to act -
 * the poses are what carry the scene, so they are all here in one place.
 */
function beaver(ctx, x, base, h, opts = {}) {
  const fur = opts.fur || PAL.fur2;
  const dark = opts.dark || PAL.fur1;
  const light = opts.light || PAL.fur3;
  const face = opts.face === undefined ? 1 : opts.face;
  const pose = opts.pose || 'stand';
  const w = Math.round(h * 0.46);
  const headR = Math.max(3, Math.round(h * 0.19));
  let hipY = base - Math.round(h * 0.32);
  let headY = base - h + headR;
  let bodyH = hipY - (headY + headR) + 2;

  if (pose === 'sit') { hipY = base - Math.round(h * 0.12); headY = base - h * 0.82; bodyH = hipY - (headY + headR) + 2; }
  if (pose === 'kneel') { hipY = base - Math.round(h * 0.14); headY = base - h * 0.78; bodyH = hipY - (headY + headR) + 2; }

  // lying down is a different animal entirely - draw it flat and leave
  if (pose === 'lie') {
    const len = Math.round(h * 0.92);
    rect(ctx, x - (len >> 1), base - Math.round(h * 0.2), len, Math.round(h * 0.2), fur);
    rect(ctx, x - (len >> 1), base - Math.round(h * 0.2), len, 2, light);
    disc(ctx, x - (len >> 1) - 1, base - Math.round(h * 0.22), headR, fur);
    disc(ctx, x - (len >> 1) - 1, base - Math.round(h * 0.22), headR - 2, light);
    px(ctx, x - (len >> 1) - 3, base - Math.round(h * 0.24), PAL.ink);   // closed eye
    rect(ctx, x - (len >> 1) - 5, base - Math.round(h * 0.24), 3, 1, PAL.ink);
    // tail, flat on the tiles
    rect(ctx, x + (len >> 1), base - Math.round(h * 0.1), Math.round(h * 0.3), Math.round(h * 0.1), dark);
    if (opts.shawl) rect(ctx, x - 2, base - Math.round(h * 0.2), Math.round(len * 0.5), Math.round(h * 0.2), opts.shawl);
    return;
  }

  // tail
  const tailX = face > 0 ? x - (w >> 1) - Math.round(h * 0.22) : x + (w >> 1);
  if (pose !== 'sit') {
    rect(ctx, tailX, hipY - 2, Math.round(h * 0.24), Math.max(2, Math.round(h * 0.12)), dark);
    rect(ctx, tailX, hipY - 2, Math.round(h * 0.24), 1, PAL.fur1);
  }

  // legs
  const legH = base - hipY;
  if (legH > 0) {
    if (pose === 'run') {
      rect(ctx, x - (w >> 1), hipY, Math.max(2, w >> 2), legH, dark);
      rect(ctx, x + 1, hipY, Math.max(2, w >> 2), Math.round(legH * 0.7), dark);
      rect(ctx, x + 1 + (w >> 2), hipY + Math.round(legH * 0.7), Math.max(2, w >> 2), 2, dark);
    } else if (pose === 'kneel') {
      rect(ctx, x - (w >> 1), hipY, w, Math.max(2, legH), dark);
    } else {
      rect(ctx, x - (w >> 1) + 1, hipY, Math.max(2, w >> 2), legH, dark);
      rect(ctx, x + (w >> 2) - 1, hipY, Math.max(2, w >> 2), legH, dark);
    }
    // feet
    rect(ctx, x - (w >> 1) + (face > 0 ? 1 : -1), base - 1, Math.round(w * 0.7), 1, PAL.dirt1);
  }

  // body
  rect(ctx, x - (w >> 1), headY + headR - 1, w, Math.max(3, bodyH), fur);
  rect(ctx, x - (w >> 1), headY + headR - 1, w, 2, light);
  if (opts.apron) {
    rect(ctx, x - (w >> 1) + 1, headY + headR + 2, w - 2, Math.max(2, bodyH - 3), opts.apron);
    px(ctx, x - 1, headY + headR + 1, PAL.paper3);
  }
  if (opts.shawl) rect(ctx, x - (w >> 1) - 1, headY + headR, w + 2, Math.max(2, Math.round(bodyH * 0.5)), opts.shawl);

  // arms
  const armY = headY + headR + Math.round(bodyH * 0.2);
  const reach = opts.reach || 0;
  if (reach) {
    rect(ctx, face > 0 ? x + (w >> 1) : x - (w >> 1) - reach, armY, reach, 2, light);
  } else if (pose === 'run') {
    rect(ctx, face > 0 ? x + (w >> 1) - 1 : x - (w >> 1) - 2, armY - 1, 3, 2, light);
  } else {
    rect(ctx, x - (w >> 1) - 1, armY, 2, Math.max(2, Math.round(bodyH * 0.5)), light);
    rect(ctx, x + (w >> 1) - 1, armY, 2, Math.max(2, Math.round(bodyH * 0.5)), light);
  }

  // head
  disc(ctx, x, headY, headR, fur);
  disc(ctx, x, headY - 1, headR - 1, light);
  const mz = face > 0 ? headR - 1 : -(headR - 1);
  rect(ctx, x + mz - (face > 0 ? 0 : 2), headY, 3, 2, PAL.fur4);  // muzzle
  px(ctx, x + mz + (face > 0 ? 1 : -2), headY, PAL.ink);          // nose
  disc(ctx, x - Math.round(headR * 0.5) * -face, headY + headR - 1, 1, PAL.paper);  // tooth
  // ear
  disc(ctx, x - Math.round(headR * 0.6) * face, headY - Math.round(headR * 0.6), Math.max(1, headR >> 2), dark);
  // eye
  const eyeX = x + Math.round(headR * 0.4) * face;
  if (opts.closed) rect(ctx, eyeX - 1, headY - 1, 3, 1, PAL.ink);
  else { px(ctx, eyeX, headY - 1, PAL.ink); px(ctx, eyeX + face, headY - 1, PAL.ink); }
  if (opts.glasses) {
    frame(ctx, eyeX - 2, headY - 3, 5, 4, PAL.stone3);
    px(ctx, eyeX + 3 * face, headY - 2, PAL.stone2);
  }
  if (opts.cap) { rect(ctx, x - headR, headY - headR - 1, headR * 2, 2, opts.cap); rect(ctx, x - headR + (face > 0 ? headR : -1), headY - headR + 1, headR, 1, opts.cap); }
}

/** A fox in medic orange, running or carrying. */
function fox(ctx, x, base, h, opts = {}) {
  const fur = opts.fur || '#d2691e';
  const face = opts.face === undefined ? 1 : opts.face;
  const w = Math.round(h * 0.4);
  const headR = Math.max(3, Math.round(h * 0.17));
  const hipY = base - Math.round(h * 0.34);
  rect(ctx, x - (w >> 1), hipY, 2, base - hipY, PAL.ink2);
  rect(ctx, x + 1, hipY, 2, Math.round((base - hipY) * (opts.stride ? 0.7 : 1)), PAL.ink2);
  // brush tail
  const tx = face > 0 ? x - (w >> 1) - Math.round(h * 0.3) : x + (w >> 1);
  rect(ctx, tx, hipY - 4, Math.round(h * 0.3), 4, fur);
  rect(ctx, tx, hipY - 4, Math.round(h * 0.12), 4, PAL.paper);
  // body in a medic vest
  rect(ctx, x - (w >> 1), base - h + headR, w, hipY - (base - h + headR), fur);
  rect(ctx, x - (w >> 1), base - h + headR + 2, w, Math.round(h * 0.22), '#f2f2f2');
  px(ctx, x, base - h + headR + 4, PAL.red);
  rect(ctx, x - 1, base - h + headR + 3, 3, 1, PAL.red);
  rect(ctx, x, base - h + headR + 2, 1, 3, PAL.red);
  // head with a long snout and black-tipped ears
  const headY = base - h + headR;
  disc(ctx, x, headY, headR, fur);
  rect(ctx, x + (face > 0 ? headR - 1 : -headR - 2), headY, 4, 2, fur);
  px(ctx, x + (face > 0 ? headR + 2 : -headR - 2), headY, PAL.ink);
  rect(ctx, x - headR + 1, headY - headR - 1, 2, 3, PAL.ink2);
  rect(ctx, x + headR - 2, headY - headR - 1, 2, 3, PAL.ink2);
  px(ctx, x + Math.round(headR * 0.4) * face, headY - 1, PAL.ink);
  if (opts.reach) rect(ctx, face > 0 ? x + (w >> 1) : x - (w >> 1) - opts.reach, headY + headR, opts.reach, 2, fur);
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
  rect(ctx, 0, 0, VIEW_W, FLOOR, '#4a3524');
  for (let x = 0; x < VIEW_W; x += 24) rect(ctx, x, 0, 1, FLOOR, '#3d2b1d');
  rect(ctx, 0, FLOOR - 26, VIEW_W, 4, '#5c4029');       // dado rail
  rect(ctx, 0, FLOOR - 26, VIEW_W, 1, PAL.wood3);
  // floorboards, receding
  rect(ctx, 0, FLOOR, VIEW_W, VIEW_H - FLOOR, PAL.wood2);
  for (let y = FLOOR; y < VIEW_H; y += 7) rect(ctx, 0, y, VIEW_W, 1, PAL.wood1);
  for (let x = -20; x < VIEW_W + 40; x += 40) line(ctx, x, FLOOR, x - 16, VIEW_H, PAL.wood1);
  // rug
  rect(ctx, 116, FLOOR + 12, 236, 38, '#8e3b3b');
  frame(ctx, 116, FLOOR + 12, 236, 38, '#b5514b');
  frame(ctx, 122, FLOOR + 16, 224, 30, '#6d2c2c');
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
  // the glow it throws, laid in first as soft discs so it has no hard edges
  ctx.globalAlpha = 0.07 * flick;
  for (let i = 1; i <= 4; i++) disc(ctx, x + w / 2, y + h / 2, 60 + i * 22, PAL.sky3);
  ctx.globalAlpha = 1;
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
  rect(ctx, x - 22, base - 32, 44, 32, '#6b4b6b');
  rect(ctx, x - 22, base - 32, 44, 3, '#8a648a');
  rect(ctx, x - 26, base - 20, 6, 20, '#5a3f5a');
  rect(ctx, x + 20, base - 20, 6, 20, '#5a3f5a');
  rect(ctx, x - 20, base - 11, 40, 6, '#7d597d');
  rect(ctx, x - 18, base, 4, 4, PAL.wood0);
  rect(ctx, x + 14, base, 4, 4, PAL.wood0);
}

/** The kitchen, seen from the doorway. */
function paintKitchen(ctx, t) {
  const floorY = 138;
  rect(ctx, 0, 0, VIEW_W, floorY, '#5a6b58');
  for (let y = 0; y < floorY; y += 12) rect(ctx, 0, y, VIEW_W, 1, '#4d5c4c');
  rect(ctx, 0, floorY, VIEW_W, VIEW_H - floorY, '#b1936a');
  for (let x = -10; x < VIEW_W + 30; x += 22) line(ctx, x, floorY, x - 22, VIEW_H, '#98795a');
  for (let y = floorY; y < VIEW_H; y += 10) rect(ctx, 0, y, VIEW_W, 1, '#98795a');
  // counter and shelves
  rect(ctx, 268, 92, 212, 10, PAL.wood2);
  rect(ctx, 268, 102, 212, 36, PAL.wood1);
  for (let i = 0; i < 4; i++) rect(ctx, 278 + i * 52, 108, 38, 24, PAL.wood0);
  rect(ctx, 278, 58, 190, 3, PAL.wood2);
  for (let i = 0; i < 5; i++) {
    rect(ctx, 286 + i * 32, 44, 14, 14, i % 2 ? PAL.paper2 : PAL.sky3);
    rect(ctx, 286 + i * 32, 44, 14, 2, PAL.white);
  }
  // the stove, with the kettle still steaming
  rect(ctx, 54, 104, 66, 34, PAL.stone1);
  rect(ctx, 54, 104, 66, 4, PAL.stone2);
  disc(ctx, 76, 100, 8, PAL.stone0);
  disc(ctx, 76, 98, 7, PAL.stone1);
  rect(ctx, 70, 92, 12, 8, PAL.stone2);
  rect(ctx, 82, 94, 4, 2, PAL.stone3);
  for (let i = 0; i < 4; i++) {
    const sy = 86 - ((t * 14 + i * 8) % 26);
    px(ctx, 76 + Math.round(Math.sin(sy * 0.3) * 3), sy, PAL.paper2);
  }
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
    rect(ctx, 0, 0, VIEW_W, VIEW_H, PAL.night0);
    rect(ctx, 0, 116, VIEW_W, VIEW_H - 116, '#1a2418');
    // the house
    rect(ctx, 306, 46, 152, 82, '#3a2b20');
    rect(ctx, 298, 32, 168, 16, '#4a3526');
    for (let i = 0; i < 3; i++) {
      rect(ctx, 320 + i * 46, 60, 28, 24, i === 1 ? '#f0d79a' : '#22303c');
      frame(ctx, 320 + i * 46, 60, 28, 24, PAL.wood0);
    }
    rect(ctx, 362, 94, 26, 34, PAL.wood1);
    rect(ctx, 364, 96, 22, 32, '#f0d79a');
    for (let i = 0; i < 8; i++) rect(ctx, 196 + i * 24, 138 + i, 22, 7, PAL.stone1);
    // the ambulance
    const vanX = Math.round(26 + (1 - Math.min(1, u * 2.2)) * -70);
    rect(ctx, vanX, 82, 112, 50, '#f2f2f2');
    rect(ctx, vanX, 82, 112, 7, PAL.red);
    rect(ctx, vanX + 76, 90, 36, 24, '#22303c');
    rect(ctx, vanX + 10, 96, 38, 28, PAL.red);
    rect(ctx, vanX + 25, 96, 8, 28, PAL.white);
    rect(ctx, vanX + 10, 106, 38, 6, PAL.white);
    for (const wx of [vanX + 24, vanX + 90]) {
      disc(ctx, wx, 134, 9, PAL.ink);
      disc(ctx, wx, 134, 4, PAL.stone2);
    }
    const beat = Math.floor(t * 6) % 2;
    rect(ctx, vanX + 38, 74, 18, 8, beat ? PAL.red2 : '#5a1a1a');
    rect(ctx, vanX + 58, 74, 18, 8, beat ? '#1a2a5a' : PAL.blue2);
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = beat ? PAL.red2 : PAL.blue2;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
    // the fox crew, carrying her out
    const march = Math.min(1, Math.max(0, (u - 0.25) * 1.8));
    const fx = Math.round(356 - march * 190);
    const bob = Math.sin(t * 9) * 1.5;
    fox(ctx, fx + 44, Math.round(ACT - 6 + bob), 40, { face: -1, stride: true, reach: 10 });
    fox(ctx, fx - 4, Math.round(ACT - 6 - bob), 40, { face: -1, stride: false, reach: 10 });
    rect(ctx, fx - 2, Math.round(ACT - 28 + bob * 0.4), 50, 5, PAL.stone2);
    rect(ctx, fx + 2, Math.round(ACT - 32 + bob * 0.4), 42, 5, PAL.purple2);
    fox(ctx, fx + 90, ACT - 4, 36, { face: -1, stride: true });
    // the two of you in the doorway
    beaver(ctx, 372, 128, 26, { pose: 'stand', face: -1, fur: PAL.fur1, glasses: true });
    beaver(ctx, 390, 128, 21, { pose: 'stand', face: -1 });
    rain(ctx, t, 130, 0.55, 3);
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
