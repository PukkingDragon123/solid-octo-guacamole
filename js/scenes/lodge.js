// Your own lodge, inside. One room, a fire, a window on the pond — and the
// walls and floor are yours to furnish. A well-kept lodge counts for something
// when the university comes to look at your application.

import { VIEW_W, VIEW_H } from '../config.js';
import { G, spend, gain, canAfford, toast } from '../state.js';
import { PAL, rect, px, disc, line, text, textWidth, rngFrom } from '../gfx/pixel.js';
import * as S from '../gfx/sprites.js';
import { panel, button, note, hovering, scrim } from '../ui/widgets.js';
import { input } from '../input.js';

export const FLOOR = 216;
export const LODGE_BOUNDS = { w: VIEW_W, h: VIEW_H };

/** Where a piece of furniture may go, and what sort belongs there. */
export const SLOTS = [
  { x: 74, y: FLOOR, place: 'floor' },
  { x: 128, y: FLOOR, place: 'floor' },
  { x: 196, y: FLOOR, place: 'floor' },
  { x: 300, y: FLOOR, place: 'floor' },
  { x: 372, y: FLOOR, place: 'floor' },
  { x: 96, y: 150, place: 'wall' },
  { x: 168, y: 144, place: 'wall' },
  { x: 302, y: 144, place: 'wall' },
  { x: 380, y: 150, place: 'wall' },
];

export const CATALOGUE = {
  rug: { name: 'Woven Rug', place: 'floor', cost: { wood: 4, berries: 3 }, cosy: 2 },
  stool: { name: 'Stool', place: 'floor', cost: { wood: 5 }, cosy: 1 },
  table: { name: 'Table', place: 'floor', cost: { wood: 9 }, cosy: 2 },
  bookshelf: { name: 'Bookshelf', place: 'floor', cost: { wood: 14 }, cosy: 3 },
  fernpot: { name: 'Potted Fern', place: 'floor', cost: { wood: 3, seeds: 4 }, cosy: 2 },
  vase: { name: 'Flower Vase', place: 'floor', cost: { seeds: 3, berries: 3 }, cosy: 2 },
  lantern: { name: 'Wall Lantern', place: 'wall', cost: { wood: 6 }, cosy: 2 },
  painting: { name: 'Painting', place: 'wall', cost: { wood: 6, berries: 5 }, cosy: 3 },
  trophy: { name: 'Trophy Shelf', place: 'wall', cost: { wood: 16 }, cosy: 4 },
  diploma: { name: 'Diploma Frame', place: 'wall', cost: { wood: 12 }, cosy: 5 },
};

export const lodge = { decorating: false, picked: null, scroll: 0 };

export function cosiness() {
  let total = 0;
  for (const id of Object.values(G.decor || {})) {
    const item = CATALOGUE[id];
    if (item) total += item.cosy;
  }
  return total;
}

export function enterLodge() {
  G.mode = 'lodge';
  G.player.x = 240;
  G.player.y = FLOOR;
  G.player.vx = 0; G.player.vy = 0; G.player.onGround = true;
  lodge.decorating = false;
  lodge.picked = null;
}

// ------------------------------------------------------------------ scene
let backdrop = null;

function paintRoom() {
  const surf = document.createElement('canvas');
  surf.width = VIEW_W; surf.height = VIEW_H;
  const ctx = surf.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const rng = rngFrom(6161);

  // packed earth outside the shell
  rect(ctx, 0, 0, VIEW_W, VIEW_H, '#1d150e');
  for (let i = 0; i < 700; i++) {
    px(ctx, (rng() * VIEW_W) | 0, (rng() * FLOOR) | 0, rng() < 0.5 ? '#2a2014' : '#171009');
  }

  // The shell is an arch: low at the sides, high over the middle. Everything
  // below this line is the inside of the lodge.
  const ceilY = (x) => {
    const t = Math.abs(x - VIEW_W / 2) / (VIEW_W / 2);
    return Math.round(26 + 104 * t * t);
  };

  // woven courses of sticks, following the curve of the roof
  for (let x = 0; x < VIEW_W; x++) {
    const top = ceilY(x);
    rect(ctx, x, top, 1, FLOOR - top, PAL.wood2);
  }
  for (let y = 0; y < FLOOR; y += 5) {
    for (let x = 0; x < VIEW_W; x++) {
      if (y < ceilY(x)) continue;
      const shade = ((y / 5) | 0) % 2 ? PAL.wood1 : PAL.wood3;
      px(ctx, x, y, shade);
      px(ctx, x, y + 1, ((y / 5) | 0) % 2 ? PAL.wood0 : PAL.wood2);
    }
  }
  // the mud packed between them
  for (let i = 0; i < 1100; i++) {
    const x = (rng() * VIEW_W) | 0;
    const y = (rng() * FLOOR) | 0;
    if (y < ceilY(x) + 1) continue;
    px(ctx, x, y, rng() < 0.5 ? '#5a3f26' : '#6b4c2e');
  }
  // upright stakes holding the whole thing together
  for (let x = 12; x < VIEW_W; x += 23) {
    const top = ceilY(x) + 2;
    rect(ctx, x, top, 3, FLOOR - top, PAL.wood1);
    rect(ctx, x, top, 1, FLOOR - top, PAL.wood3);
    rect(ctx, x + 2, top, 1, FLOOR - top, PAL.wood0);
    px(ctx, x + 1, top - 1, PAL.wood2);
  }
  // a rim of thicker timber along the roofline, and shadow above it
  for (let x = 0; x < VIEW_W; x++) {
    const top = ceilY(x);
    rect(ctx, x, top, 1, 3, PAL.wood0);
    px(ctx, x, top + 3, PAL.wood1);
    rect(ctx, x, Math.max(0, top - 3), 1, 3, '#120c07');
  }
  // corners fall away into shadow
  ctx.globalAlpha = 0.45;
  for (let x = 0; x < VIEW_W; x++) {
    const t = Math.abs(x - VIEW_W / 2) / (VIEW_W / 2);
    if (t < 0.45) continue;
    const a = (t - 0.45) / 0.55;
    ctx.fillStyle = `rgba(10,6,3,${a * 0.8})`;
    ctx.fillRect(x, ceilY(x), 1, FLOOR - ceilY(x));
  }
  ctx.globalAlpha = 1;

  // plank floor
  rect(ctx, 0, FLOOR, VIEW_W, VIEW_H - FLOOR, PAL.wood1);
  for (let i = 0; i < 6; i++) rect(ctx, 0, FLOOR + i * 9, VIEW_W, 1, PAL.wood0);
  for (let x = 0; x < VIEW_W; x += 34) {
    for (let i = 0; i < 6; i++) rect(ctx, x + (i % 2) * 17, FLOOR + i * 9, 1, 9, PAL.wood0);
  }
  for (let i = 0; i < 260; i++) {
    px(ctx, (rng() * VIEW_W) | 0, FLOOR + ((rng() * (VIEW_H - FLOOR)) | 0), rng() < 0.5 ? PAL.wood2 : PAL.wood0);
  }
  rect(ctx, 0, FLOOR, VIEW_W, 1, PAL.wood3);

  // a round window looking out on the pond
  const wx = 240, wy = 118, wr = 26;
  disc(ctx, wx, wy, wr + 3, PAL.wood1);
  disc(ctx, wx, wy, wr, PAL.water2);
  for (let y = -wr; y <= wr; y++) {
    const span = Math.floor(Math.sqrt(wr * wr - y * y));
    if (y < -6) rect(ctx, wx - span, wy + y, span * 2, 1, PAL.sky3);
    else if (y < -2) rect(ctx, wx - span, wy + y, span * 2, 1, PAL.grass1);
    else if (y % 5 === 0) rect(ctx, wx - span + 2, wy + y, span, 1, PAL.water3);
  }
  disc(ctx, wx - 12, wy - 12, 4, PAL.gold2);
  ctx.fillStyle = PAL.wood2;
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    px(ctx, Math.round(wx + Math.cos(a) * wr), Math.round(wy + Math.sin(a) * wr), PAL.wood2);
    px(ctx, Math.round(wx + Math.cos(a) * (wr + 1)), Math.round(wy + Math.sin(a) * (wr + 1)), PAL.wood1);
  }
  rect(ctx, wx - wr, wy - 1, wr * 2, 2, PAL.wood2);
  rect(ctx, wx - 1, wy - wr, 2, wr * 2, PAL.wood2);

  // fireplace, built into the left wall
  rect(ctx, 20, FLOOR - 46, 52, 46, '#1d1712');
  rect(ctx, 18, FLOOR - 50, 56, 6, PAL.stone1);
  rect(ctx, 18, FLOOR - 50, 56, 2, PAL.stone2);
  for (let i = 0; i < 22; i++) {
    const sx = 20 + ((rng() * 50) | 0), sy = FLOOR - 46 + ((rng() * 44) | 0);
    px(ctx, sx, sy, PAL.stone0);
  }
  rect(ctx, 24, FLOOR - 8, 44, 8, PAL.stone1);

  // a bed of moss and leaves in the corner
  rect(ctx, 392, FLOOR - 16, 74, 16, PAL.wood2);
  rect(ctx, 392, FLOOR - 18, 74, 3, PAL.wood3);
  rect(ctx, 396, FLOOR - 24, 66, 8, PAL.leaf2);
  rect(ctx, 396, FLOOR - 24, 66, 3, PAL.leaf3);
  rect(ctx, 400, FLOOR - 28, 22, 6, PAL.paper2);
  rect(ctx, 400, FLOOR - 28, 22, 2, PAL.paper);

  return surf;
}

export function invalidateLodge() { backdrop = null; }

export function drawLodge(ctx, t, player) {
  if (!backdrop) backdrop = paintRoom();
  ctx.drawImage(backdrop, 0, 0);

  // the fire, alive
  for (let i = 0; i < 16; i++) {
    const p = (t * 2.2 + i * 0.37) % 1;
    const fx = 46 + Math.round(Math.sin(t * 4 + i * 2) * (7 - p * 5));
    const fy = FLOOR - 8 - Math.round(p * 26);
    const c = p < 0.25 ? PAL.white : p < 0.5 ? PAL.gold2 : p < 0.78 ? PAL.gold : PAL.red2;
    px(ctx, fx, fy, c);
    if (p < 0.5) px(ctx, fx + 1, fy, c);
  }
  for (let i = 0; i < 4; i++) rect(ctx, 30 + i * 9, FLOOR - 12, 8, 4, PAL.wood1);
  ctx.globalAlpha = 0.13 + Math.sin(t * 5) * 0.03;
  disc(ctx, 46, FLOOR - 18, 58, PAL.gold2);
  ctx.globalAlpha = 1;

  // whatever you have put in
  for (let i = 0; i < SLOTS.length; i++) {
    const id = G.decor[i];
    if (!id) continue;
    const slot = SLOTS[i];
    const img = S.decorSprite(id);
    const x = slot.x - (img.width >> 1);
    const y = slot.place === 'floor' ? slot.y - img.height : slot.y;
    ctx.drawImage(img, x, y);
    if (id === 'lantern') {
      ctx.globalAlpha = 0.1 + Math.sin(t * 3 + i) * 0.02;
      disc(ctx, slot.x, slot.y + 8, 30, PAL.gold2);
      ctx.globalAlpha = 1;
    }
  }

  drawPlayer(ctx, player, t);

  if (lodge.decorating) drawCatalogue(ctx, t);
  else {
    const cosy = cosiness();
    const label = `COSINESS ${cosy}`;
    const w = textWidth(label) + 10;
    rect(ctx, (VIEW_W - w) >> 1, 6, w, 11, 'rgba(20,15,10,0.72)');
    text(ctx, label, VIEW_W / 2, 8, cosy >= 12 ? PAL.gold2 : PAL.paper, { align: 'center' });
  }
}

function drawPlayer(ctx, player, t) {
  const pose = !player.onGround ? 'jump' : Math.abs(player.vx) > 4 ? 'walk' : 'idle';
  const frameIdx = pose === 'walk' ? Math.floor(t * 9) % 4 : Math.floor(t * 2) % 2;
  const img = S.playerSprite(pose, frameIdx);
  const sx = Math.round(player.x) - (img.width >> 1);
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

// ------------------------------------------------------------- decorating
function drawCatalogue(ctx, t) {
  const ids = Object.keys(CATALOGUE);
  const h = 62;
  const y = VIEW_H - h;
  rect(ctx, 0, y, VIEW_W, h, 'rgba(20,15,10,0.88)');
  rect(ctx, 0, y, VIEW_W, 1, PAL.wood3);
  text(ctx, 'FURNISH YOUR LODGE', 6, y + 4, PAL.gold2);
  text(ctx, `COSINESS ${cosiness()}`, VIEW_W - 6, y + 4, PAL.paper, { align: 'right' });

  const size = 30;
  ids.forEach((id, i) => {
    const item = CATALOGUE[id];
    const x = 6 + i * (size + 4);
    const sel = lodge.picked === id;
    const afford = canAfford(item.cost);
    rect(ctx, x, y + 14, size, size, sel ? PAL.gold : PAL.wood1);
    if (hovering(x, y + 14, size, size)) rect(ctx, x, y + 14, size, size, sel ? PAL.gold2 : PAL.wood2);
    const img = S.decorSprite(id);
    const sw = Math.min(img.width, size - 4), sh = Math.min(img.height, size - 4);
    ctx.drawImage(img, 0, Math.max(0, img.height - sh), sw, sh,
                  x + ((size - sw) >> 1), y + 14 + (size - sh), sw, sh);
    if (!afford) { ctx.fillStyle = 'rgba(20,15,10,0.6)'; ctx.fillRect(x, y + 14, size, size); }
    if (hovering(x, y + 14, size, size)) {
      const cost = Object.entries(item.cost).map(([k, v]) => `${v}${k[0].toUpperCase()}`).join(' ');
      const tip = `${item.name}  ${cost}  +${item.cosy}`;
      const tw = textWidth(tip) + 6;
      const tx = Math.max(2, Math.min(VIEW_W - tw - 2, x - 12));
      rect(ctx, tx, y + 3, tw, 9, 'rgba(20,15,10,0.95)');
      text(ctx, tip, tx + 3, y + 4, afford ? PAL.paper : PAL.red2);
      if (input.clicked) lodge.picked = afford ? id : null;
    }
    if (sel) { rect(ctx, x, y + 14 + size, size, 2, PAL.gold2); }
  });

  text(ctx, lodge.picked ? 'NOW CLICK A SPOT IN THE ROOM' : 'PICK SOMETHING, THEN CLICK A SPOT',
       6, y + h - 8, PAL.paper3);
  text(ctx, 'E  DONE', VIEW_W - 6, y + h - 8, PAL.paper3, { align: 'right' });
}

/** Slot highlights and placement, handled while the catalogue is open. */
export function updateDecorating() {
  if (!lodge.decorating) return;
  const overCatalogue = input.my > VIEW_H - 62;
  if (overCatalogue) return;

  for (let i = 0; i < SLOTS.length; i++) {
    const slot = SLOTS[i];
    const w = 34, h = 30;
    const x = slot.x - (w >> 1);
    const y = slot.place === 'floor' ? slot.y - h : slot.y - 4;
    if (!hovering(x, y, w, h)) continue;

    if (input.rightClicked && G.decor[i]) {
      const item = CATALOGUE[G.decor[i]];
      for (const k in item.cost) gain(k, Math.round(item.cost[k] / 2));
      delete G.decor[i];
      toast(`${item.name} taken down.`, 'info');
      return;
    }
    if (input.clicked && lodge.picked) {
      const item = CATALOGUE[lodge.picked];
      if (item.place !== slot.place) { toast(`${item.name} does not go on the ${slot.place}.`, 'warn'); return; }
      if (G.decor[i]) { toast('Something is already there.', 'warn'); return; }
      if (!spend(item.cost)) { toast('Not enough materials.', 'warn'); return; }
      G.decor[i] = lodge.picked;
      toast(`${item.name} put in place.`, 'good');
      return;
    }
  }
}

export function drawSlotHints(ctx, t) {
  if (!lodge.decorating) return;
  for (let i = 0; i < SLOTS.length; i++) {
    const slot = SLOTS[i];
    const filled = !!G.decor[i];
    const ok = lodge.picked && CATALOGUE[lodge.picked].place === slot.place && !filled;
    const w = 34, h = 30;
    const x = slot.x - (w >> 1);
    const y = slot.place === 'floor' ? slot.y - h : slot.y - 4;
    const hot = hovering(x, y, w, h) && input.my < VIEW_H - 62;
    if (filled && !hot) continue;
    ctx.globalAlpha = hot ? 0.85 : 0.4;
    const colour = filled ? PAL.red2 : ok ? PAL.grass4 : PAL.paper3;
    for (let k = 0; k < w; k += 3) { px(ctx, x + k, y, colour); px(ctx, x + k, y + h - 1, colour); }
    for (let k = 0; k < h; k += 3) { px(ctx, x, y + k, colour); px(ctx, x + w - 1, y + k, colour); }
    ctx.globalAlpha = 1;
  }
}
