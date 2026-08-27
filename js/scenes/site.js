// A customer's place, played from above. You arrive with the van load, meet the
// animal who ordered it, fit every piece where the blueprint says it goes, put
// right whatever is broken, and dress the room until they love it.

import { VIEW_W, VIEW_H } from '../config.js';
import { G, toast } from '../state.js';
import { PAL, rect, frame, px, text, textWidth, disc, line, rngFrom, wrap } from '../gfx/pixel.js';
import { input, pressed, held } from '../input.js';
import { panel, button, bar, keyPrompt, scrim } from '../ui/widgets.js';
import { story, takeMaterials, haveMaterials, missingMaterials, friendRank } from '../story.js';
import { NPCS, FURNITURE, REPAIRS, outstanding, takeFurniture, completeOrder } from '../orders.js';
import { drawFurniture } from '../gfx/furniture.js';
import { heroTop, npcTop, drawTop, SUN } from '../gfx/actors.js';
import { RAMPS, ramp, mix, contact, ao, plank, plankWall, cloth, metal, glass, stonework, water,
         speck, noise as pnoise } from '../gfx/paint.js';
import * as N from '../gfx/nature.js';
import * as B_ from '../gfx/structures.js';
import * as PROP from '../gfx/props.js';
import { sfx } from '../audio.js';

const CELL = 16;                 // one tile, same as the rest of the game
const COLS = 15, ROWS = 8;       // a room you can see all of at once
const ROOM_X = (VIEW_W - COLS * CELL) >> 1;
const ROOM_Y = 52;

/**
 * Wall, floor and rug sets. They are deliberately warm - the ground outside is
 * green, so a green floor makes the whole scene read as one flat colour.
 */
const THEMES = [
  { id: 'oak',   floor: ['#c78a4c', '#b07840'], wall: '#7c5130', rug: '#c04a4a' },
  { id: 'ash',   floor: ['#e0bd8a', '#c9a878'], wall: '#8a6a45', rug: '#3f5fc4' },
  { id: 'brick', floor: ['#cf8a5f', '#b5714f'], wall: '#9c5340', rug: '#3f7a86' },
  { id: 'stone', floor: ['#cdbfa4', '#b4a488'], wall: '#6e6152', rug: '#a97ee0' },
];

/** What each trade keeps against the back wall. One big fixture, one small. */
function tradeFixtures(ctx, job, t) {
  const at = (c, r) => ({ x: ROOM_X + c * CELL, y: ROOM_Y + r * CELL });
  const glow = (x, y, r, tone) => {
    ctx.globalAlpha = 0.14;
    for (let i = 1; i <= 3; i++) disc(ctx, x, y, r + i * 5, tone);
    ctx.globalAlpha = 1;
  };

  if (job === 'Baker') {
    const o = at(0, 0);
    // brick oven, mouth lit
    rect(ctx, o.x + 2, o.y + 2, 40, 28, '#a3583f');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      rect(ctx, o.x + 3 + c * 8 + (r % 2 ? 4 : 0), o.y + 3 + r * 7, 7, 6, r % 2 ? '#b5664a' : '#9c5340');
    }
    rect(ctx, o.x, o.y, 44, 3, '#c06a4a');
    disc(ctx, o.x + 22, o.y + 22, 8, PAL.ink);
    disc(ctx, o.x + 22, o.y + 22, 6, Math.floor(t * 3) % 2 ? '#e8626f' : '#f7cc55');
    glow(o.x + 22, o.y + 24, 8, '#f7cc55');
    const r2 = at(4, 0);
    rect(ctx, r2.x, r2.y + 6, 42, 3, SUN.wood3);
    rect(ctx, r2.x, r2.y + 18, 42, 3, SUN.wood3);
    for (let i = 0; i < 4; i++) {
      disc(ctx, r2.x + 6 + i * 10, r2.y + 3, 4, '#d19a5c');
      disc(ctx, r2.x + 6 + i * 10, r2.y + 15, 4, '#c08a4c');
    }
  } else if (job === 'Blacksmith') {
    const f = at(0, 0);
    rect(ctx, f.x + 2, f.y + 4, 36, 26, '#7c8189');
    rect(ctx, f.x + 2, f.y + 4, 36, 3, '#a9b0b8');
    disc(ctx, f.x + 20, f.y + 20, 8, '#5a1f14');
    disc(ctx, f.x + 20, f.y + 20, 5, Math.floor(t * 4) % 2 ? '#f0a13c' : '#e8626f');
    glow(f.x + 20, f.y + 20, 8, '#f0a13c');
    const a = at(5, 1);
    rect(ctx, a.x, a.y, 26, 7, '#5a636e');
    rect(ctx, a.x, a.y, 26, 2, '#8a919b');
    rect(ctx, a.x + 7, a.y + 7, 11, 8, '#4a525c');
    rect(ctx, a.x - 5, a.y, 8, 4, '#5a636e');
  } else if (job === 'Weaver') {
    const l = at(1, 0);
    rect(ctx, l.x, l.y, 4, 34, SUN.wood2);
    rect(ctx, l.x + 34, l.y, 4, 34, SUN.wood2);
    rect(ctx, l.x, l.y, 38, 4, SUN.wood3);
    for (let i = 0; i < 9; i++) rect(ctx, l.x + 5 + i * 4, l.y + 4, 1, 28, i % 2 ? '#e8626f' : PAL.paper2);
    rect(ctx, l.x, l.y + 22, 38, 3, SUN.wood1);
    for (let i = 0; i < 3; i++) {
      const w = at(7 + i * 2, 0);
      disc(ctx, w.x + 8, w.y + 12, 7, ['#e8626f', '#4f8be8', '#f2c14e'][i]);
      disc(ctx, w.x + 6, w.y + 10, 3, 'rgba(255,255,255,0.35)');
      rect(ctx, w.x, w.y + 16, 16, 5, SUN.wood2);
    }
  } else if (job === 'River Fisher') {
    // an inlet along the back wall
    water(ctx, ROOM_X, ROOM_Y, COLS * CELL, CELL + 4, RAMPS.water, { phase: t });
    ctx.globalAlpha = 0.3;
    rect(ctx, ROOM_X, ROOM_Y, COLS * CELL, 3, '#1b1424');       // shaded under the lip
    ctx.globalAlpha = 1;
    // a stone lip round the inlet, with reeds growing out of the near edge
    stonework(ctx, ROOM_X, ROOM_Y + CELL + 4, COLS * CELL, 5, RAMPS.stone, { seed: 44 });
    rect(ctx, ROOM_X, ROOM_Y + CELL + 4, COLS * CELL, 1, RAMPS.stone[4]);
    const rr = pnoise(51);
    for (let i = 0; i < 22; i++) {
      const rx = ROOM_X + Math.round(rr() * (COLS * CELL - 4));
      const rh = 4 + Math.round(rr() * 5);
      const bend = Math.round(Math.sin(t * 1.4 + rx * 0.3) * 1.5);
      rect(ctx, rx, ROOM_Y + CELL + 4 - rh, 1, rh, RAMPS.leafB[1 + (i % 2)]);
      px(ctx, rx + bend, ROOM_Y + CELL + 3 - rh, RAMPS.leafB[3]);
    }
    const r = at(8, 1);
    rect(ctx, r.x, r.y + 2, 3, 18, SUN.wood2);
    rect(ctx, r.x + 30, r.y + 2, 3, 18, SUN.wood2);
    rect(ctx, r.x, r.y + 2, 33, 2, SUN.wood3);
    for (let i = 0; i < 3; i++) {
      rect(ctx, r.x + 6 + i * 10, r.y + 4, 5, 9, '#9aa0a8');
      px(ctx, r.x + 7 + i * 10, r.y + 6, PAL.ink);
    }
  } else if (job === 'Seed Miller') {
    const m = at(1, 0);
    disc(ctx, m.x + 16, m.y + 16, 14, '#9aa0a8');
    disc(ctx, m.x + 16, m.y + 16, 11, '#b6bcc4');
    disc(ctx, m.x + 16, m.y + 16, 3, '#5a636e');
    rect(ctx, m.x + 15, m.y, 3, 16, SUN.wood2);
    for (let i = 0; i < 4; i++) {
      const sk = at(6 + i * 2, 0);
      rect(ctx, sk.x, sk.y + 6, 15, 20, '#d8c79a');
      rect(ctx, sk.x + 2, sk.y + 2, 11, 5, '#c0ad82');
      px(ctx, sk.x + 7, sk.y + 14, PAL.gold);
    }
  } else if (job === 'Glassblower') {
    const f = at(0, 0);
    rect(ctx, f.x + 2, f.y + 6, 34, 24, '#6b4423');
    disc(ctx, f.x + 19, f.y + 20, 9, '#e8626f');
    disc(ctx, f.x + 19, f.y + 20, 5, '#f7cc55');
    glow(f.x + 19, f.y + 20, 9, '#f0a13c');
    for (let i = 0; i < 2; i++) {
      const sh = at(5, i);
      rect(ctx, sh.x, sh.y + 12, 100, 3, SUN.wood3);
      for (let k = 0; k < 7; k++) {
        rect(ctx, sh.x + 4 + k * 14, sh.y + 4, 6, 8, k % 2 ? '#8fd6f0' : '#a9dcf5');
        px(ctx, sh.x + 6 + k * 14, sh.y + 3, PAL.white);
      }
    }
  } else if (job === 'Quarryman') {
    for (let i = 0; i < 5; i++) {
      const b = at(1 + i * 2, 0);
      rect(ctx, b.x, b.y + 4 + (i % 2) * 6, 20, 15, '#b6bcc4');
      rect(ctx, b.x, b.y + 4 + (i % 2) * 6, 20, 3, '#cfd5dc');
      frame(ctx, b.x, b.y + 4 + (i % 2) * 6, 20, 15, '#5a636e');
    }
    const w = at(12, 1);
    rect(ctx, w.x, w.y, 26, 10, '#8a919b');
    disc(ctx, w.x + 4, w.y + 12, 5, PAL.ink2);
    rect(ctx, w.x + 24, w.y - 6, 3, 12, SUN.wood2);
  }
}

export const site = {
  active: false, npc: null, order: null,
  player: { x: 0, y: 0, vx: 0, vy: 0, face: 1 },
  slots: [], extras: [], carry: null, blueprint: false,
  repair: null, repairing: 0, theme: 0, style: 0,
  talking: 0, finished: false, result: null, t: 0,
  hint: '', pile: [],
};

/** Where the fixed points of the room are, in view pixels. */
export function geometry() {
  return {
    cell: CELL, cols: COLS, rows: ROWS, roomX: ROOM_X, roomY: ROOM_Y,
    npc: npcPos(), pile: pilePos(), repair: repairPos(),
  };
}

export function openSite(npcId) {
  const s = story();
  const npc = NPCS[npcId];
  const order = s.orders.find((o) => o.npc === npcId) || null;
  const wants = order ? order.wants : [];
  // one blueprint slot per ordered piece, laid out along the far wall
  const slots = wants.map((id, i) => ({
    id,
    cx: 3 + (i % 3) * 4,
    cy: 2 + Math.floor(i / 3) * 3,
    filled: false,
    quality: 0,
  }));
  const pile = [];
  for (const id of wants) {
    const piece = s.furniture.find((f) => f.id === id && !f.taken);
    if (piece) { piece.taken = true; pile.push(id); }
  }
  // release the marks - the van load is whatever we actually carry in
  for (const f of s.furniture) delete f.taken;
  Object.assign(site, {
    active: true, npc: npcId, order,
    player: { x: ROOM_X + COLS * CELL / 2, y: ROOM_Y + (ROWS - 1) * CELL, vx: 0, vy: 0, face: 1 },
    slots, extras: [], carry: null, blueprint: false,
    repair: order && order.repair && !order.repaired ? order.repair : null,
    repairing: 0, theme: Math.abs(npcId.charCodeAt(0)) % THEMES.length, style: 0,
    talking: 2.6, finished: false, result: null, t: 0, hint: '', pile,
  });
  return true;
}

export function closeSite() { site.active = false; }

const inRoom = (x, y) => x > ROOM_X + 8 && x < ROOM_X + COLS * CELL - 8
  && y > ROOM_Y + 12 && y < ROOM_Y + ROWS * CELL - 6;

const slotAt = (x, y) => site.slots.find((s) => !s.filled
  && Math.abs(x - (ROOM_X + s.cx * CELL)) < 20 && Math.abs(y - (ROOM_Y + s.cy * CELL)) < 20);

const npcPos = () => ({ x: ROOM_X + (COLS - 2) * CELL, y: ROOM_Y + 5 * CELL });
const pilePos = () => ({ x: ROOM_X + 2 * CELL, y: ROOM_Y + (ROWS - 2) * CELL });
const repairPos = () => ({ x: ROOM_X + 1 * CELL, y: ROOM_Y + 3 * CELL });

// ------------------------------------------------------------------ update
export function updateSite(dt) {
  if (!site.active) return;
  site.t += dt;
  if (site.talking > 0) site.talking -= dt;
  if (site.finished) {
    if (pressed('KeyE', 'Enter', 'Escape') || input.clicked) closeSite();
    return;
  }

  // ---- walking, eight ways, with a little inertia
  const p = site.player;
  let ax = 0, ay = 0;
  if (held('KeyA', 'ArrowLeft')) ax -= 1;
  if (held('KeyD', 'ArrowRight')) ax += 1;
  if (held('KeyW', 'ArrowUp')) ay -= 1;
  if (held('KeyS', 'ArrowDown')) ay += 1;
  const len = Math.hypot(ax, ay) || 1;
  const speed = 78;
  p.vx += ((ax / len) * speed - p.vx) * Math.min(1, dt * 12);
  p.vy += ((ay / len) * speed - p.vy) * Math.min(1, dt * 12);
  const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
  if (inRoom(nx, p.y)) p.x = nx; else p.vx = 0;
  if (inRoom(p.x, ny)) p.y = ny; else p.vy = 0;
  if (Math.abs(p.vx) > 6) p.face = p.vx > 0 ? 1 : -1;
  if ((Math.abs(p.vx) + Math.abs(p.vy)) > 30 && Math.random() < dt * 6) sfx.step();

  if (pressed('KeyB')) { site.blueprint = !site.blueprint; sfx.click(); }
  if (pressed('KeyR')) { site.theme = (site.theme + 1) % THEMES.length; site.style += 0.02; sfx.click(); }

  // ---- the repair, held down at the broken spot
  const rp = repairPos();
  const atRepair = site.repair && Math.hypot(p.x - rp.x, p.y - rp.y) < 30;
  if (atRepair && (held('KeyE', 'Space') || input.down)) {
    const cost = REPAIRS[site.repair].mats;
    if (!haveMaterials(cost)) {
      site.hint = `NEED ${missingMaterials(cost).toUpperCase()}`;
    } else {
      site.repairing += dt * 0.55;
      if (Math.random() < dt * 10) sfx.screw();
      if (site.repairing >= 1) {
        takeMaterials(cost);
        if (site.order) site.order.repaired = true;
        site.repair = null;
        site.repairing = 0;
        site.style += 0.15;
        toast('PUT RIGHT - THAT WILL HOLD NOW', 'good');
        sfx.good();
      }
    }
  } else if (site.repairing > 0) {
    site.repairing = Math.max(0, site.repairing - dt * 0.7);
  }

  if (!pressed('KeyE')) return;

  // ---- pick up, put down, hand over
  const pile = pilePos();
  const npos = npcPos();
  if (!site.carry && site.pile.length && Math.hypot(p.x - pile.x, p.y - pile.y) < 30) {
    site.carry = site.pile.shift();
    sfx.thunk();
    site.hint = 'CARRY IT TO ITS OUTLINE - E TO SET IT DOWN';
    return;
  }
  if (site.carry) {
    const slot = slotAt(p.x, p.y);
    if (slot && slot.id === site.carry) {
      slot.filled = true;
      const piece = takeFurniture(site.carry);
      slot.quality = piece ? piece.quality : 0.5;
      if (site.order) site.order.placed.push(site.carry);
      site.style += 0.12;
      site.carry = null;
      sfx.good();
      site.hint = 'THAT IS IT. SQUARE AND SOLID.';
    } else if (inRoom(p.x, p.y)) {
      // dropped somewhere of your own choosing: decoration, and worth a little
      site.extras.push({ id: site.carry, x: p.x, y: p.y });
      takeFurniture(site.carry);
      site.style += 0.04;
      site.carry = null;
      sfx.thunk();
      site.hint = 'SET DOWN. NOT WHERE THE PLAN SAYS, BUT IT SUITS.';
    }
    return;
  }
  if (Math.hypot(p.x - npos.x, p.y - npos.y) < 34) {
    tryHandover();
  }
}

function tryHandover() {
  const order = site.order;
  if (!order) { site.talking = 3; site.hint = 'JUST VISITING. NO JOB ON THE BOOKS.'; return; }
  const left = site.slots.filter((s) => !s.filled);
  if (left.length) {
    site.talking = 3;
    site.hint = `${left.length} PIECE${left.length === 1 ? '' : 'S'} STILL TO FIT`;
    return;
  }
  if (site.repair) {
    site.talking = 3;
    site.hint = `${REPAIRS[site.repair].name.toUpperCase()} FIRST`;
    return;
  }
  const craft = site.slots.reduce((sum, s) => sum + s.quality, 0) / Math.max(1, site.slots.length);
  const quality = Math.max(0, Math.min(1, craft * 0.7 + Math.min(0.3, site.style)));
  site.result = completeOrder(order, quality);
  site.result.quality = quality;
  site.finished = true;
  sfx.cash();
}

// -------------------------------------------------------------------- draw
/** Which way the player is facing, from how they are moving. */
function heroDir(p) {
  if (Math.abs(p.vx) > Math.abs(p.vy)) return p.vx > 0 ? 'right' : 'left';
  if (Math.abs(p.vy) > 4) return p.vy > 0 ? 'down' : 'up';
  return site.lastDir || 'down';
}

function drawRoom(ctx, t) {
  const th = THEMES[site.theme];
  const rw = COLS * CELL, rh = ROWS * CELL;

  // ---- outside the walls: the same turf and path as the yard, so going in and
  // out of the house does not change the world you are standing in
  for (let y = 0; y < VIEW_H; y += 16) {
    for (let x = 0; x < VIEW_W; x += 16) {
      ctx.drawImage(N.grassTile(((x * 7 + y * 13) / 16) % 6 | 0, 16), x, y);
    }
  }
  N.grassPatches(ctx, 0, 0, VIEW_W, VIEW_H, 1717);
  const pathX = ROOM_X + rw / 2 - 16;
  for (let y = ROOM_Y + rh; y < VIEW_H; y += 16) {
    for (let x = pathX; x < pathX + 32; x += 16) {
      ctx.drawImage(N.dirtTile((x / 16 + y / 8) % 3, 16), x, y);
    }
  }

  // ---- the garden the house stands in, so the room is not a box on a lawn
  surroundings(ctx, t, rw, rh);

  // ---- the shell: boarded walls seen edge-on, with the roof line above
  const wallT = 9;
  const wallRamp = ramp(th.wall);
  plankWall(ctx, ROOM_X - wallT, ROOM_Y - wallT - 7, rw + wallT * 2, rh + wallT * 2 + 7,
            wallRamp, { step: 18, dir: 'v' });
  plank(ctx, ROOM_X - wallT, ROOM_Y - wallT - 7, rw + wallT * 2, 5, RAMPS.shingle,
        { dir: 'h', knots: 0 });
  frame(ctx, ROOM_X - wallT, ROOM_Y - wallT - 7, rw + wallT * 2, rh + wallT * 2 + 7, SUN.wood0);
  ctx.globalAlpha = 0.22;
  rect(ctx, ROOM_X - wallT, ROOM_Y + rh + wallT, rw + wallT * 2, 3, PAL.black);
  ctx.globalAlpha = 1;

  // ---- the floor: real boards with grain, laid in staggered lengths
  const floorRamp = ramp(th.floor[0]);
  for (let r = 0; r < ROWS; r++) {
    plank(ctx, ROOM_X, ROOM_Y + r * CELL, rw, CELL, floorRamp,
          { dir: 'h', seed: 300 + r * 7, knots: r % 3 === 0 ? 1 : 0, ao: false });
    for (let c = (r % 2) ? 0 : 2; c < COLS; c += 4) {
      rect(ctx, ROOM_X + c * CELL, ROOM_Y + r * CELL, 1, CELL,
           mix(floorRamp[1], floorRamp[0], 0.5));
    }
  }
  // skirting inside the walls
  rect(ctx, ROOM_X, ROOM_Y, rw, 3, 'rgba(0,0,0,0.18)');
  rect(ctx, ROOM_X, ROOM_Y + rh - 2, rw, 2, 'rgba(0,0,0,0.12)');

  // ---- the rug, woven, with a fringe
  const rx = ROOM_X + 5 * CELL, ry = ROOM_Y + 4 * CELL, rugW = 6 * CELL, rugH = 3 * CELL;
  rect(ctx, rx, ry, rugW, rugH, th.rug);
  frame(ctx, rx, ry, rugW, rugH, PAL.paper2);
  frame(ctx, rx + 3, ry + 3, rugW - 6, rugH - 6, 'rgba(255,255,255,0.35)');
  ctx.globalAlpha = 0.3;
  for (let y = ry + 6; y < ry + rugH - 6; y += 3) rect(ctx, rx + 6, y, rugW - 12, 1, PAL.ink2);
  ctx.globalAlpha = 1;
  for (let i = 0; i < 4; i++) {
    const dx = rx + rugW / 2 - 24 + i * 16;
    for (let k = 0; k < 5; k++) {
      px(ctx, dx + k - 2, ry + rugH / 2 - 2 + Math.abs(k - 2), PAL.paper2);
      px(ctx, dx + k - 2, ry + rugH / 2 + 2 - Math.abs(k - 2), PAL.paper2);
    }
  }
  for (let x = rx; x < rx + rugW; x += 3) {
    rect(ctx, x, ry - 2, 1, 2, PAL.paper2);
    rect(ctx, x, ry + rugH, 1, 2, PAL.paper2);
  }

  // ---- daylight through the windows, falling across the boards
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = '#fff0c0';
  for (const c of [2, 9]) {
    ctx.beginPath();
    ctx.moveTo(ROOM_X + c * CELL, ROOM_Y);
    ctx.lineTo(ROOM_X + (c + 3) * CELL, ROOM_Y);
    ctx.lineTo(ROOM_X + (c + 5) * CELL, ROOM_Y + rh);
    ctx.lineTo(ROOM_X + (c + 2) * CELL, ROOM_Y + rh);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ---- door at the bottom, windows in the back wall
  const doorX = ROOM_X + rw / 2 - 16;
  rect(ctx, doorX, ROOM_Y + rh, 32, wallT, SUN.wood2);
  rect(ctx, doorX, ROOM_Y + rh, 32, 2, SUN.wood4);
  rect(ctx, doorX + 2, ROOM_Y + rh + 2, 28, wallT - 3, SUN.wood1);
  for (const c of [2, 9]) {
    const wx = ROOM_X + c * CELL;
    rect(ctx, wx, ROOM_Y - wallT - 2, 3 * CELL, 7, '#a3ddfa');
    rect(ctx, wx, ROOM_Y - wallT - 2, 3 * CELL, 3, '#cdeeff');
    frame(ctx, wx - 1, ROOM_Y - wallT - 3, 3 * CELL + 2, 9, SUN.wood2);
    rect(ctx, wx + 1.5 * CELL, ROOM_Y - wallT - 2, 2, 7, SUN.wood2);
    // a window box, because these are people's homes
    rect(ctx, wx + 4, ROOM_Y - wallT + 5, 3 * CELL - 8, 4, '#b5714f');
    for (let i = 0; i < 5; i++) px(ctx, wx + 7 + i * 8, ROOM_Y - wallT + 4, i % 2 ? '#e8626f' : '#f7cc55');
  }

  // whatever this customer does for a living, along the back wall
  tradeFixtures(ctx, NPCS[site.npc].job, t);
}

function drawBlueprintOverlay(ctx, t) {
  ctx.fillStyle = 'rgba(18,42,72,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // grid, in draughtsman's blue
  for (let c = 0; c <= COLS; c++) {
    for (let y = ROOM_Y; y < ROOM_Y + ROWS * CELL; y += 3) px(ctx, ROOM_X + c * CELL, y, '#4f7fc4');
  }
  for (let r = 0; r <= ROWS; r++) {
    for (let x = ROOM_X; x < ROOM_X + COLS * CELL; x += 3) px(ctx, x, ROOM_Y + r * CELL, '#4f7fc4');
  }
  frame(ctx, ROOM_X, ROOM_Y, COLS * CELL, ROWS * CELL, '#a9dcf5');
  // dimension lines along the top, because a plan without figures is a sketch
  const dy = ROOM_Y - 8;
  for (let x = ROOM_X; x < ROOM_X + COLS * CELL; x += 2) px(ctx, x, dy, '#a9dcf5');
  text(ctx, `${COLS} FT`, ROOM_X + COLS * CELL / 2, dy - 9, '#a9dcf5', { align: 'center' });
  text(ctx, `${ROWS} FT`, ROOM_X - 4, ROOM_Y + ROWS * CELL / 2, '#a9dcf5', { align: 'right' });
  // every slot, dashed, labelled and sized
  for (const s of site.slots) {
    const bp = FURNITURE[s.id];
    const w = bp.size[0] * CELL + 6, h = bp.size[1] * CELL + 6;
    const x = ROOM_X + s.cx * CELL - (w >> 1), y = ROOM_Y + s.cy * CELL - (h >> 1);
    const tone = s.filled ? '#5aa74b' : '#f7cc55';
    for (let i = 0; i < w; i += 4) { px(ctx, x + i, y, tone); px(ctx, x + i, y + h, tone); }
    for (let i = 0; i < h; i += 4) { px(ctx, x, y + i, tone); px(ctx, x + w, y + i, tone); }
    text(ctx, bp.name, x + (w >> 1), y + (h >> 1) - 3, tone, { align: 'center' });
    if (s.filled) text(ctx, 'FITTED', x + (w >> 1), y + (h >> 1) + 6, '#5aa74b', { align: 'center' });
  }
  text(ctx, 'BLUEPRINT - B CLOSES   R RE-DRESSES THE ROOM', VIEW_W - 6, VIEW_H - 12, '#a9dcf5',
       { align: 'right' });
}

/** Slot ghosts in the ordinary view, so you always know where things go. */
function drawSlotGhosts(ctx, t) {
  for (const s of site.slots) {
    if (s.filled) continue;
    const x = ROOM_X + s.cx * CELL, y = ROOM_Y + s.cy * CELL;
    const pulse = 0.3 + Math.sin(t * 3 + s.cx) * 0.12;
    ctx.globalAlpha = pulse;
    drawFurniture(ctx, s.id, x, y + 8, { ghost: true, scale: 1 });
    ctx.globalAlpha = 1;
    const bp = FURNITURE[s.id];
    const w = bp.size[0] * CELL + 4;
    for (let i = 0; i < w; i += 4) { px(ctx, x - (w >> 1) + i, y + 10, PAL.gold2); }
    if (site.carry === s.id) {
      text(ctx, 'HERE', x, y - 26, PAL.gold2, { align: 'center', shadow: PAL.ink });
    }
  }
}

function drawNpc(ctx, t) {
  const npc = NPCS[site.npc];
  const p = npcPos();
  const ears = { rabbit: 'long', squirrel: 'tuft', hedgehog: 'tuft' }[npc.species] || 'round';
  drawTop(ctx, npcTop(npc.tone, Math.floor(t * 1.6) % 2, { ears }), p.x, p.y + 6, -1);
  // a name tag, and their standing with you under it
  text(ctx, npc.name.toUpperCase(), p.x, p.y - 22, PAL.white, { align: 'center', shadow: PAL.ink });
  for (let i = 0; i < 5; i++) {
    rect(ctx, p.x - 10 + i * 5, p.y - 30, 4, 4, i < friendRank(site.npc) ? PAL.red2 : 'rgba(0,0,0,0.4)');
  }

  if (site.talking > 0 || site.hint) {
    const say = site.hint || npc.hello;
    const lines = wrap(say, 140);
    const w = 152, h = 8 + lines.length * 9;
    const bx = Math.max(4, Math.min(VIEW_W - w - 4, p.x - w / 2));
    const by = p.y - 36 - h;
    ctx.fillStyle = 'rgba(242,226,191,0.95)';
    ctx.fillRect(bx, by, w, h);
    frame(ctx, bx, by, w, h, PAL.wood0);
    lines.forEach((ln, i) => text(ctx, ln, bx + 5, by + 3 + i * 9, PAL.ink));
    for (let i = 0; i < 4; i++) px(ctx, p.x - 2 + i, by + h + i, PAL.paper);
  }
}

function drawPile(ctx, t) {
  const p = pilePos();
  if (!site.pile.length) return;
  // the van load, stacked by the door
  rect(ctx, p.x - 20, p.y - 6, 40, 16, PAL.wood1);
  rect(ctx, p.x - 20, p.y - 6, 40, 3, PAL.wood2);
  site.pile.slice(0, 3).forEach((id, i) => {
    drawFurniture(ctx, id, p.x - 8 + i * 9, p.y - 6 - i * 3, { scale: 1 });
  });
  const vl = `${site.pile.length} IN THE VAN`;
  rect(ctx, p.x - (vl.length * 6 + 6) / 2, p.y + 11, vl.length * 6 + 6, 10, 'rgba(13,10,9,0.66)');
  text(ctx, vl, p.x, p.y + 13, PAL.paper, { align: 'center' });
}

function drawRepair(ctx, t) {
  if (!site.repair) return;
  const p = repairPos();
  const flash = Math.floor(t * 4) % 2;
  // the broken thing, cracked and flagged
  rect(ctx, p.x - 16, p.y - 6, 32, 12, PAL.wood1);
  for (let i = 0; i < 4; i++) {
    line(ctx, p.x - 12 + i * 8, p.y - 6, p.x - 8 + i * 8, p.y + 6, PAL.ink);
  }
  const label = REPAIRS[site.repair].name.toUpperCase();
  const lw = label.length * 6 + 6;
  rect(ctx, p.x - lw / 2, p.y - 22, lw, 10, 'rgba(13,10,9,0.72)');
  text(ctx, label, p.x, p.y - 20, flash ? PAL.red2 : PAL.gold2, { align: 'center' });
  if (site.repairing > 0) bar(ctx, p.x - 22, p.y + 10, 44, 5, site.repairing, PAL.grass3);
}


/**
 * Hedge, trees and yard clutter around the outside of the room. Without it the
 * house reads as a crate dropped on an empty field.
 */
function surroundings(ctx, t, rw, rh) {
  const L = ROOM_X - 9, R = ROOM_X + rw + 9, T = ROOM_Y - 16, B = ROOM_Y + rh + 9;
  // a hedge following the plot, gappy so it never reads as a wall
  const rng = pnoise(818);
  const hedge = (x, y) => {
    const r = 6 + Math.round(rng() * 3);
    disc(ctx, x, y, r, RAMPS.leafB[1]);
    disc(ctx, x - 1, y - 2, r - 2, RAMPS.leafB[2]);
    disc(ctx, x - 2, y - 3, Math.max(1, r - 4), RAMPS.leafB[3]);
    if (rng() > 0.72) px(ctx, x + 2, y - 2, '#f7cc55');
  };
  for (let x = 10; x < VIEW_W - 8; x += 15) {
    if (Math.abs(x - (ROOM_X + rw / 2)) < 26) continue;      // leave the path clear
    hedge(x, T - 12 + Math.round(Math.sin(x * 0.2) * 2));
    if (x < L - 12 || x > R + 12) hedge(x, B + 26 + Math.round(Math.sin(x * 0.3) * 2));
  }
  for (let y = T - 4; y < B + 30; y += 15) hedge(L - 26, y);
  for (let y = T - 4; y < B + 30; y += 15) hedge(R + 26, y);
  // trees at the corners, from above
  ctx.drawImage(N.treeTop(0), L - 60, T - 30);
  ctx.drawImage(N.treeTop(1), R + 34, T - 26);
  ctx.drawImage(N.treeTop(2), L - 54, B + 4);
  ctx.drawImage(N.treeTop(0), R + 38, B + 8);
  // beds, a well and the things a household leaves outside
  ctx.drawImage(B_.gardenBed(46, 18, 'flower'), L + 6, B + 14);
  ctx.drawImage(B_.gardenBed(46, 18, 'leaf'), R - 52, B + 14);
  ctx.drawImage(PROP.barrel('open'), L - 16, B + 2);
  ctx.drawImage(PROP.crate('apples'), R + 4, B + 4);
  ctx.drawImage(PROP.firewood(30, 18), L + 2, T - 22);
  ctx.drawImage(PROP.bucket(true), R - 16, T - 20);
  // scatter, kept off the path and out of the house
  const s2 = pnoise(919);
  for (let i = 0; i < 46; i++) {
    const sx = 6 + s2() * (VIEW_W - 12);
    const sy = 6 + s2() * (VIEW_H - 12);
    if (sx > L - 14 && sx < R + 14 && sy > T - 18 && sy < B + 12) continue;
    if (Math.abs(sx - (ROOM_X + rw / 2)) < 24 && sy > B) continue;
    const roll = s2();
    if (roll < 0.45) ctx.drawImage(N.grassTuft((s2() * 3) | 0), sx, sy);
    else if (roll < 0.8) ctx.drawImage(N.flower((s2() * 4) | 0), sx, sy);
    else ctx.drawImage(N.rock(0), sx, sy);
  }
}

export function drawSite(ctx, t) {
  drawRoom(ctx, t);
  drawSlotGhosts(ctx, t);

  // everything on the floor, sorted so nearer things overlap farther ones
  const items = [];
  const grounded = (id, x, y) => {
    ctx.globalAlpha = 0.2;
    for (let dy = -2; dy <= 2; dy++) {
      const span = Math.round(14 * Math.sqrt(Math.max(0, 1 - (dy * dy) / 6)));
      rect(ctx, x - span, y - 1 + dy, span * 2, 1, PAL.black);
    }
    ctx.globalAlpha = 1;
    drawFurniture(ctx, id, x, y, { scale: 1 });
  };
  for (const s of site.slots) {
    if (!s.filled) continue;
    const fx = ROOM_X + s.cx * CELL, fy = ROOM_Y + s.cy * CELL + 8;
    items.push({ y: fy, draw: () => grounded(s.id, fx, fy) });
  }
  for (const e of site.extras) items.push({ y: e.y, draw: () => grounded(e.id, e.x, e.y) });
  items.push({ y: npcPos().y, draw: () => drawNpc(ctx, t) });
  items.push({ y: pilePos().y, draw: () => drawPile(ctx, t) });
  items.push({ y: repairPos().y, draw: () => drawRepair(ctx, t) });
  const p = site.player;
  items.push({ y: p.y, draw: () => {
    const moving = Math.abs(p.vx) + Math.abs(p.vy) > 12;
    const dir = heroDir(p);
    site.lastDir = dir;
    const frame = moving ? Math.floor(t * 8) % 4 : 0;
    drawTop(ctx, heroTop(dir, frame), p.x, p.y + 6, 1);
    if (site.carry) {
      // carried over your head, wobbling as you walk
      const wob = Math.sin(t * 9) * 1.5;
      drawFurniture(ctx, site.carry, p.x, p.y - 20 + wob, { scale: 1 });
    }
  } });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  if (site.blueprint) drawBlueprintOverlay(ctx, t);

  drawSiteHud(ctx, t);
}

function drawSiteHud(ctx, t) {
  const npc = NPCS[site.npc];
  // header
  rect(ctx, 0, 0, VIEW_W, 16, 'rgba(13,10,9,0.72)');
  text(ctx, npc.site.toUpperCase(), 6, 4, PAL.gold2);
  text(ctx, `${npc.name.toUpperCase()} - ${npc.job.toUpperCase()}`, VIEW_W / 2, 4, PAL.paper, { align: 'center' });
  const done = site.slots.filter((s) => s.filled).length;
  text(ctx, `FITTED ${done}/${site.slots.length}`, VIEW_W - 6, 4, done === site.slots.length ? PAL.grass4 : PAL.paper3,
       { align: 'right' });

  // design rating, bottom left
  rect(ctx, 4, VIEW_H - 26, 108, 22, 'rgba(13,10,9,0.66)');
  text(ctx, 'DESIGN', 8, VIEW_H - 23, PAL.paper3);
  for (let i = 0; i < 5; i++) {
    const on = site.style * 5 > i;
    rect(ctx, 52 + i * 8, VIEW_H - 23, 6, 6, on ? PAL.gold2 : 'rgba(0,0,0,0.4)');
  }
  text(ctx, 'B PLAN   R RE-DRESS', 8, VIEW_H - 13, PAL.paper3);

  // prompts
  const p = site.player;
  if (!site.carry && site.pile.length) {
    const pile = pilePos();
    if (Math.hypot(p.x - pile.x, p.y - pile.y) < 30) keyPrompt(ctx, pile.x, pile.y - 34, 'E', 'PICK UP', t);
  }
  if (site.carry) {
    const slot = site.slots.find((s) => !s.filled && s.id === site.carry);
    if (slot) {
      const near = Math.abs(p.x - (ROOM_X + slot.cx * CELL)) < 20 && Math.abs(p.y - (ROOM_Y + slot.cy * CELL)) < 20;
      if (near) keyPrompt(ctx, p.x, p.y - 40, 'E', 'FIT IT', t);
      else text(ctx, 'CARRYING - TAKE IT TO THE OUTLINE', VIEW_W / 2, VIEW_H - 40, PAL.gold2,
                { align: 'center', shadow: PAL.ink });
    }
  }
  const rp = repairPos();
  if (site.repair && Math.hypot(p.x - rp.x, p.y - rp.y) < 30 && !site.carry) {
    keyPrompt(ctx, rp.x, rp.y - 34, 'E', 'HOLD TO MEND', t);
  }
  const np = npcPos();
  if (!site.carry && Math.hypot(p.x - np.x, p.y - np.y) < 34) {
    keyPrompt(ctx, np.x, np.y - 44, 'E', 'TALK', t);
  }

  // ---- the pay-off
  if (site.finished && site.result) {
    scrim(ctx, VIEW_W, VIEW_H, 0.72);
    const w = 230, h = 116, x = (VIEW_W - w) >> 1, y = 64;
    const box = panel(ctx, x, y, w, h, 'JOB DONE');
    text(ctx, `${npc.name.toUpperCase()} IS DELIGHTED`, box.x + box.w / 2, box.y + 2, PAL.gold2, { align: 'center' });
    const grade = site.result.quality > 0.9 ? 'HEIRLOOM WORK' : site.result.quality > 0.7 ? 'FINE WORK'
      : site.result.quality > 0.45 ? 'HONEST WORK' : 'IT WILL DO';
    text(ctx, grade, box.x + box.w / 2, box.y + 14, PAL.paper, { align: 'center' });
    text(ctx, `+${site.result.pay} ACORNS`, box.x + 8, box.y + 30, PAL.gold2);
    text(ctx, `+${site.result.points} FRIENDSHIP`, box.x + 8, box.y + 42, PAL.red2);
    const gifts = Object.keys(npc.gift).map((k) => `${npc.gift[k]} ${k}`).join(', ');
    wrap(`${npc.name} sends you home with ${gifts}.`, box.w - 12).forEach((ln, i) =>
      text(ctx, ln, box.x + 8, box.y + 58 + i * 9, PAL.paper3));
    if (button(ctx, box.x + (box.w >> 1) - 40, box.y + box.h - 16, 80, 13, 'FLY HOME')) closeSite();
    text(ctx, 'ENTER  FLY HOME', box.x + box.w / 2, box.y + box.h - 26, PAL.paper3, { align: 'center' });
  }
}
