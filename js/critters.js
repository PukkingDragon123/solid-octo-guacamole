// Ambient wildlife: butterflies, fireflies, fish and passing flocks. None of it
// is part of the simulation — it is not saved and nothing depends on it. It is
// here so the valley is never still.

import { MAPW, MAPH, TILE, WORLD_W, WORLD_H, VIEW_W, VIEW_H, CAMP_W, CAMP_GROUND } from './config.js';
import { G, tileAt } from './state.js';
import { PAL, px } from './gfx/pixel.js';
import { cam } from './gfx/screen.js';
import * as S from './gfx/sprites.js';

const TINTS = [PAL.gold2, PAL.white, PAL.pink, PAL.purple2, PAL.red2];

export const critters = { butterflies: [], fireflies: [], fish: [], flock: [] };

const rand = (a, b) => a + Math.random() * (b - a);

export function seedCritters() {
  critters.butterflies = [];
  critters.fireflies = [];
  critters.fish = [];
  critters.flock = [];

  for (let i = 0; i < 16; i++) {
    critters.butterflies.push({
      x: rand(0, WORLD_W), y: rand(0, WORLD_H),
      vx: rand(-14, 14), vy: rand(-10, 10),
      tint: TINTS[(Math.random() * TINTS.length) | 0],
      phase: rand(0, 6.3), t: 0,
    });
  }
  for (let i = 0; i < 26; i++) {
    critters.fireflies.push({ x: rand(0, WORLD_W), y: rand(0, WORLD_H), phase: rand(0, 6.3), blink: rand(0, 3) });
  }
  reseedFish();
  spawnFlock();
}

/** Fish only exist where there is water to hold them. */
export function reseedFish() {
  const pond = [];
  for (let y = 0; y < MAPH; y++) {
    for (let x = 0; x < MAPW; x++) {
      const tile = tileAt(x, y);
      if (tile && (tile.t === 'pond' || tile.t === 'water')) pond.push({ x, y });
    }
  }
  critters.fish = [];
  const count = Math.min(14, Math.max(3, Math.round(pond.length / 26)));
  for (let i = 0; i < count && pond.length; i++) {
    const spot = pond[(Math.random() * pond.length) | 0];
    critters.fish.push({
      x: spot.x * TILE + 8, y: spot.y * TILE + 8,
      vx: rand(-10, 10), vy: rand(-6, 6), t: rand(0, 5), jump: 0,
    });
  }
}

function spawnFlock() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const y = rand(20, WORLD_H * 0.7);
  const n = 3 + ((Math.random() * 3) | 0);
  critters.flock = [];
  for (let i = 0; i < n; i++) {
    critters.flock.push({
      x: (dir > 0 ? -30 : WORLD_W + 30) - dir * i * 11,
      y: y + Math.abs(i - (n >> 1)) * 6,
      dir, phase: rand(0, 6.3),
    });
  }
  critters.flockTimer = rand(18, 40);
}

const isNight = () => G.dayT > 0.82 || G.dayT < 0.06;

export function updateCritters(dt) {
  const t = performance.now() / 1000;

  for (const b of critters.butterflies) {
    b.t += dt;
    // a wobbly, unhurried drift
    b.vx += Math.sin(b.t * 2.2 + b.phase) * 26 * dt;
    b.vy += Math.cos(b.t * 1.7 + b.phase) * 20 * dt;
    b.vx = Math.max(-20, Math.min(20, b.vx));
    b.vy = Math.max(-16, Math.min(16, b.vy));
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
    if (b.x > WORLD_W) { b.x = WORLD_W; b.vx = -Math.abs(b.vx); }
    if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }
    if (b.y > WORLD_H) { b.y = WORLD_H; b.vy = -Math.abs(b.vy); }
  }

  for (const f of critters.fireflies) {
    f.phase += dt * 0.7;
    f.blink += dt;
    f.x += Math.sin(f.phase) * 8 * dt;
    f.y += Math.cos(f.phase * 0.8) * 6 * dt;
  }

  for (const f of critters.fish) {
    f.t += dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    const tile = tileAt(Math.floor(f.x / TILE), Math.floor(f.y / TILE));
    if (!tile || (tile.t !== 'pond' && tile.t !== 'water')) { f.vx *= -1; f.vy *= -1; f.x += f.vx * dt * 2; f.y += f.vy * dt * 2; }
    if (f.t > 6) { f.t = 0; f.jump = 0.6; f.vx = rand(-10, 10); f.vy = rand(-6, 6); }
    if (f.jump > 0) f.jump -= dt;
  }

  critters.flockTimer -= dt;
  for (const bird of critters.flock) {
    bird.x += bird.dir * 46 * dt;
    bird.y += Math.sin(t * 1.4 + bird.phase) * 6 * dt;
  }
  if (critters.flockTimer <= 0) spawnFlock();
}

// --------------------------------------------------------------- drawing
export function drawCritters(ctx, t) {
  const night = isNight();

  for (const f of critters.fish) {
    const sx = cam.sx(f.x), sy = cam.sy(f.y);
    if (sx < -10 || sx > VIEW_W || sy < -10 || sy > VIEW_H) continue;
    if (f.jump > 0) {
      // a splash ring and a quick arc out of the water
      const arc = Math.sin((1 - f.jump / 0.6) * Math.PI) * 5;
      ctx.drawImage(S.fishSprite(1), sx - 4, Math.round(sy - arc) - 2);
      px(ctx, sx - 5, sy + 2, PAL.foam); px(ctx, sx + 5, sy + 2, PAL.foam);
      px(ctx, sx, sy + 3, PAL.foam);
    } else {
      ctx.drawImage(S.fishSprite(Math.floor(t * 4) % 2), sx - 4, sy - 2);
    }
  }

  if (!night) {
    for (const b of critters.butterflies) {
      const sx = cam.sx(b.x), sy = cam.sy(b.y);
      if (sx < -8 || sx > VIEW_W || sy < -8 || sy > VIEW_H) continue;
      ctx.drawImage(S.butterflySprite(b.tint, Math.floor(t * 9 + b.phase) % 2), sx - 3, sy - 3);
    }
  } else {
    for (const f of critters.fireflies) {
      const sx = cam.sx(f.x), sy = cam.sy(f.y);
      if (sx < -6 || sx > VIEW_W || sy < -6 || sy > VIEW_H) continue;
      const on = Math.sin(f.blink * 2.4) > 0.2;
      ctx.drawImage(S.fireflySprite(on), sx - 2, sy - 2);
    }
  }
}

/** Birds pass overhead, above everything, with a shadow on the ground. */
export function drawFlock(ctx, t) {
  for (const bird of critters.flock) {
    const sx = cam.sx(bird.x), sy = cam.sy(bird.y);
    if (sx < -12 || sx > VIEW_W + 12 || sy < -12 || sy > VIEW_H + 12) continue;
    const img = S.flyingBirdSprite(Math.floor(t * 8 + bird.phase) % 4);
    ctx.save();
    if (bird.dir < 0) {
      ctx.translate(sx + 4, sy - 12);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
    } else {
      ctx.drawImage(img, sx - 4, sy - 12);
    }
    ctx.restore();
    ctx.globalAlpha = 0.18;
    px(ctx, sx, sy + 2, PAL.ink);
    px(ctx, sx - 1, sy + 2, PAL.ink);
    px(ctx, sx + 1, sy + 2, PAL.ink);
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------- camp
// The camp gets its own small set, in screen space rather than world space.
const campCritters = { flies: [], flock: [] };

export function seedCampCritters() {
  campCritters.flies = [];
  for (let i = 0; i < 14; i++) {
    campCritters.flies.push({
      x: rand(0, CAMP_W), y: rand(CAMP_GROUND - 46, CAMP_GROUND - 6),
      vx: rand(-12, 12), vy: rand(-6, 6),
      tint: TINTS[(Math.random() * TINTS.length) | 0], phase: rand(0, 6.3), t: 0,
    });
  }
  campCritters.flock = [];
  for (let i = 0; i < 5; i++) {
    campCritters.flock.push({ x: rand(-200, CAMP_W), y: rand(24, 90), phase: rand(0, 6.3), speed: rand(16, 30) });
  }
}

export function updateCampCritters(dt) {
  for (const f of campCritters.flies) {
    f.t += dt;
    f.vx += Math.sin(f.t * 2 + f.phase) * 20 * dt;
    f.vy += Math.cos(f.t * 1.6 + f.phase) * 14 * dt;
    f.vx = Math.max(-16, Math.min(16, f.vx));
    f.vy = Math.max(-10, Math.min(10, f.vy));
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.x < 0 || f.x > CAMP_W) f.vx *= -1;
    if (f.y < CAMP_GROUND - 52) f.vy = Math.abs(f.vy);
    if (f.y > CAMP_GROUND - 4) f.vy = -Math.abs(f.vy);
  }
  for (const b of campCritters.flock) {
    b.x += b.speed * dt;
    if (b.x > CAMP_W + 60) b.x = -60;
  }
}

export function drawCampCritters(ctx, t) {
  const night = isNight();
  for (const b of campCritters.flock) {
    const sx = cam.sx(b.x * 0.4);
    if (sx < -12 || sx > VIEW_W + 12) continue;
    ctx.drawImage(S.flyingBirdSprite(Math.floor(t * 7 + b.phase) % 4), sx, Math.round(b.y + Math.sin(t + b.phase) * 3));
  }
  for (const f of campCritters.flies) {
    const sx = cam.sx(f.x);
    if (sx < -8 || sx > VIEW_W) continue;
    if (night) {
      const on = Math.sin(f.t * 2.6 + f.phase) > 0.2;
      ctx.drawImage(S.fireflySprite(on), sx - 2, Math.round(f.y) - 2);
    } else {
      ctx.drawImage(S.butterflySprite(f.tint, Math.floor(t * 9 + f.phase) % 2), sx - 3, Math.round(f.y) - 3);
    }
  }
}
