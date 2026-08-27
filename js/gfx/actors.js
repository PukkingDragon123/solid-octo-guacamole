// Everyone in the story, drawn to match the beaver you already play as: the
// same 16x18 build, the same fur ramp, the same 1px ink outline and soft
// ground shadow. Poses the original sprite bank never needed - chopping,
// sawing, driving screws, carrying, kneeling, lying down - live here, plus
// top-down versions for the scenes played from above.

import { PAL, sprite, rect, px, disc, line, outline, shadowUnder } from './pixel.js';
import { RAMPS, mix, contact } from './paint.js';

/** Brighter, more saturated tones than the valley palette - sunlit, not dim. */
export const SUN = {
  grass0: '#3d7a2e', grass1: '#4f9c33', grass2: '#6fbe45', grass3: '#8fd85c', grass4: '#b6ef7c',
  wood0: '#3b2a1c', wood1: '#6b4423', wood2: '#96602f', wood3: '#c58a45', wood4: '#e6b166',
  wall0: '#5a3a24', wall1: '#7c5130', wall2: '#a06c3f',
  floor0: '#b07840', floor1: '#c78a4c', floor2: '#e0a463',
  leaf0: '#276b2c', leaf1: '#3d9438', leaf2: '#5cba48', leaf3: '#86dd63', leaf4: '#b6f086',
  sky0: '#4aa3e0', sky1: '#77c6f2', sky2: '#a3ddfa', sky3: '#cdeeff',
  ink: '#2b1d14',      // warm outline, never pure black
  cloth: '#e8626f', clothB: '#4f8be8', clothG: '#f2c14e',
};

export const HERO_W = 26, HERO_H = 34;
/** The row the feet stand on, so a scene can plant the sprite exactly. */
export const HERO_FEET = 32;

const GREY5 = {
  d0: '#3a332c', d1: '#5f564c', m: '#867c70', l: '#aaa094', hi: '#cdc3b6', rim: '#e6ded2',
};
const GRAN5 = {
  d0: '#4a3526', d1: '#7a5c40', m: '#a3805c', l: '#c9a678', hi: '#e6cb9c', rim: '#f4e2c2',
};

const FUR5 = {
  d0: '#33200f', d1: '#5c3a1e', m: '#84552c', l: '#a97a44', hi: '#cba169', rim: '#e6c48f',
};

/**
 * The body every pose is built from. `p` moves the limbs about. Everything is
 * laid out from the feet up so a pose can shorten the legs or drop the torso
 * without the head walking off the top of the sprite.
 */
function heroBody(ctx, p) {
  const f = p.fur || FUR5;
  const cx = 13;
  const base = p.base === undefined ? HERO_FEET : p.base;   // the row the boots stand on
  const hipY = base - (p.legLen === undefined ? 8 : p.legLen);
  const shoulderY = hipY - (p.torso === undefined ? 11 : p.torso);
  const headR = 6;
  const headY = shoulderY - headR + 3;      // the head overlaps the shoulders
  const mz = p.face > 0 ? 1 : -1;           // which way the face points

  // ---- tail: a flat paddle trailing behind, angled down so it reads as a tail
  // and not as a rail nailed to the wall
  if (!p.noTail) {
    const dir = -mz;
    for (let i = 0; i < 7; i++) {
      const th = i < 2 ? 4 : i < 5 ? 6 : 4;              // the paddle swells, then rounds off
      const ty = hipY - 2 + Math.round(i * 0.5) - (th >> 1) + 2;
      const tx = dir > 0 ? cx + 5 + i : cx - 6 - i;
      rect(ctx, tx, ty, 1, th, i < 2 ? f.d1 : f.d0);
      if (i > 1 && i % 2 === 0) px(ctx, tx, ty + 2, f.d1);   // the scaly cross-hatch
    }
  }

  // ---- legs: two of them, with daylight between, and a boot on each
  const lift = p.legs || [0, 0];
  const legW = 4;
  const bootH = Math.min(3, Math.max(2, base - hipY));
  for (const [i, dx] of [[0, -5], [1, 2]]) {
    const ly = hipY - lift[i];
    const lh = base - ly - bootH;
    if (lh > 0) {
      rect(ctx, cx + dx, ly, legW, lh, f.d1);
      rect(ctx, cx + dx, ly, 1, lh, f.m);
      rect(ctx, cx + dx + legW - 1, ly, 1, lh, f.d0);
    }
    // the boot, flat on the floor, toe pointing the way you face
    const by = base - bootH;
    const bx = cx + dx - (mz > 0 ? 1 : 1);
    rect(ctx, bx, by, legW + 2, bootH, '#4a3220');
    rect(ctx, bx, by, legW + 2, 1, '#6b4a2c');
    px(ctx, mz > 0 ? bx + legW + 1 : bx, by, '#8a6338');
  }

  // ---- torso: a rounded barrel, lit from the top left
  const bw = 14;
  const bh = hipY - shoulderY + 2;
  for (let y = 0; y < bh; y++) {
    const t = y / bh;
    const inset = t < 0.1 || t > 0.86 ? 1 : 0;
    const tone = t < 0.2 ? f.l : t < 0.62 ? f.m : f.d1;
    rect(ctx, cx - (bw >> 1) + inset, shoulderY + y, bw - inset * 2, 1, tone);
  }
  rect(ctx, cx - (bw >> 1), shoulderY + 1, 1, bh - 2, f.l);
  rect(ctx, cx + (bw >> 1) - 1, shoulderY + 1, 1, bh - 2, f.d0);
  // a paler chest, offset toward the face so the body has a front and a back
  rect(ctx, cx - 2 + mz, shoulderY + 3, 5, bh - 6, f.hi);
  px(ctx, cx - 2 + mz, shoulderY + 3, f.l);

  // ---- an apron or coat over the belly, short enough to leave the legs free
  if (p.apron) {
    const ah = Math.max(4, bh - 5);
    rect(ctx, cx - (bw >> 1) + 2, shoulderY + 4, bw - 4, ah, p.apron);
    rect(ctx, cx - (bw >> 1) + 2, shoulderY + 4, bw - 4, 1, mix(p.apron, '#ffffff', 0.32));
    rect(ctx, cx - (bw >> 1) + 2, shoulderY + 3 + ah, bw - 4, 1, mix(p.apron, '#000000', 0.3));
  }
  // tool belt with a buckle
  rect(ctx, cx - (bw >> 1) + 1, hipY - 2, bw - 2, 2, '#5a3a1e');
  rect(ctx, cx - (bw >> 1) + 1, hipY - 2, bw - 2, 1, '#7c5130');
  rect(ctx, cx - 1, hipY - 2, 3, 2, '#c69a3c');
  px(ctx, cx, hipY - 2, '#e8c46a');

  // ---- arms: a limb with a paw on the end, hugging the body's edge
  const armY = shoulderY + 3;
  const arm = p.arm || 'down';
  const limb = (x, y, w, h) => {
    rect(ctx, x, y, w, h, f.d1);
    rect(ctx, x, y, 1, h, f.m);
    rect(ctx, x + w - 1, y, 1, h, f.d0);
    if (h >= w) {                       // hanging: paw at the bottom
      rect(ctx, x, y + h - 2, w, 2, f.l);
      px(ctx, x, y + h - 1, f.m);
    } else {                            // reaching: paw at the far end
      const px0 = mz > 0 ? x + w - 2 : x;
      rect(ctx, px0, y, 2, h, f.l);
    }
  };
  const near = mz > 0 ? cx + 3 : cx - 7;
  if (arm === 'down') limb(near, armY, 4, 8);
  else if (arm === 'up') limb(near, armY - 6, 4, 9);
  else if (arm === 'out') limb(mz > 0 ? cx + 4 : cx - 10, armY + 3, 6, 4);
  else if (arm === 'both-up') { limb(cx + 3, armY - 7, 4, 10); limb(cx - 7, armY - 7, 4, 10); }
  else if (arm === 'both-out') { limb(cx + 4, armY + 2, 6, 4); limb(cx - 10, armY + 2, 6, 4); }

  // ---- head: ears first so they sit behind the skull
  for (const ex of [cx - 7, cx + 5]) {
    rect(ctx, ex, headY - 4, 2, 3, f.d1);
    px(ctx, ex, headY - 4, f.m);
    px(ctx, ex + (ex < cx ? 1 : 0), headY - 3, f.d0);
  }
  disc(ctx, cx, headY, headR, f.m);
  disc(ctx, cx - 1, headY - 1, headR - 1, f.l);
  disc(ctx, cx - 2, headY - 2, headR - 3, f.hi);
  // muzzle pushed out the front, with a nose and the two front teeth
  const mx = mz > 0 ? cx + 3 : cx - 7;
  rect(ctx, mx, headY - 1, 4, 4, f.hi);
  rect(ctx, mx, headY - 1, 4, 1, f.rim);
  px(ctx, mz > 0 ? mx + 3 : mx, headY, PAL.ink);
  rect(ctx, mz > 0 ? mx + 1 : mx, headY + 3, 3, 2, PAL.white);
  px(ctx, mz > 0 ? mx + 1 : mx + 2, headY + 4, '#d8d2c4');
  // eye, with a glint
  const eyeX = cx + mz * 2;
  if (p.closed) rect(ctx, eyeX - 1, headY - 1, 3, 1, PAL.ink);
  else {
    rect(ctx, eyeX - 1, headY - 2, 3, 3, PAL.ink);
    px(ctx, eyeX, headY - 2, PAL.white);
  }

  // ---- the hard hat, with the shadow it casts on the face
  if (p.hat !== false) {
    const brimY = headY - headR;
    // the crown: a dome, lit along the top left
    for (const [y, w] of [[-5, 6], [-4, 8], [-3, 10], [-2, 11], [-1, 11]]) {
      rect(ctx, cx - (w >> 1), brimY + y, w, 1, y < -3 ? '#f7cc55' : y < -1 ? '#e8c46a' : '#c69a3c');
    }
    px(ctx, cx - 2, brimY - 4, '#fff0b0');
    // the brim, dipping toward the face
    rect(ctx, cx - 7, brimY, 14, 2, '#c69a3c');
    rect(ctx, cx - 7, brimY, 14, 1, '#e8c46a');
    rect(ctx, mz > 0 ? cx + 6 : cx - 8, brimY + 1, 2, 1, '#c69a3c');
    rect(ctx, cx - 7, brimY + 2, 14, 1, '#8a6a24');
    ctx.globalAlpha = 0.22;
    rect(ctx, cx - 5, brimY + 3, 10, 1, PAL.ink);
    ctx.globalAlpha = 1;
  }

  return { cx, base, hipY, shoulderY, headY, headR, mz };
}

/**
 * You. `pose`: idle walk run jump chop saw screw carry sit kneel push.
 * Four frames each, so callers never special-case a pose.
 */
export function hero(pose, frame = 0) {
  const f = frame % 4;
  return sprite(`hero5:${pose}:${f}`, HERO_W, HERO_H, (ctx) => {
    const bob = pose === 'idle' ? (f % 2) : (f === 1 || f === 3 ? 1 : 0);
    const p = { face: 1, base: HERO_H - 2, torso: 11, legLen: 9, hat: true };

    if (pose === 'walk' || pose === 'run') {
      const swing = f === 0 ? 0 : f === 1 ? 1 : f === 2 ? 0 : -1;
      p.legs = [swing > 0 ? 2 : 0, swing < 0 ? 2 : 0];
      p.arm = swing > 0 ? 'out' : 'down';
      p.base = HERO_H - 2 - (f % 2 === 1 ? 1 : 0);
    } else if (pose === 'jump') {
      p.legs = [3, 1]; p.arm = 'up'; p.base = HERO_H - 4;
    } else if (pose === 'sit') {
      p.legLen = 3; p.torso = 10; p.arm = 'down';
    } else if (pose === 'kneel') {
      p.legLen = 4; p.torso = 10; p.arm = 'out';
    } else if (pose === 'chop') {
      p.arm = f < 2 ? 'both-up' : 'both-out';
      p.base = HERO_H - 2 - (f === 2 ? 1 : 0);
    } else if (pose === 'saw') {
      p.arm = 'out'; p.base = HERO_H - 2 - (f % 2);
    } else if (pose === 'screw') {
      p.arm = 'up';
    } else if (pose === 'carry') {
      p.arm = 'both-up';
      p.legs = f % 2 ? [1, 0] : [0, 1];
    } else if (pose === 'push') {
      p.arm = 'out';
    } else {
      p.arm = 'down';
      p.base = HERO_H - 2 - (bob ? 1 : 0);
    }

    heroBody(ctx, p);

    // tools, so the action reads even without the world around it
    if (pose === 'chop') {
      if (f < 2) {
        rect(ctx, 17, 2, 3, 12, RAMPS.oak[2]);
        rect(ctx, 13, 0, 11, 4, RAMPS.iron[2]);
        rect(ctx, 13, 0, 11, 1, RAMPS.iron[4]);
      } else {
        rect(ctx, 19, 16, 7, 3, RAMPS.oak[2]);
        rect(ctx, 23, 18, 3, 7, RAMPS.iron[2]);
        px(ctx, 23, 18, RAMPS.iron[4]);
      }
    } else if (pose === 'saw') {
      rect(ctx, 18, 20, 8, 3, RAMPS.metal[2]);
      for (let i = 0; i < 8; i += 2) px(ctx, 18 + i, 23, RAMPS.metal[4]);
    } else if (pose === 'screw') {
      rect(ctx, 17, 6, 3, 7, PAL.red);
      rect(ctx, 17, 13, 3, 4, RAMPS.metal[2]);
    }
    outline(ctx, HERO_W, HERO_H, SUN.ink);
  });
}

// ------------------------------------------------------------------ elder
/** Grandpa: grey, spectacled, in the leather apron he has worn for forty years. */
export function elder(pose, frame = 0) {
  const f = frame % 4;
  return sprite(`elder5:${pose}:${f}`, HERO_W, HERO_H, (ctx) => {
    const bob = f % 2;
    const p = { face: 1, base: HERO_H - 2 - bob, torso: 11, legLen: 8, hat: false,
                fur: GREY5, apron: '#8a6a3f' };
    if (pose === 'kneel') { p.legLen = 4; p.torso = 10; p.arm = 'out'; }
    else if (pose === 'hold' || pose === 'point') p.arm = 'out';
    else if (pose === 'sit') { p.legLen = 3; p.torso = 10; p.arm = 'down'; }
    else p.arm = f % 2 ? 'down' : 'out';
    const m = heroBody(ctx, p);

    // a flat cap and wire spectacles, so he reads as grandpa at a glance
    const { cx, headY, headR, mz } = m;
    const capY = headY - headR;
    rect(ctx, cx - 6, capY, 13, 2, '#6b5330');          // the band
    rect(ctx, cx - 6, capY, 13, 1, '#8a6d3b');
    for (const [dy, w] of [[-1, 11], [-2, 9], [-3, 6]]) {
      rect(ctx, cx - (w >> 1), capY + dy, w, 1, dy > -3 ? '#7a5f37' : '#8a6d3b');
    }
    rect(ctx, cx + (mz > 0 ? 5 : -8), capY + 1, 4, 2, '#6b5330');   // the peak
    // spectacles: a lens over the eye, a wire back to the ear
    rect(ctx, cx + mz, headY - 3, 4, 1, RAMPS.metal[3]);
    rect(ctx, cx + mz, headY + 1, 4, 1, RAMPS.metal[3]);
    px(ctx, cx + mz, headY - 2, RAMPS.metal[3]);
    px(ctx, cx + mz + 3, headY - 2, RAMPS.metal[3]);
    ctx.globalAlpha = 0.3;
    px(ctx, cx + mz + 1, headY - 2, '#dff0ff');
    ctx.globalAlpha = 1;
    rect(ctx, cx - mz * 3, headY - 3, 3, 1, RAMPS.metal[2]);
    if (pose === 'hold') {
      rect(ctx, cx + 7, headY + 6, 3, 15, RAMPS.oak[2]);
      rect(ctx, cx + 4, headY + 3, 10, 4, RAMPS.iron[2]);
      rect(ctx, cx + 4, headY + 3, 10, 1, RAMPS.iron[4]);
    }
    outline(ctx, HERO_W, HERO_H, SUN.ink);
  });
}

/** Grandma: the shawl, and the two poses the story needs her in. */
export function granny(pose = 'lie') {
  const w = pose === 'lie' ? 40 : HERO_W;
  return sprite(`granny5:${pose}`, w, HERO_H, (ctx) => {
    if (pose === 'lie') {
      const base = 28;
      // her body, flat out, head to the left
      rect(ctx, 10, base - 10, 22, 10, GRAN5.m);
      rect(ctx, 10, base - 10, 22, 2, GRAN5.l);
      rect(ctx, 10, base - 1, 22, 1, GRAN5.d0);
      rect(ctx, 14, base - 10, 15, 10, '#8256c4');
      rect(ctx, 14, base - 10, 15, 1, '#a97ee0');
      disc(ctx, 7, base - 12, 6, GRAN5.m);
      disc(ctx, 6, base - 13, 5, GRAN5.l);
      disc(ctx, 5, base - 14, 3, GRAN5.hi);
      rect(ctx, 2, base - 12, 4, 1, PAL.ink);       // closed eye
      rect(ctx, 1, base - 10, 4, 2, GRAN5.hi);      // muzzle
      disc(ctx, 9, base - 18, 3, GRAN5.hi);         // her bun
      rect(ctx, 31, base - 6, 8, 6, GRAN5.d1);      // tail
      rect(ctx, 15, base, 4, 3, GRAN5.d1);
      rect(ctx, 25, base, 4, 3, GRAN5.d1);
      outline(ctx, w, HERO_H, SUN.ink);
    } else {
      const p = { face: 1, base: HERO_H - 2, torso: 11, legLen: 6, hat: false, fur: GRAN5 };
      const m = heroBody(ctx, p);
      const { cx, shoulderY, headY, headR } = m;
      // a knitted shawl, narrowing to a point down her back
      for (let y = 0; y < 9; y++) {
        const ww = 13 - Math.round(y * 0.8);
        rect(ctx, cx - (ww >> 1), shoulderY + 1 + y, ww, 1,
             y === 0 ? '#a97ee0' : y > 6 ? '#5f3b96' : '#8256c4');
        if (y % 3 === 1) px(ctx, cx - (ww >> 1) + 2, shoulderY + 1 + y, '#a97ee0');
      }
      rect(ctx, cx - 5, shoulderY + 10, 10, 1, '#5f3b96');   // the fringe
      disc(ctx, cx - 3, headY - headR - 1, 3, GRAN5.hi);      // her bun
      disc(ctx, cx - 3, headY - headR - 2, 2, GRAN5.rim);
      outline(ctx, w, HERO_H, SUN.ink);
    }
  });
}

const FOX5 = {
  d0: '#8a3d12', d1: '#b4521c', m: '#d2691e', l: '#e88a3d', hi: '#f2b077', rim: '#ffd7a8',
};

/** The stretcher crew: same build, longer snout, black socks, medic vest. */
export function foxMedic(frame = 0, carrying = false) {
  const f = frame % 4;
  return sprite(`fox5:${f}:${carrying ? 1 : 0}`, HERO_W, HERO_H, (ctx) => {
    const swing = f === 0 ? 0 : f === 1 ? 1 : f === 2 ? 0 : -1;
    const p = { face: -1, base: HERO_H - 2 - (f % 2), torso: 11, legLen: 9, hat: false,
                fur: FOX5, legs: [swing > 0 ? 2 : 0, swing < 0 ? 2 : 0],
                arm: carrying ? 'out' : swing > 0 ? 'out' : 'down' };
    heroBody(ctx, p);
    const headY = p.base - p.legLen - p.torso - 5;
    // white vest with a red cross
    rect(ctx, 6, headY + 10, 14, 8, '#f2f2f2');
    rect(ctx, 6, headY + 10, 14, 1, '#ffffff');
    rect(ctx, 12, headY + 11, 3, 6, PAL.red);
    rect(ctx, 10, headY + 13, 7, 2, PAL.red);
    // tipped ears and a longer snout
    rect(ctx, 6, headY - 10, 3, 5, FOX5.d1);
    rect(ctx, 17, headY - 10, 3, 5, FOX5.d1);
    rect(ctx, 6, headY - 10, 3, 2, PAL.ink2);
    rect(ctx, 17, headY - 10, 3, 2, PAL.ink2);
    rect(ctx, 1, headY - 1, 6, 3, FOX5.hi);
    px(ctx, 0, headY, PAL.ink);
    // black socks
    for (const lx of [8, 14]) rect(ctx, lx, HERO_H - 5, 5, 3, PAL.ink2);
    outline(ctx, HERO_W, HERO_H, SUN.ink);
  });
}

// ---------------------------------------------------------------- top down
export const TOP_W = 24, TOP_H = 30;
/** The row the feet stand on in the top-down sprites. */
export const TOP_FEET = 28;

/** The shared top-down build: big head, readable silhouette, four directions. */
function topBody(ctx, dir, step, fur, opts = {}) {
  const cx = 12;
  const base = TOP_FEET - (opts.bob || 0);
  const f = fur;
  // tail, when facing away
  if (dir === 'up') {
    rect(ctx, cx - 4, base - 7, 8, 7, f.d0);
    rect(ctx, cx - 4, base - 7, 8, 1, f.d1);
  }
  // feet
  rect(ctx, cx - 7 + (step > 0 ? 1 : 0), base - 4, 5, 4, f.d1);
  rect(ctx, cx + 2 - (step < 0 ? 1 : 0), base - 4, 5, 4, f.d1);
  rect(ctx, cx - 7 + (step > 0 ? 1 : 0), base - 1, 5, 1, f.d0);
  rect(ctx, cx + 2 - (step < 0 ? 1 : 0), base - 1, 5, 1, f.d0);
  // body
  const by = base - 16, bh = 13, bw = 16;
  for (let y = 0; y < bh; y++) {
    const t = y / bh;
    rect(ctx, cx - bw / 2, by + y, bw, 1, t < 0.2 ? f.l : t < 0.66 ? f.m : f.d1);
  }
  rect(ctx, cx - bw / 2, by, 2, bh, f.l);
  rect(ctx, cx + bw / 2 - 2, by, 2, bh, f.d0);
  if (opts.apron) rect(ctx, cx - 5, by + 4, 10, bh - 5, opts.apron);
  else rect(ctx, cx - bw / 2, by + 8, bw, 3, '#5a3a1e');
  // arms swinging, darker than the body so the silhouette stays readable
  for (const [ax, lag] of [[cx - bw / 2 - 3, step > 0 ? 1 : 0], [cx + bw / 2, step < 0 ? 1 : 0]]) {
    rect(ctx, ax, by + 2 + lag, 3, 8, f.d1);
    rect(ctx, ax, by + 2 + lag, 3, 1, f.m);
    rect(ctx, ax, by + 8 + lag, 3, 2, f.l);        // the paw
    rect(ctx, ax, by + 10 + lag, 3, 1, f.d0);
  }
  // head - its shadow first, thrown onto the shoulders below it
  const hy = by - 11, hw = 20, hh = 13;
  ctx.globalAlpha = 0.3;
  rect(ctx, cx - 8, hy + hh, 16, 2, '#1b1424');
  ctx.globalAlpha = 1;
  for (let y = 0; y < hh; y++) {
    const t = y / hh;
    rect(ctx, cx - hw / 2 + (t > 0.8 ? 1 : 0), hy + y, hw - (t > 0.8 ? 2 : 0), 1,
         t < 0.2 ? f.l : t < 0.7 ? f.m : f.d1);
  }
  rect(ctx, cx - hw / 2, hy + 1, 2, hh - 3, f.l);
  rect(ctx, cx + hw / 2 - 2, hy + 1, 2, hh - 3, f.d0);
  // ears
  if (opts.ears === 'long') {
    rect(ctx, cx - 7, hy - 8, 4, 10, f.m);
    rect(ctx, cx + 3, hy - 8, 4, 10, f.m);
    rect(ctx, cx - 6, hy - 6, 2, 6, f.hi);
    rect(ctx, cx + 4, hy - 6, 2, 6, f.hi);
  } else if (opts.ears === 'tuft') {
    rect(ctx, cx - 9, hy - 4, 5, 6, f.d1);
    rect(ctx, cx + 4, hy - 4, 5, 6, f.d1);
  } else {
    disc(ctx, cx - 8, hy + 1, 3, f.d1);
    disc(ctx, cx + 8, hy + 1, 3, f.d1);
  }
  // the face, only when we can see it
  if (dir !== 'up') {
    if (dir === 'down') {
      rect(ctx, cx - 5, hy + 4, 3, 3, PAL.ink);
      rect(ctx, cx + 3, hy + 4, 3, 3, PAL.ink);
      px(ctx, cx - 5, hy + 4, PAL.white);
      px(ctx, cx + 3, hy + 4, PAL.white);
      rect(ctx, cx - 3, hy + 8, 7, 4, f.hi);
      rect(ctx, cx - 2, hy + 10, 5, 2, PAL.white);
    } else {
      const side = dir === 'right' ? 1 : -1;
      rect(ctx, cx + side * 3, hy + 4, 3, 3, PAL.ink);
      px(ctx, cx + side * 3, hy + 4, PAL.white);
      rect(ctx, cx + side * 6 - (side < 0 ? 4 : 0), hy + 7, 5, 4, f.hi);
      px(ctx, cx + side * 9 - (side < 0 ? 1 : 0), hy + 8, PAL.white);
    }
  }
  if (opts.hat) {
    rect(ctx, cx - 11, hy - 1, 22, 4, '#c69a3c');
    rect(ctx, cx - 11, hy - 1, 22, 1, '#e8c46a');
    for (let y = 0; y < 4; y++) {
      const w = 14 - y * 2;
      rect(ctx, cx - w / 2, hy - 2 - y, w, 1, y > 1 ? '#e8c46a' : '#c69a3c');
    }
    ctx.globalAlpha = 0.3;
    rect(ctx, cx - 9, hy + 3, 18, 2, PAL.ink);
    ctx.globalAlpha = 1;
  }
}

export function heroTop(dir = 'down', frame = 0) {
  const f = frame % 4;
  return sprite(`heroTop5:${dir}:${f}`, TOP_W, TOP_H, (ctx) => {
    const step = f === 0 ? 0 : f === 1 ? 1 : f === 2 ? 0 : -1;
    topBody(ctx, dir, step, FUR5, { hat: true, bob: f % 2 });
    outline(ctx, TOP_W, TOP_H, SUN.ink);
  });
}

/** A customer, from above. Tinted by species so each is recognisable. */
export function npcTop(tone, frame = 0, opts = {}) {
  const f = frame % 2;
  return sprite(`npcTop5:${tone}:${f}:${opts.ears || 'round'}`, TOP_W, TOP_H, (ctx) => {
    const fur = {
      d0: mix(tone, '#2a2140', 0.55), d1: mix(tone, '#2a2140', 0.28), m: tone,
      l: mix(tone, '#fff3c4', 0.26), hi: mix(tone, '#fff3c4', 0.5), rim: '#fff3c4',
    };
    topBody(ctx, 'down', 0, fur, { ears: opts.ears, apron: opts.apron, bob: f });
    outline(ctx, TOP_W, TOP_H, SUN.ink);
  });
}

// ------------------------------------------------------------------ drawing
/**
 * Draw the hero side-on at a world position already converted to screen space.
 * The pose comes from what the player is actually doing, so walking, jumping and
 * chopping all animate without the scenes knowing how the sprite is built.
 */
export function drawHeroSide(ctx, x, base, t, opts = {}) {
  const p = opts.player;
  let pose = opts.pose;
  if (!pose && p) {
    pose = !p.onGround ? 'jump' : Math.abs(p.vx) > 4 ? 'walk' : 'idle';
  }
  pose = pose || 'idle';
  const rate = pose === 'walk' ? 9 : pose === 'chop' ? 7 : pose === 'idle' ? 1.6 : 6;
  const frame = Math.floor(t * rate) % 4;
  const img = hero(pose, frame);
  const face = opts.face !== undefined ? opts.face : (p ? p.face : 1);
  const scale = opts.scale || 1;
  const w = img.width * scale, h = img.height * scale;
  // Plant the feet: HERO_FEET is the sprite row the boots sit on, so the whole
  // sprite hangs from the ground line instead of floating a few pixels above it.
  const dx = Math.round(x - w / 2);
  const dy = Math.round(base - (HERO_FEET + 1) * scale);
  const airborne = p && p.onGround === false;
  if (opts.shadow !== false && !airborne) {
    contact(ctx, Math.round(x), Math.round(base) - 1, Math.round(7 * scale), Math.round(2 * scale), 0.3);
  }
  ctx.save();
  if (face < 0) {
    ctx.translate(dx + w, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);
  } else {
    ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, w, h);
  }
  ctx.restore();
}

/**
 * Same, for anyone from the top-down cast. `y` is the tile the feet stand on,
 * so the sprite leans up the screen from there and the shadow marks the spot.
 */
export function drawTop(ctx, img, x, y, face, opts = {}) {
  const dx = Math.round(x - img.width / 2);
  const dy = Math.round(y - (TOP_FEET + 1));
  if (opts.shadow !== false) contact(ctx, Math.round(x), Math.round(y) - 1, 7, 2, 0.28);
  ctx.save();
  if (face < 0) {
    ctx.translate(dx + img.width, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
  } else {
    ctx.drawImage(img, dx, dy);
  }
  ctx.restore();
}
