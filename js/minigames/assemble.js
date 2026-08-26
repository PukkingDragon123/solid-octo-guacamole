// The assembly bench. Three things happen here, in order, and you do all of
// them by hand: strip the screws out of the flat-pack, fit the parts, then
// drive the fixings home without over-tightening and splitting the wood.

import { VIEW_W, VIEW_H } from '../config.js';
import { PAL, rect, frame, px, text, disc, line, ring } from '../gfx/pixel.js';
import { panel, button, scrim, bar } from '../ui/widgets.js';
import { input, pressed, held } from '../input.js';
import { story, haveMaterials, takeMaterials, missingMaterials } from '../story.js';
import { FURNITURE, creditBuild } from '../orders.js';
import { screwWindow, partsSkipped } from '../shop.js';
import { sfx } from '../audio.js';
import { toast } from '../state.js';
import { drawFurniture } from '../gfx/furniture.js';

export const asm = {
  active: false, item: null, phase: 'strip', t: 0,
  crateScrews: [], turning: -1, turn: 0,
  parts: [], partIndex: 0, slotWobble: 0, carry: null, grabbed: false,
  screws: [], screwIndex: 0, torque: 0, driving: false, split: 0,
  quality: 0, finished: false, marks: [],
};

export function canAssemble(id) {
  const bp = FURNITURE[id];
  return bp ? haveMaterials(bp.mats) : false;
}

export function openAssemble(id) {
  const bp = FURNITURE[id];
  if (!bp) return false;
  if (!haveMaterials(bp.mats)) {
    toast(`SHORT OF ${missingMaterials(bp.mats).toUpperCase()}`, 'warn');
    return false;
  }
  takeMaterials(bp.mats);
  const skip = partsSkipped();
  const parts = bp.parts.slice(0, Math.max(2, bp.parts.length - skip)).map((name, i) => ({
    name, fitted: false, score: 0,
    // where the part has to end up on the bench, laid out along the piece
    tx: 132 + (i % 3) * 74, ty: 118 + Math.floor(i / 3) * 46,
  }));
  const crateScrews = [];
  for (let i = 0; i < 3; i++) crateScrews.push({ x: 128 + i * 96, y: 96 + (i % 2) * 74, out: 0 });
  const screws = [];
  for (let i = 0; i < bp.screws; i++) screws.push({ score: 0, done: false });
  Object.assign(asm, {
    active: true, item: id, phase: 'strip', t: 0,
    crateScrews, turning: -1, turn: 0,
    parts, partIndex: 0, slotWobble: 0, carry: null, grabbed: false,
    screws, screwIndex: 0, torque: 0, driving: false, split: 0,
    quality: 0, finished: false, marks: [],
  });
  return true;
}

export function closeAssemble() { asm.active = false; }

export function updateAssemble(dt) {
  if (!asm.active || asm.finished) return;
  asm.t += dt;
  if (asm.split > 0) asm.split = Math.max(0, asm.split - dt);

  if (asm.phase === 'strip') {
    // hold on a screw and it backs out, a quarter turn at a time
    const holding = input.down || held('Space', 'KeyE');
    let target = -1;
    for (let i = 0; i < asm.crateScrews.length; i++) {
      const s = asm.crateScrews[i];
      if (s.out >= 1) continue;
      const near = Math.abs(input.mx - s.x) < 16 && Math.abs(input.my - s.y) < 16;
      if (near || (!input.isTouch && asm.turning === i)) { target = i; break; }
    }
    if (target < 0 && asm.crateScrews.some((s) => s.out < 1) && (held('Space', 'KeyE'))) {
      target = asm.crateScrews.findIndex((s) => s.out < 1);   // keyboard players get the next one
    }
    asm.turning = holding ? target : -1;
    if (asm.turning >= 0) {
      const s = asm.crateScrews[asm.turning];
      s.out = Math.min(1, s.out + dt * 0.85);
      asm.turn += dt * 7;
      if (Math.random() < dt * 8) sfx.screw();
      if (s.out >= 1) sfx.click();
    }
    if (asm.crateScrews.every((s) => s.out >= 1)) { asm.phase = 'fit'; sfx.thunk(); }
  } else if (asm.phase === 'fit') {
    // the part swings on its own; drop it when it lines up with the socket
    asm.slotWobble += dt;
    if (pressed('Space', 'KeyE') || input.clicked) dropPart();
  } else if (asm.phase === 'screw') {
    const holding = input.down || held('Space', 'KeyE');
    if (holding) {
      asm.driving = true;
      asm.torque += dt * 0.62;
      if (Math.random() < dt * 14) sfx.screw();
      if (asm.torque > 1.35) {   // gone too far - the wood splits
        landScrew(0);
        asm.split = 0.5;
        sfx.bad();
      }
    } else if (asm.driving) {
      asm.driving = false;
      const t = asm.torque;
      const win = 0.16 * screwWindow();
      const score = Math.abs(t - 0.85) < win * 0.4 ? 1 : Math.abs(t - 0.85) < win ? 0.6 : t > 0.4 ? 0.25 : 0;
      landScrew(score);
      if (score >= 1) sfx.good(); else if (score > 0) sfx.click(); else sfx.bad();
    }
  }
}

function dropPart() {
  const part = asm.parts[asm.partIndex];
  if (!part) return;
  const swing = Math.sin(asm.slotWobble * 2.1) * 46;
  const off = Math.abs(swing);
  const score = off < 3 ? 1 : off < 10 ? 0.7 : off < 22 ? 0.35 : 0;
  part.fitted = true;
  part.score = score;
  asm.partIndex++;
  if (score >= 1) sfx.good(); else if (score) sfx.thunk(); else sfx.bad();
  if (asm.partIndex >= asm.parts.length) { asm.phase = 'screw'; asm.torque = 0; }
}

function landScrew(score) {
  const s = asm.screws[asm.screwIndex];
  if (!s) return;
  s.done = true;
  s.score = score;
  asm.screwIndex++;
  asm.torque = 0;
  if (asm.screwIndex >= asm.screws.length) finish();
}

function finish() {
  const partScore = asm.parts.reduce((sum, p) => sum + p.score, 0) / Math.max(1, asm.parts.length);
  const screwScore = asm.screws.reduce((sum, s) => sum + s.score, 0) / Math.max(1, asm.screws.length);
  const quality = Math.max(0.05, Math.min(1, partScore * 0.45 + screwScore * 0.55));
  asm.quality = quality;
  asm.finished = true;
  creditBuild(asm.item, quality);
  if (quality > 0.92) story().stats.perfect++;
  toast(`${FURNITURE[asm.item].name.toUpperCase()} FINISHED - ${Math.round(quality * 100)}%`,
        quality > 0.6 ? 'good' : 'info');
  sfx.cash();
}

// -------------------------------------------------------------------- draw
/** A screw head, seen from above, turned to whatever angle it is at. */
function screwHead(ctx, x, y, r, angle, out) {
  disc(ctx, x, y + (out > 0 ? -Math.round(out * 5) : 0), r, PAL.stone2);
  disc(ctx, x, y + (out > 0 ? -Math.round(out * 5) : 0), r - 1, PAL.stone3);
  const yy = y + (out > 0 ? -Math.round(out * 5) : 0);
  const dx = Math.round(Math.cos(angle) * (r - 1));
  const dy = Math.round(Math.sin(angle) * (r - 1));
  line(ctx, x - dx, yy - dy, x + dx, yy + dy, PAL.stone0);
  line(ctx, x + dy, yy - dx, x - dy, yy + dx, PAL.stone0);
  if (out > 0) {
    // the thread, standing proud of the timber
    for (let i = 0; i < Math.round(out * 6); i++) rect(ctx, x - 1, yy + r + i, 3, 1, i % 2 ? PAL.stone1 : PAL.stone2);
  }
}

export function drawAssemble(ctx, t) {
  scrim(ctx, VIEW_W, VIEW_H, 0.74);
  const bp = FURNITURE[asm.item] || { name: 'PIECE', parts: [] };
  const titles = { strip: 'UNPACK IT', fit: 'FIT THE PARTS', screw: 'DRIVE THE SCREWS' };
  const box = panel(ctx, 20, 26, VIEW_W - 40, 220, `${bp.name} - ${titles[asm.phase] || ''}`);

  // the bench, lit from the left
  rect(ctx, box.x, 176, box.w, 46, PAL.wood2);
  rect(ctx, box.x, 176, box.w, 3, PAL.wood3);
  for (let x = 0; x < box.w; x += 5) px(ctx, box.x + x, 190 + (x % 3), PAL.wood1);
  rect(ctx, box.x, 218, box.w, 4, PAL.wood0);

  if (asm.phase === 'strip') {
    // the flat-pack crate, screwed shut
    rect(ctx, 108, 74, 264, 100, PAL.wood1);
    rect(ctx, 108, 74, 264, 4, PAL.wood3);
    frame(ctx, 108, 74, 264, 100, PAL.wood0);
    for (let i = 0; i < 6; i++) rect(ctx, 112, 84 + i * 15, 256, 1, PAL.wood0);
    text(ctx, 'FLAT PACK', 240, 120, PAL.wood3, { align: 'center' });
    text(ctx, bp.name, 240, 132, PAL.wood0, { align: 'center' });
    asm.crateScrews.forEach((s, i) => {
      const lifting = asm.turning === i;
      screwHead(ctx, s.x, s.y, 6, asm.turn * (lifting ? 1 : 0.2) + i, s.out);
      if (s.out < 1) {
        ring(ctx, s.x, s.y, 10 + Math.round(Math.sin(t * 5 + i) * 1.5), lifting ? PAL.gold2 : PAL.paper3);
        bar(ctx, s.x - 12, s.y + 14, 24, 3, s.out, PAL.gold2);
      } else {
        text(ctx, 'OUT', s.x, s.y + 12, PAL.grass4, { align: 'center' });
      }
    });
    text(ctx, input.isTouch ? 'HOLD ON EACH SCREW TO BACK IT OUT'
                            : 'HOLD THE MOUSE OR SPACE ON A SCREW', 240, box.y + 4, PAL.paper3, { align: 'center' });
  } else {
    // the piece, growing as parts land - drawn from the shared furniture art
    drawFurniture(ctx, asm.item, 240, 176, {
      built: asm.partIndex / Math.max(1, asm.parts.length),
      screwed: asm.screwIndex / Math.max(1, asm.screws.length),
      scale: 2,
    });
  }

  if (asm.phase === 'fit') {
    // the part on its hook, swinging over the socket
    const swing = Math.sin(asm.slotWobble * 2.1) * 46;
    const part = asm.parts[asm.partIndex];
    const px0 = Math.round(240 + swing);
    line(ctx, px0, box.y + 6, px0, 92, PAL.stone2);
    rect(ctx, px0 - 16, 92, 32, 12, PAL.wood3);
    rect(ctx, px0 - 16, 92, 32, 3, PAL.wood4);
    frame(ctx, px0 - 16, 92, 32, 12, PAL.wood0);
    text(ctx, part ? part.name : '', px0, 95, PAL.ink, { align: 'center' });
    // the socket it belongs in
    for (let i = 0; i < 3; i++) {
      frame(ctx, 240 - 18 + i, 150 + i, 36 - i * 2, 14 - i * 2, i === 0 ? PAL.gold2 : PAL.wood0);
    }
    text(ctx, 'DROP IT SQUARE', 240, box.y + 4, PAL.paper3, { align: 'center' });
    const off = Math.abs(swing);
    text(ctx, off < 3 ? 'SQUARE' : off < 10 ? 'CLOSE' : 'CROOKED', 240, 138,
         off < 3 ? PAL.grass4 : off < 10 ? PAL.gold2 : PAL.red2, { align: 'center' });
    // which parts are already in
    asm.parts.forEach((p, i) => {
      const tone = !p.fitted ? PAL.wood0 : p.score >= 1 ? PAL.gold2 : p.score > 0 ? PAL.grass3 : PAL.red;
      rect(ctx, box.x + 6 + i * 12, box.y + 14, 10, 6, tone);
    });
  }

  if (asm.phase === 'screw' && !asm.finished) {
    // torque meter: let go inside the green and it is tight, hold on and it splits
    const mw = 200, mx = 240 - mw / 2, my = 120;
    rect(ctx, mx, my, mw, 12, PAL.wood0);
    const win = 0.16 * screwWindow();
    rect(ctx, mx + Math.round((0.85 - win) * mw * 0.74), my, Math.round(win * 2 * mw * 0.74), 12, PAL.grass1);
    rect(ctx, mx + Math.round((0.85 - win * 0.4) * mw * 0.74), my, Math.round(win * 0.8 * mw * 0.74), 12, PAL.grass3);
    rect(ctx, mx + Math.round(1.0 * mw * 0.74), my, mw - Math.round(1.0 * mw * 0.74), 12, PAL.red);
    frame(ctx, mx, my, mw, 12, PAL.ink);
    const px1 = mx + Math.round(Math.min(1.35, asm.torque) * mw * 0.74);
    rect(ctx, px1 - 1, my - 3, 3, 18, PAL.white);
    text(ctx, 'HOLD TO DRIVE - LET GO WHEN IT BITES', 240, box.y + 4, PAL.paper3, { align: 'center' });
    text(ctx, `SCREW ${asm.screwIndex + 1} OF ${asm.screws.length}`, 240, my - 14, PAL.gold2, { align: 'center' });
    // the driver, sinking as torque builds
    const dy = 138 + Math.round(asm.torque * 8);
    rect(ctx, 236, dy, 8, 26, PAL.red);
    rect(ctx, 238, dy + 26, 4, 14, PAL.stone2);
    screwHead(ctx, 240, dy + 42, 5, asm.torque * 20, 0);
    asm.screws.forEach((s, i) => {
      const tone = !s.done ? PAL.wood0 : s.score >= 1 ? PAL.gold2 : s.score > 0 ? PAL.grass3 : PAL.red;
      rect(ctx, box.x + 6 + i * 9, box.y + 14, 7, 6, tone);
    });
    if (asm.split > 0) {
      text(ctx, 'SPLIT IT!', 240, 100, PAL.red2, { align: 'center', shadow: PAL.black });
    }
  }

  if (asm.finished) {
    const w = 210, h = 74, x = (VIEW_W - w) >> 1, y = 70;
    const res = panel(ctx, x, y, w, h, 'FINISHED PIECE');
    text(ctx, bp.name, res.x + res.w / 2, res.y + 2, PAL.gold2, { align: 'center' });
    const grade = asm.quality > 0.92 ? 'HEIRLOOM' : asm.quality > 0.72 ? 'FINE WORK'
      : asm.quality > 0.45 ? 'HONEST' : 'WOBBLY';
    text(ctx, grade, res.x + res.w / 2, res.y + 14, PAL.paper, { align: 'center' });
    bar(ctx, res.x + 12, res.y + 26, res.w - 24, 6, asm.quality, PAL.grass3);
    text(ctx, 'IN THE VAN - FLY IT OUT', res.x + res.w / 2, res.y + 36, PAL.paper3, { align: 'center' });
    if (button(ctx, res.x + (res.w >> 1) - 30, res.y + 48, 60, 12, 'DONE') || pressed('KeyE', 'Escape', 'Enter')) {
      closeAssemble();
      return false;
    }
  }
  return true;
}
