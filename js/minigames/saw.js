// The saw bench. Two passes over one log: rip it down the guide line, then
// shape the plank on the marks. Both are hand skills - the blade wanders and
// you steer it back, and every stroke throws sawdust and bites at the wood.

import { VIEW_W, VIEW_H } from '../config.js';
import { PAL, rect, frame, px, text, disc, line, rngFrom } from '../gfx/pixel.js';
import { panel, button, scrim, bar } from '../ui/widgets.js';
import { input, pressed, held } from '../input.js';
import { story, addMaterial, takeMaterials, haveMaterials } from '../story.js';
import { sawWobble, plankBonus } from '../shop.js';
import { sfx } from '../audio.js';
import { toast } from '../state.js';

const LOG_X = 96, LOG_W = 288, LOG_Y = 112, LOG_H = 46;

export const saw = {
  active: false, phase: 'rip', t: 0,
  cut: 0,              // 0..1 how far along the log the blade is
  blade: 0,            // blade offset from the line, in pixels
  drift: 0,            // where the wood is pulling it
  error: 0, samples: 0,
  marks: [], markIndex: 0, sweep: 0, sweepDir: 1,
  dust: [], quality: 0, finished: false, planks: 0,
  kerf: [],            // the cut itself, one depth per column
};

export function canSaw() { return haveMaterials({ hardwood: 1 }); }

export function openSaw() {
  if (!canSaw()) { toast('NO LOGS TO CUT - FELL A TREE OUT BACK', 'warn'); return false; }
  takeMaterials({ hardwood: 1 });
  const marks = [];
  for (let i = 0; i < 4; i++) marks.push({ at: 0.16 + i * 0.22, hit: 0 });
  Object.assign(saw, {
    active: true, phase: 'rip', t: 0, cut: 0, blade: 0, drift: 0,
    error: 0, samples: 0, marks, markIndex: 0, sweep: 0, sweepDir: 1,
    dust: [], quality: 0, finished: false, planks: 0,
    kerf: new Array(LOG_W).fill(0),
  });
  return true;
}

export function closeSaw() { saw.active = false; }

function spray(x, y, n, up) {
  for (let i = 0; i < n; i++) {
    saw.dust.push({
      x, y,
      vx: (Math.random() - 0.5) * 60,
      vy: up ? -20 - Math.random() * 70 : Math.random() * 40,
      life: 0.4 + Math.random() * 0.6,
      tone: Math.random() > 0.5 ? PAL.wood4 : PAL.paper2,
    });
  }
}

export function updateSaw(dt) {
  if (!saw.active) return;
  saw.t += dt;

  for (const d of saw.dust) {
    d.life -= dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += 120 * dt;
  }
  saw.dust = saw.dust.filter((d) => d.life > 0);

  if (saw.finished) return;

  if (saw.phase === 'rip') {
    // the wood pulls the blade about; you counter it
    saw.drift += (Math.sin(saw.t * 2.3) * 26 + Math.sin(saw.t * 5.7) * 14 - saw.drift) * dt * 2.2;
    const steer = (held('KeyA', 'ArrowLeft') ? -1 : 0) + (held('KeyD', 'ArrowRight') ? 1 : 0);
    const mouseSteer = input.overCanvas && input.down
      ? Math.max(-1, Math.min(1, (input.my - (LOG_Y + LOG_H / 2)) / 26)) : 0;
    const wobble = sawWobble();
    saw.blade += (saw.drift * wobble * 0.6 + (steer || mouseSteer) * 46) * dt;
    saw.blade = Math.max(-22, Math.min(22, saw.blade));

    const pushing = held('Space') || (input.overCanvas && input.down) || held('KeyE');
    if (pushing) {
      const speed = 0.24;
      saw.cut = Math.min(1, saw.cut + speed * dt);
      const col = Math.min(LOG_W - 1, Math.floor(saw.cut * LOG_W));
      saw.kerf[col] = saw.blade;
      saw.error += Math.abs(saw.blade) * dt;
      saw.samples += dt;
      if (Math.random() < dt * 30) spray(LOG_X + col, LOG_Y + LOG_H / 2 + saw.blade, 2, true);
      if (Math.random() < dt * 9) sfx.saw();
      if (saw.cut >= 1) {
        saw.phase = 'shape';
        saw.sweep = 0;
        sfx.thunk();
      }
    }
  } else if (saw.phase === 'shape') {
    // a chisel sweeps the plank; tap it on each mark
    saw.sweep += saw.sweepDir * dt * 0.62;
    if (saw.sweep > 1) { saw.sweep = 1; saw.sweepDir = -1; }
    if (saw.sweep < 0) { saw.sweep = 0; saw.sweepDir = 1; }
    if (pressed('Space', 'KeyE') || input.clicked) strike();
  }
}

function strike() {
  const mark = saw.marks[saw.markIndex];
  if (!mark) return;
  const off = Math.abs(saw.sweep - mark.at);
  const score = off < 0.02 ? 1 : off < 0.05 ? 0.7 : off < 0.1 ? 0.35 : 0;
  mark.hit = score || -1;
  saw.markIndex++;
  spray(LOG_X + saw.sweep * LOG_W, LOG_Y + 8, score ? 10 : 4, true);
  if (score >= 1) sfx.good(); else if (score) sfx.thunk(); else sfx.bad();
  if (saw.markIndex >= saw.marks.length) finish();
}

function finish() {
  const straight = saw.samples > 0 ? Math.max(0, 1 - (saw.error / saw.samples) / 12) : 0;
  const shaped = saw.marks.reduce((sum, m) => sum + Math.max(0, m.hit), 0) / saw.marks.length;
  const quality = Math.max(0, Math.min(1, straight * 0.55 + shaped * 0.45));
  saw.quality = quality;
  saw.finished = true;
  const planks = 2 + Math.round(quality * 2) + plankBonus();
  saw.planks = planks;
  addMaterial('plank', planks);
  story().stats.planed++;
  if (quality > 0.92) story().stats.perfect++;
  toast(`${planks} PLANKS CUT - ${gradeName(quality)}`, quality > 0.6 ? 'good' : 'info');
  sfx.cash();
}

export function gradeName(q) {
  return q > 0.92 ? 'FURNITURE GRADE' : q > 0.72 ? 'GOOD STOCK'
    : q > 0.45 ? 'USABLE' : q > 0.2 ? 'ROUGH' : 'FIREWOOD';
}

// -------------------------------------------------------------------- draw
/** The log, drawn with end grain and a lit top so it reads as a solid round. */
function drawLog(ctx, t) {
  const cy = LOG_Y + LOG_H / 2;
  // body, shaded in bands from top light to underside shadow
  // a cylinder: bright along the top third, dropping hard into shadow
  const bands = [
    [0.00, PAL.wood3], [0.10, PAL.wood4], [0.24, PAL.wood3],
    [0.48, PAL.wood2], [0.72, PAL.wood1], [0.88, PAL.wood0],
  ];
  ctx.globalAlpha = 0.3;
  rect(ctx, LOG_X + 4, LOG_Y + LOG_H + 6, LOG_W - 8, 3, PAL.black);
  ctx.globalAlpha = 1;
  for (let i = 0; i < bands.length; i++) {
    const top = LOG_Y + Math.round(bands[i][0] * LOG_H);
    const bottom = LOG_Y + Math.round((i + 1 < bands.length ? bands[i + 1][0] : 1) * LOG_H);
    rect(ctx, LOG_X, top, LOG_W, bottom - top, bands[i][1]);
    // scatter the next tone up into the seam
    if (i + 1 < bands.length) {
      ctx.fillStyle = bands[i + 1][1];
      for (let x = (bottom % 2); x < LOG_W; x += 2) ctx.fillRect(LOG_X + x, bottom - 1, 1, 1);
    }
  }
  // bark texture
  const rng = rngFrom(1234);
  for (let i = 0; i < 220; i++) {
    const bx = LOG_X + Math.floor(rng() * LOG_W);
    const by = LOG_Y + Math.floor(rng() * LOG_H);
    px(ctx, bx, by, rng() > 0.6 ? PAL.wood1 : PAL.wood0);
  }
  // end grain: rings on an ellipse, which is what sells the roundness
  for (let r = 22; r > 0; r -= 3) {
    ctx.fillStyle = r % 6 === 0 ? PAL.wood2 : PAL.wood3;
    for (let y = -r; y <= r; y++) {
      const span = Math.round(6 * Math.sqrt(Math.max(0, 1 - (y * y) / (r * r))));
      ctx.fillRect(LOG_X + LOG_W - span, Math.round(cy + y), span * 2, 1);
    }
  }
  frame(ctx, LOG_X, LOG_Y, LOG_W, LOG_H, PAL.wood0);
  // the cradle it sits in
  rect(ctx, LOG_X - 14, LOG_Y + LOG_H, LOG_W + 28, 8, PAL.wood1);
  rect(ctx, LOG_X - 14, LOG_Y + LOG_H, LOG_W + 28, 2, PAL.wood2);
  for (const bx of [LOG_X + 20, LOG_X + LOG_W - 40]) {
    rect(ctx, bx, LOG_Y + LOG_H + 8, 10, 26, PAL.wood0);
  }
}

function drawKerf(ctx) {
  const cy = LOG_Y + LOG_H / 2;
  // the guide line you are meant to follow
  for (let x = 0; x < LOG_W; x += 4) px(ctx, LOG_X + x, cy, PAL.paper3);
  // the cut so far, dark and a pixel proud on the lower lip
  for (let x = 0; x < Math.floor(saw.cut * LOG_W); x++) {
    const y = cy + saw.kerf[x];
    rect(ctx, LOG_X + x, Math.round(y) - 1, 1, 3, PAL.wood0);
    px(ctx, LOG_X + x, Math.round(y) + 2, PAL.wood2);
  }
}

function drawBlade(ctx, t) {
  const cy = LOG_Y + LOG_H / 2;
  const x = LOG_X + Math.floor(saw.cut * LOG_W);
  const y = Math.round(cy + saw.blade);
  const shake = Math.sin(t * 40) * 0.8;
  // the saw plate, teeth down, handle off to the right
  rect(ctx, x - 40, y - 12 + shake, 54, 3, PAL.stone3);
  rect(ctx, x - 40, y - 9 + shake, 54, 8, PAL.stone2);
  for (let i = 0; i < 54; i += 3) px(ctx, x - 40 + i, y - 1 + shake, PAL.stone3);
  rect(ctx, x + 14, y - 14 + shake, 12, 16, PAL.wood2);
  frame(ctx, x + 14, y - 14 + shake, 12, 16, PAL.wood0);
  // where it is actually biting
  px(ctx, x, y, PAL.white);
  rect(ctx, x - 1, y - 1, 3, 3, PAL.paper);
}

function drawPlank(ctx) {
  // after the rip: the plank, face up, with the shaping marks along it
  rect(ctx, LOG_X, LOG_Y + 6, LOG_W, 30, PAL.wood3);
  rect(ctx, LOG_X, LOG_Y + 6, LOG_W, 3, PAL.wood4);
  rect(ctx, LOG_X, LOG_Y + 33, LOG_W, 3, PAL.wood1);
  // grain following the cut you actually made
  for (let x = 0; x < LOG_W; x++) {
    const wobble = saw.kerf[x] || 0;
    px(ctx, LOG_X + x, LOG_Y + 20 + Math.round(wobble * 0.4), PAL.wood2);
    if (x % 3 === 0) px(ctx, LOG_X + x, LOG_Y + 26 + Math.round(wobble * 0.2), PAL.wood2);
  }
  frame(ctx, LOG_X, LOG_Y + 6, LOG_W, 30, PAL.wood0);

  for (let i = 0; i < saw.marks.length; i++) {
    const m = saw.marks[i];
    const mx = Math.round(LOG_X + m.at * LOG_W);
    const done = m.hit !== 0;
    const tone = m.hit >= 1 ? PAL.gold2 : m.hit > 0 ? PAL.grass3 : m.hit < 0 ? PAL.red2 : PAL.paper3;
    for (let y = 0; y < 30; y += 3) px(ctx, mx, LOG_Y + 6 + y, tone);
    if (done && m.hit > 0) {
      // a chamfer chiselled off the edge
      for (let k = 0; k < 5; k++) rect(ctx, mx - 4 + k, LOG_Y + 6 + k, 8 - k, 1, PAL.wood4);
    }
    if (i === saw.markIndex) frame(ctx, mx - 5, LOG_Y + 2, 10, 38, PAL.white);
  }

  // the chisel, sweeping
  const cx = Math.round(LOG_X + saw.sweep * LOG_W);
  rect(ctx, cx - 1, LOG_Y - 22, 3, 18, PAL.wood2);
  rect(ctx, cx - 2, LOG_Y - 6, 5, 8, PAL.stone2);
  rect(ctx, cx - 2, LOG_Y - 1, 5, 2, PAL.stone3);
}

export function drawSaw(ctx, t) {
  scrim(ctx, VIEW_W, VIEW_H, 0.72);
  const box = panel(ctx, 24, 30, VIEW_W - 48, 200, saw.phase === 'rip' ? 'RIP THE LOG' : 'SHAPE THE PLANK');

  // bench top the work sits on
  rect(ctx, box.x, LOG_Y + LOG_H + 40, box.w, 30, PAL.wood1);
  rect(ctx, box.x, LOG_Y + LOG_H + 40, box.w, 3, PAL.wood2);
  for (let x = 0; x < box.w; x += 6) px(ctx, box.x + x, LOG_Y + LOG_H + 50, PAL.wood0);
  // the heap of shavings that builds up under the cut
  const heap = Math.round(saw.cut * 26);
  for (let i = 0; i < heap * 3; i++) {
    const hx = LOG_X + 20 + ((i * 37) % (LOG_W - 40));
    px(ctx, hx, LOG_Y + LOG_H + 38 - (i % 5), i % 3 ? PAL.wood4 : PAL.paper2);
  }

  if (saw.phase === 'rip') { drawLog(ctx, t); drawKerf(ctx); if (!saw.finished) drawBlade(ctx, t); }
  else drawPlank(ctx);

  for (const d of saw.dust) {
    px(ctx, Math.round(d.x), Math.round(d.y), d.life > 0.2 ? d.tone : PAL.wood2);
  }

  // ---- read-outs
  if (saw.phase === 'rip') {
    text(ctx, 'HOLD SPACE TO PUSH   A / D KEEP IT ON THE LINE', VIEW_W / 2, box.y + 2, PAL.paper3, { align: 'center' });
    bar(ctx, box.x + 40, box.y + 14, box.w - 80, 5, saw.cut, PAL.gold2);
    const off = Math.abs(saw.blade);
    const tone = off < 4 ? PAL.grass4 : off < 11 ? PAL.gold2 : PAL.red2;
    text(ctx, off < 4 ? 'DEAD STRAIGHT' : off < 11 ? 'DRIFTING' : 'OFF THE LINE', VIEW_W / 2, box.y + 24, tone, { align: 'center' });
  } else if (!saw.finished) {
    text(ctx, 'TAP SPACE ON EACH MARK', VIEW_W / 2, box.y + 2, PAL.paper3, { align: 'center' });
    text(ctx, `${saw.markIndex} / ${saw.marks.length}`, VIEW_W / 2, box.y + 14, PAL.gold2, { align: 'center' });
  }

  if (saw.finished) {
    const w = 200, h = 66, x = (VIEW_W - w) >> 1, y = 84;
    const res = panel(ctx, x, y, w, h, 'OFF THE BENCH');   // over the finished plank
    text(ctx, gradeName(saw.quality), res.x + res.w / 2, res.y + 2, PAL.gold2, { align: 'center' });
    text(ctx, `+${saw.planks} PLANKS`, res.x + res.w / 2, res.y + 13, PAL.paper, { align: 'center' });
    bar(ctx, res.x + 10, res.y + 24, res.w - 20, 5, saw.quality, PAL.grass3);
    if (button(ctx, res.x + (res.w >> 1) - 30, res.y + 33, 60, 12, 'DONE') || pressed('KeyE', 'Escape', 'Enter')) {
      closeSaw();
      return false;
    }
  }
  return true;
}
