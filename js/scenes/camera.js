// The camera rig the cutscenes are shot with.
//
// A shot names a framing (wide, medium, close, insert), a move (push, pull,
// pan, dolly, handheld) and a length. Everything is tweened with easing, so a
// push starts slow, gathers and settles instead of sliding linearly. The comic
// devices - panel splits, speed lines, impact bursts, lettering - live here too,
// because they are camera language rather than scenery.

import { VIEW_W, VIEW_H } from '../config.js';
import { PAL, surface, rect, px, disc, line, text, textWidth, bigText, wrap, rngFrom }
  from '../gfx/pixel.js';

// ------------------------------------------------------------------ easing
export const ease = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -9 * t)),
  outBack: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
  bounce: (t) => (t < 0.6 ? ease.outCubic(t / 0.6) : 1 - Math.sin((t - 0.6) * 9) * 0.06 * (1 - t)),
};

/** Tween between two values with a named curve. */
export const tween = (a, b, t, curve = 'inOut') =>
  a + (b - a) * ease[curve](Math.max(0, Math.min(1, t)));

/**
 * Framings, as a zoom and a vertical bias. A close-up is not just bigger - it
 * also sits higher in the frame, on the face.
 */
export const FRAMING = {
  wide:   { zoom: 1.0,  y: 0 },
  full:   { zoom: 1.18, y: 6 },
  medium: { zoom: 1.5,  y: -6 },
  close:  { zoom: 2.1,  y: -16 },
  insert: { zoom: 2.8,  y: 0 },
};

const buf = surface(VIEW_W, VIEW_H);

/**
 * Work out where the camera is this instant.
 * shot: { framing, to, focus:[x,y], move, dur, shake }
 */
export function cameraAt(shot, u, t) {
  const from = FRAMING[shot.framing || 'wide'];
  const to = FRAMING[shot.to || shot.framing || 'wide'];
  const move = shot.move || 'hold';
  const curve = shot.curve || (move === 'push' || move === 'pull' ? 'outExpo' : 'inOut');
  let zoom = tween(from.zoom, to.zoom, u, curve);
  let bias = tween(from.y, to.y, u, curve);
  const focus = shot.focus || [VIEW_W / 2, VIEW_H / 2];
  let fx = focus[0], fy = focus[1] + bias;

  if (move === 'pan' && shot.panTo) {
    fx = tween(focus[0], shot.panTo[0], u, curve);
    fy = tween(focus[1], shot.panTo[1], u, curve) + bias;
  }
  if (move === 'dolly' && shot.panTo) {
    fx = tween(focus[0], shot.panTo[0], u, 'inOut');
    fy = tween(focus[1], shot.panTo[1], u, 'inOut') + bias;
    zoom *= 1 + Math.sin(u * Math.PI) * 0.04;
  }
  if (move === 'handheld') {
    fx += Math.sin(t * 2.7) * 3 + Math.sin(t * 6.1) * 1.2;
    fy += Math.cos(t * 3.3) * 2.2;
    zoom *= 1 + Math.sin(t * 1.7) * 0.008;
  }
  if (move === 'crane') {
    fy = tween(focus[1] - 40, focus[1], u, 'outCubic') + bias;
  }
  const roll = shot.tilt ? tween(0, shot.tilt, u, 'outCubic') : 0;
  return { zoom, fx, fy, roll };
}

/**
 * Paint one frame: run the shot's own painter into a buffer, then crop the
 * buffer through the camera. Returns the buffer context so painters can use it.
 */
export function renderShot(ctx, shot, u, t, paint, opts = {}) {
  const cam = cameraAt(shot, u, t);
  buf.ctx.imageSmoothingEnabled = false;
  paint(buf.ctx, u, t, cam);

  const sw = VIEW_W / cam.zoom, sh = VIEW_H / cam.zoom;
  let sx = cam.fx - sw / 2;
  let sy = cam.fy - sh / 2;
  // never show past the edge of the painted world
  sx = Math.max(0, Math.min(VIEW_W - sw, sx));
  sy = Math.max(0, Math.min(VIEW_H - sh, sy));

  const shake = opts.shake || 0;
  const ox = shake ? Math.round((Math.random() - 0.5) * shake * 10) : 0;
  const oy = shake ? Math.round((Math.random() - 0.5) * shake * 10) : 0;

  ctx.imageSmoothingEnabled = false;
  if (cam.roll) {
    ctx.save();
    ctx.translate(VIEW_W / 2, VIEW_H / 2);
    ctx.rotate((cam.roll * Math.PI) / 180);
    ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
    ctx.drawImage(buf.canvas, sx, sy, sw, sh, ox - 8, oy - 8, VIEW_W + 16, VIEW_H + 16);
    ctx.restore();
  } else {
    ctx.drawImage(buf.canvas, sx, sy, sw, sh, ox, oy, VIEW_W, VIEW_H);
  }
  return cam;
}

// ------------------------------------------------------------ comic devices
/** Letterbox bars that slide in. */
export function letterbox(ctx, amount, h = 22) {
  const bar = Math.round(h * amount);
  rect(ctx, 0, 0, VIEW_W, bar, PAL.black);
  rect(ctx, 0, VIEW_H - bar, VIEW_W, bar, PAL.black);
  if (bar > 2) {
    rect(ctx, 0, bar, VIEW_W, 1, 'rgba(0,0,0,0.5)');
    rect(ctx, 0, VIEW_H - bar - 1, VIEW_W, 1, 'rgba(0,0,0,0.5)');
  }
  return bar;
}

/**
 * An inset panel, comic-style: a second image in a boxed corner of the frame,
 * for a reaction or a detail without cutting away.
 */
export function inset(ctx, x, y, w, h, paint, u, t) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  paint(ctx, u, t, x, y, w, h);
  ctx.restore();
  // ink border with a drop shadow, so it sits above the frame
  ctx.globalAlpha = 0.5;
  rect(ctx, x + 3, y + h, w, 3, PAL.black);
  ctx.globalAlpha = 1;
  rect(ctx, x - 2, y - 2, w + 4, 2, PAL.black);
  rect(ctx, x - 2, y + h, w + 4, 2, PAL.black);
  rect(ctx, x - 2, y - 2, 2, h + 4, PAL.black);
  rect(ctx, x + w, y - 2, 2, h + 4, PAL.black);
  rect(ctx, x - 1, y - 1, w + 2, 1, PAL.paper2);
}

/** Speed lines rushing past, for motion the frame cannot show on its own. */
export function speedLines(ctx, amount, dir = 1, tone = 'rgba(255,255,255,0.5)', seed = 5) {
  if (amount <= 0) return;
  const rng = rngFrom(seed);
  const n = Math.round(26 * amount);
  for (let i = 0; i < n; i++) {
    const y = rng() * VIEW_H;
    const len = 20 + rng() * 90 * amount;
    const x = rng() * VIEW_W;
    rect(ctx, dir > 0 ? x : x - len, y, len, rng() > 0.7 ? 2 : 1, tone);
  }
}

/** Radial burst lines from a point - the comic impact frame. */
export function impactBurst(ctx, cx, cy, u, tone = PAL.white) {
  const spread = 40 + u * 420;
  const inner = u * 90;
  ctx.strokeStyle = tone;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + u * 0.4;
    const x0 = cx + Math.cos(a) * inner, y0 = cy + Math.sin(a) * inner * 0.7;
    const x1 = cx + Math.cos(a) * spread, y1 = cy + Math.sin(a) * spread * 0.7;
    line(ctx, x0, y0, x1, y1, tone);
    if (i % 3 === 0) line(ctx, x0 + 1, y0, x1 + 1, y1, tone);
  }
}

/** A jagged onomatopoeia balloon - CRASH, THUD, CREAK. */
export function shout(ctx, word, cx, cy, scale, u, tone = PAL.red2) {
  const w = word.length * (6 * scale) + 16;
  const h = 9 * scale + 12;
  const pop = ease.outBack(Math.min(1, u * 3));
  const sc = Math.max(1, Math.round(scale * pop));
  // spiky balloon
  const rng = rngFrom(word.length * 31);
  ctx.fillStyle = PAL.paper;
  const pts = 18;
  ctx.beginPath();
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const spike = i % 2 ? 1.24 : 0.94;
    const x = cx + Math.cos(a) * (w / 2) * spike * pop;
    const y = cy + Math.sin(a) * (h / 2) * spike * pop;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PAL.black;
  ctx.stroke();
  bigText(ctx, word, cx, cy - Math.round(3.5 * sc), sc, tone, PAL.black);
}

/** A hard white flash, for a cut on impact. */
export function flash(ctx, amount, tone = PAL.white) {
  if (amount <= 0) return;
  ctx.globalAlpha = Math.min(1, amount);
  rect(ctx, 0, 0, VIEW_W, VIEW_H, tone);
  ctx.globalAlpha = 1;
}

/** A wipe between shots, in one of a few shapes. */
export function wipe(ctx, kind, amount, tone = PAL.black) {
  const a = Math.max(0, Math.min(1, amount));
  if (a <= 0) return;
  if (kind === 'iris') {
    const r = (1 - a) * Math.hypot(VIEW_W, VIEW_H) * 0.6;
    ctx.fillStyle = tone;
    for (let y = 0; y < VIEW_H; y++) {
      const dy = y - VIEW_H / 2;
      const span = r > Math.abs(dy) ? Math.round(Math.sqrt(r * r - dy * dy)) : 0;
      if (span <= 0) { rect(ctx, 0, y, VIEW_W, 1, tone); continue; }
      rect(ctx, 0, y, Math.max(0, VIEW_W / 2 - span), 1, tone);
      rect(ctx, VIEW_W / 2 + span, y, Math.max(0, VIEW_W / 2 - span), 1, tone);
    }
  } else if (kind === 'bars') {
    const step = 18;
    for (let y = 0; y < VIEW_H; y += step) {
      const w = Math.round(VIEW_W * Math.min(1, a * 1.4 - (y / VIEW_H) * 0.3));
      if (w > 0) rect(ctx, (y / step) % 2 ? VIEW_W - w : 0, y, w, step, tone);
    }
  } else if (kind === 'diagonal') {
    ctx.fillStyle = tone;
    const reach = a * (VIEW_W + VIEW_H);
    for (let y = 0; y < VIEW_H; y++) {
      const w = Math.round(reach - y);
      if (w > 0) rect(ctx, 0, y, Math.min(VIEW_W, w), 1, tone);
    }
  } else {
    ctx.globalAlpha = a;
    rect(ctx, 0, 0, VIEW_W, VIEW_H, tone);
    ctx.globalAlpha = 1;
  }
}

/** Film grain and a slight vignette, to take the digital edge off. */
export function filmGrain(ctx, t, strength = 0.06) {
  const rng = rngFrom(Math.floor(t * 24) * 977 + 5);
  ctx.globalAlpha = strength;
  for (let i = 0; i < 240; i++) {
    px(ctx, rng() * VIEW_W, rng() * VIEW_H, rng() > 0.5 ? PAL.white : PAL.black);
  }
  ctx.globalAlpha = 1;
}

/** The dialogue plate: a caption box with a name tab and typed-out text. */
export function caption(ctx, speaker, words, elapsed, bar) {
  const lines = wrap(words, VIEW_W - 120);
  const boxH = 10 + lines.length * 9;
  const y = VIEW_H - bar - boxH - 6;
  const x = 44, w = VIEW_W - 88;
  // a translucent plate, so the shot still reads behind it
  ctx.globalAlpha = 0.4;
  rect(ctx, x + 2, y + 3, w, boxH, PAL.black);
  ctx.globalAlpha = 0.82;
  rect(ctx, x, y, w, boxH, '#161520');
  ctx.globalAlpha = 1;
  rect(ctx, x, y, w, 1, '#4a4a5a');
  rect(ctx, x, y + boxH - 1, w, 1, PAL.black);
  rect(ctx, x, y, 2, boxH, PAL.gold);
  if (speaker) {
    const tw = textWidth(speaker) + 10;
    rect(ctx, x + 6, y - 6, tw, 11, PAL.gold);
    rect(ctx, x + 6, y - 6, tw, 1, PAL.gold2);
    text(ctx, speaker, x + 11, y - 4, PAL.ink);
  }
  const shown = Math.floor(elapsed * 38);
  let used = 0;
  lines.forEach((ln, i) => {
    const take = Math.max(0, Math.min(ln.length, shown - used));
    used += ln.length;
    if (take > 0) text(ctx, ln.slice(0, take), x + 9, y + 5 + i * 9, PAL.paper);
  });
  const done = shown >= words.length;
  if (done && Math.floor(elapsed * 2) % 2 === 0) {
    text(ctx, '>', x + w - 11, y + boxH - 9, PAL.gold2);
  }
  return done;
}

/** A chapter card, on a card of paper with a rule. */
export function titleCard(ctx, title, sub, u) {
  ctx.globalAlpha = Math.min(0.82, u * 2);
  rect(ctx, 0, 0, VIEW_W, VIEW_H, PAL.black);
  ctx.globalAlpha = 1;
  const slide = tween(-30, 0, Math.min(1, u * 1.6), 'outExpo');
  bigText(ctx, title, VIEW_W / 2 + slide, 92, 4, PAL.gold2, PAL.black);
  const ruleW = Math.round(tween(0, 200, Math.min(1, u * 2), 'outCubic'));
  rect(ctx, (VIEW_W - ruleW) / 2, 134, ruleW, 1, PAL.wood3);
  if (u > 0.35) text(ctx, sub, VIEW_W / 2, 146, PAL.paper, { align: 'center', shadow: PAL.black });
}
