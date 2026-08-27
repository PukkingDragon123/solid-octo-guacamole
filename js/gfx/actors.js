// Everyone in the story, drawn to match the beaver you already play as: the
// same 16x18 build, the same fur ramp, the same 1px ink outline and soft
// ground shadow. Poses the original sprite bank never needed - chopping,
// sawing, driving screws, carrying, kneeling, lying down - live here, plus
// top-down versions for the scenes played from above.

import { PAL, sprite, rect, px, disc, line, outline, shadowUnder } from './pixel.js';

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

const FUR = { d0: PAL.fur0, d1: PAL.fur1, m: PAL.fur2, l: PAL.fur3, hi: PAL.fur4 };
const GREY = { d0: '#4a423b', d1: '#6e645a', m: '#9a9086', l: '#c0b6aa', hi: '#e0d7cb' };
const GRAN = { d0: '#4a3526', d1: '#7a5c40', m: '#a3805c', l: '#c9a678', hi: '#e6cb9c' };

/**
 * The shared body. Every pose is this, with limbs moved - which is why they all
 * read as the same animal. `p` carries the pose offsets.
 */
function body(ctx, fur, p) {
  const y0 = p.y0;
  // tail
  if (!p.noTail) {
    rect(ctx, p.tailX, y0 + 8 + (p.tailY || 0), 4, 4, fur.d0);
    px(ctx, p.tailX, y0 + 8 + (p.tailY || 0), fur.d1);
    px(ctx, p.tailX + 1, y0 + 10 + (p.tailY || 0), fur.d1);
  }
  // legs
  const lift = p.legs || [0, 0];
  rect(ctx, 5, y0 + 12 - lift[0], 2, 4 + lift[0], fur.d1);
  rect(ctx, 9, y0 + 12 - lift[1], 2, 4 + lift[1], fur.d1);
  px(ctx, 5, y0 + 15, fur.d0);
  px(ctx, 9, y0 + 15, fur.d0);
  // body
  rect(ctx, 4, y0 + 6, 8, 7, fur.d1);
  rect(ctx, 5, y0 + 6, 6, 6, fur.m);
  rect(ctx, 6, y0 + 8, 4, 4, fur.l);
  if (p.belt !== false) { rect(ctx, 4, y0 + 11, 8, 1, PAL.wood1); px(ctx, 9, y0 + 11, PAL.gold); }
  if (p.apron) { rect(ctx, 4, y0 + 8, 8, 5, p.apron); rect(ctx, 5, y0 + 7, 6, 1, p.apron); }
  if (p.shawl) { rect(ctx, 3, y0 + 6, 10, 3, p.shawl); px(ctx, 8, y0 + 9, p.shawl); }
  // head
  const hy = y0 + (p.headY || 0);
  rect(ctx, 5, hy + 1, 8, 6, fur.m);
  rect(ctx, 6, hy, 6, 2, fur.m);
  rect(ctx, 11, hy + 3, 3, 3, fur.l);      // snout
  px(ctx, 13, hy + 4, fur.hi);
  rect(ctx, 12, hy + 6, 2, 1, PAL.white);  // teeth
  if (p.closed) rect(ctx, 9, hy + 3, 2, 1, PAL.ink);
  else px(ctx, 10, hy + 3, PAL.ink);
  px(ctx, 5, hy + 1, fur.d1);              // ear
  px(ctx, 4, hy + 2, fur.d1);
  if (p.specs) {
    rect(ctx, 8, hy + 2, 5, 1, PAL.stone3);
    px(ctx, 9, hy + 3, PAL.stone2);
    px(ctx, 12, hy + 3, PAL.stone2);
  }
  if (p.hat === 'hard') {
    rect(ctx, 4, hy - 1, 10, 2, PAL.gold);
    rect(ctx, 6, hy - 3, 6, 2, PAL.gold);
    rect(ctx, 6, hy - 3, 6, 1, PAL.gold2);
    px(ctx, 13, hy - 1, PAL.gold2);
  } else if (p.hat === 'flat') {
    rect(ctx, 4, hy - 1, 10, 2, '#6b5330');
    rect(ctx, 5, hy - 2, 7, 1, '#8a6d3b');
  } else if (p.hat === 'bun') {
    disc(ctx, 6, hy - 1, 2, GRAN.hi);
    rect(ctx, 5, hy - 1, 8, 1, GRAN.l);
  }
  // arms
  const arm = p.arm || 'down';
  if (arm === 'down') rect(ctx, 11, y0 + 7, 2, 4, fur.d1);
  else if (arm === 'up') rect(ctx, 11, y0 + 3, 2, 6, fur.d1);
  else if (arm === 'out') rect(ctx, 12, y0 + 8, 3, 2, fur.d1);
  else if (arm === 'both-up') { rect(ctx, 11, y0 + 3, 2, 6, fur.d1); rect(ctx, 3, y0 + 3, 2, 6, fur.d1); }
  else if (arm === 'both-out') { rect(ctx, 12, y0 + 8, 3, 2, fur.d1); rect(ctx, 1, y0 + 8, 3, 2, fur.d1); }
}

const finish = (ctx, w, h, cx = 8) => { outline(ctx, w, h, SUN.ink); shadowUnder(ctx, cx, h - 1, 5, 1, 0.3); };

// ------------------------------------------------------------------- hero
/**
 * You. `pose`: idle walk run jump chop saw screw carry sit kneel push.
 * Every pose is four frames so callers never have to special-case them.
 */
export function hero(pose, frame = 0) {
  const f = frame % 4;
  return sprite(`hero:${pose}:${f}`, 20, 22, (ctx) => {
    const bob = pose === 'idle' ? (f % 2) : (f === 1 || f === 3 ? 1 : 0);
    const p = { y0: 4 + bob, tailX: 1, hat: 'hard' };

    if (pose === 'walk' || pose === 'run') {
      const a = f === 0 || f === 1 ? 0 : 1;
      p.legs = [a ? 1 : 0, a ? 0 : 1];
      p.arm = a ? 'out' : 'down';
    } else if (pose === 'jump') {
      p.y0 = 3; p.legs = [1, 2]; p.arm = 'up';
    } else if (pose === 'sit') {
      p.y0 = 8; p.legs = [0, 0]; p.arm = 'down'; p.tailY = -2;
    } else if (pose === 'kneel') {
      p.y0 = 7; p.legs = [0, 0]; p.arm = 'out';
    } else if (pose === 'chop') {
      // the axe travels: overhead, high, striking, recoil
      p.arm = f === 0 || f === 1 ? 'both-up' : 'both-out';
      p.y0 = 4 + (f === 2 ? 1 : 0);
    } else if (pose === 'saw') {
      p.arm = 'out';
      p.y0 = 4 + (f % 2);
    } else if (pose === 'screw') {
      p.arm = 'up';
    } else if (pose === 'carry') {
      p.arm = 'both-up';
      p.legs = f === 1 || f === 3 ? [1, 0] : [0, 1];
    } else if (pose === 'push') {
      p.arm = 'out';
    }

    body(ctx, FUR, p);

    // tools in hand, so the action reads without the world around it
    if (pose === 'chop') {
      const ax = f === 0 || f === 1 ? [13, p.y0 - 2, 1, 8] : [14, p.y0 + 8, 6, 1];
      rect(ctx, ax[0], ax[1], ax[2], ax[3], PAL.wood2);
      if (f === 0 || f === 1) { rect(ctx, 11, p.y0 - 4, 6, 3, PAL.stone2); rect(ctx, 11, p.y0 - 4, 6, 1, PAL.stone3); }
      else { rect(ctx, 17, p.y0 + 6, 3, 4, PAL.stone2); px(ctx, 17, p.y0 + 6, PAL.stone3); }
    } else if (pose === 'saw') {
      rect(ctx, 13, p.y0 + 8, 7, 2, PAL.stone2);
      for (let i = 0; i < 7; i += 2) px(ctx, 13 + i, p.y0 + 10, PAL.stone3);
    } else if (pose === 'screw') {
      rect(ctx, 12, p.y0 + 1, 2, 5, PAL.red);
      rect(ctx, 12, p.y0 + 6, 2, 3, PAL.stone2);
    }
    finish(ctx, 20, 22, 8);
  });
}

// ------------------------------------------------------------------ elder
/** Grandpa: grey, spectacled, in the leather apron he has worn for forty years. */
export function elder(pose, frame = 0) {
  const f = frame % 4;
  return sprite(`elder:${pose}:${f}`, 20, 22, (ctx) => {
    const bob = f % 2;
    const p = { y0: 5 + bob, tailX: 1, specs: true, apron: '#8a6a3f', hat: 'flat', belt: false };
    if (pose === 'kneel') { p.y0 = 8; p.arm = 'out'; }
    else if (pose === 'hold') { p.arm = 'out'; }
    else if (pose === 'point') { p.arm = 'out'; }
    else if (pose === 'sit') { p.y0 = 9; p.tailY = -2; }
    else p.arm = f % 2 ? 'down' : 'out';
    body(ctx, GREY, p);
    if (pose === 'hold') {
      // holding out the axe
      rect(ctx, 15, p.y0 + 2, 1, 8, PAL.wood2);
      rect(ctx, 13, p.y0, 5, 3, PAL.stone2);
      rect(ctx, 13, p.y0, 5, 1, PAL.stone3);
    }
    finish(ctx, 20, 22, 8);
  });
}

/** Grandma: the shawl, and the two poses the story needs her in. */
export function granny(pose = 'lie') {
  return sprite(`granny:${pose}`, 26, 20, (ctx) => {
    if (pose === 'lie') {
      // flat out on the tiles, shawl over her, eyes closed
      rect(ctx, 6, 11, 15, 6, GRAN.m);
      rect(ctx, 6, 11, 15, 2, GRAN.l);
      rect(ctx, 9, 11, 9, 6, PAL.purple2);
      rect(ctx, 3, 9, 7, 7, GRAN.m);      // head
      rect(ctx, 4, 8, 5, 2, GRAN.l);
      disc(ctx, 5, 8, 2, GRAN.hi);        // bun
      rect(ctx, 3, 12, 3, 1, PAL.ink);    // closed eye
      rect(ctx, 2, 13, 2, 1, GRAN.l);
      rect(ctx, 20, 13, 5, 4, GRAN.d1);   // tail
      rect(ctx, 8, 17, 3, 2, GRAN.d1);    // paws
      rect(ctx, 15, 17, 3, 2, GRAN.d1);
    } else {
      rect(ctx, 8, 8, 9, 9, GRAN.m);
      rect(ctx, 7, 7, 11, 4, PAL.purple2);
      rect(ctx, 9, 2, 8, 6, GRAN.m);
      rect(ctx, 15, 5, 3, 3, GRAN.l);
      px(ctx, 13, 5, PAL.ink);
      disc(ctx, 11, 1, 2, GRAN.hi);
      rect(ctx, 9, 17, 3, 3, GRAN.d1);
      rect(ctx, 14, 17, 3, 3, GRAN.d1);
    }
    finish(ctx, 26, 20, 13);
  });
}

// -------------------------------------------------------------- fox medic
/** The stretcher crew: same build, longer snout, black socks, medic vest. */
export function foxMedic(frame = 0, carrying = false) {
  const f = frame % 4;
  return sprite(`fox:${f}:${carrying ? 1 : 0}`, 20, 22, (ctx) => {
    const fur = { d0: '#8a3d12', d1: '#b4521c', m: '#d2691e', l: '#e88a3d', hi: '#f2b077' };
    const bob = f === 1 || f === 3 ? 1 : 0;
    const y0 = 4 + bob;
    // brush tail with a white tip
    rect(ctx, 0, y0 + 7, 5, 4, fur.d1);
    rect(ctx, 0, y0 + 7, 2, 4, PAL.paper);
    // legs, black socks
    const a = f === 0 || f === 1 ? 0 : 1;
    rect(ctx, 5, y0 + 12 - (a ? 1 : 0), 2, 4, fur.d1);
    rect(ctx, 9, y0 + 12 - (a ? 0 : 1), 2, 4, fur.d1);
    rect(ctx, 5, y0 + 15, 2, 1, PAL.ink2);
    rect(ctx, 9, y0 + 15, 2, 1, PAL.ink2);
    // body under a white vest with a red cross
    rect(ctx, 4, y0 + 6, 8, 7, fur.d1);
    rect(ctx, 5, y0 + 6, 6, 5, fur.m);
    rect(ctx, 4, y0 + 8, 8, 4, '#f4f4f4');
    px(ctx, 8, y0 + 9, PAL.red);
    rect(ctx, 7, y0 + 10, 3, 1, PAL.red);
    rect(ctx, 8, y0 + 9, 1, 3, PAL.red);
    // head, long snout, tipped ears
    rect(ctx, 5, y0 + 1, 8, 5, fur.m);
    rect(ctx, 11, y0 + 3, 4, 2, fur.l);
    px(ctx, 15, y0 + 3, PAL.ink);
    rect(ctx, 5, y0 - 1, 2, 3, fur.d1);
    rect(ctx, 10, y0 - 1, 2, 3, fur.d1);
    px(ctx, 5, y0 - 1, PAL.ink2);
    px(ctx, 11, y0 - 1, PAL.ink2);
    px(ctx, 9, y0 + 3, PAL.ink);
    if (carrying) rect(ctx, 12, y0 + 7, 4, 2, fur.d1);
    else rect(ctx, 11, y0 + 7, 2, 4, fur.d1);
    finish(ctx, 20, 22, 8);
  });
}

// ---------------------------------------------------------------- top down
/**
 * The same cast, seen from above for the scenes played that way. Four
 * directions, two walk frames each, in the Stardew tradition: a big head, a
 * readable silhouette, and one pixel of shadow under the feet.
 */
export function heroTop(dir = 'down', frame = 0) {
  const f = frame % 4;
  return sprite(`heroTop:${dir}:${f}`, 18, 22, (ctx) => {
    const step = f === 1 ? 1 : f === 3 ? -1 : 0;
    const y0 = 3;
    // tail behind, when facing away
    if (dir === 'up') rect(ctx, 7, y0 + 15, 4, 4, FUR.d0);
    // feet
    rect(ctx, 5 + (step > 0 ? 1 : 0), y0 + 16, 3, 3, FUR.d1);
    rect(ctx, 10 - (step < 0 ? 1 : 0), y0 + 16, 3, 3, FUR.d1);
    // body
    rect(ctx, 4, y0 + 8, 10, 9, FUR.d1);
    rect(ctx, 5, y0 + 8, 8, 8, FUR.m);
    rect(ctx, 6, y0 + 11, 6, 4, FUR.l);
    rect(ctx, 4, y0 + 14, 10, 1, PAL.wood1);
    // arms swinging
    rect(ctx, 2, y0 + 9 + (step > 0 ? 1 : 0), 2, 5, FUR.d1);
    rect(ctx, 14, y0 + 9 + (step < 0 ? 1 : 0), 2, 5, FUR.d1);
    // head
    rect(ctx, 3, y0, 12, 9, FUR.m);
    rect(ctx, 4, y0 - 1, 10, 2, FUR.m);
    if (dir !== 'up') {
      // face
      const eyeY = y0 + 4;
      if (dir === 'down') {
        px(ctx, 6, eyeY, PAL.ink); px(ctx, 11, eyeY, PAL.ink);
        rect(ctx, 7, y0 + 6, 4, 2, FUR.l);
        rect(ctx, 8, y0 + 7, 2, 1, PAL.white);
      } else {
        const side = dir === 'right' ? 1 : -1;
        px(ctx, 9 + side * 2, eyeY, PAL.ink);
        rect(ctx, dir === 'right' ? 11 : 4, y0 + 5, 3, 3, FUR.l);
        px(ctx, dir === 'right' ? 13 : 4, y0 + 7, PAL.white);
      }
    }
    // ears, then the hard hat over the lot
    rect(ctx, 2, y0 + 1, 2, 2, FUR.d1);
    rect(ctx, 14, y0 + 1, 2, 2, FUR.d1);
    rect(ctx, 2, y0 - 2, 14, 3, PAL.gold);
    rect(ctx, 3, y0 - 3, 12, 2, PAL.gold2);
    rect(ctx, 3, y0 - 3, 12, 1, PAL.white);
    finish(ctx, 18, 22, 9);
  });
}

/** A customer, from above. Tinted by species so each one is recognisable. */
export function npcTop(tone, frame = 0, opts = {}) {
  const f = frame % 2;
  return sprite(`npcTop:${tone}:${f}:${opts.tall ? 1 : 0}`, 18, 22, (ctx) => {
    const y0 = 4 + f;
    rect(ctx, 5, y0 + 15, 3, 3, PAL.ink2);
    rect(ctx, 10, y0 + 15, 3, 3, PAL.ink2);
    rect(ctx, 4, y0 + 7, 10, 9, tone);
    rect(ctx, 5, y0 + 7, 8, 7, tone);
    rect(ctx, 4, y0 + 12, 10, 4, 'rgba(0,0,0,0.20)');
    rect(ctx, 5, y0 + 9, 8, 4, opts.apron || 'rgba(0,0,0,0.16)');
    rect(ctx, 5, y0 + 9, 8, 1, 'rgba(255,255,255,0.22)');
    rect(ctx, 2, y0 + 8, 2, 5, tone);
    rect(ctx, 14, y0 + 8, 2, 5, tone);
    rect(ctx, 3, y0, 12, 8, tone);
    rect(ctx, 4, y0 - 1, 10, 2, tone);
    px(ctx, 6, y0 + 3, PAL.ink);
    px(ctx, 11, y0 + 3, PAL.ink);
    rect(ctx, 7, y0 + 5, 4, 2, PAL.fur4);
    rect(ctx, 8, y0 + 6, 2, 1, PAL.white);
    if (opts.ears === 'long') { rect(ctx, 4, y0 - 5, 2, 6, tone); rect(ctx, 12, y0 - 5, 2, 6, tone); }
    else if (opts.ears === 'tuft') { rect(ctx, 3, y0 - 3, 3, 4, tone); rect(ctx, 12, y0 - 3, 3, 4, tone); }
    else { rect(ctx, 2, y0, 2, 3, tone); rect(ctx, 14, y0, 2, 3, tone); }
    finish(ctx, 18, 22, 9);
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
  const dx = Math.round(x - w / 2), dy = Math.round(base - h + 2);
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

/** Same, for anyone from the top-down cast. */
export function drawTop(ctx, img, x, y, face) {
  const dx = Math.round(x - img.width / 2), dy = Math.round(y - img.height + 6);
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
