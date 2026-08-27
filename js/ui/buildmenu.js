// The cut list pinned over the assembly bench: what the customers are waiting
// for, what it takes, and whether you can start it right now.

import { VIEW_W, VIEW_H } from '../config.js';
import { PAL, rect, frame, px, text, wrap } from '../gfx/pixel.js';
import { panel, button, scrim, note, hovering } from './widgets.js';
import { input, pressed } from '../input.js';
import { story, haveMaterials, missingMaterials, MATERIALS } from '../story.js';
import { FURNITURE, FURNITURE_IDS, NPCS, outstanding } from '../orders.js';
import { drawFurniture } from '../gfx/furniture.js';

export const buildMenu = { open: false, sel: 0, tab: 'orders' };

export function openBuildMenu() { buildMenu.open = true; buildMenu.sel = 0; }
export function closeBuildMenu() { buildMenu.open = false; }

/** Everything an open order still needs, newest last. */
function wanted() {
  const s = story();
  const out = [];
  for (const order of s.orders) {
    for (const id of outstanding(order)) out.push({ id, order });
  }
  return out;
}

/**
 * Returns the furniture id to start building, or null. `false` means the player
 * closed the list.
 */
export function drawBuildMenu(ctx, t) {
  const s = story();
  scrim(ctx, VIEW_W, VIEW_H, 0.7);
  const box = panel(ctx, 30, 24, VIEW_W - 60, 222, 'THE CUT LIST');

  const jobs = wanted();
  const list = buildMenu.tab === 'orders' ? jobs : FURNITURE_IDS.map((id) => ({ id, order: null }));
  if (buildMenu.sel >= list.length) buildMenu.sel = Math.max(0, list.length - 1);

  // tabs
  ['orders', 'all'].forEach((tab, i) => {
    const bx = box.x + i * 74;
    const on = buildMenu.tab === tab;
    if (button(ctx, bx, box.y, 70, 13, tab === 'orders' ? `ORDERS ${jobs.length}` : 'ANYTHING', { active: on })) {
      buildMenu.tab = tab;
      buildMenu.sel = 0;
    }
  });

  if (!list.length) {
    text(ctx, 'NOTHING ON ORDER.', box.x + box.w / 2, box.y + 60, PAL.paper3, { align: 'center' });
    text(ctx, 'ANSWER THE PHONE, OR BUILD ON SPEC.', box.x + box.w / 2, box.y + 74, PAL.paper3, { align: 'center' });
  }

  // ---- the list, left
  const rowH = 20;
  const rows = Math.min(list.length, 8);
  for (let i = 0; i < rows; i++) {
    const entry = list[i];
    const bp = FURNITURE[entry.id];
    const y = box.y + 18 + i * rowH;
    const on = i === buildMenu.sel;
    const can = haveMaterials(bp.mats);
    rect(ctx, box.x, y, 176, rowH - 2, on ? PAL.wood3 : PAL.wood1);
    if (on) frame(ctx, box.x, y, 176, rowH - 2, PAL.gold2);
    text(ctx, bp.name.toUpperCase(), box.x + 4, y + 2, can ? PAL.paper : PAL.paper3);
    if (entry.order) {
      const npc = NPCS[entry.order.npc];
      text(ctx, `FOR ${npc.name.toUpperCase()}`, box.x + 4, y + 11, npc.tone);
    } else {
      text(ctx, `${bp.pay} ACORNS`, box.x + 4, y + 11, PAL.gold2);
    }
    text(ctx, can ? 'READY' : 'SHORT', box.x + 172, y + 6, can ? PAL.grass4 : PAL.red2, { align: 'right' });
    if (hovering(box.x, y, 176, rowH - 2)) {
      buildMenu.sel = i;
      if (input.clicked) return startIfPossible(list[i].id);
    }
  }

  // ---- the detail panel, right
  const entry = list[buildMenu.sel];
  if (entry) {
    const bp = FURNITURE[entry.id];
    const dx = box.x + 186, dw = box.w - 186;
    rect(ctx, dx, box.y + 18, dw, 160, PAL.wood0);
    frame(ctx, dx, box.y + 18, dw, 160, PAL.wood2);
    text(ctx, bp.name.toUpperCase(), dx + dw / 2, box.y + 22, PAL.gold2, { align: 'center' });
    // the piece itself, drawn big
    drawFurniture(ctx, entry.id, dx + dw / 2, box.y + 104, { scale: 1 });
    let cy = box.y + 112;
    text(ctx, 'TAKES', dx + 6, cy, PAL.paper);
    cy += 10;
    for (const k in bp.mats) {
      const have = (story().materials[k] || 0);
      const enough = have >= bp.mats[k];
      text(ctx, `${bp.mats[k]} ${(MATERIALS[k] ? MATERIALS[k].name : k).toUpperCase()}`, dx + 8, cy,
           enough ? PAL.paper : PAL.red2);
      text(ctx, `HAVE ${have}`, dx + dw - 6, cy, enough ? PAL.grass4 : PAL.red2, { align: 'right' });
      cy += 9;
    }
    text(ctx, `${bp.parts.length} PARTS   ${bp.screws} SCREWS`, dx + 6, cy + 2, PAL.paper3);
    const can = haveMaterials(bp.mats);
    if (!can) {
      wrap(`Short of ${missingMaterials(bp.mats)}.`, dw - 12).forEach((ln, i) =>
        text(ctx, ln, dx + 6, cy + 14 + i * 9, PAL.red2));
    }
    if (button(ctx, dx + (dw >> 1) - 42, box.y + 162, 84, 14, 'BUILD IT', { enabled: can })) {
      return startIfPossible(entry.id);
    }
  }

  text(ctx, 'W / S CHOOSE   ENTER BUILD   E CLOSE', VIEW_W / 2, VIEW_H - 12, PAL.paper3, { align: 'center' });
  if (pressed('KeyW', 'ArrowUp')) buildMenu.sel = Math.max(0, buildMenu.sel - 1);
  if (pressed('KeyS', 'ArrowDown')) buildMenu.sel = Math.min(list.length - 1, buildMenu.sel + 1);
  if (pressed('Enter') && entry) return startIfPossible(entry.id);
  if (pressed('KeyE', 'Escape')) { closeBuildMenu(); return false; }
  return null;
}

function startIfPossible(id) {
  const bp = FURNITURE[id];
  if (!haveMaterials(bp.mats)) return null;
  closeBuildMenu();
  return id;
}
