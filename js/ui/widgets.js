// Immediate-mode pixel widgets. Everything is drawn into the game canvas, so
// the interface is made of the same pixels as the world.

import { PAL, rect, frame, px, text, textWidth } from '../gfx/pixel.js';
import { input } from '../input.js';

export function hovering(x, y, w, h) {
  return input.overCanvas && input.mx >= x && input.my >= y && input.mx < x + w && input.my < y + h;
}

/** A plank panel with a carved border. Returns its inner content box. */
export function panel(ctx, x, y, w, h, title) {
  rect(ctx, x + 2, y + h, w - 4, 2, 'rgba(0,0,0,0.35)');
  rect(ctx, x, y, w, h, PAL.wood1);
  for (let i = 8; i < h - 2; i += 9) rect(ctx, x + 2, y + i, w - 4, 1, PAL.wood0);
  rect(ctx, x + 1, y + 1, w - 2, 1, PAL.wood3);
  frame(ctx, x, y, w, h, PAL.wood0);
  frame(ctx, x + 2, y + 2, w - 4, h - 4, PAL.wood2);
  for (const [nx, ny] of [[x + 4, y + 4], [x + w - 5, y + 4], [x + 4, y + h - 5], [x + w - 5, y + h - 5]]) {
    px(ctx, nx, ny, PAL.stone3); px(ctx, nx, ny + 1, PAL.stone1);
  }
  let top = y + 5;
  if (title) {
    rect(ctx, x + 4, y + 4, w - 8, 11, PAL.wood0);
    text(ctx, title, x + w / 2, y + 6, PAL.gold2, { align: 'center' });
    top = y + 18;
  }
  return { x: x + 6, y: top, w: w - 12, h: h - (top - y) - 6 };
}

/** A pinned paper note - used for lists and contracts. */
export function note(ctx, x, y, w, h, tone = PAL.paper) {
  rect(ctx, x + 1, y + 1, w, h, 'rgba(0,0,0,0.28)');
  rect(ctx, x, y, w, h, tone);
  rect(ctx, x, y, w, 1, PAL.white);
  rect(ctx, x, y + h - 1, w, 1, PAL.paper3);
  px(ctx, x + (w >> 1), y, PAL.red);
  px(ctx, x + (w >> 1), y + 1, PAL.red2);
}

/** A clickable button. Returns true on the frame it is clicked. */
export function button(ctx, x, y, w, h, label, opts = {}) {
  const enabled = opts.enabled !== false;
  const hot = enabled && hovering(x, y, w, h);
  const active = opts.active;
  const base = !enabled ? PAL.stone1 : active ? PAL.gold : hot ? PAL.wood3 : PAL.wood2;
  const lip = !enabled ? PAL.stone0 : active ? PAL.gold2 : PAL.wood1;

  rect(ctx, x, y + h - 1, w, 1, 'rgba(0,0,0,0.3)');
  rect(ctx, x, y, w, h, base);
  rect(ctx, x, y, w, 1, lip);
  frame(ctx, x, y, w, h, PAL.wood0);
  const labelColor = !enabled ? PAL.stone2 : active ? PAL.ink : PAL.paper;
  text(ctx, label, x + w / 2, y + ((h - 7) >> 1), labelColor, { align: 'center' });
  if (hot && enabled) frame(ctx, x - 1, y - 1, w + 2, h + 2, PAL.gold2);
  return hot && enabled && input.clicked;
}

/** A small square icon button. */
export function iconButton(ctx, x, y, size, spriteImg, opts = {}) {
  const enabled = opts.enabled !== false;
  const hot = enabled && hovering(x, y, size, size);
  rect(ctx, x, y, size, size, opts.active ? PAL.gold : hot ? PAL.wood3 : PAL.wood2);
  frame(ctx, x, y, size, size, PAL.wood0);
  if (opts.active) frame(ctx, x, y, size, size, PAL.gold2);
  if (spriteImg) ctx.drawImage(spriteImg, x + ((size - spriteImg.width) >> 1), y + ((size - spriteImg.height) >> 1));
  if (!enabled) { ctx.fillStyle = 'rgba(20,15,10,0.55)'; ctx.fillRect(x, y, size, size); }
  return hot && enabled && input.clicked;
}

export function bar(ctx, x, y, w, h, fraction, fill, back = PAL.wood0) {
  rect(ctx, x, y, w, h, back);
  const f = Math.max(0, Math.min(1, fraction));
  if (f > 0) {
    const fw = Math.max(1, Math.round(w * f));
    rect(ctx, x, y, fw, h, fill);
    rect(ctx, x, y, fw, 1, PAL.white);
  }
  frame(ctx, x, y, w, h, PAL.ink);
}

/** Pip row for skill ranks. */
export function pips(ctx, x, y, filled, total, color = PAL.gold2) {
  for (let i = 0; i < total; i++) {
    const cx = x + i * 4;
    if (i < filled) { rect(ctx, cx, y, 3, 3, color); px(ctx, cx, y, PAL.white); }
    else frame(ctx, cx, y, 3, 3, PAL.wood0);
  }
  return total * 4;
}

/** The floating key prompt shown beside anything you can interact with. */
export function keyPrompt(ctx, x, y, key, label, bob = 0) {
  const w = 11;
  const yy = Math.round(y + Math.sin(bob * 3) * 1.2);
  rect(ctx, x - (w >> 1), yy, w, 11, PAL.paper);
  frame(ctx, x - (w >> 1), yy, w, 11, PAL.ink);
  rect(ctx, x - (w >> 1) + 1, yy + 1, w - 2, 1, PAL.white);
  text(ctx, key, x - 2, yy + 2, PAL.ink);
  if (label) {
    const lw = textWidth(label) + 6;
    rect(ctx, x + 8, yy + 1, lw, 9, 'rgba(20,15,10,0.75)');
    text(ctx, label, x + 11, yy + 2, PAL.paper);
  }
}

export function scrim(ctx, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(13,10,9,${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

export function scrollbar(ctx, x, y, h, scroll, contentH, viewH) {
  if (contentH <= viewH) return;
  rect(ctx, x, y, 2, h, PAL.wood0);
  const thumb = Math.max(6, Math.round((viewH / contentH) * h));
  const max = contentH - viewH;
  const pos = Math.round((scroll / max) * (h - thumb));
  rect(ctx, x, y + pos, 2, thumb, PAL.wood3);
}
