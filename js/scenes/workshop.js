// Grandpa's workshop, played side-on. This is the hub: the phone rings here,
// the saw bench and the assembly bench are here, the map table sends you out,
// and the back door leads to the timber.

import { VIEW_W, VIEW_H } from '../config.js';
import { G } from '../state.js';
import { PAL, rect, frame, px, text, disc, line, rngFrom, wrap } from '../gfx/pixel.js';
import { cam } from '../gfx/screen.js';
import * as S from '../gfx/sprites.js';
import { keyPrompt, bar } from '../ui/widgets.js';
import { story, MATERIALS, HOSPITAL_BILL, tutorialStep, TUTORIAL } from '../story.js';
import { drawFurniture } from '../gfx/furniture.js';

export const WORKSHOP_W = 1000;
export const WORKSHOP_GROUND = 218;
export const WORKSHOP_BOUNDS = { w: WORKSHOP_W, h: VIEW_H };

export const WORK_STATIONS = [
  { id: 'phone',  x: 96,  label: 'THE PHONE',       reach: 30 },
  { id: 'saw',    x: 300, label: 'SAW BENCH',       reach: 34 },
  { id: 'bench',  x: 500, label: 'ASSEMBLY BENCH',  reach: 34 },
  { id: 'map',    x: 700, label: 'MAP TABLE',       reach: 32 },
  { id: 'door',   x: 900, label: 'OUT TO THE TREES', reach: 30 },
];

const GRANDPA_X = 170;

export function nearestWorkStation(px0) {
  let best = null;
  for (const st of WORK_STATIONS) {
    const d = Math.abs(px0 - st.x);
    if (d < st.reach && (!best || d < best.d)) best = { station: st, d };
  }
  return best ? best.station : null;
}

// ------------------------------------------------------------------ pieces
function wallAndFloor(ctx, t) {
  rect(ctx, 0, 0, VIEW_W, WORKSHOP_GROUND, '#3f2d1e');
  // board-and-batten wall, scrolling with the camera
  const startX = Math.floor(cam.x / 18) * 18;
  for (let x = startX; x < cam.x + VIEW_W + 18; x += 18) {
    const sx = cam.sx(x);
    rect(ctx, sx, 0, 2, WORKSHOP_GROUND, '#33241a');
    rect(ctx, sx + 2, 0, 1, WORKSHOP_GROUND, '#4a3524');
  }
  rect(ctx, 0, WORKSHOP_GROUND - 34, VIEW_W, 3, '#5c4029');
  rect(ctx, 0, WORKSHOP_GROUND - 34, VIEW_W, 1, PAL.wood3);
  // floor
  rect(ctx, 0, WORKSHOP_GROUND, VIEW_W, VIEW_H - WORKSHOP_GROUND, PAL.wood2);
  for (let y = WORKSHOP_GROUND; y < VIEW_H; y += 7) rect(ctx, 0, y, VIEW_W, 1, PAL.wood1);
  const seams = Math.floor(cam.x / 46) * 46;
  for (let x = seams; x < cam.x + VIEW_W + 46; x += 46) {
    line(ctx, cam.sx(x), WORKSHOP_GROUND, cam.sx(x) - 14, VIEW_H, PAL.wood1);
  }
  // sawdust drifted against the benches
  const dust = rngFrom(3131);
  for (let i = 0; i < 160; i++) {
    const wx = dust() * WORKSHOP_W;
    const sx = cam.sx(wx);
    if (sx < 0 || sx > VIEW_W) continue;
    px(ctx, sx, WORKSHOP_GROUND + Math.round(dust() * 6), dust() > 0.5 ? PAL.wood4 : PAL.paper3);
  }
}

/** Two windows, and the light they throw across the floor. */
function windows(ctx, t) {
  for (const wx of [420, 830]) {
    const sx = cam.sx(wx);
    if (sx < -100 || sx > VIEW_W + 100) continue;
    rect(ctx, sx - 34, 34, 68, 62, '#cfe6f2');
    rect(ctx, sx - 34, 34, 68, 22, '#e6f3fa');
    frame(ctx, sx - 34, 34, 68, 62, PAL.wood2);
    rect(ctx, sx - 1, 34, 2, 62, PAL.wood2);
    rect(ctx, sx - 34, 62, 68, 2, PAL.wood2);
    rect(ctx, sx - 38, 30, 76, 4, PAL.wood1);
    // a hint of the valley outside
    rect(ctx, sx - 32, 78, 64, 16, '#8fae76');
    for (let i = 0; i < 6; i++) disc(ctx, sx - 28 + i * 12, 76, 4, '#6f9460');
    // the shaft of light
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.moveTo(sx - 34, 96); ctx.lineTo(sx + 34, 96);
    ctx.lineTo(sx + 96, VIEW_H); ctx.lineTo(sx + 10, VIEW_H);
    ctx.fill();
    ctx.globalAlpha = 1;
    // motes in the beam
    const rng = rngFrom(700 + wx);
    for (let i = 0; i < 26; i++) {
      const bx = sx + rng() * 90 - 10;
      const by = 100 + ((rng() * 150 + t * 8 + i * 4) % 150);
      px(ctx, Math.round(bx), Math.round(by), i % 3 ? PAL.paper2 : PAL.white);
    }
  }
}

/** The wall of tools, and the shelf where your materials actually live. */
function toolWall(ctx, t) {
  const sx = cam.sx(300);
  if (sx > -160 && sx < VIEW_W + 160) {
    rect(ctx, sx - 90, 44, 180, 66, '#4d3524');
    frame(ctx, sx - 90, 44, 180, 66, PAL.wood0);
    for (let i = 0; i < 5; i++) {
      const hx = sx - 74 + i * 32;
      rect(ctx, hx, 58, 3, 34, PAL.wood2);
      rect(ctx, hx - 6, 52, 15, 7, PAL.stone2);
      px(ctx, hx - 4, 54, PAL.stone3);
    }
    for (let i = 0; i < 3; i++) {
      rect(ctx, sx - 70 + i * 52, 96, 40, 3, PAL.stone2);
      for (let k = 0; k < 40; k += 2) px(ctx, sx - 70 + i * 52 + k, 99, PAL.stone3);
    }
  }
  // materials shelf
  const mx = cam.sx(560);   // over the assembly bench
  if (mx > -140 && mx < VIEW_W + 140) {
    rect(ctx, mx - 66, 100, 132, 4, PAL.wood2);
    rect(ctx, mx - 66, 104, 132, 2, PAL.wood0);
    const mats = story().materials;
    const keys = Object.keys(MATERIALS);
    keys.forEach((k, i) => {
      const bx = mx - 58 + i * 26;
      const n = Math.min(6, mats[k] || 0);
      for (let s = 0; s < n; s++) {
        rect(ctx, bx, 96 - s * 3, 18, 3, MATERIALS[k].tone);
        px(ctx, bx, 96 - s * 3, PAL.white);
      }
      text(ctx, String(mats[k] || 0), bx + 8, 108, PAL.paper3, { align: 'center' });
    });
  }
}

/** The hospital board: grandma's photo, and how much of the bill is paid. */
function debtBoard(ctx, t) {
  const sx = cam.sx(96);
  if (sx < -120 || sx > VIEW_W + 120) return;
  const s = story();
  rect(ctx, sx - 52, 58, 104, 66, PAL.wood1);
  frame(ctx, sx - 52, 58, 104, 66, PAL.wood0);
  rect(ctx, sx - 46, 64, 40, 34, PAL.paper2);
  frame(ctx, sx - 46, 64, 40, 34, PAL.wood2);
  // grandma, in the photo
  disc(ctx, sx - 26, 80, 8, PAL.fur3);
  disc(ctx, sx - 26, 78, 6, PAL.fur4);
  px(ctx, sx - 29, 78, PAL.ink); px(ctx, sx - 23, 78, PAL.ink);
  rect(ctx, sx - 30, 88, 9, 8, PAL.purple2);
  text(ctx, 'THE BILL', sx + 20, 64, PAL.gold2, { align: 'center' });
  const paid = 1 - s.debt / HOSPITAL_BILL;
  bar(ctx, sx - 2, 74, 44, 5, paid, PAL.grass3);
  text(ctx, `${s.debt} LEFT`, sx + 20, 83, PAL.red2, { align: 'center' });
  rect(ctx, sx - 46, 102, 92, 16, PAL.paper);
  rect(ctx, sx - 46, 102, 92, 1, PAL.white);
  text(ctx, `ACORNS ${s.money}`, sx, 106, PAL.ink, { align: 'center' });
}

function phoneStation(ctx, t) {
  const sx = cam.sx(96);
  const base = WORKSHOP_GROUND;
  // a little table with the phone on it
  rect(ctx, sx - 20, base - 26, 40, 5, PAL.wood2);
  rect(ctx, sx - 16, base - 21, 5, 21, PAL.wood1);
  rect(ctx, sx + 11, base - 21, 5, 21, PAL.wood1);
  rect(ctx, sx - 12, base - 38, 24, 12, '#22303c');
  frame(ctx, sx - 12, base - 38, 24, 12, PAL.ink);
  rect(ctx, sx - 9, base - 35, 18, 6, '#33424f');
  rect(ctx, sx - 14, base - 42, 28, 5, PAL.ink2);   // the handset
  const s = story();
  if (s.offers.length) {
    // ringing: the handset jumps and rings come off it
    const ring = Math.floor(t * 6) % 2;
    rect(ctx, sx - 14, base - 42 - ring, 28, 5, PAL.ink2);
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.5 - i * 0.12;
      const r = 8 + i * 6 + (Math.sin(t * 8) + 1) * 2;
      for (let a = -1; a <= 1; a += 0.25) {
        px(ctx, Math.round(sx + Math.cos(a - 1.6) * r), Math.round(base - 44 + Math.sin(a - 1.6) * r), PAL.gold2);
      }
      ctx.globalAlpha = 1;
    }
    text(ctx, `${s.offers.length} WAITING`, sx, base - 56, PAL.gold2, { align: 'center', shadow: PAL.ink });
  }
}

function sawStation(ctx, t) {
  const sx = cam.sx(300);
  const base = WORKSHOP_GROUND;
  rect(ctx, sx - 44, base - 30, 88, 8, PAL.wood2);
  rect(ctx, sx - 44, base - 30, 88, 2, PAL.wood3);
  rect(ctx, sx - 38, base - 22, 8, 22, PAL.wood1);
  rect(ctx, sx + 30, base - 22, 8, 22, PAL.wood1);
  // a log in the cradle, waiting
  const logs = story().materials.hardwood || 0;
  if (logs > 0) {
    rect(ctx, sx - 34, base - 42, 68, 12, PAL.wood2);
    rect(ctx, sx - 34, base - 42, 68, 3, PAL.wood3);
    for (let r = 5; r > 0; r--) disc(ctx, sx + 34, base - 36, r, r % 2 ? PAL.wood3 : PAL.wood4);
  }
  // the frame saw, hung on its hook above
  rect(ctx, sx - 20, base - 68, 44, 3, PAL.stone2);
  for (let i = 0; i < 44; i += 3) px(ctx, sx - 20 + i, base - 65, PAL.stone3);
  rect(ctx, sx + 24, base - 74, 6, 14, PAL.wood2);
  // a stack of finished planks
  const planks = Math.min(7, story().materials.plank || 0);
  for (let i = 0; i < planks; i++) {
    rect(ctx, sx + 46, base - 4 - i * 4, 30, 3, PAL.wood4);
    rect(ctx, sx + 46, base - 4 - i * 4, 30, 1, PAL.paper2);
  }
}

function benchStation(ctx, t) {
  const sx = cam.sx(500);
  const base = WORKSHOP_GROUND;
  rect(ctx, sx - 46, base - 32, 92, 9, PAL.wood2);
  rect(ctx, sx - 46, base - 32, 92, 3, PAL.wood3);
  rect(ctx, sx - 40, base - 23, 9, 23, PAL.wood1);
  rect(ctx, sx + 32, base - 23, 9, 23, PAL.wood1);
  rect(ctx, sx + 14, base - 40, 22, 8, PAL.stone1);   // the vice
  rect(ctx, sx + 14, base - 36, 22, 2, PAL.stone0);
  // jars of screws
  for (let i = 0; i < 3; i++) {
    rect(ctx, sx - 40 + i * 12, base - 42, 9, 10, PAL.sky3);
    rect(ctx, sx - 40 + i * 12, base - 42, 9, 2, PAL.sky4);
    for (let k = 0; k < 4; k++) px(ctx, sx - 38 + i * 12 + (k % 3), base - 35 + (k >> 1), PAL.stone3);
  }
  // the finished pieces, lined up ready to go out
  const done = story().furniture.slice(0, 4);
  done.forEach((f, i) => {
    drawFurniture(ctx, f.id, sx + 70 + i * 34, base, { scale: 1 });
  });
  if (done.length) text(ctx, `${story().furniture.length} READY`, sx + 90, base - 56, PAL.gold2,
                        { align: 'center', shadow: PAL.ink });
}

function mapStation(ctx, t) {
  const sx = cam.sx(700);
  const base = WORKSHOP_GROUND;
  // a slanted map table with the valley pinned to it
  rect(ctx, sx - 34, base - 34, 68, 10, PAL.wood1);
  rect(ctx, sx - 30, base - 42, 60, 10, PAL.paper2);
  rect(ctx, sx - 30, base - 42, 60, 2, PAL.paper);
  for (let i = 0; i < 5; i++) px(ctx, sx - 24 + i * 12, base - 38, PAL.red);
  line(ctx, sx - 28, base - 36, sx + 28, base - 39, PAL.water2);
  rect(ctx, sx - 28, base - 24, 8, 24, PAL.wood0);
  rect(ctx, sx + 20, base - 24, 8, 24, PAL.wood0);
  // the heron, dozing on its perch, waiting to fly you out
  const heron = S.heronSideSprite(Math.floor(t * 1.1) % 2);
  ctx.drawImage(heron, sx + 40, base - heron.height + 2);
  rect(ctx, sx + 36, base - 4, 40, 4, PAL.wood1);
}

function doorway(ctx, t) {
  const sx = cam.sx(900);
  const base = WORKSHOP_GROUND;
  rect(ctx, sx - 26, base - 72, 52, 72, PAL.wood0);
  rect(ctx, sx - 22, base - 68, 44, 68, '#9dc07a');   // daylight outside
  rect(ctx, sx - 22, base - 68, 44, 20, '#c8e4f0');
  for (let i = 0; i < 4; i++) disc(ctx, sx - 16 + i * 11, base - 44, 7, '#6f9460');
  rect(ctx, sx - 30, base - 78, 60, 8, PAL.wood2);
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.moveTo(sx - 22, base - 68); ctx.lineTo(sx + 22, base - 68);
  ctx.lineTo(sx - 20, VIEW_H); ctx.lineTo(sx - 90, VIEW_H);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Grandpa, leaning on the bench, with whatever he is telling you today. */
function grandpa(ctx, t) {
  const sx = cam.sx(GRANDPA_X);
  const base = WORKSHOP_GROUND;
  if (sx < -60 || sx > VIEW_W + 60) return;
  const bob = Math.sin(t * 1.3) * 1;
  const img = S.crewSideSprite('engineer', Math.floor(t * 1.1) % 2);
  const top = base - img.height + 2 + Math.round(bob);
  ctx.drawImage(img, sx - (img.width >> 1), top);
  // a wire spectacle and an apron strap, so he reads as grandpa and not crew
  rect(ctx, sx - 5, top + 5, 8, 1, PAL.stone3);
  px(ctx, sx - 6, top + 4, PAL.stone3);
  px(ctx, sx + 3, top + 4, PAL.stone3);
  rect(ctx, sx - 4, top + 9, 7, 1, '#8a6d3b');
  rect(ctx, sx - 3, top + 10, 5, 4, '#6b5330');
  const step = tutorialStep();
  const s = story();
  const line = step ? step.line : GRANDPA_IDLE[s.grandpaLine % GRANDPA_IDLE.length];
  const lines = wrap(line, 150);
  const w = 158, h = 10 + lines.length * 9;
  const bx = Math.max(4, Math.min(VIEW_W - w - 4, sx - w / 2));
  const by = base - img.height - h - 16;
  ctx.fillStyle = 'rgba(242,226,191,0.94)';
  ctx.fillRect(bx, by, w, h);
  frame(ctx, bx, by, w, h, PAL.wood0);
  lines.forEach((ln, i) => text(ctx, ln, bx + 5, by + 4 + i * 9, PAL.ink));
  for (let i = 0; i < 4; i++) px(ctx, sx - 2 + i, by + h + i, PAL.paper);
}

const GRANDPA_IDLE = [
  'Take the jobs that pay. Take the ones that matter too.',
  'Sharp tools, straight cuts. Everything else is patience.',
  'She asked after you. Bring her something you made.',
  'That kiln in the catalogue is not a toy. It is worth it.',
  'A customer who trusts you never haggles.',
];

// -------------------------------------------------------------------- draw
export function drawWorkshop(ctx, t) {
  wallAndFloor(ctx, t);
  windows(ctx, t);
  toolWall(ctx, t);
  debtBoard(ctx, t);
  phoneStation(ctx, t);
  sawStation(ctx, t);
  benchStation(ctx, t);
  mapStation(ctx, t);
  doorway(ctx, t);
  grandpa(ctx, t);

  // hanging lamps, swinging a little
  for (const lx of [240, 560, 800]) {
    const sx = cam.sx(lx);
    if (sx < -20 || sx > VIEW_W + 20) continue;
    const sway = Math.sin(t * 0.9 + lx) * 2;
    line(ctx, sx, 0, sx + sway, 26, PAL.ink2);
    rect(ctx, sx + sway - 7, 26, 14, 5, PAL.stone1);
    disc(ctx, sx + sway, 33, 4, PAL.gold2);
    ctx.globalAlpha = 0.06;
    for (let i = 1; i <= 3; i++) disc(ctx, sx + sway, 36, 12 + i * 9, PAL.gold2);
    ctx.globalAlpha = 1;
  }
}

export function drawWorkshopHud(ctx, t) {
  const station = nearestWorkStation(G.player.x);
  if (!station) return;
  const labels = {
    phone: story().offers.length ? 'ANSWER THE PHONE' : 'THE PHONE',
    saw: 'SAW BENCH', bench: 'ASSEMBLY BENCH', map: 'MAP TABLE', door: 'OUT TO THE TREES',
  };
  keyPrompt(ctx, cam.sx(station.x), WORKSHOP_GROUND - 82, 'E', labels[station.id] || station.label, t);
}
