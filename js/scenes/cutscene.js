// Cutscenes: a few painted beats with a line of narration under each. Every
// frame is drawn with the same pixel toolkit as the game — no images, no video.

import { VIEW_W, VIEW_H } from '../config.js';
import { PAL, rect, px, disc, line, text, textWidth, rngFrom, surface } from '../gfx/pixel.js';
import * as S from '../gfx/sprites.js';

export const cutscene = { active: false, id: null, beat: 0, t: 0, typed: 0, done: null };

const CHARS_PER_SEC = 34;

export function playCutscene(id, onDone) {
  if (!SCENES[id]) return false;
  cutscene.active = true;
  cutscene.id = id;
  cutscene.beat = 0;
  cutscene.t = 0;
  cutscene.typed = 0;
  cutscene.done = onDone || null;
  return true;
}

export function updateCutscene(dt) {
  if (!cutscene.active) return;
  cutscene.t += dt;
  cutscene.typed += dt * CHARS_PER_SEC;
}

function fullText() {
  const beat = SCENES[cutscene.id][cutscene.beat];
  return beat.lines.join('\n');
}

/** Space/E/click: finish the typing, then move on. */
export function advanceCutscene() {
  if (!cutscene.active) return;
  const total = fullText().length;
  if (cutscene.typed < total) { cutscene.typed = total; return; }
  cutscene.beat++;
  cutscene.t = 0;
  cutscene.typed = 0;
  if (cutscene.beat >= SCENES[cutscene.id].length) {
    cutscene.active = false;
    const cb = cutscene.done;
    cutscene.done = null;
    if (cb) cb();
  }
}

// ------------------------------------------------------------------ crest
function drawCrest(ctx, cx, cy, scale = 1) {
  const w = 26 * scale, h = 30 * scale;
  const x = cx - w / 2, y = cy - h / 2;
  // shield
  ctx.fillStyle = PAL.wood2;
  for (let i = 0; i < h; i++) {
    const t = i / h;
    const half = (w / 2) * (t < 0.62 ? 1 : 1 - (t - 0.62) / 0.38);
    rect(ctx, Math.round(cx - half), Math.round(y + i), Math.round(half * 2), 1, PAL.wood2);
  }
  for (let i = 0; i < h; i++) {
    const t = i / h;
    const half = (w / 2) * (t < 0.62 ? 1 : 1 - (t - 0.62) / 0.38);
    px(ctx, Math.round(cx - half), Math.round(y + i), PAL.wood0);
    px(ctx, Math.round(cx + half - 1), Math.round(y + i), PAL.wood0);
  }
  rect(ctx, Math.round(x), Math.round(y), Math.round(w), 1, PAL.wood0);
  // a log and a chisel crossed
  rect(ctx, Math.round(cx - 8 * scale), Math.round(cy - 4 * scale), Math.round(16 * scale), Math.round(4 * scale), PAL.wood3);
  rect(ctx, Math.round(cx - 8 * scale), Math.round(cy - 4 * scale), Math.round(16 * scale), 1, PAL.wood4);
  line(ctx, cx - 6 * scale, cy + 6 * scale, cx + 6 * scale, cy - 8 * scale, PAL.stone3);
  rect(ctx, Math.round(cx + 4 * scale), Math.round(cy - 10 * scale), Math.round(3 * scale), Math.round(4 * scale), PAL.stone2);
  text(ctx, 'BIT', cx, cy + 6 * scale, PAL.gold2, { align: 'center' });
}

// ----------------------------------------------------------------- scenes
let dawnCache = null;
function paintValleyDawn(ctx, t, p) {
  if (!dawnCache) {
    const surf = surface(VIEW_W + 40, VIEW_H);
    const c = surf.ctx;
    const rng = rngFrom(4242);
    const ramp = ['#2b2a52', '#3d3560', '#57406a', '#75506c', '#95626a', '#b47a63', '#d09a63', '#e8bd77'];
    for (let i = 0; i < ramp.length; i++) {
      const top = Math.round((i / ramp.length) * 150);
      const bottom = Math.round(((i + 1) / ramp.length) * 150);
      rect(c, 0, top, VIEW_W + 40, bottom - top, ramp[i]);
      c.fillStyle = ramp[Math.min(ramp.length - 1, i + 1)];
      for (let x = (bottom % 2); x < VIEW_W + 40; x += 2) c.fillRect(x, bottom - 2, 1, 1);
    }
    disc(c, 300, 138, 16, '#ffe9a8');
    disc(c, 300, 138, 12, '#fff6d8');
    // ridges
    const ridge = (baseY, height, colour, seed) => {
      const r = rngFrom(seed);
      let h = height;
      for (let x = 0; x < VIEW_W + 40; x++) {
        h += (r() - 0.5) * 3;
        h = Math.max(height - 10, Math.min(height + 10, h));
        rect(c, x, Math.round(baseY - h), 1, Math.round(h) + 40, colour);
      }
    };
    ridge(158, 26, '#5a4a70', 3);
    ridge(166, 16, '#3e3556', 9);
    // the valley floor and the river winding away
    rect(c, 0, 168, VIEW_W + 40, VIEW_H - 168, '#2c4a2c');
    for (let y = 168; y < VIEW_H; y++) {
      const t2 = (y - 168) / (VIEW_H - 168);
      const wide = 6 + t2 * 60;
      const cx = 250 - Math.sin(t2 * 2.6) * 70;
      rect(c, Math.round(cx - wide / 2), y, Math.round(wide), 1, t2 < 0.4 ? '#8fa9c4' : '#6d8fb4');
      if (y % 7 === 0) rect(c, Math.round(cx - wide / 2 + 2), y, Math.round(wide * 0.4), 1, '#c4dcee');
    }
    // trees dotted over the floor
    for (let i = 0; i < 70; i++) {
      const x = (rng() * (VIEW_W + 40)) | 0;
      const y = 170 + ((rng() * (VIEW_H - 172)) | 0);
      const h = 4 + ((y - 168) / 10) | 0;
      rect(c, x, y - h, 1, h, '#1d3320');
      disc(c, x, y - h - 1, 1 + (h >> 2), '#27492a');
    }
    // mist lying in the hollows: patchy wisps, not stripes
    for (let i = 0; i < 90; i++) {
      const y = 174 + ((rng() * 78) | 0);
      const x = (rng() * (VIEW_W + 40)) | 0;
      const w = 14 + ((rng() * 60) | 0);
      c.globalAlpha = 0.10 + rng() * 0.16;
      rect(c, x, y, w, 1 + ((rng() * 2) | 0), '#cfd8e8');
      c.globalAlpha = 0.08;
      rect(c, x + 6, y + 2, Math.round(w * 0.6), 1, '#eef3fb');
    }
    c.globalAlpha = 1;
    dawnCache = surf.canvas;
  }
  const drift = Math.round(p * 34);
  ctx.drawImage(dawnCache, -drift, 0);
  // birds heading out for the day
  for (let i = 0; i < 4; i++) {
    const bx = Math.round(60 + i * 22 + t * 16) % (VIEW_W + 60) - 30;
    ctx.drawImage(S.flyingBirdSprite(Math.floor(t * 6 + i) % 4), bx, 60 + (i % 2) * 9);
  }
}

function paintLetter(ctx, t, p) {
  // a plank desk at night, one lamp
  rect(ctx, 0, 0, VIEW_W, VIEW_H, '#2a1d12');
  for (let y = 0; y < VIEW_H; y += 11) rect(ctx, 0, y, VIEW_W, 1, '#20150c');
  const rng = rngFrom(77);
  for (let i = 0; i < 500; i++) px(ctx, (rng() * VIEW_W) | 0, (rng() * VIEW_H) | 0, rng() < 0.5 ? '#33240f' : '#3d2b16');
  ctx.globalAlpha = 0.16;
  disc(ctx, 300, 40, 120, PAL.gold2);
  ctx.globalAlpha = 1;

  // the letter, sliding out of its envelope as the beat plays
  const slide = Math.min(1, p * 2.2);
  const lx = 84, ly = 46 + Math.round((1 - slide) * 16);
  const lw = 200, lh = 150;
  rect(ctx, lx + 3, ly + 4, lw, lh, 'rgba(0,0,0,0.45)');
  rect(ctx, lx, ly, lw, lh, PAL.paper);
  rect(ctx, lx, ly, lw, 2, PAL.white);
  rect(ctx, lx, ly + lh - 2, lw, 2, PAL.paper3);
  drawCrest(ctx, lx + lw / 2, ly + 26, 1.1);
  text(ctx, 'BEAVER INSTITUTE', lx + lw / 2, ly + 46, PAL.ink, { align: 'center' });
  text(ctx, 'OF TIMBERWORK', lx + lw / 2, ly + 56, PAL.ink, { align: 'center' });
  rect(ctx, lx + 20, ly + 68, lw - 40, 1, PAL.paper3);
  const lines = Math.floor(Math.min(9, p * 14));
  for (let i = 0; i < lines; i++) {
    const w = lw - 44 - ((i * 37) % 40);
    rect(ctx, lx + 22, ly + 76 + i * 7, w, 2, PAL.paper3);
  }
  // wax seal
  disc(ctx, lx + lw - 30, ly + lh - 26, 9, PAL.red);
  disc(ctx, lx + lw - 30, ly + lh - 26, 7, PAL.red2);
  text(ctx, 'B', lx + lw - 32, ly + lh - 29, PAL.paper);

  // the envelope it came in
  rect(ctx, 300, 150, 110, 62, PAL.paper2);
  rect(ctx, 300, 150, 110, 2, PAL.paper);
  line(ctx, 300, 150, 355, 186, PAL.paper3);
  line(ctx, 410, 150, 355, 186, PAL.paper3);
  rect(ctx, 300, 210, 110, 2, PAL.paper3);
  disc(ctx, 355, 186, 6, PAL.red);
}

function paintPortrait(ctx, t, p) {
  // the workshop wall behind you
  rect(ctx, 0, 0, VIEW_W, VIEW_H, '#3a2a1c');
  for (let x = 0; x < VIEW_W; x += 22) rect(ctx, x, 0, 2, VIEW_H, '#2c2014');
  for (let y = 0; y < VIEW_H; y += 6) rect(ctx, 0, y, VIEW_W, 1, 'rgba(20,14,8,0.25)');
  // tools hanging up
  for (let i = 0; i < 5; i++) {
    const x = 46 + i * 84;
    rect(ctx, x, 26, 2, 30, PAL.wood2);
    if (i % 2) { rect(ctx, x - 6, 22, 14, 5, PAL.stone2); }
    else { rect(ctx, x - 4, 20, 10, 8, PAL.stone3); rect(ctx, x - 4, 20, 10, 2, PAL.white); }
  }
  ctx.globalAlpha = 0.14;
  disc(ctx, 240, 150, 150, PAL.gold2);
  ctx.globalAlpha = 1;

  // you, scaled up from the sprite you actually play
  const img = S.playerSprite('idle', Math.floor(t * 2) % 2);
  const scale = 7;
  const bob = Math.round(Math.sin(t * 1.6) * 2);
  ctx.drawImage(img, 0, 0, img.width, img.height,
                Math.round(VIEW_W / 2 - (img.width * scale) / 2),
                Math.round(VIEW_H - img.height * scale - 4 + bob),
                img.width * scale, img.height * scale);
  // a spark of determination
  const sp = (t * 1.4) % 1;
  if (sp < 0.5) {
    const sx = 316, sy = 60 + Math.round(sp * 8);
    px(ctx, sx, sy, PAL.gold2); px(ctx, sx + 1, sy, PAL.white); px(ctx, sx - 1, sy, PAL.gold);
    px(ctx, sx, sy - 1, PAL.gold); px(ctx, sx, sy + 1, PAL.gold);
  }
}

function paintGates(ctx, t, p) {
  // BIT, at last: stone posts, a banner, and a path in
  const ramp = ['#4f83c4', '#7fb6e6', '#a9dcf5', '#d6f0fb'];
  for (let i = 0; i < ramp.length; i++) {
    rect(ctx, 0, Math.round((i / ramp.length) * 150), VIEW_W, Math.ceil(150 / ramp.length), ramp[i]);
  }
  const rng = rngFrom(191);
  for (let i = 0; i < 26; i++) {
    const x = (rng() * VIEW_W) | 0;
    const h = 30 + ((rng() * 30) | 0);
    for (let k = 0; k < h; k++) {
      const half = Math.round(((h - k) / h) * 7);
      rect(ctx, x - half, 150 - k, half * 2 + 1, 1, '#27492a');
    }
  }
  rect(ctx, 0, 150, VIEW_W, VIEW_H - 150, '#4e8a3c');
  rect(ctx, 0, 150, VIEW_W, 3, '#6aa64a');
  // the path
  for (let y = 150; y < VIEW_H; y++) {
    const t2 = (y - 150) / (VIEW_H - 150);
    const wide = 20 + t2 * 120;
    rect(ctx, Math.round(VIEW_W / 2 - wide / 2), y, Math.round(wide), 1, t2 > 0.5 ? '#a37c4c' : '#8d6a3f');
  }
  // gate posts
  for (const px0 of [128, 352]) {
    rect(ctx, px0 - 14, 60, 28, 96, PAL.stone2);
    rect(ctx, px0 - 14, 60, 4, 96, PAL.stone3);
    rect(ctx, px0 + 8, 60, 6, 96, PAL.stone1);
    rect(ctx, px0 - 18, 52, 36, 10, PAL.stone3);
    rect(ctx, px0 - 18, 52, 36, 2, PAL.white);
    for (let i = 0; i < 6; i++) rect(ctx, px0 - 14, 72 + i * 14, 28, 1, PAL.stone1);
  }
  // banner strung between them
  const sag = Math.round(Math.sin(t * 1.2) * 2);
  rect(ctx, 128, 54 + sag, 224, 26, PAL.red);
  rect(ctx, 128, 54 + sag, 224, 2, PAL.red2);
  rect(ctx, 128, 78 + sag, 224, 2, '#8f2a24');
  text(ctx, 'B I T', 240, 60 + sag, PAL.gold2, { align: 'center' });
  text(ctx, 'INSTITUTE OF TIMBERWORK', 240, 70 + sag, PAL.paper, { align: 'center' });
  drawCrest(ctx, 88, 70, 0.9);
  drawCrest(ctx, 392, 70, 0.9);

  // you, walking in, in a mortar board
  const walk = Math.min(1, p * 1.4);
  const bx = Math.round(80 + walk * 150);
  const img = S.playerSprite(walk < 0.97 ? 'walk' : 'idle', Math.floor(t * 8) % 4);
  const scale = 3;
  ctx.drawImage(img, 0, 0, img.width, img.height,
                bx, VIEW_H - 30 - img.height * scale, img.width * scale, img.height * scale);
  // mortar board on top
  rect(ctx, bx + 6, VIEW_H - 32 - img.height * scale, 22, 4, PAL.ink);
  rect(ctx, bx + 12, VIEW_H - 36 - img.height * scale, 10, 4, PAL.ink);
  rect(ctx, bx + 26, VIEW_H - 31 - img.height * scale, 5, 1, PAL.gold2);

  // confetti
  for (let i = 0; i < 30; i++) {
    const cx = (i * 53 + Math.floor(t * 20)) % VIEW_W;
    const cy = (i * 37 + Math.floor(t * 60)) % VIEW_H;
    px(ctx, cx, cy, [PAL.gold2, PAL.red2, PAL.grass4, PAL.water4, PAL.pink][i % 5]);
  }
}

function paintHeronPost(ctx, t, p) {
  const ramp = ['#3a2258', '#5b2a60', '#7d3560', '#a94f57', '#c26550', '#dd8446', '#e8bd77', '#f6d69a'];
  const skyH = 176;
  for (let i = 0; i < ramp.length; i++) {
    const top = Math.round((i / ramp.length) * skyH);
    const bottom = Math.round(((i + 1) / ramp.length) * skyH);
    rect(ctx, 0, top, VIEW_W, bottom - top, ramp[i]);
    ctx.fillStyle = ramp[Math.min(ramp.length - 1, i + 1)];
    for (let x = (bottom % 2); x < VIEW_W; x += 2) ctx.fillRect(x, bottom - 2, 1, 1);
    for (let x = ((bottom + 1) % 2); x < VIEW_W; x += 4) ctx.fillRect(x, bottom - 3, 1, 1);
  }
  disc(ctx, 396, 150, 13, '#ffe9a8');
  disc(ctx, 396, 150, 9, '#fff6d8');

  // the far bank and the pond the camp looks out on
  rect(ctx, 0, 168, VIEW_W, 14, '#2f3a5a');
  rect(ctx, 0, 176, VIEW_W, 26, '#3f4a6e');
  for (let i = 0; i < 40; i++) {
    const x = ((i * 53 + Math.floor(t * 6)) % VIEW_W);
    rect(ctx, x, 178 + (i % 10) * 2, 4 + (i % 5), 1, i % 3 ? '#5b6a92' : '#8fa0c4');
  }
  rect(ctx, 0, 200, VIEW_W, VIEW_H - 200, '#1d2a18');
  rect(ctx, 0, 200, VIEW_W, 2, '#2c4022');

  // the camp in silhouette: lodges, the job board, a sawhorse, trees
  const dome = (x, r) => {
    disc(ctx, x, 206, r, '#141d10');
    rect(ctx, x - r, 200, r * 2, 8, '#141d10');
  };
  dome(56, 22); dome(104, 15); dome(392, 19);
  // job board with its little roof
  rect(ctx, 196, 168, 4, 34, '#141d10');
  rect(ctx, 232, 168, 4, 34, '#141d10');
  rect(ctx, 190, 156, 52, 16, '#141d10');
  rect(ctx, 186, 150, 60, 7, '#141d10');
  // the perch, empty tonight
  rect(ctx, 300, 150, 4, 52, '#141d10');
  rect(ctx, 288, 148, 28, 4, '#141d10');
  // pines along the bank
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 52 + ((i * 37) % 15);
    const h = 22 + ((i * 29) % 16);
    for (let k = 0; k < h; k++) {
      const half = Math.round(((h - k) / h) * 6);
      rect(ctx, x - half, 202 - k, half * 2 + 1, 1, '#101809');
    }
  }
  // lit windows
  px(ctx, 50, 198, PAL.gold2); px(ctx, 51, 198, PAL.gold);
  px(ctx, 100, 200, PAL.gold2);

  // the heron coming in, letter in its beak
  const fly = Math.min(1, p * 1.25);
  const hx = Math.round(-50 + fly * 250);
  const hy = Math.round(112 - Math.sin(fly * 3.1) * 30);
  const img = S.birdSprite(Math.floor(t * 9) % 4, false);
  ctx.drawImage(img, hx, hy);
  // the envelope, swinging as it flies
  const ex = hx + 12 + Math.round(Math.sin(t * 5) * 2);
  const ey = hy + 26;
  rect(ctx, ex, ey, 18, 12, PAL.paper);
  rect(ctx, ex, ey, 18, 1, PAL.white);
  line(ctx, ex, ey, ex + 9, ey + 7, PAL.paper3);
  line(ctx, ex + 17, ey, ex + 9, ey + 7, PAL.paper3);
  disc(ctx, ex + 9, ey + 7, 3, PAL.red);
  px(ctx, ex + 9, ey + 7, PAL.gold2);
}

// --------------------------------------------------------------- the script
const SCENES = {
  intro: [
    { paint: paintValleyDawn, who: '', lines: [
      'THE VALLEY IS QUIET, WET AND FULL OF TREES.',
      'NOBODY HAS BUILT ANYTHING HERE IN YEARS.',
    ] },
    { paint: paintPortrait, who: 'YOU', lines: [
      'YOU ARE AN APPRENTICE BUILDER WITH A HARD HAT,',
      'ONE AXE, AND A PLAN NOBODY ASKED FOR.',
    ] },
    { paint: paintPortrait, who: 'YOU', lines: [
      'DAM THE RIVER. HOUSE THE ANIMALS.',
      'GET GOOD ENOUGH THAT B.I.T. HAS TO LET YOU IN.',
    ] },
  ],
  letter: [
    { paint: paintHeronPost, who: '', lines: [
      'A HERON DROPS SOMETHING ON THE JOB BOARD.',
    ] },
    { paint: paintLetter, who: 'B.I.T.', lines: [
      'BEAVER INSTITUTE OF TIMBERWORK.',
      'WE DO NOT TAKE APPLICATIONS ON PAPER.',
    ] },
    { paint: paintLetter, who: 'B.I.T.', lines: [
      'BUILD US A VALLEY WE CAN WALK THROUGH.',
      'THE JOB BOARD HAS THE LIST. GET ON WITH IT.',
    ] },
  ],
  accepted: [
    { paint: paintValleyDawn, who: '', lines: [
      'THE WATER IS HIGH. THE LODGES ARE FULL.',
      'EVERY ANIMAL IN THE VALLEY HAS A DOOR OF ITS OWN.',
    ] },
    { paint: paintGates, who: 'B.I.T.', lines: [
      'THE INSTITUTE HAS SEEN THE VALLEY.',
      'MASTER BUILDER - YOU ARE ACCEPTED.',
    ] },
    { paint: paintGates, who: '', lines: [
      'THEY WILL WANT A LECTURE ON DAM DESIGN BY FRIDAY.',
      'BRING THE HERON.',
    ] },
  ],
};

// ------------------------------------------------------------------ render
export function drawCutscene(ctx) {
  if (!cutscene.active) return false;
  const beats = SCENES[cutscene.id];
  const beat = beats[Math.min(cutscene.beat, beats.length - 1)];
  const p = Math.min(1, cutscene.t / 3.4);

  beat.paint(ctx, cutscene.t, p);

  // letterbox
  rect(ctx, 0, 0, VIEW_W, 10, PAL.black);
  rect(ctx, 0, VIEW_H - 10, VIEW_W, 10, PAL.black);

  // the narration box
  const boxH = 44;
  const y = VIEW_H - boxH - 12;
  rect(ctx, 8, y, VIEW_W - 16, boxH, 'rgba(13,10,20,0.88)');
  rect(ctx, 8, y, VIEW_W - 16, 1, PAL.wood3);
  rect(ctx, 8, y + boxH - 1, VIEW_W - 16, 1, PAL.wood0);

  if (beat.who) {
    const w = textWidth(beat.who) + 8;
    rect(ctx, 12, y - 9, w, 10, PAL.wood2);
    rect(ctx, 12, y - 9, w, 1, PAL.wood3);
    text(ctx, beat.who, 16, y - 7, PAL.gold2);
  }

  const shown = Math.floor(cutscene.typed);
  let used = 0;
  beat.lines.forEach((lineStr, i) => {
    const room = Math.max(0, shown - used);
    text(ctx, lineStr.slice(0, room), 16, y + 8 + i * 11, PAL.paper);
    used += lineStr.length;
  });

  const total = fullText().length;
  if (cutscene.typed >= total && Math.floor(cutscene.t * 2) % 2) {
    text(ctx, 'E', VIEW_W - 26, y + boxH - 13, PAL.gold2);
    rect(ctx, VIEW_W - 30, y + boxH - 15, 11, 11, 'rgba(0,0,0,0)');
    for (let i = 0; i < 11; i++) {
      px(ctx, VIEW_W - 30 + i, y + boxH - 15, PAL.gold);
      px(ctx, VIEW_W - 30 + i, y + boxH - 5, PAL.gold);
    }
    for (let i = 0; i < 11; i++) {
      px(ctx, VIEW_W - 30, y + boxH - 15 + i, PAL.gold);
      px(ctx, VIEW_W - 20, y + boxH - 15 + i, PAL.gold);
    }
  }

  // which beat we are on
  for (let i = 0; i < beats.length; i++) {
    rect(ctx, VIEW_W - 30 + i * 7, y - 7, 5, 3, i === cutscene.beat ? PAL.gold2 : PAL.wood1);
  }
  return true;
}
