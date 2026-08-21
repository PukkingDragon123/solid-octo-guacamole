// "Log Slam" - walk up to the log pile and slap three logs into place. A good
// run packs every building site and earns spare timber.

import { VIEW_W, VIEW_H } from './config.js';
import { G, gain, toast } from './state.js';
import { PAL, rect, frame, px, text, disc } from './gfx/pixel.js';
import * as S from './gfx/sprites.js';
import { panel, button, scrim } from './ui/widgets.js';
import { input, pressed } from './input.js';

const BAR_W = 260;
const COOLDOWN = 50;

export const mini = {
  active: false, cooldown: 0,
  pos: 0, dir: 1, speed: 150,
  round: 0, rounds: 3, hits: [], score: 0,
  finished: false, flash: 0, resultText: '',
};

export const canPlay = () => mini.cooldown <= 0;

export function openMinigame() {
  if (!canPlay()) return false;
  Object.assign(mini, {
    active: true, pos: 6, dir: 1, speed: 150,
    round: 0, hits: [], score: 0, finished: false, flash: 0, resultText: '',
  });
  return true;
}

export function closeMinigame() { mini.active = false; }

export function slam() {
  if (!mini.active || mini.finished) return;
  const centre = BAR_W / 2;
  const off = Math.abs(mini.pos - centre);
  let points = 0, label = 'MISS';
  if (off <= 7) { points = 3; label = 'PERFECT'; }
  else if (off <= 20) { points = 2; label = 'SOLID'; }
  else if (off <= 40) { points = 1; label = 'GRAZED IT'; }
  mini.hits.push({ pos: mini.pos, points });
  mini.score += points;
  mini.flash = points ? 0.3 : 0.15;
  mini.resultText = label;
  mini.round++;
  mini.speed += 42;
  if (mini.round >= mini.rounds) finish();
}

function finish() {
  mini.finished = true;
  const boost = mini.score * 1.6;
  let sites = 0;
  for (const e of G.entities) {
    if (e.kind !== 'site') continue;
    e.workDone = Math.min(e.work, e.workDone + boost);
    e.pulse = 0.3;
    sites++;
  }
  const wood = Math.round(mini.score * 0.9);
  gain('wood', wood);
  mini.cooldown = COOLDOWN;
  if (mini.score === 9) mini.resultText = 'FLAWLESS SLAM';
  toast(`LOG SLAM ${mini.score}/9 - PLUS ${wood} WOOD, ${sites} SITE${sites === 1 ? '' : 'S'} SHOVED ALONG`,
        mini.score >= 6 ? 'good' : 'info');
}

/** Runs on real time so it feels the same whatever the sim is doing. */
export function updateMinigame(dt) {
  if (mini.cooldown > 0 && !mini.active) mini.cooldown = Math.max(0, mini.cooldown - dt);
  if (mini.flash > 0) mini.flash -= dt;
  if (!mini.active || mini.finished) return;
  mini.pos += mini.dir * mini.speed * dt;
  if (mini.pos > BAR_W - 6) { mini.pos = BAR_W - 6; mini.dir = -1; }
  if (mini.pos < 6) { mini.pos = 6; mini.dir = 1; }
}

/** Returns false once the player closes it. */
export function drawMinigame(ctx, t) {
  scrim(ctx, VIEW_W, VIEW_H, 0.6);
  const w = BAR_W + 36, h = 116;
  const x = (VIEW_W - w) >> 1;
  const y = (VIEW_H - h) >> 1;
  const box = panel(ctx, x, y, w, h, 'LOG SLAM');

  const barX = box.x + 4;
  const barY = box.y + 30;

  // the water the logs drop into
  rect(ctx, box.x, barY + 20, box.w, 16, PAL.water1);
  for (let i = 0; i < box.w; i += 7) px(ctx, box.x + ((i + Math.floor(t * 12)) % box.w), barY + 23 + (i % 3), PAL.water3);

  // the log
  rect(ctx, barX, barY, BAR_W, 14, PAL.wood1);
  rect(ctx, barX, barY, BAR_W, 3, PAL.wood2);
  rect(ctx, barX, barY + 11, BAR_W, 3, PAL.wood0);
  for (let i = 8; i < BAR_W; i += 17) px(ctx, barX + i, barY + 6, PAL.wood0);

  // scoring zones
  const c = barX + BAR_W / 2;
  rect(ctx, c - 40, barY, 80, 14, PAL.wood3);
  rect(ctx, c - 20, barY, 40, 14, PAL.gold);
  rect(ctx, c - 7, barY, 14, 14, PAL.gold2);
  frame(ctx, c - 7, barY, 14, 14, PAL.white);

  // previous slaps
  for (const hit of mini.hits) {
    const hx = Math.round(barX + hit.pos);
    rect(ctx, hx - 1, barY - 4, 2, 22, hit.points === 3 ? PAL.gold2 : hit.points ? PAL.grass4 : PAL.red2);
  }

  // the marker: your beaver, poised
  if (!mini.finished) {
    const mx = Math.round(barX + mini.pos);
    rect(ctx, mx, barY - 6, 1, 26, PAL.ink);
    const bv = S.beaverSprite('logger', Math.floor(t * 10) % 2);
    ctx.drawImage(bv, mx - (bv.width >> 1), barY - 24);
  }

  if (mini.flash > 0) {
    ctx.globalAlpha = Math.min(1, mini.flash * 3);
    rect(ctx, box.x, box.y, box.w, box.h, PAL.white);
    ctx.globalAlpha = 1;
  }

  const headline = mini.finished ? `${mini.resultText} - ${mini.score}/9`
    : mini.resultText || `SLAP ${mini.round + 1} OF ${mini.rounds}`;
  text(ctx, headline, box.x + box.w / 2, box.y + 8, PAL.gold2, { align: 'center' });

  // score pips
  for (let i = 0; i < mini.rounds; i++) {
    const hit = mini.hits[i];
    const sx = box.x + box.w / 2 - 14 + i * 10;
    rect(ctx, sx, box.y + 18, 8, 6, hit ? (hit.points === 3 ? PAL.gold2 : hit.points ? PAL.grass3 : PAL.red) : PAL.wood0);
  }

  if (mini.finished) {
    if (button(ctx, box.x + (box.w >> 1) - 30, box.y + box.h - 14, 60, 12, 'E  DONE') || pressed('KeyE', 'Escape', 'Space')) {
      closeMinigame();
      return false;
    }
  } else {
    text(ctx, 'SPACE OR CLICK TO SLAM', box.x + box.w / 2, box.y + box.h - 12, PAL.paper3, { align: 'center' });
    if (pressed('Space') || input.clicked) slam();
  }
  return true;
}
