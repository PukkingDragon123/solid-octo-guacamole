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
import { sfx } from '../audio.js';

const CELL = 18;
const COLS = 22, ROWS = 11;
const ROOM_X = (VIEW_W - COLS * CELL) >> 1;
const ROOM_Y = 44;

/**
 * Wall, floor and rug sets. They are deliberately warm - the ground outside is
 * green, so a green floor makes the whole scene read as one flat colour.
 */
const THEMES = [
  { id: 'oak',   floor: ['#a3703f', '#8d5f36'], wall: '#5c4029', rug: '#8e3b3b' },
  { id: 'ash',   floor: ['#c9a878', '#b3946a'], wall: '#6d5540', rug: '#3f5fc4' },
  { id: 'brick', floor: ['#b5714f', '#9c5f43'], wall: '#7a4438', rug: '#e0a02e' },
  { id: 'slate', floor: ['#9aa0a8', '#848a92'], wall: '#3f4650', rug: '#8256c4' },
];

/** What each trade keeps against the back wall. */
function tradeFixtures(ctx, job, t) {
  const bx = ROOM_X, by = ROOM_Y;
  const at = (c, r) => ({ x: bx + c * CELL, y: by + r * CELL });
  if (job === 'Baker') {
    // a brick oven, mouth glowing, and a rack of loaves
    const o = at(2, 1);
    rect(ctx, o.x - 16, o.y - 8, 44, 34, '#8a4b38');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      rect(ctx, o.x - 15 + c * 9 + (r % 2 ? 4 : 0), o.y - 7 + r * 8, 8, 7, r % 2 ? '#a3583f' : '#96513a');
    }
    disc(ctx, o.x + 6, o.y + 14, 9, PAL.ink);
    disc(ctx, o.x + 6, o.y + 14, 7, Math.floor(t * 3) % 2 ? '#e8604a' : '#f7cc55');
    const rk = at(7, 1);
    rect(ctx, rk.x, rk.y, 46, 3, PAL.wood2);
    rect(ctx, rk.x, rk.y + 12, 46, 3, PAL.wood2);
    for (let i = 0; i < 4; i++) { disc(ctx, rk.x + 8 + i * 11, rk.y - 3, 4, '#c9a05c'); disc(ctx, rk.x + 8 + i * 11, rk.y + 9, 4, '#b98d4c'); }
  } else if (job === 'Blacksmith') {
    const f = at(2, 1);
    rect(ctx, f.x - 14, f.y - 6, 40, 30, PAL.stone1);
    rect(ctx, f.x - 14, f.y - 6, 40, 4, PAL.stone2);
    disc(ctx, f.x + 6, f.y + 10, 8, '#5a1f14');
    for (let i = 0; i < 5; i++) px(ctx, f.x + 2 + i * 2, f.y + 4 - ((t * 20 + i * 5) % 12), PAL.gold2);
    const a = at(8, 2);
    rect(ctx, a.x, a.y, 24, 7, PAL.stone0);
    rect(ctx, a.x + 6, a.y + 7, 10, 8, PAL.stone0);
    rect(ctx, a.x - 4, a.y, 8, 4, PAL.stone0);
  } else if (job === 'Weaver') {
    const l = at(3, 1);
    rect(ctx, l.x - 12, l.y - 10, 4, 36, PAL.wood1);
    rect(ctx, l.x + 24, l.y - 10, 4, 36, PAL.wood1);
    rect(ctx, l.x - 12, l.y - 10, 40, 3, PAL.wood2);
    for (let i = 0; i < 9; i++) rect(ctx, l.x - 8 + i * 4, l.y - 7, 1, 30, i % 2 ? PAL.pink : PAL.paper2);
    for (let i = 0; i < 3; i++) {
      const w = at(9 + i * 2, 1);
      disc(ctx, w.x, w.y + 6, 7, [PAL.pink, PAL.sky3, PAL.gold2][i]);
      rect(ctx, w.x - 7, w.y + 8, 14, 5, PAL.wood1);
    }
  } else if (job === 'River Fisher') {
    // an inlet of the river running along the back wall
    rect(ctx, ROOM_X, ROOM_Y, COLS * CELL, CELL + 6, '#2f83b8');
    rect(ctx, ROOM_X, ROOM_Y, COLS * CELL, 3, '#4fa9d8');
    for (let i = 0; i < 30; i++) {
      px(ctx, ROOM_X + ((i * 27 + Math.floor(t * 16)) % (COLS * CELL)), ROOM_Y + 6 + (i % 3) * 4, '#8fd6f0');
    }
    rect(ctx, ROOM_X, ROOM_Y + CELL + 6, COLS * CELL, 3, PAL.sand);
    const r = at(9, 2);
    rect(ctx, r.x, r.y, 3, 20, PAL.wood1);
    rect(ctx, r.x + 30, r.y, 3, 20, PAL.wood1);
    rect(ctx, r.x, r.y, 33, 2, PAL.wood2);
    for (let i = 0; i < 3; i++) { rect(ctx, r.x + 6 + i * 10, r.y + 2, 5, 9, PAL.stone2); px(ctx, r.x + 7 + i * 10, r.y + 4, PAL.ink); }
  } else if (job === 'Seed Miller') {
    const m = at(3, 1);
    disc(ctx, m.x, m.y + 8, 15, PAL.stone2);
    disc(ctx, m.x, m.y + 8, 12, PAL.stone3);
    disc(ctx, m.x, m.y + 8, 3, PAL.stone0);
    rect(ctx, m.x - 1, m.y - 8, 3, 16, PAL.wood1);
    for (let i = 0; i < 4; i++) {
      const sk = at(8 + i * 2, 1);
      rect(ctx, sk.x - 7, sk.y - 2, 15, 20, '#c9b68f');
      rect(ctx, sk.x - 5, sk.y - 5, 11, 5, '#b3a079');
      px(ctx, sk.x, sk.y + 8, PAL.gold);
    }
  } else if (job === 'Glassblower') {
    const f = at(2, 1);
    rect(ctx, f.x - 12, f.y - 4, 34, 28, '#4a3524');
    disc(ctx, f.x + 5, f.y + 10, 9, '#e8604a');
    disc(ctx, f.x + 5, f.y + 10, 5, PAL.gold2);
    for (let i = 0; i < 3; i++) {
      const sh = at(8, 1 + i);
      rect(ctx, sh.x, sh.y + 8, 80, 2, PAL.wood2);
      for (let k = 0; k < 6; k++) {
        rect(ctx, sh.x + 4 + k * 13, sh.y + 1, 6, 7, k % 2 ? '#8fd6f0' : '#a9dcf5');
        px(ctx, sh.x + 6 + k * 13, sh.y, PAL.white);
      }
    }
  } else if (job === 'Quarryman') {
    for (let i = 0; i < 5; i++) {
      const b = at(2 + i * 2, 1);
      rect(ctx, b.x - 8, b.y + (i % 2) * 6, 18, 14, PAL.stone2);
      rect(ctx, b.x - 8, b.y + (i % 2) * 6, 18, 3, PAL.stone3);
      frame(ctx, b.x - 8, b.y + (i % 2) * 6, 18, 14, PAL.stone0);
    }
    const w = at(14, 2);
    rect(ctx, w.x, w.y, 26, 10, PAL.stone1);
    disc(ctx, w.x + 4, w.y + 12, 5, PAL.ink);
    rect(ctx, w.x + 24, w.y - 6, 3, 12, PAL.wood2);
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

export function openSite(npcId) {
  const s = story();
  const npc = NPCS[npcId];
  const order = s.orders.find((o) => o.npc === npcId) || null;
  const wants = order ? order.wants : [];
  // one blueprint slot per ordered piece, laid out along the far wall
  const slots = wants.map((id, i) => ({
    id,
    cx: 4 + (i % 4) * 5,
    cy: 3 + Math.floor(i / 4) * 4,
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

const npcPos = () => ({ x: ROOM_X + (COLS - 4) * CELL, y: ROOM_Y + 3 * CELL });
const pilePos = () => ({ x: ROOM_X + 2 * CELL, y: ROOM_Y + (ROWS - 2) * CELL });
const repairPos = () => ({ x: ROOM_X + (COLS - 3) * CELL, y: ROOM_Y + (ROWS - 3) * CELL });

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
/** A beaver from above: round back, ears, and that unmistakable tail. */
function topBeaver(ctx, x, y, face, opts = {}) {
  const fur = opts.fur || PAL.fur2;
  ctx.globalAlpha = 0.28;
  disc(ctx, Math.round(x), Math.round(y) + 5, 8, PAL.black);
  ctx.globalAlpha = 1;
  // tail, trailing behind
  rect(ctx, Math.round(x) - (face > 0 ? 12 : -4), Math.round(y) - 2, 9, 5, PAL.fur1);
  disc(ctx, Math.round(x), Math.round(y), 8, fur);
  disc(ctx, Math.round(x), Math.round(y) - 1, 6, opts.light || PAL.fur3);
  // head end
  disc(ctx, Math.round(x) + face * 5, Math.round(y) - 2, 5, fur);
  disc(ctx, Math.round(x) + face * 6, Math.round(y) - 3, 3, opts.light || PAL.fur4);
  px(ctx, Math.round(x) + face * 8, Math.round(y) - 3, PAL.ink);
  disc(ctx, Math.round(x) + face * 2, Math.round(y) - 6, 2, PAL.fur1);
  if (opts.tone) rect(ctx, Math.round(x) - 4, Math.round(y) - 1, 8, 4, opts.tone);
}

function drawRoom(ctx, t) {
  const th = THEMES[site.theme];
  // outside: whatever this customer lives among
  rect(ctx, 0, 0, VIEW_W, VIEW_H, '#6b8a5a');
  const rng = rngFrom(1717);
  for (let i = 0; i < 260; i++) {
    const gx = rng() * VIEW_W, gy = rng() * VIEW_H;
    px(ctx, Math.round(gx), Math.round(gy), rng() > 0.5 ? '#5f7d4e' : '#7c9a68');
  }
  // a path up to the door, and the heron waiting on the grass
  rect(ctx, ROOM_X + COLS * CELL / 2 - 16, ROOM_Y + ROWS * CELL, 32, VIEW_H, '#b1936a');
  for (let y = ROOM_Y + ROWS * CELL; y < VIEW_H; y += 6) rect(ctx, ROOM_X + COLS * CELL / 2 - 16, y, 32, 1, '#98795a');

  // walls, drawn with a lit top edge so the room reads as a box from above
  rect(ctx, ROOM_X - 6, ROOM_Y - 12, COLS * CELL + 12, ROWS * CELL + 18, th.wall);
  rect(ctx, ROOM_X - 6, ROOM_Y - 12, COLS * CELL + 12, 4, PAL.wood3);
  frame(ctx, ROOM_X - 6, ROOM_Y - 12, COLS * CELL + 12, ROWS * CELL + 18, PAL.wood0);

  // floorboards
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = ROOM_X + c * CELL, y = ROOM_Y + r * CELL;
      rect(ctx, x, y, CELL, CELL, (r + c) % 2 ? th.floor[0] : th.floor[1]);
      rect(ctx, x, y, CELL, 1, 'rgba(255,255,255,0.06)');
    }
  }
  for (let r = 0; r <= ROWS; r++) rect(ctx, ROOM_X, ROOM_Y + r * CELL, COLS * CELL, 1, 'rgba(0,0,0,0.14)');

  // the rug, and the light from the window falling across it
  const rx = ROOM_X + 6 * CELL, ry = ROOM_Y + 5 * CELL, rw = 8 * CELL, rh = 4 * CELL;
  rect(ctx, rx, ry, rw, rh, th.rug);
  frame(ctx, rx, ry, rw, rh, PAL.paper3);
  frame(ctx, rx + 4, ry + 4, rw - 8, rh - 8, PAL.paper2);
  // a woven pattern, or it reads as a painted rectangle
  ctx.globalAlpha = 0.4;
  for (let y = ry + 8; y < ry + rh - 8; y += 4) rect(ctx, rx + 8, y, rw - 16, 1, PAL.ink2);
  ctx.globalAlpha = 1;
  for (let i = 0; i < 5; i++) {
    const dx = rx + rw / 2 - 32 + i * 16;
    for (let k = 0; k < 5; k++) {
      px(ctx, dx + k - 2, ry + rh / 2 - 2 + Math.abs(k - 2), PAL.paper2);
      px(ctx, dx + k - 2, ry + rh / 2 + 2 - Math.abs(k - 2), PAL.paper2);
    }
  }
  // fringe at both ends
  for (let x = rx; x < rx + rw; x += 3) {
    rect(ctx, x, ry - 2, 1, 2, PAL.paper2);
    rect(ctx, x, ry + rh, 1, 2, PAL.paper2);
  }
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.moveTo(ROOM_X + 3 * CELL, ROOM_Y);
  ctx.lineTo(ROOM_X + 7 * CELL, ROOM_Y);
  ctx.lineTo(ROOM_X + 11 * CELL, ROOM_Y + ROWS * CELL);
  ctx.lineTo(ROOM_X + 5 * CELL, ROOM_Y + ROWS * CELL);
  ctx.fill();
  ctx.globalAlpha = 1;

  // door at the bottom, windows in the back wall
  rect(ctx, ROOM_X + COLS * CELL / 2 - 18, ROOM_Y + ROWS * CELL, 36, 6, PAL.wood2);
  rect(ctx, ROOM_X + COLS * CELL / 2 - 14, ROOM_Y + ROWS * CELL + 6, 28, 10, '#8d5f36');
  for (const c of [3, 15]) {
    rect(ctx, ROOM_X + c * CELL, ROOM_Y - 12, 4 * CELL, 6, '#cfe6f2');
    frame(ctx, ROOM_X + c * CELL, ROOM_Y - 12, 4 * CELL, 6, PAL.wood0);
    rect(ctx, ROOM_X + c * CELL + 2 * CELL, ROOM_Y - 12, 2, 6, PAL.wood0);
  }
  // whatever this customer does for a living, standing against the back wall
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
  const bob = Math.sin(t * 1.8) * 1.5;
  topBeaver(ctx, p.x, p.y + bob, -1, { fur: npc.tone, light: PAL.fur4, tone: null });
  // a name tag, and their trade under it
  const label = npc.name.toUpperCase();
  text(ctx, label, p.x, p.y - 20, PAL.white, { align: 'center', shadow: PAL.ink });
  for (let i = 0; i < 5; i++) {
    rect(ctx, p.x - 10 + i * 5, p.y - 28, 4, 4, i < friendRank(site.npc) ? PAL.red2 : 'rgba(0,0,0,0.4)');
  }

  if (site.talking > 0 || site.hint) {
    const say = site.hint || npc.hello;
    const lines = wrap(say, 140);
    const w = 152, h = 8 + lines.length * 9;
    const bx = Math.max(4, Math.min(VIEW_W - w - 4, p.x - w / 2));
    const by = p.y - 34 - h;
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
  text(ctx, `${site.pile.length} IN THE VAN`, p.x, p.y + 12, PAL.paper, { align: 'center', shadow: PAL.ink });
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
  text(ctx, REPAIRS[site.repair].name.toUpperCase(), p.x, p.y - 20, flash ? PAL.red2 : PAL.gold2,
       { align: 'center', shadow: PAL.ink });
  if (site.repairing > 0) bar(ctx, p.x - 22, p.y + 10, 44, 5, site.repairing, PAL.grass3);
}

export function drawSite(ctx, t) {
  drawRoom(ctx, t);
  drawSlotGhosts(ctx, t);

  // everything on the floor, sorted so nearer things overlap farther ones
  const items = [];
  for (const s of site.slots) if (s.filled) items.push({ y: ROOM_Y + s.cy * CELL + 8, draw: () => drawFurniture(ctx, s.id, ROOM_X + s.cx * CELL, ROOM_Y + s.cy * CELL + 8, { scale: 1 }) });
  for (const e of site.extras) items.push({ y: e.y, draw: () => drawFurniture(ctx, e.id, e.x, e.y, { scale: 1 }) });
  items.push({ y: npcPos().y, draw: () => drawNpc(ctx, t) });
  items.push({ y: pilePos().y, draw: () => drawPile(ctx, t) });
  items.push({ y: repairPos().y, draw: () => drawRepair(ctx, t) });
  const p = site.player;
  items.push({ y: p.y, draw: () => {
    topBeaver(ctx, p.x, p.y, p.face);
    if (site.carry) {
      // carried over your head, wobbling as you walk
      const wob = Math.sin(t * 9) * 1.5;
      drawFurniture(ctx, site.carry, p.x, p.y - 16 + wob, { scale: 1 });
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
