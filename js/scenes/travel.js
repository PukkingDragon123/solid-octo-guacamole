// The map table and the flight out. Pick a site, and the heron carries you
// there - a held cinematic shot with the valley rolling past underneath.

import { VIEW_W, VIEW_H } from '../config.js';
import { G, toast } from '../state.js';
import { PAL, rect, frame, px, text, disc, line, rngFrom, wrap, bigText } from '../gfx/pixel.js';
import * as S from '../gfx/sprites.js';
import { panel, button, scrim, hovering } from '../ui/widgets.js';
import { input, pressed } from '../input.js';
import { story } from '../story.js';
import { NPCS, NPC_IDS, outstanding } from '../orders.js';
import { sfx } from '../audio.js';

/** Where each site sits on the parchment. */
export const SITE_POS = {
  willow:  { x: 108, y: 158 },
  bramble: { x: 178, y: 96 },
  pip:     { x: 262, y: 130 },
  quill:   { x: 330, y: 78 },
  marsh:   { x: 208, y: 200 },
  juniper: { x: 350, y: 176 },
  cobb:    { x: 396, y: 122 },
};

export const travel = {
  open: false, sel: 0, flying: false, t: 0, dest: null, onArrive: null,
  onPick: null, onCamp: null,
};

export function openMap() {
  travel.open = true;
  travel.sel = 0;
  travel.flying = false;
  sfx.click();
}

export function closeMap() { travel.open = false; }

export function startFlight(npcId, onArrive) {
  travel.flying = true;
  travel.t = 0;
  travel.dest = npcId;
  travel.onArrive = onArrive;
  sfx.wing();
}

export function updateTravel(dt) {
  if (!travel.flying) return;
  travel.t += dt;
  if (Math.random() < dt * 1.4) sfx.wing();
  if (travel.t > 4.6) {
    travel.flying = false;
    travel.open = false;
    const done = travel.onArrive;
    travel.onArrive = null;
    if (done) done(travel.dest);
  }
}

/** Sites you may fly to: unlocked, and with a job worth going out for. */
export function flyable() {
  const s = story();
  return NPC_IDS.filter((id) => s.unlocked[id] && SITE_POS[id]);
}

// -------------------------------------------------------------------- draw
function parchment(ctx, box, t) {
  rect(ctx, box.x, box.y, box.w, box.h, '#e2cb9c');
  // stains and fibres, so it reads as paper and not a beige rectangle
  const rng = rngFrom(4242);
  for (let i = 0; i < 300; i++) {
    const px0 = box.x + rng() * box.w, py = box.y + rng() * box.h;
    px(ctx, Math.round(px0), Math.round(py), rng() > 0.6 ? '#d8bf8c' : '#ecd9ae');
  }
  ctx.globalAlpha = 0.25;
  for (const [cx, cy, r] of [[box.x + 40, box.y + 30, 16], [box.x + box.w - 50, box.y + box.h - 26, 20]]) {
    disc(ctx, cx, cy, r, '#c9ab77');
  }
  ctx.globalAlpha = 1;
  frame(ctx, box.x, box.y, box.w, box.h, '#a8875a');

  // the river, drawn as a hand-inked meander with the pond partway down
  let rx = box.x + 60;
  for (let y = box.y + 6; y < box.y + box.h - 6; y += 2) {
    rx += Math.sin(y * 0.09) * 3.2;
    rect(ctx, Math.round(rx), y, 3, 2, '#7fa8c4');
    px(ctx, Math.round(rx) + 3, y, '#a9dcf5');
  }
  disc(ctx, box.x + 96, box.y + 118, 20, '#7fa8c4');
  disc(ctx, box.x + 96, box.y + 118, 16, '#a9dcf5');
  // woods, hills, marks of a map that has been used
  const wood = rngFrom(99);
  for (let i = 0; i < 60; i++) {
    const wx = box.x + 20 + wood() * (box.w - 40);
    const wy = box.y + 14 + wood() * (box.h - 28);
    for (let k = 0; k < 4; k++) px(ctx, Math.round(wx), Math.round(wy - k), '#5f7d4e');
    px(ctx, Math.round(wx) - 1, Math.round(wy - 1), '#5f7d4e');
    px(ctx, Math.round(wx) + 1, Math.round(wy - 1), '#5f7d4e');
  }
  for (let i = 0; i < 7; i++) {
    const hx = box.x + 30 + i * 60, hy = box.y + 40 + (i % 3) * 50;
    for (let k = 0; k < 8; k++) {
      rect(ctx, Math.round(hx - 8 + k), Math.round(hy - k / 2), Math.round(16 - k * 2), 1, '#b09468');
    }
  }
  // home, top left, with a compass rose opposite
  rect(ctx, box.x + 22, box.y + 26, 16, 12, PAL.wood1);
  rect(ctx, box.x + 20, box.y + 20, 20, 7, PAL.red);
  text(ctx, 'HOME', box.x + 30, box.y + 40, PAL.ink2, { align: 'center' });
  const cx = box.x + box.w - 30, cy = box.y + 28;
  for (let i = 0; i < 8; i++) line(ctx, cx, cy, cx + Math.round(Math.cos(i * 0.785) * 9), cy + Math.round(Math.sin(i * 0.785) * 9), '#a8875a');
  text(ctx, 'N', cx, cy - 17, PAL.ink2, { align: 'center' });
}

export function drawMap(ctx, t) {
  const s = story();
  scrim(ctx, VIEW_W, VIEW_H, 0.7);
  const box = panel(ctx, 14, 16, VIEW_W - 28, 238, 'THE VALLEY');
  const map = { x: box.x, y: box.y, w: box.w - 116, h: box.h - 4 };
  parchment(ctx, map, t);

  const sites = flyable();
  if (travel.sel >= sites.length) travel.sel = 0;

  // ---- pins
  sites.forEach((id, i) => {
    const p = SITE_POS[id];
    const npc = NPCS[id];
    const mx = map.x + p.x * (map.w / 480);
    const my = map.y + p.y * (map.h / 240);
    const order = s.orders.find((o) => o.npc === id);
    const sel = i === travel.sel;
    const hot = hovering(mx - 8, my - 8, 16, 16);
    if (hot && input.clicked) { travel.sel = i; sfx.click(); }
    if (hot) travel.sel = i;
    // pin, with a paper flag on jobs that are ready to fit
    line(ctx, mx, my, mx, my - 10, PAL.ink2);
    disc(ctx, mx, my, sel ? 4 : 3, order ? PAL.red2 : PAL.stone2);
    if (sel) {
      for (let a = 0; a < 8; a++) {
        px(ctx, Math.round(mx + Math.cos(a * 0.785) * (7 + Math.sin(t * 6))), Math.round(my + Math.sin(a * 0.785) * (7 + Math.sin(t * 6))), PAL.gold2);
      }
    }
    if (order) {
      const ready = outstanding(order).length === 0;
      rect(ctx, mx + 1, my - 14, 9, 7, ready ? PAL.grass3 : PAL.paper);
      if (!ready) px(ctx, mx + 5, my - 11, PAL.red);
    }
    text(ctx, npc.site.toUpperCase(), mx, my + 6, sel ? PAL.ink : PAL.ink2, { align: 'center' });
  });

  // ---- the panel on the right: who lives there and what they want
  const side = { x: map.x + map.w + 6, y: map.y, w: 104, h: map.h };
  rect(ctx, side.x, side.y, side.w, side.h, PAL.wood0);
  frame(ctx, side.x, side.y, side.w, side.h, PAL.wood2);
  const id = sites[travel.sel];
  if (!id) {
    text(ctx, 'NO SITES YET', side.x + side.w / 2, side.y + 20, PAL.paper3, { align: 'center' });
  } else {
    const npc = NPCS[id];
    const order = s.orders.find((o) => o.npc === id);
    text(ctx, npc.name.toUpperCase(), side.x + side.w / 2, side.y + 4, PAL.gold2, { align: 'center' });
    text(ctx, npc.job.toUpperCase(), side.x + side.w / 2, side.y + 14, PAL.paper3, { align: 'center' });
    disc(ctx, side.x + side.w / 2, side.y + 34, 9, npc.tone);
    disc(ctx, side.x + side.w / 2 - 2, side.y + 32, 6, PAL.fur4);
    px(ctx, side.x + side.w / 2 - 3, side.y + 32, PAL.ink);
    let cy = side.y + 48;
    if (order) {
      const need = outstanding(order);
      text(ctx, 'WANTS', side.x + 5, cy, PAL.paper); cy += 10;
      order.wants.forEach((w) => {
        const built = !need.includes(w);
        text(ctx, `${built ? '*' : '-'} ${w.toUpperCase()}`, side.x + 5, cy, built ? PAL.grass4 : PAL.paper3);
        cy += 8;
      });
      if (order.repair) { text(ctx, '- REPAIR JOB', side.x + 5, cy, PAL.purple2); cy += 8; }
      text(ctx, `${order.pay} ACORNS`, side.x + 5, cy + 4, PAL.gold2);
      cy += 18;
      const ready = need.length === 0;
      if (button(ctx, side.x + 6, side.y + side.h - 30, side.w - 12, 14, ready ? 'FLY OUT' : 'GO ANYWAY')) {
        startFlight(id, travel.onPick);
      }
      if (!ready) text(ctx, 'STILL BUILDING', side.x + side.w / 2, side.y + side.h - 40, PAL.red2, { align: 'center' });
    } else {
      wrap('No job on the books here just now.', side.w - 10).forEach((ln, i) =>
        text(ctx, ln, side.x + 5, cy + i * 8, PAL.paper3));
      if (button(ctx, side.x + 6, side.y + side.h - 30, side.w - 12, 14, 'VISIT')) {
        startFlight(id, travel.onPick);
      }
    }
  }

  // the old dam crew is still out there, and this is the way back to them
  if (button(ctx, map.x + 4, map.y + map.h - 16, 96, 13, 'THE DAM CAMP')) {
    if (travel.onCamp) travel.onCamp();
  }
  text(ctx, 'CLICK A PIN   ENTER FLY   E CLOSE', VIEW_W / 2, VIEW_H - 10, PAL.paper3, { align: 'center' });
  if (pressed('Enter') && sites[travel.sel]) startFlight(sites[travel.sel], travel.onPick);
  if (pressed('KeyE', 'Escape')) { closeMap(); return false; }
  if (pressed('ArrowRight', 'KeyD')) travel.sel = (travel.sel + 1) % Math.max(1, sites.length);
  if (pressed('ArrowLeft', 'KeyA')) travel.sel = (travel.sel - 1 + sites.length) % Math.max(1, sites.length);
  return true;
}

/** The flight: a long lateral shot, everything below on parallax. */
export function drawFlight(ctx, t) {
  const u = Math.min(1, travel.t / 4.6);
  const scroll = travel.t * 150;

  // sky
  const bands = ['#4f83c4', '#7fb6e6', '#a9dcf5', '#d6f0fb'];
  bands.forEach((c, i) => rect(ctx, 0, i * 40, VIEW_W, 40, c));
  rect(ctx, 0, 160, VIEW_W, VIEW_H - 160, '#5f8a52');

  // clouds streaming past
  for (let i = 0; i < 8; i++) {
    const img = S.cloudSprite(i % 2);
    const cx = ((i * 90 - scroll * 0.55) % (VIEW_W + 120)) - 60;
    ctx.drawImage(img, Math.round(cx < -60 ? cx + VIEW_W + 120 : cx), 20 + (i * 17) % 60);
  }
  // ridges
  for (let layer = 0; layer < 3; layer++) {
    const tone = ['#7f9ab0', '#6b8a62', '#4f7355'][layer];
    const par = 0.2 + layer * 0.25;
    const yb = 150 + layer * 16;
    for (let x = 0; x < VIEW_W; x++) {
      const wx = x + scroll * par;
      const h = Math.sin(wx * 0.012) * 14 + Math.sin(wx * 0.031) * 7;
      rect(ctx, x, Math.round(yb + h), 1, VIEW_H, tone);
    }
  }
  // the river below, and the trees rushing under you
  for (let x = 0; x < VIEW_W; x++) {
    const wx = x + scroll * 0.85;
    const y = 214 + Math.sin(wx * 0.02) * 10;
    rect(ctx, x, Math.round(y), 1, 12, '#2f83b8');
    px(ctx, x, Math.round(y), '#8fd6f0');
  }
  for (let i = 0; i < 26; i++) {
    const wx = (i * 73 - scroll * 0.95) % (VIEW_W + 60);
    const sx = wx < 0 ? wx + VIEW_W + 60 : wx;
    const img = S.bgTreeSprite(i % 2, true);
    ctx.drawImage(img, Math.round(sx) - 30, 186 + (i % 3) * 10);
  }

  // heron and rider, dead centre, rising and falling on the wind
  const bob = Math.sin(travel.t * 3.4) * 5;
  const rise = u < 0.18 ? (1 - u / 0.18) * 40 : u > 0.82 ? ((u - 0.82) / 0.18) * 50 : 0;
  const hy = 96 + bob + rise;
  const heron = S.birdSprite(Math.floor(travel.t * 8) % 4, true);
  ctx.drawImage(heron, (VIEW_W >> 1) - (heron.width >> 1), Math.round(hy));
  ctx.globalAlpha = 0.25;
  disc(ctx, VIEW_W >> 1, 236, 12, PAL.black);
  ctx.globalAlpha = 1;

  // letterbox and captions
  rect(ctx, 0, 0, VIEW_W, 18, PAL.black);
  rect(ctx, 0, VIEW_H - 18, VIEW_W, 18, PAL.black);
  const npc = NPCS[travel.dest];
  if (npc) {
    text(ctx, `TO ${npc.site.toUpperCase()}`, VIEW_W / 2, VIEW_H - 13, PAL.gold2, { align: 'center' });
    if (u < 0.5) text(ctx, 'ERROL THE HERON, OBLIGING AS EVER', VIEW_W / 2, 6, PAL.paper3, { align: 'center' });
    else text(ctx, `${npc.name.toUpperCase()} - ${npc.job.toUpperCase()}`, VIEW_W / 2, 6, PAL.paper, { align: 'center' });
  }
  if (u > 0.9) {
    ctx.globalAlpha = (u - 0.9) / 0.1;
    rect(ctx, 0, 0, VIEW_W, VIEW_H, PAL.black);
    ctx.globalAlpha = 1;
  }
  if (pressed('Enter', 'Space', 'Escape')) travel.t = 4.6;
}
