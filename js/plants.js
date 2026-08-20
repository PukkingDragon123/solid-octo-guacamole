// Growth: saplings becoming trees, bushes ripening, harvest jobs appearing.

import { BERRY_IDS, TILE } from './config.js';
import { G, tileAt, inBounds } from './state.js';
import { addJob, jobFor } from './jobs.js';
import { dist } from './util.js';

const GROW_SECONDS = {
  sapling: 150, sunberry: 55, dewberry: 55, goldberry: 80,
  clover: 30, bluebell: 35, sunflower: 40, reed: 35,
};
const RIPEN_SECONDS = { sunberry: 55, dewberry: 55, goldberry: 80 };
const YIELD = { sunberry: 9, dewberry: 9, goldberry: 14 };

function gardenerBoost(x, y) {
  for (const b of G.beavers) {
    if (b.role !== 'gardener') continue;
    if (dist(b.px / TILE, b.py / TILE, x + 0.5, y + 0.5) < 4.5) return 1.7;
  }
  return 1;
}

function dampBonus(e) {
  if (e.blueprint !== 'dewberry' && e.blueprint !== 'reed') return 1;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const tile = inBounds(e.x + dx, e.y + dy) ? tileAt(e.x + dx, e.y + dy) : null;
    if (tile && tile.t === 'pond') return 1.35;
  }
  return 1;
}

export function updatePlants(dt) {
  for (const e of G.entities) {
    if (e.shake > 0) e.shake -= dt;
    if (e.pulse > 0) e.pulse -= dt;

    if (e.kind === 'tree') {
      if (e.growth < 1) {
        e.growth += (dt * gardenerBoost(e.x, e.y)) / GROW_SECONDS.sapling;
        if (e.growth >= 1) {
          e.growth = 1;
          e.wood = 13 + Math.floor(G.rng() * 8);
        }
      }
      continue;
    }
    if (e.kind !== 'plant') continue;

    const boost = gardenerBoost(e.x, e.y) * dampBonus(e);
    if (e.growth < 1) {
      e.growth += (dt * boost) / (GROW_SECONDS[e.blueprint] || 45);
      if (e.growth > 1) e.growth = 1;
      continue;
    }
    if (!BERRY_IDS.includes(e.blueprint)) continue;

    const ripen = RIPEN_SECONDS[e.blueprint];
    if (e.berries <= 0) {
      e.ripeT = (e.ripeT || 0) + dt * boost;
      if (e.ripeT >= ripen) {
        e.ripeT = ripen;
        e.berries = YIELD[e.blueprint];
      }
    }
    if (e.berries > 0 && !jobFor(e)) addJob('HARVEST', e);
  }
}

export const ripeness = (e) => {
  if (e.berries > 0) return 1;
  const ripen = RIPEN_SECONDS[e.blueprint];
  return ripen ? Math.min(1, (e.ripeT || 0) / ripen) : 0;
};
