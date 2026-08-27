// Grandpa's workshop: one warm timber room, seen side-on, and the hub the whole
// game runs through. Five stations, each with its own island of clutter so you
// can tell where you are at a glance, and enough decoration that it reads as
// somewhere that has been worked in for forty years.

import { VIEW_W, VIEW_H } from '../config.js';
import { G } from '../state.js';
import { PAL, rect, frame as boxFrame, px, text, disc, line, rngFrom, wrap } from '../gfx/pixel.js';
import { cam } from '../gfx/screen.js';
import * as S from '../gfx/sprites.js';
import { keyPrompt, bar } from '../ui/widgets.js';
import { story, MATERIALS, HOSPITAL_BILL, tutorialStep } from '../story.js';
import { drawFurniture } from '../gfx/furniture.js';
import { elder } from '../gfx/actors.js';
import { RAMPS, ramp, mix, noise, contact, ao, rim, speck, plank, plankWall, cloth, metal,
         glass, brick, stonework, shingles, band } from '../gfx/paint.js';
import * as PROP from '../gfx/props.js';
import * as N from '../gfx/nature.js';

export const WORKSHOP_W = 600;
export const WORKSHOP_GROUND = 182;
export const WORKSHOP_BOUNDS = { w: WORKSHOP_W, h: VIEW_H };

const T = 16;
const CEILING = 34;
const WALL = ramp('#8a5a33');          // the timber the room is built from
const FLOORB = ramp('#c08a4c');        // and the boards underfoot

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

// ------------------------------------------------------------------- shell
function shell(ctx, t) {
  const camX = cam.x;
  // ---- roof space and rafters, as one world-anchored tile
  band(ctx, 'ws:roofspace', 120, camX, 0, CEILING, VIEW_W, (c, w, h) => {
    rect(c, 0, 0, w, h, '#2e2118');
    speck(c, 0, 0, w, h - 8, ['#3a2a1e', '#241a14'], 60, 5);
    // two rafters per tile, with timber stored across them
    for (const rx of [10, 70]) {
      plank(c, rx, 0, 7, h - 8, RAMPS.walnut, { dir: 'v', knots: 0, grain: 0 });
      c.globalAlpha = 0.35;
      rect(c, rx, 0, 7, h - 8, '#1b1424');
      c.globalAlpha = 1;
    }
    plank(c, 24, h - 24, 60, 5, RAMPS.pine, { dir: 'h', knots: 1 });
    plank(c, 32, h - 29, 44, 5, RAMPS.pine, { dir: 'h', knots: 0 });
    plank(c, 0, h - 9, w, 10, RAMPS.walnut, { dir: 'h', knots: 1 });
    rect(c, 0, h - 9, w, 1, RAMPS.walnut[4]);
  });

  // ---- the wall
  const wallH = WORKSHOP_GROUND - CEILING;
  band(ctx, 'ws:wall', 96, camX, CEILING, wallH, VIEW_W, (c, w, h) => {
    plankWall(c, 0, 0, w, h, WALL, { step: 24, dir: 'v' });
    c.globalAlpha = 0.3;
    rect(c, 0, 0, w, 12, '#1b1424');
    c.globalAlpha = 1;
    plank(c, 0, 0, 7, h, RAMPS.oak, { dir: 'v', knots: 1 });     // a stud per tile
    plank(c, 0, h - 9, w, 10, RAMPS.walnut, { dir: 'h', knots: 0 });
  });

  // ---- the floor
  const floorH = VIEW_H - WORKSHOP_GROUND;
  band(ctx, 'ws:floor', 78, camX, WORKSHOP_GROUND, floorH, VIEW_W, (c, w, h) => {
    for (let i = 0; i < Math.ceil(h / 10); i++) {
      plank(c, 0, i * 10, w, 10, FLOORB, { dir: 'h', seed: 200 + i, knots: i % 4 === 0 ? 1 : 0 });
      // staggered board ends
      rect(c, (i % 2) * 39, i * 10, 1, 10, mix(FLOORB[1], FLOORB[0], 0.5));
    }
    // shavings and offcuts, baked into the tile so they do not crawl
    const rng = noise(3131);
    for (let i = 0; i < 60; i++) {
      const sx = rng() * w, sy = rng() * h;
      const roll = rng();
      if (roll > 0.9) { rect(c, sx, sy, 3, 1, RAMPS.pine[4]); px(c, sx + 3, sy, RAMPS.pine[2]); }
      else px(c, sx, sy, roll > 0.5 ? RAMPS.pine[4] : PAL.paper2);
    }
  });
}

/** Windows, and the light they throw across the room. */
function windows(ctx, t) {
  for (const wx of [140, 368]) {
    const sx = cam.sx(wx);
    if (sx < -90 || sx > VIEW_W + 90) continue;
    const w = 52, h = 42, y = CEILING + 12;
    // the valley outside
    rect(ctx, sx - w / 2, y, w, h, '#8fd3ff');
    rect(ctx, sx - w / 2, y, w, 16, '#5ab4ee');
    for (let i = 0; i < 4; i++) disc(ctx, sx - w / 2 + 9 + i * 14, y + 28, 10, RAMPS.leafB[2]);
    rect(ctx, sx - w / 2, y + h - 12, w, 12, RAMPS.grass[2]);
    rect(ctx, sx - w / 2, y + h - 12, w, 2, RAMPS.grass[3]);
    // painted frame with glazing bars
    const paint = ramp('#2f7ab0');
    glass(ctx, sx - w / 2, y, w, h, RAMPS.glass, {});
    rect(ctx, sx - 1, y, 2, h, paint[3]);
    rect(ctx, sx - w / 2, y + h / 2 - 1, w, 2, paint[3]);
    boxFrame(ctx, sx - w / 2 - 2, y - 2, w + 4, h + 4, paint[2]);
    rect(ctx, sx - w / 2 - 2, y - 2, w + 4, 1, paint[4]);
    boxFrame(ctx, sx - w / 2 - 3, y - 3, w + 6, h + 6, RAMPS.walnut[0]);
    plank(ctx, sx - w / 2 - 6, y + h + 3, w + 12, 5, RAMPS.walnut, { dir: 'h', knots: 0 });
    // pots on the sill
    ctx.drawImage(PROP.pottedPlant(2), sx - w / 2 - 2, y + h - 16);
    ctx.drawImage(PROP.pottedPlant(1), sx + w / 2 - 16, y + h - 18);
    // and the beam of light on the floor
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#fff0c0';
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, y + h);
    ctx.lineTo(sx + w / 2, y + h);
    ctx.lineTo(sx + w / 2 + 60, VIEW_H);
    ctx.lineTo(sx - w / 2 + 24, VIEW_H);
    ctx.fill();
    ctx.globalAlpha = 1;
    const rng = rngFrom(700 + wx);
    for (let i = 0; i < 24; i++) {
      const bx = sx + rng() * 80 - 26;
      const by = y + h + ((rng() * 110 + t * 8 + i * 4) % 110);
      px(ctx, Math.round(bx), Math.round(by), i % 3 ? PAL.paper2 : PAL.white);
    }
  }
}

/** Lamps on the beams, and bunting between them. */
function lights(ctx, t) {
  ctx.drawImage(PROP.bunting(200), cam.sx(160), CEILING - 8);
  ctx.drawImage(PROP.bunting(170), cam.sx(392), CEILING - 8);
  for (const lx of [96, 244, 396, 520]) {
    const sx = cam.sx(lx);
    if (sx < -20 || sx > VIEW_W + 20) continue;
    const sway = Math.sin(t * 0.9 + lx) * 2;
    line(ctx, sx, CEILING - 8, sx + sway, CEILING + 6, PAL.ink2);
    ctx.drawImage(PROP.lantern(false), Math.round(sx + sway) - 7, CEILING + 6);
    ctx.globalAlpha = 0.06;
    for (let i = 1; i <= 3; i++) disc(ctx, sx + sway, CEILING + 16, 12 + i * 10, '#f7cc55');
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- stations
/** The phone corner: the bill on the wall, a rug, a stool, the telephone. */
function phoneCorner(ctx, t) {
  const sx = cam.sx(64);
  const base = WORKSHOP_GROUND;
  const s = story();
  if (sx > -140 && sx < VIEW_W + 140) {
    // grandma's photograph and the bill, pinned side by side
    const bw = 88, by = CEILING + 8;
    plank(ctx, sx - 44, by, bw, 52, RAMPS.walnut, { dir: 'h', knots: 1 });
    boxFrame(ctx, sx - 44, by, bw, 52, RAMPS.walnut[0]);
    ctx.drawImage(PROP.picture(1), sx - 40, by + 3);
    text(ctx, 'THE BILL', sx + 20, by + 5, PAL.gold2, { align: 'center' });
    bar(ctx, sx - 4, by + 16, 40, 5, 1 - s.debt / HOSPITAL_BILL, PAL.grass3);
    text(ctx, `${s.debt}`, sx + 16, by + 25, PAL.red2, { align: 'center' });
    text(ctx, 'OWING', sx + 16, by + 34, PAL.paper3, { align: 'center' });
    rect(ctx, sx - 40, by + 42, 80, 9, PAL.paper);
    rect(ctx, sx - 40, by + 42, 80, 1, PAL.white);
    text(ctx, `${s.money} ACORNS`, sx, by + 44, PAL.ink, { align: 'center' });
  }
  // the rug, a stool, a broom in the corner
  ctx.drawImage(PROP.rug(84, 26, '#a8404a'), cam.sx(24), base + 12);
  ctx.drawImage(PROP.stool(), cam.sx(96), base - 20);
  ctx.drawImage(PROP.broom(), cam.sx(14), base - 34);
  ctx.drawImage(PROP.pottedPlant(0), cam.sx(112), base - 26);
  // the telephone on its little table
  plank(ctx, sx - 18, base - 24, 36, 5, RAMPS.oak, { dir: 'h', knots: 0 });
  plank(ctx, sx - 14, base - 19, 5, 19, RAMPS.walnut, { dir: 'v', knots: 0 });
  plank(ctx, sx + 9, base - 19, 5, 19, RAMPS.walnut, { dir: 'v', knots: 0 });
  plank(ctx, sx - 12, base - 12, 24, 4, RAMPS.walnut, { dir: 'h', knots: 0 });
  plank(ctx, sx - 11, base - 38, 22, 14, RAMPS.walnut, { dir: 'h', knots: 0 });
  boxFrame(ctx, sx - 11, base - 38, 22, 14, RAMPS.walnut[0]);
  metal(ctx, sx - 8, base - 35, 16, 5, RAMPS.brass);
  disc(ctx, sx + 7, base - 40, 3, RAMPS.brass[3]);
  const ring = s.offers.length ? Math.floor(t * 7) % 2 : 0;
  metal(ctx, sx - 13, base - 43 - ring, 26, 4, RAMPS.iron);
  if (s.offers.length) {
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.55 - i * 0.13;
      const r = 8 + i * 5 + (Math.sin(t * 9) + 1) * 1.5;
      for (let a = -1.1; a <= 1.1; a += 0.22) {
        px(ctx, Math.round(sx + Math.cos(a - 1.6) * r), Math.round(base - 45 + Math.sin(a - 1.6) * r),
           PAL.gold2);
      }
      ctx.globalAlpha = 1;
    }
    text(ctx, `${s.offers.length} WAITING`, sx, base - 58, PAL.gold2, { align: 'center', shadow: PAL.ink });
  }
}

/** The saw bench: trestles, a log in the cradle, planks stacked, tools over it. */
function sawStation(ctx, t) {
  const sx = cam.sx(184);
  const base = WORKSHOP_GROUND;
  // pegboard of tools above the bench
  if (sx > -120 && sx < VIEW_W + 120) {
    const bx = sx + 38;    // over the bench, clear of the window
    plankWall(ctx, bx - 44, CEILING + 8, 88, 46, RAMPS.walnut, { step: 22, dir: 'v' });
    boxFrame(ctx, bx - 44, CEILING + 8, 88, 46, RAMPS.walnut[0]);
    rect(ctx, bx - 44, CEILING + 8, 88, 1, RAMPS.walnut[4]);
    ctx.drawImage(PROP.tool('saw'), bx - 38, CEILING + 12);
    ctx.drawImage(PROP.tool('square'), bx - 2, CEILING + 12);
    ctx.drawImage(PROP.tool('plane'), bx + 18, CEILING + 14);
    ctx.drawImage(PROP.tool('chisel'), bx - 36, CEILING + 30);
    ctx.drawImage(PROP.tool('mallet'), bx - 24, CEILING + 28);
    ctx.drawImage(PROP.tool('axe'), bx - 8, CEILING + 26);
    ctx.drawImage(PROP.tool('brace'), bx + 14, CEILING + 30);
  }
  // the bench
  plank(ctx, sx - 36, base - 28, 72, 7, RAMPS.oak, { dir: 'h', knots: 1 });
  for (const lx of [sx - 32, sx + 24]) {
    plank(ctx, lx, base - 21, 8, 21, RAMPS.walnut, { dir: 'v', knots: 0 });
    plank(ctx, lx - 3, base - 12, 14, 4, RAMPS.walnut, { dir: 'h', knots: 0 });
  }
  // a log waiting to be cut
  if ((story().materials.hardwood || 0) > 0) {
    const lg = N.log(0, 60);
    ctx.drawImage(lg, sx - 30, base - 28 - lg.height + 4);
  }
  // stacked planks and an offcut bin
  const planks = Math.min(7, story().materials.plank || 0);
  for (let i = 0; i < planks; i++) {
    plank(ctx, sx - 66, base - 4 - i * 5, 26, 4, RAMPS.pine, { dir: 'h', knots: 0, seed: 9 + i });
  }
  ctx.drawImage(PROP.crate('timber'), cam.sx(232), base - 22);
  ctx.drawImage(PROP.bucket(false), cam.sx(150), base - 18);
  // a drift of shavings under the bench
  const rng = rngFrom(88);
  for (let i = 0; i < 70; i++) {
    const px0 = sx - 40 + rng() * 80;
    rect(ctx, px0, base + 2 + rng() * 8, 2, 1, rng() > 0.5 ? RAMPS.pine[4] : PAL.paper2);
  }
}

/** The assembly bench: vice, jars of fixings, finished pieces, a shelf. */
function benchStation(ctx, t) {
  const sx = cam.sx(304);
  const base = WORKSHOP_GROUND;
  if (sx > -140 && sx < VIEW_W + 140) {
    ctx.drawImage(PROP.shelf(84, 'jars'), sx - 60, CEILING + 10);
    ctx.drawImage(PROP.shelf(66, 'books'), sx - 50, CEILING + 38);
    ctx.drawImage(PROP.picture(2), sx + 30, CEILING + 12);
  }
  plank(ctx, sx - 40, base - 30, 80, 8, RAMPS.oak, { dir: 'h', knots: 1 });
  for (const lx of [sx - 36, sx + 28]) {
    plank(ctx, lx, base - 22, 8, 22, RAMPS.walnut, { dir: 'v', knots: 0 });
  }
  plank(ctx, sx - 32, base - 14, 64, 4, RAMPS.walnut, { dir: 'h', knots: 0 });
  // the vice, bolted to the end
  metal(ctx, sx + 14, base - 38, 20, 8, RAMPS.iron);
  metal(ctx, sx + 16, base - 30, 16, 3, RAMPS.iron);
  disc(ctx, sx + 34, base - 34, 3, RAMPS.iron[3]);
  // jars of screws and a mallet left on the bench
  ctx.drawImage(PROP.jar('#9aa2ad'), sx - 34, base - 44);
  ctx.drawImage(PROP.jar('#c69a3c'), sx - 22, base - 44);
  ctx.drawImage(PROP.tool('hammer'), sx - 6, base - 50);
  // finished pieces, lined up along the wall to go out
  const done = story().furniture.slice(0, 3);
  done.forEach((f, i) => drawFurniture(ctx, f.id, sx + 62 + i * 30, base, { scale: 1 }));
  if (done.length) {
    text(ctx, `${story().furniture.length} READY`, sx + 76, base - 48, PAL.gold2,
         { align: 'center', shadow: PAL.ink });
  }
  ctx.drawImage(PROP.sack('#d8c79a'), cam.sx(268), base - 24);
  ctx.drawImage(PROP.barrel('open'), cam.sx(346), base - 28);
}

/** The map table, the heron perch, and the materials shelf. */
function mapStation(ctx, t) {
  const sx = cam.sx(424);
  const base = WORKSHOP_GROUND;
  if (sx > -140 && sx < VIEW_W + 140) {
    // the materials shelf, with what you have on it
    plank(ctx, sx - 48, CEILING + 44, 104, 5, RAMPS.oak, { dir: 'h', knots: 0 });
    rect(ctx, sx - 48, CEILING + 44, 104, 1, RAMPS.oak[4]);
    const mats = story().materials;
    Object.keys(MATERIALS).forEach((k, i) => {
      const bx = sx - 44 + i * 20;
      const n = Math.min(5, mats[k] || 0);
      for (let s2 = 0; s2 < n; s2++) {
        rect(ctx, bx, CEILING + 40 - s2 * 3, 14, 3, MATERIALS[k].tone);
        rect(ctx, bx, CEILING + 40 - s2 * 3, 14, 1, 'rgba(255,255,255,0.4)');
      }
      text(ctx, String(mats[k] || 0), bx + 7, CEILING + 50, PAL.paper2, { align: 'center' });
    });
    // a map of the valley pinned above it
    plank(ctx, sx - 40, CEILING + 8, 80, 30, ramp('#d8c79a'), { dir: 'h', knots: 0 });
    boxFrame(ctx, sx - 40, CEILING + 8, 80, 30, RAMPS.walnut[1]);
    for (let i = 0; i < 22; i++) {
      px(ctx, sx - 36 + i * 3, CEILING + 20 + Math.round(Math.sin(i * 0.5) * 5), '#3f8fc4');
    }
    for (let i = 0; i < 5; i++) px(ctx, sx - 30 + i * 15, CEILING + 14 + (i % 3) * 6, PAL.red);
  }
  // the table
  plank(ctx, sx - 28, base - 28, 56, 7, RAMPS.oak, { dir: 'h', knots: 1 });
  plank(ctx, sx - 26, base - 34, 52, 7, ramp('#e8d8a8'), { dir: 'h', knots: 0 });
  for (let i = 0; i < 16; i++) {
    px(ctx, sx - 22 + i * 3, base - 31 + Math.round(Math.sin(i * 0.6) * 2), '#3f8fc4');
  }
  for (const lx of [sx - 24, sx + 18]) plank(ctx, lx, base - 21, 7, 21, RAMPS.walnut, { dir: 'v', knots: 0 });
  // the heron, dozing on its perch
  const heron = S.heronSideSprite(Math.floor(t * 1.1) % 2);
  ctx.drawImage(heron, sx + 38, base - heron.height + 1);
  plank(ctx, sx + 32, base - 4, 40, 4, RAMPS.walnut, { dir: 'h', knots: 0 });
  contact(ctx, sx + 52, base + 1, 18, 2, 0.3);
  ctx.drawImage(PROP.ladder(64), cam.sx(482), CEILING + 56);
}

/** The back door, standing open on the timber. */
function doorway(ctx, t) {
  const sx = cam.sx(552);
  const base = WORKSHOP_GROUND;
  const w = 50, h = 70;
  plank(ctx, sx - w / 2 - 5, base - h - 8, w + 10, h + 8, RAMPS.walnut, { dir: 'v', knots: 1 });
  // the outside, bright
  rect(ctx, sx - w / 2, base - h, w, h, '#8fd3ff');
  rect(ctx, sx - w / 2, base - h, w, 20, '#5ab4ee');
  for (let i = 0; i < 3; i++) {
    const tr = N.treeTop(i, 0.4);
    ctx.drawImage(tr, sx - w / 2 - 6 + i * 18, base - h + 14);
  }
  rect(ctx, sx - w / 2, base - 26, w, 26, RAMPS.grass[2]);
  rect(ctx, sx - w / 2, base - 26, w, 2, RAMPS.grass[3]);
  for (let i = 0; i < 10; i++) px(ctx, sx - w / 2 + 3 + i * 5, base - 28, RAMPS.grass[4]);
  boxFrame(ctx, sx - w / 2, base - h, w, h, RAMPS.walnut[0]);
  // the door swung back inside, and the daylight on the boards
  plank(ctx, sx + w / 2 + 6, base - h, 9, h, ramp('#c0392b'), { dir: 'v', knots: 0 });
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#fff0c0';
  ctx.beginPath();
  ctx.moveTo(sx - w / 2, base);
  ctx.lineTo(sx + w / 2, base);
  ctx.lineTo(sx + w / 2 - 40, VIEW_H);
  ctx.lineTo(sx - w / 2 - 90, VIEW_H);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.drawImage(PROP.firewood(40, 26), cam.sx(508), base - 30);
  ctx.drawImage(PROP.wallHook('apron'), cam.sx(590), CEILING + 54);
}

/** Grandpa, and whatever he is telling you today. */
function grandpa(ctx, t) {
  const sx = cam.sx(GRANDPA_X);
  const base = WORKSHOP_GROUND;
  if (sx < -60 || sx > VIEW_W + 60) return;
  const img = elder('idle', Math.floor(t * 1.5) % 4);
  ctx.drawImage(img, sx - (img.width >> 1), base - img.height + 2);

  // he holds his tongue while you are standing at a bench, so his note never
  // covers the prompt telling you what the bench does
  const atStation = !!nearestWorkStation(G.player.x);
  const near = Math.abs(G.player.x - GRANDPA_X) < 96 && !atStation;
  if (!near) {
    const puff = Math.floor(t * 1.2) % 3;
    for (let i = 0; i <= puff; i++) disc(ctx, sx + 10 + i * 5, base - img.height - 4 - i * 4, 1 + i, PAL.paper2);
    return;
  }
  const step = tutorialStep();
  const s = story();
  const line = step ? step.line : GRANDPA_IDLE[s.grandpaLine % GRANDPA_IDLE.length];
  const lines = wrap(line, 128);
  const w = 136, h = 9 + lines.length * 9;
  const bx = Math.max(4, Math.min(VIEW_W - w - 4, sx - w / 2));
  const by = base - img.height - h - 26;
  rect(ctx, bx + 1, by + 1, w, h, 'rgba(0,0,0,0.3)');
  rect(ctx, bx, by, w, h, PAL.paper);
  rect(ctx, bx, by, w, 1, PAL.white);
  boxFrame(ctx, bx, by, w, h, RAMPS.walnut[1]);
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
/** Things left on the floor - what stops the boards reading as an empty apron. */
function floorClutter(ctx, t) {
  const base = WORKSHOP_GROUND;
  ctx.drawImage(PROP.rug(96, 28, '#3f7a86'), cam.sx(196), base + 34);
  ctx.drawImage(PROP.crate('apples'), cam.sx(120), base + 30);
  ctx.drawImage(PROP.barrel('closed'), cam.sx(352), base + 26);
  ctx.drawImage(PROP.sack('#c2a35c'), cam.sx(388), base + 32);
  ctx.drawImage(PROP.stool(), cam.sx(300), base + 40);
  ctx.drawImage(PROP.bucket(true), cam.sx(462), base + 38);
  ctx.drawImage(PROP.pottedPlant(1), cam.sx(38), base + 30);
  ctx.drawImage(PROP.firewood(34, 18), cam.sx(514), base + 40);
  // offcuts and shavings swept into heaps
  const rng = rngFrom(6161);
  for (let i = 0; i < 160; i++) {
    const sx = cam.sx(rng() * WORKSHOP_W);
    if (sx < 0 || sx > VIEW_W) continue;
    const sy = base + 20 + rng() * 60;
    const roll = rng();
    if (roll > 0.93) { plank(ctx, sx, sy, 10, 3, RAMPS.pine, { dir: 'h', knots: 0, seed: i }); }
    else if (roll > 0.8) { rect(ctx, sx, sy, 3, 1, RAMPS.pine[4]); }
    else px(ctx, sx, sy, roll > 0.4 ? RAMPS.pine[4] : PAL.paper2);
  }
}

export function drawWorkshop(ctx, t) {
  shell(ctx, t);
  windows(ctx, t);
  phoneCorner(ctx, t);
  sawStation(ctx, t);
  benchStation(ctx, t);
  mapStation(ctx, t);
  doorway(ctx, t);
  floorClutter(ctx, t);
  lights(ctx, t);
  grandpa(ctx, t);
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
