// "Log Slam" — the cute timing mini-game. Land three tail-slaps on the mark to
// pack the dam and give every building site a free burst of work.

import { G, gain, toast } from './state.js';
import { roundRect, clamp } from './util.js';

const W = 360, H = 132;
const COOLDOWN = 55;

export const mini = {
  active: false, cooldown: 0,
  pos: 0, dir: 1, speed: 210,
  round: 0, rounds: 3, hits: [], score: 0,
  finished: false, flash: 0, resultText: '',
};

export const canPlay = () => mini.cooldown <= 0 && !mini.active;

export function openMinigame() {
  if (!canPlay()) return false;
  mini.active = true;
  mini.pos = 12;
  mini.dir = 1;
  mini.speed = 210;
  mini.round = 0;
  mini.hits = [];
  mini.score = 0;
  mini.finished = false;
  mini.flash = 0;
  mini.resultText = '';
  return true;
}

export function closeMinigame() {
  mini.active = false;
}

export function slam() {
  if (!mini.active || mini.finished) return;
  const centre = W / 2;
  const off = Math.abs(mini.pos - centre);
  let points = 0, label = 'Miss!';
  if (off <= 11) { points = 3; label = 'PERFECT!'; }
  else if (off <= 32) { points = 2; label = 'Solid!'; }
  else if (off <= 58) { points = 1; label = 'Grazed it'; }
  mini.hits.push({ pos: mini.pos, points, label });
  mini.score += points;
  mini.flash = points ? 0.35 : 0.18;
  mini.resultText = label;
  mini.round++;
  mini.speed += 55;
  if (mini.round >= mini.rounds) finish();
}

function finish() {
  mini.finished = true;
  const score = mini.score;
  const boost = score * 1.6;          // worker-seconds handed to every site
  let sites = 0;
  for (const e of G.entities) {
    if (e.kind !== 'site') continue;
    e.workDone = Math.min(e.work, e.workDone + boost);
    e.pulse = 0.3;
    sites++;
  }
  const wood = Math.round(score * 0.8);
  gain('wood', wood);
  mini.cooldown = COOLDOWN;
  if (score === 9) mini.resultText = 'FLAWLESS SLAM! 🦫';
  toast(`🪵 Log Slam scored ${score}/9 — +${wood} wood and a shove for ${sites} site${sites === 1 ? '' : 's'}.`,
        score >= 6 ? 'good' : 'info');
}

/** Runs on real time so the mini-game feels the same at any game speed. */
export function updateMinigame(dt) {
  if (mini.cooldown > 0 && !mini.active) mini.cooldown = Math.max(0, mini.cooldown - dt);
  if (mini.flash > 0) mini.flash -= dt;
  if (!mini.active || mini.finished) return;
  mini.pos += mini.dir * mini.speed * dt;
  if (mini.pos > W - 12) { mini.pos = W - 12; mini.dir = -1; }
  if (mini.pos < 12) { mini.pos = 12; mini.dir = 1; }
}

export function drawMinigame(ctx) {
  ctx.clearRect(0, 0, W, H);

  // water strip
  ctx.fillStyle = '#4aa3d9';
  roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  for (let i = 0; i < 4; i++) {
    roundRect(ctx, 8 + i * 92, 12 + (i % 2) * 6, 60, 4, 2); ctx.fill();
  }

  // the log bar
  const barY = 58, barH = 26;
  ctx.fillStyle = '#7d5129';
  roundRect(ctx, 8, barY, W - 16, barH, 8); ctx.fill();
  ctx.fillStyle = '#a9713e';
  roundRect(ctx, 12, barY + 4, W - 24, barH - 8, 6); ctx.fill();

  // target zones
  const c = W / 2;
  ctx.fillStyle = 'rgba(120,220,140,0.55)';
  roundRect(ctx, c - 58, barY, 116, barH, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,225,130,0.75)';
  roundRect(ctx, c - 32, barY, 64, barH, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(ctx, c - 11, barY, 22, barH, 6); ctx.fill();

  // previous hits
  for (const hit of mini.hits) {
    ctx.fillStyle = hit.points === 3 ? '#ffd76a' : hit.points ? '#a8e6a0' : '#ff8f8f';
    roundRect(ctx, hit.pos - 2, barY - 8, 4, barH + 16, 2); ctx.fill();
  }

  // the marker
  if (!mini.finished) {
    ctx.fillStyle = '#2b2118';
    roundRect(ctx, mini.pos - 2.5, barY - 12, 5, barH + 24, 2.5); ctx.fill();
    ctx.font = '20px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('🦫', mini.pos, barY - 16);
  }

  if (mini.flash > 0) {
    ctx.globalAlpha = clamp(mini.flash * 2.6, 0, 1);
    ctx.fillStyle = '#fff';
    roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.font = '700 14px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff6e5';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 3;
  const msg = mini.finished
    ? `${mini.resultText}  ·  ${mini.score}/9`
    : mini.resultText || `Slap ${mini.round + 1} of ${mini.rounds}`;
  ctx.strokeText(msg, W / 2, 26);
  ctx.fillText(msg, W / 2, 26);

  ctx.font = '11px system-ui';
  const hint = mini.finished ? 'Nice tail work! Close to get back to the valley.' : 'Press SPACE or click to slam the log';
  ctx.strokeText(hint, W / 2, H - 12);
  ctx.fillText(hint, W / 2, H - 12);
}

export const MINI_W = W;
export const MINI_H = H;
