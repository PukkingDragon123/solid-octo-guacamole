// On-screen controls for phones and tablets. Each button simply holds down a
// key on the player's behalf, so the rest of the game never needs to know
// whether it is being played with a thumb or a keyboard.

import { VIEW_W, VIEW_H } from '../config.js';
import { G } from '../state.js';
import { PAL, rect, px, disc, text, line } from '../gfx/pixel.js';
import { input, setVirtualKey } from '../input.js';

const R = 15;                    // button radius
const held = new Set();
const wasHeld = new Set();

export const touchUI = { enabled: false, forced: false };

/** Turn the controls on once we have seen a real touch (or a forced override). */
export function detectTouch() {
  if (touchUI.forced) { touchUI.enabled = true; return; }
  if (input.isTouch) touchUI.enabled = true;
  else if (!touchUI.enabled && (('ontouchstart' in window) || navigator.maxTouchPoints > 0)) touchUI.enabled = true;
}

function layout(mode, overlayOpen) {
  const bottom = VIEW_H - R - 8;
  if (overlayOpen) {
    // only a close button while a panel is up; the panel itself is tappable
    return [{ id: 'close', key: 'KeyE', x: VIEW_W - R - 8, y: R + 22, glyph: 'x' }];
  }
  if (mode === 'site') {
    // eight ways to walk, plus the one button that picks up and fits
    return [
      { id: 'left', key: 'ArrowLeft', x: R + 8, y: bottom - R - 4, glyph: 'left' },
      { id: 'right', key: 'ArrowRight', x: R * 3 + 16, y: bottom - R - 4, glyph: 'right' },
      { id: 'up', key: 'ArrowUp', x: R * 2 + 12, y: bottom - R * 2 - 12, glyph: 'up' },
      { id: 'down', key: 'ArrowDown', x: R * 2 + 12, y: bottom + 2, glyph: 'down' },
      { id: 'plan', key: 'KeyB', x: VIEW_W - R * 3 - 16, y: bottom - R - 4, glyph: 'tools' },
      { id: 'use', key: 'KeyE', x: VIEW_W - R - 8, y: bottom - R * 2 - 10, glyph: 'use', big: true },
    ];
  }
  if (mode === 'camp' || mode === 'workshop' || mode === 'forest') {
    return [
      { id: 'left', key: 'ArrowLeft', x: R + 10, y: bottom, glyph: 'left' },
      { id: 'right', key: 'ArrowRight', x: R * 3 + 18, y: bottom, glyph: 'right' },
      { id: 'jump', key: 'Space', x: VIEW_W - R * 3 - 18, y: bottom, glyph: 'jump' },
      { id: 'use', key: 'KeyE', x: VIEW_W - R - 10, y: bottom - R - 6, glyph: 'use', big: true },
    ];
  }
  return [
    { id: 'left', key: 'ArrowLeft', x: R + 8, y: bottom - R - 4, glyph: 'left' },
    { id: 'right', key: 'ArrowRight', x: R * 3 + 16, y: bottom - R - 4, glyph: 'right' },
    { id: 'up', key: 'ArrowUp', x: R * 2 + 12, y: bottom - R * 2 - 12, glyph: 'up' },
    { id: 'down', key: 'ArrowDown', x: R * 2 + 12, y: bottom + 2, glyph: 'down' },
    { id: 'tools', key: 'Tab', x: VIEW_W - R * 3 - 16, y: bottom - R - 4, glyph: 'tools' },
    { id: 'land', key: 'KeyE', x: VIEW_W - R - 8, y: bottom - R * 2 - 10, glyph: 'land', big: true },
  ];
}

let buttons = [];

/** Work out which buttons the fingers are on, and hold those keys down. */
export function updateTouch(mode, overlayOpen) {
  detectTouch();
  if (!touchUI.enabled) return;
  buttons = layout(mode, overlayOpen);

  wasHeld.clear();
  for (const id of held) wasHeld.add(id);
  held.clear();

  let onButton = false;
  for (const [, p] of input.touches) {
    for (const b of buttons) {
      const r = (b.big ? R + 3 : R) + 4;      // a little slop, thumbs are imprecise
      if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= r * r) { held.add(b.id); onButton = true; break; }
    }
  }
  // while a finger is on a button, taps must not also count as map clicks
  input.consumedByButton = onButton;

  for (const b of buttons) {
    const down = held.has(b.id);
    if (b.id === 'use' || b.id === 'land' || b.id === 'close' || b.id === 'tools') {
      // one-shot buttons fire on the press, not for as long as they are held
      if (down && !wasHeld.has(b.id)) setVirtualKey(b.key, true);
      else setVirtualKey(b.key, false);
    } else {
      setVirtualKey(b.key, down);
    }
  }
}

// ------------------------------------------------------------------ drawing
function glyph(ctx, kind, x, y, colour) {
  if (kind === 'left' || kind === 'right') {
    const dir = kind === 'left' ? -1 : 1;
    for (let i = 0; i < 5; i++) rect(ctx, x + dir * (i - 2), y - (4 - i), 1, (4 - i) * 2 + 1, colour);
  } else if (kind === 'up' || kind === 'down') {
    const dir = kind === 'up' ? -1 : 1;
    for (let i = 0; i < 5; i++) rect(ctx, x - (4 - i), y + dir * (i - 2), (4 - i) * 2 + 1, 1, colour);
  } else if (kind === 'jump') {
    for (let i = 0; i < 4; i++) rect(ctx, x - (3 - i), y - 4 + i, (3 - i) * 2 + 1, 1, colour);
    rect(ctx, x - 1, y - 1, 3, 5, colour);
    rect(ctx, x - 4, y + 5, 9, 1, colour);
  } else if (kind === 'use') {
    text(ctx, 'E', x - 2, y - 3, colour);
  } else if (kind === 'close') {
    line(ctx, x - 3, y - 3, x + 3, y + 3, colour);
    line(ctx, x + 3, y - 3, x - 3, y + 3, colour);
  } else if (kind === 'tools') {
    // a little hammer
    line(ctx, x - 3, y + 4, x + 1, y - 1, colour);
    rect(ctx, x - 1, y - 5, 6, 3, colour);
  } else if (kind === 'land') {
    // a bird coming in to land
    rect(ctx, x - 1, y - 1, 3, 3, colour);
    for (let i = 1; i <= 4; i++) {
      px(ctx, x - 1 - i, y - 1 - Math.round(i * 0.6), colour);
      px(ctx, x + 1 + i, y - 1 - Math.round(i * 0.6), colour);
    }
    rect(ctx, x - 4, y + 4, 9, 1, colour);
  }
}

function padButton(ctx, b, t) {
  const down = held.has(b.id);
  const r = b.big ? R + 3 : R;
  const y = b.y + (down ? 1 : 0);

  ctx.globalAlpha = down ? 0.95 : 0.72;
  disc(ctx, b.x, b.y + 2, r, 'rgba(13,10,9,0.55)');          // drop shadow
  disc(ctx, b.x, y, r, PAL.wood0);
  disc(ctx, b.x, y, r - 1, down ? PAL.gold : PAL.wood2);
  disc(ctx, b.x, y - 1, r - 3, down ? PAL.gold2 : PAL.wood3);
  // a highlight arc across the top-left, so it reads as a rounded cap
  for (let a = Math.PI * 0.7; a < Math.PI * 1.5; a += 0.12) {
    px(ctx, Math.round(b.x + Math.cos(a) * (r - 2)), Math.round(y + Math.sin(a) * (r - 2)),
       down ? PAL.white : PAL.wood4);
  }
  glyph(ctx, b.glyph, b.x, y, down ? PAL.ink : PAL.paper);
  ctx.globalAlpha = 1;
}

export function drawTouchControls(ctx, t) {
  if (!touchUI.enabled) return;
  for (const b of buttons) padButton(ctx, b, t);
}

/** Nudge the player to turn the phone round. */
export function drawOrientationHint(ctx) {
  if (!touchUI.enabled) return false;
  if (window.innerWidth >= window.innerHeight) return false;
  rect(ctx, 0, 0, VIEW_W, VIEW_H, PAL.ink);
  const cx = VIEW_W >> 1, cy = (VIEW_H >> 1) - 8;

  // a phone, tipping over onto its side
  const phone = (px0, py0, w, h, tilt) => {
    rect(ctx, px0 - (w >> 1), py0 - (h >> 1), w, h, PAL.wood2);
    rect(ctx, px0 - (w >> 1), py0 - (h >> 1), w, h - 1, PAL.wood1);
    rect(ctx, px0 - (w >> 1) + 3, py0 - (h >> 1) + 5, w - 6, h - 11, PAL.water2);
    rect(ctx, px0 - (w >> 1) + 3, py0 - (h >> 1) + 5, w - 6, 4, PAL.water3);
    rect(ctx, px0 - 4, py0 + (h >> 1) - 4, 8, 2, PAL.wood0);
    rect(ctx, px0 - 3, py0 - (h >> 1) + 2, 6, 1, PAL.wood0);
  };
  phone(cx - 34, cy, 34, 56, 0);          // upright, dimmed
  ctx.globalAlpha = 0.4;
  rect(ctx, cx - 51, cy - 28, 34, 56, PAL.ink);
  ctx.globalAlpha = 1;
  phone(cx + 34, cy, 56, 34, 1);          // sideways, the one you want

  // a curved arrow sweeping between them
  for (let a = -1.15; a < 1.15; a += 0.06) {
    px(ctx, Math.round(cx + Math.sin(a) * 26), Math.round(cy - 34 - Math.cos(a) * 10), PAL.gold2);
  }
  for (let i = 0; i < 5; i++) {
    px(ctx, cx + 22 + i, cy - 40 + i, PAL.gold2);
    px(ctx, cx + 22 + i, cy - 30 - i, PAL.gold2);
  }

  text(ctx, 'TURN YOUR PHONE SIDEWAYS', cx, cy + 44, PAL.paper, { align: 'center' });
  text(ctx, 'DAM IT IS PLAYED IN LANDSCAPE', cx, cy + 56, PAL.gold, { align: 'center' });
  return true;
}
