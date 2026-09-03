// The camp, played side-on. This is where you walk about, read the job board,
// check the stores, and climb onto the heron.

import { VIEW_W, VIEW_H, CAMP_W, CAMP_GROUND, MAX_WATER_LEVEL } from '../config.js';
import { G } from '../state.js';
import { PAL, rect, px, text, disc, line, rngFrom } from '../gfx/pixel.js';
import { cam } from '../gfx/screen.js';
import * as S from '../gfx/sprites.js';
import { drawCampCritters } from '../critters.js';

export const CAMP_BOUNDS = { w: CAMP_W, h: VIEW_H };

/** Everything you can walk up to and press E on. */
export const STATIONS = [
  { id: 'home', x: 66, prop: 'homelodge', label: 'YOUR LODGE', reach: 34 },
  { id: 'bunkhouse', x: 200, prop: 'bunkhouse', label: 'CREW', reach: 34 },
  { id: 'jobboard', x: 352, prop: 'jobboard', label: 'JOB BOARD', reach: 30 },
  { id: 'storehouse', x: 536, prop: 'storehouse', label: 'STORES', reach: 32 },
  { id: 'logpile', x: 712, prop: 'logpile', label: 'LOG SLAM', reach: 28 },
  { id: 'perch', x: 900, prop: 'perch', label: 'RIDE THE HERON', reach: 30 },
];

const DECOR = [
  { prop: 'sawhorse', x: 268 }, { prop: 'bucket', x: 300 },
  { prop: 'lantern', x: 420 }, { prop: 'bucket', x: 640 },
  { prop: 'sawhorse', x: 790 }, { prop: 'lantern', x: 860 },
];

const BG_TREES = [];
{
  const rng = rngFrom(20240821);
  for (let i = 0; i < 26; i++) {
    BG_TREES.push({ x: 20 + i * 46 + Math.round(rng() * 24), v: rng() < 0.5 ? 0 : 1, depth: rng() < 0.5 ? 0.45 : 0.6 });
  }
}
const CLOUDS = [];
{
  const rng = rngFrom(77);
  for (let i = 0; i < 7; i++) CLOUDS.push({ x: rng() * 1400, y: 14 + rng() * 46, v: i % 2, speed: 3 + rng() * 5 });
}

export function nearestStation(playerX) {
  let best = null;
  for (const st of STATIONS) {
    const d = Math.abs(playerX - st.x);
    if (d < st.reach && (!best || d < best.d)) best = { station: st, d };
  }
  return best ? best.station : null;
}

// --------------------------------------------------------------- the sky
const SKY_SETS = {
  dawn: [PAL.dusk0, PAL.dusk1, PAL.dusk2, PAL.dusk3, PAL.sky4],
  day: [PAL.sky1, PAL.sky2, PAL.sky3, PAL.sky4, PAL.sky5],
  dusk: [PAL.dusk0, PAL.dusk0, PAL.dusk1, PAL.dusk2, PAL.dusk3],
  night: [PAL.night0, PAL.night0, PAL.night1, PAL.night2, PAL.dusk0],
};

export function skyPhase(dayT) {
  if (dayT < 0.10) return 'dawn';
  if (dayT < 0.68) return 'day';
  if (dayT < 0.84) return 'dusk';
  return 'night';
}

function drawSky(ctx, t) {
  const bands = SKY_SETS[skyPhase(G.dayT)];
  const h = CAMP_GROUND + 8;
  for (let i = 0; i < bands.length; i++) {
    const top = Math.round((i / bands.length) * h);
    const bottom = Math.round(((i + 1) / bands.length) * h);
    rect(ctx, 0, top, VIEW_W, bottom - top, bands[i]);
    if (i < bands.length - 1) {
      ctx.fillStyle = bands[i + 1];
      for (let k = (bottom % 2); k < VIEW_W; k += 2) ctx.fillRect(k, bottom - 2, 1, 1);
      for (let k = ((bottom + 1) % 2); k < VIEW_W; k += 4) ctx.fillRect(k, bottom - 3, 1, 1);
    }
  }

  // stars at night
  if (skyPhase(G.dayT) === 'night') {
    const rng = rngFrom(4242);
    for (let i = 0; i < 46; i++) {
      const sx = (rng() * VIEW_W) | 0, sy = (rng() * 110) | 0;
      const tw = (Math.floor(t * 2 + i) % 5) === 0;
      px(ctx, sx, sy, tw ? PAL.white : PAL.sky3);
    }
  }

  // sun or moon, arcing across
  const arc = (G.dayT - 0.05) / 0.8;
  if (arc >= -0.05 && arc <= 1.05) {
    const sx = Math.round(30 + arc * (VIEW_W - 60));
    const sy = Math.round(112 - Math.sin(arc * Math.PI) * 84);
    disc(ctx, sx, sy, 7, PAL.gold2);
    disc(ctx, sx, sy, 5, PAL.white);
  } else {
    const marc = ((G.dayT + 0.5) % 1 - 0.05) / 0.8;
    const sx = Math.round(30 + marc * (VIEW_W - 60));
    const sy = Math.round(112 - Math.sin(marc * Math.PI) * 70);
    disc(ctx, sx, sy, 6, PAL.paper2);
    disc(ctx, sx - 2, sy - 1, 5, PAL.paper);
    disc(ctx, sx + 2, sy - 2, 4, SKY_SETS.night[1]);
  }

  for (const c of CLOUDS) {
    const img = S.cloudSprite(c.v);
    const x = Math.round(((c.x - cam.x * 0.18 - t * c.speed) % (VIEW_W + 120)) - 60);
    ctx.drawImage(img, x, Math.round(c.y));
  }
}

// ------------------------------------------------------------ background
// The camp looks out over the valley: hills on the skyline, then the pond the
// crew is damming, then the near bank the camp itself stands on.
const WATER_TOP = CAMP_GROUND - 42;
const WATER_BOTTOM = CAMP_GROUND - 13;

function drawHills(ctx) {
  const far = S.hillSprite(1);
  for (let i = -1; i < 7; i++) {
    ctx.drawImage(far, Math.round(i * 120 - (cam.x * 0.12) % 120), WATER_TOP - 40);
  }
  const near = S.hillSprite(0);
  for (let i = -1; i < 7; i++) {
    ctx.drawImage(near, Math.round(i * 120 - (cam.x * 0.22) % 120), WATER_TOP - 30);
  }
}

/** The pond, with the dam in the middle distance once you have built one. */
function drawBackWater(ctx, t) {
  const h = WATER_BOTTOM - WATER_TOP;
  // far shore
  rect(ctx, 0, WATER_TOP - 3, VIEW_W, 3, PAL.grass1);
  rect(ctx, 0, WATER_TOP - 3, VIEW_W, 1, PAL.grass2);
  // the water itself, darker with depth
  rect(ctx, 0, WATER_TOP, VIEW_W, h, PAL.water2);
  rect(ctx, 0, WATER_TOP, VIEW_W, 2, PAL.water3);
  rect(ctx, 0, WATER_BOTTOM - 6, VIEW_W, 6, PAL.water1);

  // ripples, slower once the channel is sealed
  const drift = t * (G.riverBlocked ? 3 : 11);
  for (let i = 0; i < 30; i++) {
    const y = WATER_TOP + 3 + ((i * 5) % (h - 5));
    const x = Math.round((i * 41 + drift - cam.x * 0.35) % (VIEW_W + 24)) - 12;
    rect(ctx, x, y, 4 + (i % 4), 1, i % 3 ? PAL.water3 : PAL.water4);
  }

  // a stretch of the dam, if the crew has got that far
  if (G.riverBlocked || G.waterLevel > 0) {
    const dx = Math.round(240 - cam.x * 0.35);
    for (let i = 0; i < 8; i++) {
      const x = dx + i * 15;
      if (x < -16 || x > VIEW_W) continue;
      rect(ctx, x, WATER_TOP + 4, 14, 9, PAL.wood1);
      rect(ctx, x, WATER_TOP + 4, 14, 2, PAL.wood2);
      rect(ctx, x, WATER_TOP + 11, 14, 1, PAL.wood0);
      px(ctx, x + 4, WATER_TOP + 7, PAL.wood0);
    }
    // water piled up behind it
    rect(ctx, 0, WATER_TOP - 1, VIEW_W, 1, PAL.water4);
  }

  // near bank sloping down to the camp
  rect(ctx, 0, WATER_BOTTOM, VIEW_W, CAMP_GROUND - WATER_BOTTOM, PAL.grass1);
  rect(ctx, 0, WATER_BOTTOM, VIEW_W, 2, PAL.grass2);
  for (let x = 0; x < VIEW_W; x += 2) {
    px(ctx, x + (Math.floor(t * 4 + x) % 2), WATER_BOTTOM - 1, PAL.foam);
  }
}

/** Small firs on the far shore, full-size ones among the camp. */
export function drawFarTrees(ctx) {
  for (const tree of BG_TREES) {
    if (tree.depth >= 0.5) continue;
    const x = Math.round(tree.x * 0.7 - cam.x * tree.depth);
    if (x < -20 || x > VIEW_W + 4) continue;
    const img = S.bgTreeSprite(tree.v, true);
    ctx.drawImage(img, x, WATER_TOP - 2 - img.height);
    // a smear of reflection in the water below
    ctx.globalAlpha = 0.22;
    rect(ctx, x + 6, WATER_TOP + 1, 4, 4, PAL.leaf0);
    ctx.globalAlpha = 1;
  }
}

function drawBgTrees(ctx) {
  for (const tree of BG_TREES) {
    if (tree.depth < 0.5) continue;
    const x = Math.round(tree.x - cam.x * tree.depth);
    if (x < -30 || x > VIEW_W + 4) continue;
    const img = S.bgTreeSprite(tree.v);
    ctx.drawImage(img, x, CAMP_GROUND - 2 - img.height);
  }
}

// ---------------------------------------------------------------- ground
function drawGround(ctx) {
  const strip = S.groundStrip();
  const startX = Math.floor(cam.x / 16) * 16;
  for (let x = startX - 16; x < cam.x + VIEW_W + 16; x += 16) {
    ctx.drawImage(strip, cam.sx(x), CAMP_GROUND);
  }

  // soil strata, roots and buried stones under the turf
  const deepTop = CAMP_GROUND + 40;
  rect(ctx, 0, deepTop, VIEW_W, VIEW_H - deepTop, PAL.dirt0);
  const soil = rngFrom(9182);
  for (let i = 0; i < 150; i++) {
    const sx = cam.sx(soil() * CAMP_W);
    const sy = Math.round(deepTop + soil() * (VIEW_H - deepTop));
    if (sx < 0 || sx > VIEW_W) continue;
    const roll = soil();
    if (roll < 0.55) px(ctx, sx, sy, PAL.dirt1);
    else if (roll < 0.8) { px(ctx, sx, sy, PAL.stone0); px(ctx, sx + 1, sy, PAL.stone1); }
    else rect(ctx, sx, sy, 3, 1, PAL.dirt1);
  }
  for (let i = 0; i < 24; i++) {
    const sx = cam.sx(soil() * CAMP_W);
    if (sx < 0 || sx > VIEW_W) continue;
    const len = 4 + Math.floor(soil() * 10);
    for (let k = 0; k < len; k++) px(ctx, sx + (k % 3 === 2 ? 1 : 0), CAMP_GROUND + 36 + k, PAL.dirt2);
  }

  // mushrooms, ferns and logs along the camp path
  const flora = rngFrom(5150);
  const KINDS = ['mushroom', 'fern', 'tallgrass', 'log', 'stone', 'flowers'];
  for (let i = 0; i < 46; i++) {
    const wx = flora() * CAMP_W;
    const sx = cam.sx(wx);
    const kind = KINDS[(flora() * KINDS.length) | 0];
    const variant = (flora() * 4) | 0;
    if (sx < -18 || sx > VIEW_W) continue;
    const img = S.clutterSprite(kind, variant);
    ctx.drawImage(img, sx, CAMP_GROUND - img.height + 3);
  }

  // wildflowers and tufts along the path
  const tuft = rngFrom(31337);
  for (let i = 0; i < 110; i++) {
    const sx = cam.sx(tuft() * CAMP_W);
    if (sx < -4 || sx > VIEW_W) continue;
    const kind = tuft();
    if (kind < 0.5) {
      px(ctx, sx, CAMP_GROUND - 1, PAL.grass3);
      px(ctx, sx + 1, CAMP_GROUND - 2, PAL.grass3);
    } else if (kind < 0.74) {
      px(ctx, sx, CAMP_GROUND - 1, PAL.gold2);
      px(ctx, sx, CAMP_GROUND - 2, PAL.grass2);
    } else if (kind < 0.82) {
      px(ctx, sx, CAMP_GROUND - 2, PAL.pink);
      px(ctx, sx, CAMP_GROUND - 1, PAL.grass2);
    }
  }
}

// ----------------------------------------------------------------- props
function drawProps(ctx, t) {
  const items = [...DECOR, ...STATIONS.map((s) => ({ prop: s.prop, x: s.x, station: s }))];
  items.sort((a, b) => a.x - b.x);
  for (const item of items) {
    const img = S.propSprite(item.prop);
    const sx = cam.sx(item.x) - (img.width >> 1);
    if (sx < -img.width || sx > VIEW_W) continue;
    const sy = CAMP_GROUND - img.height + 2;
    ctx.drawImage(img, sx, sy);

    if (item.prop === 'perch' && !G.rider.flying) {
      const heron = S.heronSideSprite(Math.floor(t * 1.2) % 2);
      ctx.drawImage(heron, sx + 2, sy - heron.height + 12);
    }
    if (item.prop === 'lantern' && skyPhase(G.dayT) !== 'day') {
      ctx.globalAlpha = 0.25 + Math.sin(t * 4) * 0.05;
      disc(ctx, sx + 5, sy + 8, 16, PAL.gold2);
      ctx.globalAlpha = 1;
    }
    if (item.prop === 'jobboard') {
      // a paper flutters when a contract is waiting
      const waiting = G.requests.length;
      if (waiting) {
        const flap = Math.floor(t * 3) % 2;
        rect(ctx, sx + 24, sy + 12 + flap, 6, 6, PAL.paper);
        px(ctx, sx + 26, sy + 14 + flap, PAL.red);
      }
    }
    if (item.prop === 'storehouse') {
      // stock indicator: how full the stores are
      const full = G.resources.wood / G.caps.wood;
      rect(ctx, sx + 6, sy - 4, 20, 3, PAL.ink);
      rect(ctx, sx + 6, sy - 4, Math.max(1, Math.round(20 * full)), 3, PAL.wood3);
    }
  }
}

/** Crew who are off-shift, dozing outside the bunkhouse. */
function drawRestingCrew(ctx, t) {
  const resting = G.beavers.filter((b) => b.state === 'resting');
  resting.forEach((b, i) => {
    const wx = 120 + i * 22;
    const sx = cam.sx(wx);
    if (sx < -20 || sx > VIEW_W) return;
    const img = S.crewSideSprite(b.role, Math.floor(t * 1.2 + i) % 2);
    ctx.drawImage(img, sx, CAMP_GROUND - img.height + 2);
    if (Math.floor(t * 1.5 + i) % 2) text(ctx, 'Z', sx + 12, CAMP_GROUND - img.height - 4, PAL.paper, { shadow: PAL.ink });
  });
}

// ------------------------------------------------------------------ draw
export function drawCamp(ctx, t) {
  drawSky(ctx, t);
  drawHills(ctx);
  drawFarTrees(ctx);
  drawBackWater(ctx, t);
  drawBgTrees(ctx);
  drawGround(ctx);
  drawProps(ctx, t);
  drawRestingCrew(ctx, t);
  drawCampCritters(ctx, t);

  // night wash over the whole camp
  const phase = skyPhase(G.dayT);
  if (phase === 'night' || phase === 'dusk') {
    ctx.fillStyle = phase === 'night' ? 'rgba(24,32,72,0.32)' : 'rgba(90,50,60,0.16)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

/** Draw the player's beaver walking around the camp. */
export function drawPlayer(ctx, player, t) {
  const pose = !player.onGround ? 'jump' : Math.abs(player.vx) > 4 ? 'walk' : 'idle';
  const frameIdx = pose === 'walk' ? Math.floor(t * 9) % 4 : Math.floor(t * 2) % 2;
  const img = S.playerSprite(pose, frameIdx);
  const sx = cam.sx(player.x) - (img.width >> 1);
  const sy = Math.round(player.y) - img.height + 1;
  ctx.save();
  if (player.face < 0) {
    ctx.translate(sx + img.width, sy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
  } else {
    ctx.drawImage(img, sx, sy);
  }
  ctx.restore();
}
