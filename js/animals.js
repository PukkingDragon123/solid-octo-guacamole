// Wild animals: their requests, whether the habitat satisfies them, and the
// little residents that move in once it does.

import { ANIMALS, NEED_LABEL, MAPW, MAPH, TILE } from './config.js';
import { G, tileAt, inBounds, addEntity, gain, toast } from './state.js';
import { countTileNear, countPlantNear, countStructureNear, countTreesNear, isWet } from './world.js';
import { clamp, chebyshev, shuffle } from './util.js';

const MAX_ACTIVE_REQUESTS = 3;

// Neighbours arrive roughly easiest-first, shuffled inside each tier, so nobody
// asks for a deep-water holt on day two.
const TIERS = [
  ['duck', 'rabbit'],
  ['frog', 'dragonfly', 'hedgehog', 'squirrel'],
  ['songbird', 'bee', 'otter'],
  ['turtle', 'kingfisher'],
];

export function resetAnimalPool() {
  G.animalPool = TIERS.flatMap((tier) => shuffle(G.rng, [...tier]));
  // The duck is the friendly tutorial case, so it always knocks first.
  G.animalPool = ['duck', ...G.animalPool.filter((id) => id !== 'duck')];
  G.requests = [];
  G.housed = [];
}

export const animalDef = (id) => ANIMALS.find((a) => a.id === id);

function nearRiver(x, y, r) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (!inBounds(x + dx, y + dy)) continue;
      if (tileAt(x + dx, y + dy).river) return true;
    }
  }
  return false;
}

function findAnchor(def) {
  const candidates = [];
  for (let y = 2; y < MAPH - 2; y++) {
    for (let x = 2; x < MAPW - 2; x++) {
      const tile = tileAt(x, y);
      if (isWet(tile.t) || tile.t === 'rock') continue;
      if (chebyshev(x, y, G.lodge.x, G.lodge.y) < 3) continue;
      if (G.requests.some((r) => chebyshev(x, y, r.x, r.y) < 6)) continue;
      if (G.entities.some((e) => e.kind === 'animal' && chebyshev(x, y, e.hx, e.hy) < 5)) continue;
      const close = nearRiver(x, y, 3);
      if (def.near === 'water' && !close) continue;
      if (def.near === 'land' && close) continue;
      candidates.push({ x, y });
    }
  }
  if (!candidates.length) return null;
  return candidates[Math.floor(G.rng() * candidates.length)];
}

export function spawnRequest(force = false) {
  if (!force && G.requests.length >= MAX_ACTIVE_REQUESTS) return null;
  if (!G.animalPool.length) return null;
  const id = G.animalPool[0];
  const def = animalDef(id);
  const spot = findAnchor(def);
  if (!spot) return null;
  G.animalPool.shift();
  const request = { animalId: id, x: spot.x, y: spot.y, radius: def.radius, t: 0 };
  G.requests.push(request);
  toast(`New contract: a ${def.name} wants a home.`, 'quest');
  return request;
}

/** How each need of a request is doing right now. */
export function needStatus(request) {
  const def = animalDef(request.animalId);
  const { x, y, radius } = request;
  return def.needs.map((need) => {
    let have = 0, want = 1;
    if (need.type === 'structure') { have = countStructureNear(x, y, radius, need.id); want = need.count; }
    else if (need.type === 'plant') { have = countPlantNear(x, y, radius, need.id); want = need.count; }
    else if (need.type === 'tile') { have = countTileNear(x, y, radius, need.tile); want = need.count; }
    else if (need.type === 'tree') { have = countTreesNear(x, y, radius); want = need.count; }
    else if (need.type === 'water') { have = G.waterLevel; want = need.level; }
    return { need, label: NEED_LABEL[need.type](need), have, want, met: have >= want };
  });
}

export function requestProgress(request) {
  const status = needStatus(request);
  const met = status.filter((s) => s.met).length;
  return { status, met, total: status.length, complete: met === status.length };
}

function houseAnimal(request) {
  const def = animalDef(request.animalId);
  // Claim the habitat that made this possible, so nobody demolishes it.
  const home = def.needs.find((n) => n.type === 'structure');
  let hx = request.x, hy = request.y;
  if (home) {
    let best = null;
    for (const e of G.entities) {
      if (e.kind !== 'structure' || e.blueprint !== home.id || e.animalId) continue;
      const d = chebyshev(e.x, e.y, request.x, request.y);
      if (d <= request.radius && (!best || d < best.d)) best = { e, d };
    }
    if (best) { best.e.animalId = def.id; hx = best.e.x; hy = best.e.y; }
  }

  addEntity({
    kind: 'animal', animalId: def.id, hx, hy,
    px: hx * TILE + TILE / 2, py: hy * TILE + TILE / 2,
    vx: 0, vy: 0, wanderT: 0, hop: G.rng() * 6.28,
  });
  G.housed.push(def.id);
  G.requests.splice(G.requests.indexOf(request), 1);

  const r = def.reward;
  if (r.hearts) gain('hearts', r.hearts);
  if (r.berries) gain('berries', r.berries);
  if (r.seeds) gain('seeds', r.seeds);
  if (r.skill && G.beavers.length) {
    const lucky = G.beavers.reduce((a, b) => (b.level < a.level ? b : a));
    lucky.sp += r.skill;
    toast(`${lucky.name} earned a skill point from the ${def.name}.`, 'good');
  }
  toast(`The ${def.name} moved in! +${r.hearts} hearts, +${r.berries} berries, +${r.seeds} seeds`, 'good');

  if (G.housed.length === ANIMALS.length) {
    G.won = true;
    toast('Every animal has a home. DAM IT - you did it!', 'good');
  }
}

let checkTimer = 0;

export function updateAnimals(dt) {
  checkTimer += dt;
  if (checkTimer >= 0.6) {
    checkTimer = 0;
    for (const request of [...G.requests]) {
      if (requestProgress(request).complete) houseAnimal(request);
    }
  }
  for (const request of G.requests) request.t += dt;

  for (const e of G.entities) {
    if (e.kind !== 'animal') continue;
    e.hop += dt * 3;
    e.wanderT -= dt;
    if (e.wanderT <= 0) {
      e.wanderT = 1.2 + G.rng() * 2.4;
      const a = G.rng() * Math.PI * 2;
      e.vx = Math.cos(a) * 11;
      e.vy = Math.sin(a) * 11;
    }
    const nx = e.px + e.vx * dt;
    const ny = e.py + e.vy * dt;
    const homePx = e.hx * TILE + TILE / 2;
    const homePy = e.hy * TILE + TILE / 2;
    if (Math.hypot(nx - homePx, ny - homePy) < TILE * 2.2) { e.px = nx; e.py = ny; }
    else { e.vx *= -1; e.vy *= -1; }
    e.px = clamp(e.px, TILE / 2, MAPW * TILE - TILE / 2);
    e.py = clamp(e.py, TILE / 2, MAPH * TILE - TILE / 2);
  }
}
