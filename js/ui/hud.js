// The whole heads-up display: a resource strip, a day chip, toasts, and the
// build hotbar while you are flying. Deliberately small - the rest of the
// interface lives on things you walk up to.

import { VIEW_W, VIEW_H, BLUEPRINTS, MAX_WATER_LEVEL } from '../config.js';
import { G } from '../state.js';
import { PAL, rect, frame, px, text, textWidth } from '../gfx/pixel.js';
import * as S from '../gfx/sprites.js';
import { iconButton, hovering } from './widgets.js';
import { input } from '../input.js';
import { blueprintSprite } from '../scenes/valley.js';
import { skyPhase } from '../scenes/camp.js';

export const HOTBAR = [
  'dam', 'sapling', 'sunberry', 'dewberry', 'goldberry',
  'clover', 'bluebell', 'sunflower', 'reed',
];
export const HABITATS = [
  'duck_nest', 'frog_log', 'rabbit_burrow', 'hedgehog_hut',
  'bird_house', 'otter_holt', 'turtle_bask', 'lodge', 'shed',
];

function costText(bp) {
  return Object.entries(bp.cost).map(([k, v]) => `${v}${k === 'wood' ? 'W' : k === 'seeds' ? 'S' : 'B'}`).join(' ');
}

export function drawResourceStrip(ctx) {
  const items = [
    ['wood', Math.floor(G.resources.wood), G.caps.wood],
    ['berry', Math.floor(G.resources.berries), G.caps.berries],
    ['seed', G.resources.seeds, G.caps.seeds],
    ['heart', G.resources.hearts, null],
  ];
  let x = 4;
  const y = 4;
  const w = 4 + items.length * 32;
  rect(ctx, x, y, w, 13, 'rgba(20,15,10,0.72)');
  frame(ctx, x, y, w, 13, PAL.wood0);
  x += 3;
  for (const [name, value, cap] of items) {
    ctx.drawImage(S.icon(name), x, y + 2);
    const full = cap !== null && value >= cap;
    text(ctx, String(value), x + 10, y + 3, full ? PAL.gold2 : PAL.paper);
    x += 32;
  }
}

export function drawDayChip(ctx) {
  const phase = skyPhase(G.dayT);
  const label = `D${G.day}`;
  const w = textWidth(label) + 16;
  const x = VIEW_W - w - 4;
  rect(ctx, x, 4, w, 13, 'rgba(20,15,10,0.72)');
  frame(ctx, x, 4, w, 13, PAL.wood0);
  ctx.drawImage(S.icon('clock'), x + 3, 6);
  text(ctx, label, x + 13, 7, phase === 'night' ? PAL.sky3 : PAL.paper);

  // water level pips, only once there is something to say
  if (G.waterLevel > 0 || G.riverBlocked) {
    const pw = 10 + MAX_WATER_LEVEL * 5;
    const px2 = VIEW_W - pw - 4;
    rect(ctx, px2, 19, pw, 11, 'rgba(20,15,10,0.72)');
    frame(ctx, px2, 19, pw, 11, PAL.wood0);
    ctx.drawImage(S.icon('drop'), px2 + 1, 20);
    for (let i = 0; i < MAX_WATER_LEVEL; i++) {
      rect(ctx, px2 + 10 + i * 5, 22, 4, 5, i < G.waterLevel ? PAL.water4 : PAL.wood0);
    }
  }
}

export function drawToasts(ctx, dt, bottomGap = 16) {
  for (const t of G.toasts) t.t += dt;
  while (G.toasts.length && G.toasts[0].t > G.toasts[0].life) G.toasts.shift();
  const shown = G.toasts.slice(-3);
  const maxChars = Math.floor((VIEW_W - 30) / 6);
  let y = VIEW_H - bottomGap - shown.length * 13;
  for (const toast of shown) {
    const fade = Math.min(1, (toast.life - toast.t) * 2);
    const body = toast.repeat > 1 ? `${toast.text} x${toast.repeat}` : toast.text;
    const lines = body.length > maxChars ? `${body.slice(0, maxChars - 1)}.` : body;
    const w = Math.min(VIEW_W - 12, textWidth(lines) + 10);
    ctx.globalAlpha = Math.max(0, fade);
    rect(ctx, 5, y, w, 11, 'rgba(20,15,10,0.8)');
    const tone = toast.tone === 'good' ? PAL.grass4 : toast.tone === 'bad' ? PAL.red2
      : toast.tone === 'warn' ? PAL.gold2 : toast.tone === 'quest' ? PAL.purple2 : PAL.paper;
    rect(ctx, 5, y, 2, 11, tone);
    text(ctx, lines, 10, y + 2, PAL.paper);
    ctx.globalAlpha = 1;
    y += 13;
  }
}

/** The tool belt: everything you can place, only while airborne. */
export function drawHotbar(ctx, t) {
  const slots = G.ui.hotbarPage === 1 ? HABITATS : HOTBAR;
  const size = 20;
  const w = slots.length * size + 4;
  const x = Math.round((VIEW_W - w) / 2);
  const y = VIEW_H - size - 6;

  rect(ctx, x - 2, y - 12, w + 4, size + 14, 'rgba(20,15,10,0.8)');
  frame(ctx, x - 2, y - 12, w + 4, size + 14, PAL.wood0);
  rect(ctx, x - 1, y - 11, w + 2, 1, PAL.wood2);

  // page toggle
  const pageLabel = G.ui.hotbarPage === 1 ? 'HABITATS' : 'GROUNDWORK';
  text(ctx, `TAB  ${pageLabel}`, x + 2, y - 10, PAL.gold2);

  let clicked = null;
  slots.forEach((id, i) => {
    const bp = BLUEPRINTS[id];
    const sx = x + 2 + i * size;
    const active = G.ui.build === id;
    const afford = Object.entries(bp.cost).every(([k, v]) => G.resources[k] >= v);
    const img = blueprintSprite(id);
    // shrink oversized sprites into the slot
    rect(ctx, sx, y, size - 2, size - 2, active ? PAL.gold : PAL.wood1);
    frame(ctx, sx, y, size - 2, size - 2, PAL.wood0);
    const sw = Math.min(img.width, size - 4), sh = Math.min(img.height, size - 4);
    ctx.drawImage(img, 0, Math.max(0, img.height - sh), sw, sh,
                  sx + ((size - 2 - sw) >> 1), y + (size - 2 - sh), sw, sh);
    if (!afford) { ctx.fillStyle = 'rgba(20,15,10,0.55)'; ctx.fillRect(sx, y, size - 2, size - 2); }
    text(ctx, String(i + 1), sx + 1, y + 1, active ? PAL.ink : PAL.paper3);
    if (hovering(sx, y, size - 2, size - 2)) {
      frame(ctx, sx - 1, y - 1, size, size, PAL.gold2);
      const tip = `${bp.name}  ${costText(bp)}`;
      const tw = textWidth(tip) + 6;
      const tx = Math.max(2, Math.min(VIEW_W - tw - 2, sx - (tw >> 1)));
      rect(ctx, tx, y - 24, tw, 10, 'rgba(20,15,10,0.9)');
      frame(ctx, tx, y - 24, tw, 10, PAL.wood0);
      text(ctx, tip, tx + 3, y - 22, afford ? PAL.paper : PAL.red2);
      if (input.clicked) clicked = id;
    }
  });
  return clicked;
}

/** One-line hint at the bottom of the screen. */
export function drawHint(ctx, str, tone = PAL.paper) {
  const w = textWidth(str) + 8;
  const x = VIEW_W - w - 4;
  const y = VIEW_H - 12;
  rect(ctx, x, y, w, 10, 'rgba(20,15,10,0.7)');
  text(ctx, str, x + 4, y + 2, tone);
}
