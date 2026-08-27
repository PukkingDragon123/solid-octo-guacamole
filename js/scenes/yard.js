// The outside of a customer's place. You are set down at the gate, walk up the
// path past whatever they keep in their yard, and go in through the front door.
// Played from the same three-quarter angle as the house itself.

import { VIEW_W, VIEW_H } from '../config.js';
import { G } from '../state.js';
import { PAL, rect, px, text, disc, line, frame as boxFrame } from '../gfx/pixel.js';
import { RAMPS, mix, noise, contact, ao, plank, cloth, metal, stonework, water, speck }
  from '../gfx/paint.js';
import * as N from '../gfx/nature.js';
import * as B from '../gfx/structures.js';
import * as PROP from '../gfx/props.js';
import { heroTop, npcTop, drawTop } from '../gfx/actors.js';
import { keyPrompt } from '../ui/widgets.js';
import { NPCS } from '../orders.js';
import { friendRank } from '../story.js';
import { input, pressed, held } from '../input.js';
import { sfx } from '../audio.js';

/** Which house each trade lives in, and what is lying about outside it. */
const YARDS = {
  willow:  { style: 'riverside', yard: 'river'  },
  bramble: { style: 'bakery',    yard: 'bakery' },
  pip:     { style: 'mill',      yard: 'mill'   },
  quill:   { style: 'forge',     yard: 'forge'  },
  marsh:   { style: 'cottage',   yard: 'glass'  },
  juniper: { style: 'cottage',   yard: 'loom'   },
  cobb:    { style: 'forge',     yard: 'quarry' },
};

const HOUSE_CX = 240;
const HOUSE = B.houseTopMetrics();  // the small cottage, measured
const DOOR_Y = 132;                 // where the step is, in view pixels
const HOUSE_TOP = DOOR_Y - HOUSE.base;   // sprite row 0 lands here
const GROUND_TOP = 84;              // the yard starts below the house eaves

export const yard = {
  active: false, npc: null, t: 0,
  player: { x: 240, y: 222, vx: 0, vy: 0, face: 1, dir: 'up' },
  lastDir: 'up', hint: '', arriving: 0, leaving: 0,
};

export function openYard(npcId) {
  yard.active = true;
  yard.npc = npcId;
  yard.t = 0;
  yard.arriving = 1.2;
  yard.leaving = 0;
  yard.hint = '';
  yard.player = { x: 240, y: 222, vx: 0, vy: 0, face: 1, dir: 'up' };
  return true;
}

export function closeYard() { yard.active = false; }

const houseImg = (npcId, lit) =>
  B.houseTop((YARDS[npcId] || YARDS.willow).style, { lit });

/** The house blocks the top of the yard; you may only pass through the door. */
function blocked(x, y) {
  if (x < 14 || x > VIEW_W - 14 || y > VIEW_H - 44) return true;   // the bank, not the river
  const half = (HOUSE.doorW >> 1) + 3;
  if (y < DOOR_Y) {
    if (x > HOUSE_CX - half && x < HOUSE_CX + half) return y < DOOR_Y - 14;
    return true;
  }
  return false;
}

export function updateYard(dt) {
  if (!yard.active) return;
  yard.t += dt;
  if (yard.arriving > 0) yard.arriving -= dt;
  const p = yard.player;

  let ax = 0, ay = 0;
  if (held('KeyA', 'ArrowLeft')) ax -= 1;
  if (held('KeyD', 'ArrowRight')) ax += 1;
  if (held('KeyW', 'ArrowUp')) ay -= 1;
  if (held('KeyS', 'ArrowDown')) ay += 1;
  const len = Math.hypot(ax, ay) || 1;
  const speed = 76;
  p.vx += ((ax / len) * speed - p.vx) * Math.min(1, dt * 12);
  p.vy += ((ay / len) * speed - p.vy) * Math.min(1, dt * 12);
  const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
  if (!blocked(nx, p.y)) p.x = nx; else p.vx = 0;
  if (!blocked(p.x, ny)) p.y = ny; else p.vy = 0;
  if (Math.abs(p.vx) > Math.abs(p.vy)) p.dir = p.vx > 0 ? 'right' : 'left';
  else if (Math.abs(p.vy) > 4) p.dir = p.vy > 0 ? 'down' : 'up';
  if (Math.abs(p.vx) + Math.abs(p.vy) > 30 && Math.random() < dt * 7) sfx.step();

  // stepping into the doorway takes you inside
  const atDoor = Math.abs(p.x - HOUSE_CX) < 12 && p.y < DOOR_Y - 4;
  if (atDoor || (pressed('KeyE') && Math.abs(p.x - HOUSE_CX) < 22 && p.y < DOOR_Y + 16)) {
    yard.leaving = 1;
  }
}

/** True once the player has gone in - the caller swaps to the interior. */
export const enteredHouse = () => yard.leaving > 0;

// -------------------------------------------------------------------- draw
function drawGround(ctx, t) {
  // lawn: six tile variants, then broad patches so the field is never one green
  for (let y = GROUND_TOP; y < VIEW_H; y += 16) {
    for (let x = 0; x < VIEW_W; x += 16) {
      ctx.drawImage(N.grassTile(((x * 7 + y * 13) / 16) % 6 | 0, 16), x, y);
    }
  }
  N.grassPatches(ctx, 0, GROUND_TOP, VIEW_W, VIEW_H - GROUND_TOP, 4242);

  // the path: gate to doorstep, dead straight, worn wider where feet turn
  for (let y = DOOR_Y + 6; y < VIEW_H; y += 16) {
    const k = (y - DOOR_Y) / (VIEW_H - DOOR_Y);
    const halfW = Math.round(15 + k * 10);
    for (let x = HOUSE_CX - halfW; x < HOUSE_CX + halfW; x += 16) {
      ctx.drawImage(N.dirtTile((x / 16 + y / 8) % 3, 16), x, y);
    }
    const rng = noise(y | 0);
    for (let i = 0; i < 12; i++) {
      px(ctx, HOUSE_CX - halfW + ((rng() * 5) | 0), y + rng() * 16, RAMPS.grass[2]);
      px(ctx, HOUSE_CX + halfW - ((rng() * 5) | 0), y + rng() * 16, RAMPS.grass[2]);
    }
  }
  // two flagstones at the step, and nothing further
  for (let i = 0; i < 2; i++) {
    const sy = DOOR_Y + 2 + i * 11;
    stonework(ctx, HOUSE_CX - 13, sy, 26, 9, RAMPS.stone, { seed: 20 + i });
    ao(ctx, HOUSE_CX - 13, sy, 26, 9, '#1b1424', 1);
    contact(ctx, HOUSE_CX, sy + 10, 13, 2, 0.22);
  }

  // flower beds either side of the door, up against the wall
  const bedW = Math.round(HOUSE.wallW / 2) - 14;
  for (const bx of [HOUSE_CX - 16 - bedW, HOUSE_CX + 16]) {
    ctx.drawImage(B.gardenBed(bedW, 16, 'flower'), bx, DOOR_Y - 12);
  }
}

/** The boundary: hedge behind the house, trees framing, fence along the front. */
function drawBorder(ctx, t) {
  // a hedge running behind the house, hiding the join with the hills
  for (let x = -10; x < VIEW_W + 20; x += 22) {
    const h = 14 + Math.round(Math.sin(x * 0.09) * 4 + Math.sin(x * 0.31) * 2);
    for (const [dx, r] of [[0, 11], [11, 9]]) {
      disc(ctx, x + dx, GROUND_TOP + 6 - h, r, RAMPS.leafB[1]);
      disc(ctx, x + dx - 1, GROUND_TOP + 4 - h, r - 3, RAMPS.leafB[2]);
      disc(ctx, x + dx - 2, GROUND_TOP + 2 - h, r - 6, RAMPS.leafB[3]);
    }
  }

  // trees down both sides, planted on the lawn
  for (let i = 0; i < 5; i++) {
    const ty = GROUND_TOP + 26 + i * 34;
    ctx.drawImage(N.treeTop(i % N.TREE_KINDS, 0.4 + (i % 2) * 0.4), -14, ty - 24);
    ctx.drawImage(N.treeTop((i + 2) % N.TREE_KINDS, 0.35 + (i % 3) * 0.3), VIEW_W - 38, ty - 14);
  }
  // and two canopies hanging into frame from above, to close the composition
  ctx.drawImage(N.treeTop(0, 1), -26, -30);
  ctx.drawImage(N.treeTop(3, 0.8), VIEW_W - 30, -34);

  // fence across the front, with a gate on the path
  const fence = B.fenceTop(60);
  for (let x = -6; x < VIEW_W; x += 58) {
    if (Math.abs(x + 30 - HOUSE_CX) < 46) continue;
    ctx.drawImage(fence, x, VIEW_H - 20);
  }
  for (const gx of [HOUSE_CX - 44, HOUSE_CX + 38]) {
    rect(ctx, gx, VIEW_H - 30, 6, 18, RAMPS.walnut[2]);
    rect(ctx, gx, VIEW_H - 30, 6, 2, RAMPS.walnut[4]);
    disc(ctx, gx + 3, VIEW_H - 32, 3, RAMPS.walnut[3]);
    contact(ctx, gx + 3, VIEW_H - 12, 5, 2, 0.3);
  }

  // scatter over the lawn: tufts, flowers, stones, mushrooms
  const rng = noise(303);
  for (let i = 0; i < 60; i++) {
    const sx = 8 + rng() * (VIEW_W - 16);
    const sy = GROUND_TOP + 10 + rng() * (VIEW_H - GROUND_TOP - 26);
    if (Math.abs(sx - HOUSE_CX) < 28 && sy > DOOR_Y) continue;      // not on the path
    if (sy < DOOR_Y && Math.abs(sx - HOUSE_CX) < HOUSE.totalW / 2) continue;  // nor under the house
    const roll = rng();
    if (roll < 0.42) ctx.drawImage(N.grassTuft((rng() * 3) | 0), sx, sy);
    else if (roll < 0.74) ctx.drawImage(N.flower((rng() * 4) | 0), sx, sy);
    else if (roll < 0.88) ctx.drawImage(N.rock(0), sx, sy);
    else ctx.drawImage(N.mushroom((rng() * 2) | 0), sx, sy);
  }
}

/** What this customer keeps in the yard - the bit that says who lives here. */
function drawTradeYard(ctx, kind, t) {
  const rng = noise(707);
  if (kind === 'bakery') {
    // an outdoor bread oven, smoking, and a table of loaves
    contact(ctx, 68, 186, 26, 4, 0.3);
    for (let i = 0; i < 30; i++) px(ctx, 44 + rng() * 48, 182 + rng() * 8, RAMPS.dirt[1]);
    stonework(ctx, 46, 150, 44, 34, RAMPS.stone, { seed: 5 });
    disc(ctx, 68, 172, 9, '#161018');
    disc(ctx, 68, 172, 6, Math.floor(t * 3) % 2 ? '#e8626f' : '#f0a13c');
    ctx.globalAlpha = 0.14;
    for (let i = 1; i <= 3; i++) disc(ctx, 68, 172, 8 + i * 6, '#f0a13c');
    ctx.globalAlpha = 1;
    plank(ctx, 40, 200, 56, 8, RAMPS.oak, { dir: 'h' });
    for (let i = 0; i < 4; i++) {
      disc(ctx, 48 + i * 13, 198, 5, '#d19a5c');
      disc(ctx, 48 + i * 13, 196, 3, '#e0b174');
    }
  } else if (kind === 'forge') {
    // a coal forge, an anvil and a barrel of quench water, on scorched ground
    contact(ctx, 67, 180, 28, 4, 0.3);
    for (let i = 0; i < 60; i++) px(ctx, 38 + rng() * 60, 176 + rng() * 14, rng() > 0.5 ? '#3f342c' : RAMPS.dirt[1]);
    stonework(ctx, 44, 148, 46, 30, RAMPS.stone, { seed: 9 });
    disc(ctx, 67, 164, 10, '#3a1a12');
    disc(ctx, 67, 164, 6, Math.floor(t * 4) % 2 ? '#f0a13c' : '#e8626f');
    for (let i = 0; i < 5; i++) {
      px(ctx, 63 + i * 2, 152 - ((t * 24 + i * 7) % 22), '#f7cc55');
    }
    metal(ctx, 44, 192, 30, 9, RAMPS.iron);
    rect(ctx, 52, 201, 12, 8, RAMPS.iron[1]);
    contact(ctx, 58, 210, 14, 3, 0.3);
    plank(ctx, 92, 196, 22, 18, RAMPS.walnut, { dir: 'v' });
    water(ctx, 94, 196, 18, 6, RAMPS.water, { phase: t });
  } else if (kind === 'mill') {
    // sacks of grain and a stack of millstones
    for (let i = 0; i < 5; i++) {
      const sx = 40 + (i % 3) * 20, sy = 168 + Math.floor(i / 3) * 22;
      cloth(ctx, sx, sy, 18, 22, RAMPS.linen, { fold: 0.5 });
      rect(ctx, sx + 3, sy - 3, 12, 4, RAMPS.linen[1]);
      px(ctx, sx + 9, sy + 10, RAMPS.brass[3]);
    }
    disc(ctx, 108, 200, 14, RAMPS.stone[2]);
    disc(ctx, 108, 200, 11, RAMPS.stone[3]);
    disc(ctx, 108, 200, 3, RAMPS.stone[0]);
  } else if (kind === 'river') {
    // the river itself, running across the bottom of the yard, with a jetty
    water(ctx, 0, VIEW_H - 40, VIEW_W, 40, RAMPS.water, { phase: t });
    for (let i = 0; i < 40; i++) {
      px(ctx, (i * 37 + Math.floor(t * 26)) % VIEW_W, VIEW_H - 34 + (i % 5), RAMPS.water[4]);
    }
    rect(ctx, 0, VIEW_H - 42, VIEW_W, 3, RAMPS.dirt[2]);
    for (let i = 0; i < 5; i++) plank(ctx, 78, VIEW_H - 44 + i * 5, 46, 4, RAMPS.walnut, { dir: 'h' });
    // creels and a drying rack
    plank(ctx, 44, 152, 4, 26, RAMPS.walnut, { dir: 'v' });
    plank(ctx, 92, 152, 4, 26, RAMPS.walnut, { dir: 'v' });
    plank(ctx, 44, 152, 52, 3, RAMPS.walnut, { dir: 'h' });
    for (let i = 0; i < 4; i++) {
      metal(ctx, 50 + i * 11, 156, 6, 12, RAMPS.metal);
      px(ctx, 52 + i * 11, 159, PAL.ink);
    }
  } else if (kind === 'glass') {
    // a small furnace and a shelf of bottles catching the light
    stonework(ctx, 46, 152, 40, 28, RAMPS.slate, { seed: 15 });
    disc(ctx, 66, 168, 8, '#3a1a12');
    disc(ctx, 66, 168, 5, '#f7cc55');
    plank(ctx, 38, 196, 60, 5, RAMPS.oak, { dir: 'h' });
    for (let i = 0; i < 6; i++) {
      const bx = 42 + i * 9;
      rect(ctx, bx, 186, 6, 10, i % 2 ? '#8fd6f0' : '#a9dcf5');
      rect(ctx, bx, 186, 6, 2, '#e8f7ff');
      px(ctx, bx + 2, 184, RAMPS.glass[4]);
    }
  } else if (kind === 'loom') {
    // washing lines of dyed cloth, and baskets of wool
    for (let r = 0; r < 2; r++) {
      const ly = 150 + r * 26;
      line(ctx, 34, ly, 118, ly - 2, RAMPS.linen[1]);
      for (let i = 0; i < 4; i++) {
        const cxx = 40 + i * 20;
        cloth(ctx, cxx, ly, 14, 18 + (i % 2) * 4,
              [RAMPS.cloth, RAMPS.linen, RAMPS.water, RAMPS.brass][(i + r) % 4], { fold: 0.6 });
      }
    }
    for (let i = 0; i < 3; i++) {
      const bx = 44 + i * 22;
      rect(ctx, bx, 204, 16, 10, RAMPS.oak[2]);
      rect(ctx, bx, 204, 16, 2, RAMPS.oak[4]);
      disc(ctx, bx + 8, 202, 6, ['#e8626f', '#4f8be8', '#f2c14e'][i]);
    }
  } else if (kind === 'quarry') {
    // cut blocks, a barrow and a heap of rubble
    for (let i = 0; i < 6; i++) {
      const bx = 36 + (i % 3) * 26, by = 158 + Math.floor(i / 3) * 24;
      stonework(ctx, bx, by, 24, 18, RAMPS.stone, { seed: 40 + i });
      boxFrame(ctx, bx, by, 24, 18, RAMPS.slate[1]);
      contact(ctx, bx + 12, by + 19, 12, 2, 0.28);
    }
    metal(ctx, 96, 208, 28, 10, RAMPS.iron);
    disc(ctx, 102, 220, 5, PAL.ink);
    for (let i = 0; i < 24; i++) {
      const rx = 34 + rng() * 90, ry = 210 + rng() * 20;
      px(ctx, rx, ry, rng() > 0.5 ? RAMPS.stone[1] : RAMPS.stone[3]);
    }
  }
  // everyone has a well, a vegetable bed, a bench and something being carted
  ctx.drawImage(B.wellTop(), VIEW_W - 76, 132);
  ctx.drawImage(B.gardenBed(58, 30, 'leaf'), VIEW_W - 80, 180);
  ctx.drawImage(PROP.crate('apples'), VIEW_W - 116, 216);
  ctx.drawImage(PROP.barrel('open'), VIEW_W - 88, 220);
  ctx.drawImage(PROP.stool(), 122, 232);
  ctx.drawImage(PROP.bucket(true), 96, 210);
  ctx.drawImage(PROP.firewood(32, 20), 40, 226);
  ctx.drawImage(PROP.pottedPlant(0), HOUSE_CX + (HOUSE.wallW >> 1) + 6, DOOR_Y - 8);
  ctx.drawImage(PROP.pottedPlant(2), HOUSE_CX - (HOUSE.wallW >> 1) - 16, DOOR_Y - 10);
}

export function drawYard(ctx, t) {
  const npc = NPCS[yard.npc];
  const conf = YARDS[yard.npc] || YARDS.willow;

  // sky above the roofline, so the yard sits in a world
  rect(ctx, 0, 0, VIEW_W, GROUND_TOP, '#77c6f2');
  rect(ctx, 0, 0, VIEW_W, 40, '#4aa3e0');
  for (let i = 0; i < 5; i++) {
    const cxx = ((i * 130 - t * 5) % (VIEW_W + 120)) - 60;
    ctx.globalAlpha = 0.9;
    disc(ctx, cxx < -60 ? cxx + VIEW_W + 120 : cxx, 22 + (i % 3) * 12, 10 + (i % 2) * 5, '#e8f7ff');
    disc(ctx, (cxx < -60 ? cxx + VIEW_W + 120 : cxx) + 12, 26 + (i % 3) * 12, 8, '#cdeeff');
    ctx.globalAlpha = 1;
  }
  // distant hills behind the house
  for (let layer = 0; layer < 2; layer++) {
    const tone = layer ? '#5f9c52' : '#8fb6c4';
    for (let x = 0; x < VIEW_W; x++) {
      const h = Math.sin(x * 0.014 + layer * 2) * 10 + Math.sin(x * 0.03) * 5;
      rect(ctx, x, Math.round(GROUND_TOP - 26 + layer * 12 + h), 1, 40, tone);
    }
  }

  drawGround(ctx, t);
  drawBorder(ctx, t);
  drawTradeYard(ctx, conf.yard, t);

  // the house, with smoke from the chimney
  const img = houseImg(yard.npc, true);
  const hx = HOUSE_CX - (img.width >> 1);
  // the shadow it casts: a slab offset down and right from the wall base, not a
  // floating ellipse - that is what plants a building on the ground
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = '#1b1424';
  const shHalf = (HOUSE.wallW >> 1) + 3;
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(HOUSE_CX - shHalf + i * 2, DOOR_Y - 4 + i, shHalf * 2 - i * 2, 1);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(img, hx, HOUSE_TOP);
  for (let i = 0; i < 6; i++) {
    const sy = HOUSE_TOP - 8 - ((t * 11 + i * 9) % 46);
    const drift = Math.sin(sy * 0.09 + t * 0.6) * 6;
    ctx.globalAlpha = Math.max(0, 0.5 - i * 0.07);
    disc(ctx, Math.round(HOUSE_CX + 17 + drift), Math.round(sy), 2 + i, '#e8e2d0');
    ctx.globalAlpha = 1;
  }

  // the name board at the gate
  const sign = B.signPost();
  ctx.drawImage(sign, HOUSE_CX + 52, VIEW_H - 58);
  text(ctx, npc.site.toUpperCase(), HOUSE_CX + 80, VIEW_H - 51, PAL.ink, { align: 'center' });

  // the customer, out in the yard until you go in
  const np = { x: HOUSE_CX - 70, y: DOOR_Y + 40 };
  const ears = { rabbit: 'long', squirrel: 'tuft', hedgehog: 'tuft' }[npc.species] || 'round';
  drawTop(ctx, npcTop(npc.tone, Math.floor(t * 1.6) % 2, { ears }), np.x, np.y + 6, 1);
  text(ctx, npc.name.toUpperCase(), np.x, np.y - 30, PAL.white, { align: 'center', shadow: PAL.ink });
  for (let i = 0; i < 5; i++) {
    rect(ctx, np.x - 10 + i * 5, np.y - 38, 4, 4, i < friendRank(yard.npc) ? PAL.red2 : 'rgba(0,0,0,0.45)');
  }

  // you
  const p = yard.player;
  const moving = Math.abs(p.vx) + Math.abs(p.vy) > 12;
  drawTop(ctx, heroTop(p.dir, moving ? Math.floor(t * 8) % 4 : 0), p.x, p.y + 6, 1);

  // prompts and the arrival caption
  if (Math.abs(p.x - HOUSE_CX) < 30 && p.y < DOOR_Y + 24) {
    keyPrompt(ctx, HOUSE_CX, DOOR_Y - 16, 'E', 'GO IN', t);
  }
  rect(ctx, 0, 0, VIEW_W, 13, 'rgba(13,10,9,0.6)');
  text(ctx, npc.site.toUpperCase(), 6, 3, PAL.gold2);
  text(ctx, `${npc.name.toUpperCase()} - ${npc.job.toUpperCase()}`, VIEW_W / 2, 3, PAL.paper,
       { align: 'center' });
  text(ctx, 'WASD WALK   E GO IN', VIEW_W - 6, 3, PAL.paper3, { align: 'right' });

  if (yard.arriving > 0) {
    ctx.globalAlpha = Math.min(1, yard.arriving / 1.2);
    rect(ctx, 0, 0, VIEW_W, VIEW_H, PAL.black);
    ctx.globalAlpha = 1;
  }
}
