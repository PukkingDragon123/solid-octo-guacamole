// You. On foot in the camp, and on the heron's back over the valley.

import { CAMP_W, CAMP_GROUND, WORLD_W, WORLD_H, TILE } from './config.js';
import { G } from './state.js';
import { input, held } from './input.js';

const GRAVITY = 520;
const WALK_ACCEL = 640;
const WALK_MAX = 68;
const FRICTION = 900;
const JUMP_V = -168;

/**
 * Side-on walking, shared by the camp, the workshop and the forest - they only
 * differ in how wide the room is and where the floor sits.
 */
export function updateSidePlayer(dt, locked, width = CAMP_W, ground = CAMP_GROUND) {
  const p = G.player;
  const left = !locked && held('ArrowLeft', 'KeyA');
  const right = !locked && held('ArrowRight', 'KeyD');

  if (left && !right) { p.vx -= WALK_ACCEL * dt; p.face = -1; }
  else if (right && !left) { p.vx += WALK_ACCEL * dt; p.face = 1; }
  else {
    const drop = FRICTION * dt;
    p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - Math.sign(p.vx) * drop;
  }
  p.vx = Math.max(-WALK_MAX, Math.min(WALK_MAX, p.vx));

  if (!locked && p.onGround && held('Space', 'ArrowUp', 'KeyW')) {
    p.vy = JUMP_V;
    p.onGround = false;
  }

  p.vy += GRAVITY * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (p.y >= ground) { p.y = ground; p.vy = 0; p.onGround = true; }
  p.x = Math.max(14, Math.min(width - 14, p.x));
}

export function updateCampPlayer(dt, locked) {
  updateSidePlayer(dt, locked, CAMP_W, CAMP_GROUND);
}

const FLY_ACCEL = 460;
const FLY_MAX = 132;
const FLY_DRAG = 3.2;

export function updateRider(dt, locked) {
  const r = G.rider;
  let ax = 0, ay = 0;
  if (!locked) {
    if (held('ArrowLeft', 'KeyA')) ax -= 1;
    if (held('ArrowRight', 'KeyD')) ax += 1;
    if (held('ArrowUp', 'KeyW')) ay -= 1;
    if (held('ArrowDown', 'KeyS')) ay += 1;
  }
  const len = Math.hypot(ax, ay) || 1;
  r.vx += (ax / len) * FLY_ACCEL * dt;
  r.vy += (ay / len) * FLY_ACCEL * dt;

  // drag, so the heron glides to a stop instead of stopping dead
  const drag = Math.exp(-FLY_DRAG * dt);
  r.vx *= drag;
  r.vy *= drag;
  const speed = Math.hypot(r.vx, r.vy);
  if (speed > FLY_MAX) { r.vx = (r.vx / speed) * FLY_MAX; r.vy = (r.vy / speed) * FLY_MAX; }

  r.x += r.vx * dt;
  r.y += r.vy * dt;
  r.x = Math.max(8, Math.min(WORLD_W - 8, r.x));
  r.y = Math.max(8, Math.min(WORLD_H - 8, r.y));
  if (Math.abs(r.vx) > 6) r.face = r.vx > 0 ? 1 : -1;

  r.bob = (r.bob || 0) + dt * (2 + speed * 0.02);
  r.height = 23 + Math.sin(r.bob) * 2;
}

/** Where the heron should be when you first take off: over the lodge. */
export function seatRider() {
  const r = G.rider;
  if (!r.x && !r.y) {
    r.x = G.lodge.x * TILE + TILE / 2;
    r.y = G.lodge.y * TILE + TILE / 2;
  }
  r.vx = 0; r.vy = 0;
}
