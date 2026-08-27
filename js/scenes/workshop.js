// Grandpa's workshop, played side-on: a one-room timber cabin, warm and bright.
// This is the hub - the phone rings here, the saw bench and the assembly bench
// are here, the map table sends you out, and the back door leads to the timber.
//
// It is deliberately small. A cabin you can see most of at once reads better
// than a hall you have to walk across, and it keeps the beaver the right size
// in frame.

import { VIEW_W, VIEW_H } from '../config.js';
import { G } from '../state.js';
import { PAL, rect, frame, px, text, disc, line, rngFrom, wrap } from '../gfx/pixel.js';
import { cam } from '../gfx/screen.js';
import * as S from '../gfx/sprites.js';
import { keyPrompt, bar } from '../ui/widgets.js';
import { story, MATERIALS, HOSPITAL_BILL, tutorialStep, TUTORIAL } from '../story.js';
import { drawFurniture } from '../gfx/furniture.js';
import { elder, SUN } from '../gfx/actors.js';

export const WORKSHOP_W = 600;
export const WORKSHOP_GROUND = 200;
export const WORKSHOP_BOUNDS = { w: WORKSHOP_W, h: VIEW_H };

const T = 16;                       // everything lines up on a 16px tile
const CEILING = 40;                 // where the roof beams sit

export const WORK_STATIONS = [
  { id: 'phone',  x: 64,  label: 'THE PHONE',        reach: 26 },
  { id: 'saw',    x: 184, label: 'SAW BENCH',        reach: 30 },
  { id: 'bench',  x: 304, label: 'ASSEMBLY BENCH',   reach: 30 },
  { id: 'map',    x: 424, label: 'MAP TABLE',        reach: 28 },
  { id: 'door',   x: 552, label: 'OUT TO THE TREES', reach: 42 },
];

const GRANDPA_X = 248;

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
  // roof space above the beams, then the wall, then the floor
  rect(ctx, 0, 0, VIEW_W, CEILING, '#3f2a1b');
  rect(ctx, 0, CEILING - 6, VIEW_W, 6, SUN.wood1);
  rect(ctx, 0, CEILING - 6, VIEW_W, 2, SUN.wood3);
  // rafters, receding into the dark
  for (let x = Math.floor(cam.x / 48) * 48; x < cam.x + VIEW_W + 48; x += 48) {
    const sx = cam.sx(x);
    rect(ctx, sx, 0, 4, CEILING - 6, '#4d3524');
    rect(ctx, sx, 0, 1, CEILING - 6, '#5f4229');
  }

  // the wall: horizontal boards, lit from the windows
  rect(ctx, 0, CEILING, VIEW_W, WORKSHOP_GROUND - CEILING, SUN.wall1);
  for (let y = CEILING; y < WORKSHOP_GROUND; y += T) {
    rect(ctx, 0, y, VIEW_W, 1, SUN.wall2);
    rect(ctx, 0, y + T - 1, VIEW_W, 1, SUN.wall0);
  }
  // uprights every four tiles, so the boards have something to sit on
  for (let x = Math.floor(cam.x / (T * 4)) * T * 4; x < cam.x + VIEW_W + T * 4; x += T * 4) {
    const sx = cam.sx(x);
    rect(ctx, sx, CEILING, 5, WORKSHOP_GROUND - CEILING, SUN.wood1);
    rect(ctx, sx, CEILING, 1, WORKSHOP_GROUND - CEILING, SUN.wood3);
    rect(ctx, sx + 4, CEILING, 1, WORKSHOP_GROUND - CEILING, SUN.wood0);
  }
  // skirting
  rect(ctx, 0, WORKSHOP_GROUND - 5, VIEW_W, 5, SUN.wood1);
  rect(ctx, 0, WORKSHOP_GROUND - 5, VIEW_W, 1, SUN.wood3);

  // floorboards
  rect(ctx, 0, WORKSHOP_GROUND, VIEW_W, VIEW_H - WORKSHOP_GROUND, SUN.floor1);
  for (let y = WORKSHOP_GROUND + 6; y < VIEW_H; y += 9) {
    rect(ctx, 0, y, VIEW_W, 1, SUN.floor0);
    rect(ctx, 0, y + 1, VIEW_W, 1, SUN.floor2);
  }
  for (let x = Math.floor(cam.x / 52) * 52; x < cam.x + VIEW_W + 52; x += 52) {
    line(ctx, cam.sx(x), WORKSHOP_GROUND, cam.sx(x) - 18, VIEW_H, SUN.floor0);
  }
  // a rag rug by the phone, because grandma made it
  const rugX = cam.sx(40);
  if (rugX > -120 && rugX < VIEW_W) {
    for (let i = 0; i < 5; i++) {
      const tone = ['#c04a4a', '#e8a33c', '#4f8be8', '#5cba48', '#c04a4a'][i];
      rect(ctx, rugX, WORKSHOP_GROUND + 10 + i * 4, 96, 4, tone);
    }
    frame(ctx, rugX, WORKSHOP_GROUND + 10, 96, 20, SUN.wood0);
  }
  // sawdust drifted along the boards
  const dust = rngFrom(3131);
  for (let i = 0; i < 130; i++) {
    const sx = cam.sx(dust() * WORKSHOP_W);
    if (sx < 0 || sx > VIEW_W) continue;
    px(ctx, sx, WORKSHOP_GROUND + 2 + Math.round(dust() * 8), dust() > 0.5 ? SUN.wood4 : PAL.paper2);
  }
}

/** Two windows with real daylight behind them, and the beams they throw. */
function windows(ctx, t) {
  for (const wx of [276, 440]) {
    const sx = cam.sx(wx);
    if (sx < -90 || sx > VIEW_W + 90) continue;
    const w = 56, h = 44, y = CEILING + 14;
    // the valley outside: sky, hills, a hedge
    rect(ctx, sx - w / 2, y, w, h, SUN.sky2);
    rect(ctx, sx - w / 2, y, w, 14, SUN.sky1);
    for (let i = 0; i < 4; i++) disc(ctx, sx - w / 2 + 8 + i * 14, y + 26, 9, SUN.grass1);
    rect(ctx, sx - w / 2, y + h - 12, w, 12, SUN.grass2);
    rect(ctx, sx - w / 2, y + h - 12, w, 2, SUN.grass3);
    // frame and bars
    frame(ctx, sx - w / 2 - 2, y - 2, w + 4, h + 4, SUN.wood2);
    frame(ctx, sx - w / 2 - 3, y - 3, w + 6, h + 6, SUN.wood0);
    rect(ctx, sx - 1, y, 2, h, SUN.wood2);
    rect(ctx, sx - w / 2, y + h / 2 - 1, w, 2, SUN.wood2);
    rect(ctx, sx - w / 2 - 6, y - 6, w + 12, 4, SUN.wood1);   // sill above
    rect(ctx, sx - w / 2 - 6, y + h + 2, w + 12, 4, SUN.wood2);
    rect(ctx, sx - w / 2 - 6, y + h + 2, w + 12, 1, SUN.wood4);
    // a pot plant on the sill, and the light on the floor
    disc(ctx, sx + w / 2 - 4, y + h - 2, 5, SUN.leaf2);
    rect(ctx, sx + w / 2 - 7, y + h + 2, 7, 4, '#b5714f');
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#fff0c0';
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, y + h);
    ctx.lineTo(sx + w / 2, y + h);
    ctx.lineTo(sx + w / 2 + 46, VIEW_H);
    ctx.lineTo(sx - w / 2 + 20, VIEW_H);
    ctx.fill();
    ctx.globalAlpha = 1;
    const rng = rngFrom(700 + wx);
    for (let i = 0; i < 20; i++) {
      const bx = sx + rng() * 70 - 20;
      const by = y + h + ((rng() * 100 + t * 7 + i * 4) % 100);
      px(ctx, Math.round(bx), Math.round(by), i % 3 ? PAL.paper2 : PAL.white);
    }
  }
}

/** The wall of tools over the benches, and the shelf your materials live on. */
function toolWall(ctx, t) {
  const sx = cam.sx(184);
  if (sx > -110 && sx < VIEW_W + 110) {
    // a pegboard, hung with the tools of the trade
    rect(ctx, sx - 54, CEILING + 10, 108, 46, '#6b4423');
    frame(ctx, sx - 54, CEILING + 10, 108, 46, SUN.wood0);
    rect(ctx, sx - 54, CEILING + 10, 108, 2, SUN.wood3);
    for (let i = 0; i < 4; i++) {
      const hx = sx - 40 + i * 26;
      rect(ctx, hx, CEILING + 22, 2, 20, SUN.wood3);        // handles
      rect(ctx, hx - 5, CEILING + 17, 12, 6, PAL.stone2);   // heads
      rect(ctx, hx - 5, CEILING + 17, 12, 2, PAL.stone3);
    }
    // a hand saw and a square, hung below
    rect(ctx, sx - 40, CEILING + 46, 40, 3, PAL.stone2);
    for (let k = 0; k < 40; k += 2) px(ctx, sx - 40 + k, CEILING + 49, PAL.stone3);
    rect(ctx, sx + 12, CEILING + 44, 3, 12, SUN.wood3);
    rect(ctx, sx + 12, CEILING + 53, 16, 3, SUN.wood3);
  }
  // the materials shelf, in the gap between the window and the bench
  const mx = cam.sx(370);
  if (mx > -110 && mx < VIEW_W + 110) {
    rect(ctx, mx - 56, CEILING + 44, 112, 4, SUN.wood2);
    rect(ctx, mx - 56, CEILING + 44, 112, 1, SUN.wood4);
    rect(ctx, mx - 56, CEILING + 48, 112, 2, SUN.wood0);
    const mats = story().materials;
    Object.keys(MATERIALS).forEach((k, i) => {
      const bx = mx - 50 + i * 22;
      const n = Math.min(5, mats[k] || 0);
      for (let s2 = 0; s2 < n; s2++) {
        rect(ctx, bx, CEILING + 40 - s2 * 3, 15, 3, MATERIALS[k].tone);
        rect(ctx, bx, CEILING + 40 - s2 * 3, 15, 1, 'rgba(255,255,255,0.35)');
      }
      text(ctx, String(mats[k] || 0), bx + 7, CEILING + 52, PAL.paper2, { align: 'center' });
    });
  }
}

/** The bill, pinned up with grandma's photograph beside it. */
function debtBoard(ctx, t) {
  const sx = cam.sx(64);
  if (sx < -90 || sx > VIEW_W + 90) return;
  const s = story();
  const y = CEILING + 12;
  rect(ctx, sx - 44, y, 88, 52, '#7c5130');
  frame(ctx, sx - 44, y, 88, 52, SUN.wood0);
  rect(ctx, sx - 44, y, 88, 2, SUN.wood3);
  // the photograph
  rect(ctx, sx - 38, y + 6, 30, 26, PAL.paper);
  frame(ctx, sx - 38, y + 6, 30, 26, SUN.wood2);
  disc(ctx, sx - 23, y + 18, 7, '#a3805c');
  disc(ctx, sx - 23, y + 16, 5, '#c9a678');
  px(ctx, sx - 26, y + 16, PAL.ink);
  px(ctx, sx - 20, y + 16, PAL.ink);
  rect(ctx, sx - 27, y + 24, 9, 8, PAL.purple2);
  disc(ctx, sx - 25, y + 10, 2, '#e6cb9c');
  // the ledger
  text(ctx, 'THE BILL', sx + 16, y + 6, PAL.gold2, { align: 'center' });
  bar(ctx, sx - 2, y + 16, 38, 5, 1 - s.debt / HOSPITAL_BILL, PAL.grass3);
  text(ctx, `${s.debt}`, sx + 16, y + 24, PAL.red2, { align: 'center' });
  text(ctx, 'OWING', sx + 16, y + 33, PAL.paper3, { align: 'center' });
  rect(ctx, sx - 38, y + 40, 76, 9, PAL.paper);
  rect(ctx, sx - 38, y + 40, 76, 1, PAL.white);
  text(ctx, `${s.money} ACORNS`, sx, y + 42, PAL.ink, { align: 'center' });
}

function phoneStation(ctx, t) {
  const sx = cam.sx(64);
  const base = WORKSHOP_GROUND;
  // a little side table with the phone on it
  rect(ctx, sx - 16, base - 22, 32, 4, SUN.wood3);
  rect(ctx, sx - 16, base - 22, 32, 1, SUN.wood4);
  rect(ctx, sx - 13, base - 18, 4, 18, SUN.wood2);
  rect(ctx, sx + 9, base - 18, 4, 18, SUN.wood2);
  rect(ctx, sx - 11, base - 12, 22, 3, SUN.wood1);
  // the telephone: a wooden box with a brass bell and a handset across the top
  rect(ctx, sx - 10, base - 34, 20, 12, '#3f4650');
  frame(ctx, sx - 10, base - 34, 20, 12, SUN.wood0);
  rect(ctx, sx - 8, base - 32, 16, 5, '#5a6470');
  px(ctx, sx - 6, base - 30, PAL.gold2);
  disc(ctx, sx + 6, base - 36, 3, PAL.gold);
  const s = story();
  const ring = s.offers.length ? Math.floor(t * 7) % 2 : 0;
  rect(ctx, sx - 12, base - 39 - ring, 24, 4, PAL.ink2);
  rect(ctx, sx - 12, base - 39 - ring, 24, 1, '#4a4a52');
  if (s.offers.length) {
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.55 - i * 0.13;
      const r = 7 + i * 5 + (Math.sin(t * 9) + 1) * 1.5;
      for (let a = -1.1; a <= 1.1; a += 0.22) {
        px(ctx, Math.round(sx + Math.cos(a - 1.6) * r), Math.round(base - 41 + Math.sin(a - 1.6) * r), PAL.gold2);
      }
      ctx.globalAlpha = 1;
    }
    text(ctx, `${s.offers.length} WAITING`, sx, base - 52, PAL.gold2, { align: 'center', shadow: PAL.ink });
  }
}

function sawStation(ctx, t) {
  const sx = cam.sx(184);
  const base = WORKSHOP_GROUND;
  // trestle bench, two tiles long
  rect(ctx, sx - 34, base - 26, 68, 6, SUN.wood3);
  rect(ctx, sx - 34, base - 26, 68, 2, SUN.wood4);
  rect(ctx, sx - 30, base - 20, 6, 20, SUN.wood2);
  rect(ctx, sx + 24, base - 20, 6, 20, SUN.wood2);
  rect(ctx, sx - 26, base - 12, 52, 3, SUN.wood1);
  // a log in the cradle if there is one to cut
  if ((story().materials.hardwood || 0) > 0) {
    rect(ctx, sx - 26, base - 34, 52, 9, SUN.wood2);
    rect(ctx, sx - 26, base - 34, 52, 3, SUN.wood3);
    rect(ctx, sx - 26, base - 27, 52, 2, SUN.wood0);
    for (let r = 4; r > 0; r--) disc(ctx, sx + 26, base - 29, r, r % 2 ? SUN.wood3 : SUN.wood4);
  }
  // the frame saw leaning against the bench end
  rect(ctx, sx + 32, base - 30, 3, 30, SUN.wood2);
  rect(ctx, sx + 26, base - 32, 14, 3, PAL.stone2);
  for (let k = 0; k < 14; k += 2) px(ctx, sx + 26 + k, base - 29, PAL.stone3);
  // planks stacked against the wall
  const planks = Math.min(6, story().materials.plank || 0);
  for (let i = 0; i < planks; i++) {
    rect(ctx, sx - 56, base - 3 - i * 4, 22, 3, SUN.wood4);
    rect(ctx, sx - 56, base - 3 - i * 4, 22, 1, PAL.paper2);
  }
}

function benchStation(ctx, t) {
  const sx = cam.sx(304);
  const base = WORKSHOP_GROUND;
  rect(ctx, sx - 36, base - 28, 72, 7, SUN.wood3);
  rect(ctx, sx - 36, base - 28, 72, 2, SUN.wood4);
  rect(ctx, sx - 32, base - 21, 7, 21, SUN.wood2);
  rect(ctx, sx + 25, base - 21, 7, 21, SUN.wood2);
  // a vice, and jars of fixings on the bench top
  rect(ctx, sx + 12, base - 35, 18, 7, PAL.stone1);
  rect(ctx, sx + 12, base - 32, 18, 2, PAL.stone0);
  for (let i = 0; i < 3; i++) {
    rect(ctx, sx - 30 + i * 10, base - 36, 8, 8, '#a3ddfa');
    rect(ctx, sx - 30 + i * 10, base - 36, 8, 2, '#cdeeff');
    for (let k = 0; k < 3; k++) px(ctx, sx - 28 + i * 10 + k, base - 30, PAL.stone3);
  }
  // finished pieces lined up along the wall, ready to go out
  const done = story().furniture.slice(0, 3);
  done.forEach((f, i) => drawFurniture(ctx, f.id, sx + 56 + i * 30, base, { scale: 1 }));
  if (done.length) {
    text(ctx, `${story().furniture.length} READY`, sx + 70, base - 46, PAL.gold2,
         { align: 'center', shadow: PAL.ink });
  }
}

function mapStation(ctx, t) {
  const sx = cam.sx(424);
  const base = WORKSHOP_GROUND;
  // a slanted drawing table with the valley pinned to it
  rect(ctx, sx - 26, base - 26, 52, 7, SUN.wood2);
  rect(ctx, sx - 24, base - 32, 48, 7, PAL.paper2);
  rect(ctx, sx - 24, base - 32, 48, 2, PAL.paper);
  line(ctx, sx - 22, base - 28, sx + 22, base - 30, '#4aa3e0');
  for (let i = 0; i < 4; i++) px(ctx, sx - 16 + i * 11, base - 29, PAL.red);
  rect(ctx, sx - 22, base - 19, 6, 19, SUN.wood1);
  rect(ctx, sx + 16, base - 19, 6, 19, SUN.wood1);
  // the heron on its perch by the door, waiting to be asked
  const heron = S.heronSideSprite(Math.floor(t * 1.1) % 2);
  ctx.drawImage(heron, sx + 34, base - heron.height + 1);
  rect(ctx, sx + 30, base - 3, 34, 3, SUN.wood1);
  rect(ctx, sx + 30, base - 3, 34, 1, SUN.wood3);
}

function doorway(ctx, t) {
  const sx = cam.sx(550);
  const base = WORKSHOP_GROUND;
  const w = 44, h = 62;
  // the open back door, with the bright outside showing through it
  rect(ctx, sx - w / 2 - 4, base - h - 6, w + 8, h + 6, SUN.wood1);
  rect(ctx, sx - w / 2 - 4, base - h - 6, w + 8, 4, SUN.wood3);
  rect(ctx, sx - w / 2, base - h, w, h, SUN.sky2);
  rect(ctx, sx - w / 2, base - h, w, 18, SUN.sky1);
  for (let i = 0; i < 3; i++) disc(ctx, sx - w / 2 + 8 + i * 14, base - h + 30, 10, SUN.leaf1);
  rect(ctx, sx - w / 2, base - 22, w, 22, SUN.grass2);
  rect(ctx, sx - w / 2, base - 22, w, 2, SUN.grass3);
  for (let i = 0; i < 8; i++) px(ctx, sx - w / 2 + 3 + i * 5, base - 24, SUN.grass4);
  frame(ctx, sx - w / 2, base - h, w, h, SUN.wood0);
  // the door itself, swung back against the wall
  rect(ctx, sx + w / 2 + 4, base - h, 8, h, SUN.wood2);
  rect(ctx, sx + w / 2 + 4, base - h, 2, h, SUN.wood3);
  // daylight on the boards
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#fff0c0';
  ctx.beginPath();
  ctx.moveTo(sx - w / 2, base);
  ctx.lineTo(sx + w / 2, base);
  ctx.lineTo(sx + w / 2 - 30, VIEW_H);
  ctx.lineTo(sx - w / 2 - 70, VIEW_H);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Grandpa, leaning by the bench with whatever he is telling you today. */
function grandpa(ctx, t) {
  const sx = cam.sx(GRANDPA_X);
  const base = WORKSHOP_GROUND;
  if (sx < -60 || sx > VIEW_W + 60) return;
  const img = elder('idle', Math.floor(t * 1.5) % 4);
  ctx.drawImage(img, sx - (img.width >> 1), base - img.height + 2);

  const near = Math.abs(G.player.x - GRANDPA_X) < 96;
  if (!near) {
    // out of earshot: just a quiet puff of thought
    const puff = Math.floor(t * 1.2) % 3;
    for (let i = 0; i <= puff; i++) {
      disc(ctx, sx + 10 + i * 5, base - img.height - 4 - i * 4, 1 + i, PAL.paper2);
    }
    return;
  }
  const step = tutorialStep();
  const s = story();
  const line = step ? step.line : GRANDPA_IDLE[s.grandpaLine % GRANDPA_IDLE.length];
  const lines = wrap(line, 128);
  const w = 136, h = 9 + lines.length * 9;
  const bx = Math.max(4, Math.min(VIEW_W - w - 4, sx - w / 2));
  const by = base - img.height - h - 6;
  // a paper speech note, pinned in the air
  rect(ctx, bx + 1, by + 1, w, h, 'rgba(0,0,0,0.25)');
  rect(ctx, bx, by, w, h, PAL.paper);
  rect(ctx, bx, by, w, 1, PAL.white);
  frame(ctx, bx, by, w, h, SUN.wood0);
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

  // two lamps on the beams, swinging a little
  for (const lx of [140, 380]) {
    const sx = cam.sx(lx);
    if (sx < -20 || sx > VIEW_W + 20) continue;
    const sway = Math.sin(t * 0.9 + lx) * 2;
    line(ctx, sx, CEILING - 6, sx + sway, CEILING + 8, PAL.ink2);
    // a tin shade with the bulb glowing under it
    rect(ctx, sx + sway - 9, CEILING + 8, 18, 3, PAL.stone2);
    rect(ctx, sx + sway - 7, CEILING + 11, 14, 3, PAL.stone1);
    rect(ctx, sx + sway - 9, CEILING + 8, 18, 1, PAL.stone3);
    disc(ctx, sx + sway, CEILING + 15, 3, PAL.gold2);
    px(ctx, sx + sway, CEILING + 15, PAL.white);
    ctx.globalAlpha = 0.05;
    for (let i = 1; i <= 3; i++) disc(ctx, sx + sway, CEILING + 16, 10 + i * 8, PAL.gold2);
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
  keyPrompt(ctx, cam.sx(station.x), WORKSHOP_GROUND - 66, 'E', labels[station.id] || station.label, t);
}
