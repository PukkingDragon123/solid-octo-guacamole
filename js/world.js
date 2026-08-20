// Map generation, tile queries and the water-level simulation.

import { MAPW, MAPH, MAX_WATER_LEVEL, PLANT_IDS } from './config.js';
import { G, tileAt, tileIndex, inBounds, addEntity, removeEntity, entityAt, gain, toast } from './state.js';
import { makeRng, valueNoise, clamp, chebyshev } from './util.js';

export const isWet = (t) => t === 'water' || t === 'pond';
export const isDamTile = (tile) => !!(tile && tile.dam);

/** Beavers walk anywhere but bare rock — open water they simply swim across. */
export function passable(x, y) {
  const tile = tileAt(x, y);
  if (!tile) return false;
  return tile.t !== 'rock';
}

/** Swimming is slower than trotting, and a dam is as good as dry land. */
export function isSwimTile(x, y) {
  const tile = tileAt(x, y);
  return !!tile && isWet(tile.t) && !tile.dam;
}

export function generateWorld(seed) {
  const rng = makeRng(seed);
  G.seed = seed;
  G.rng = rng;
  G.tiles = new Array(MAPW * MAPH);
  G.entities = [];
  G.occupied.clear();
  G.nextId = 1;

  const noise = valueNoise(rng, MAPW, MAPH, 6);
  for (let y = 0; y < MAPH; y++) {
    for (let x = 0; x < MAPW; x++) {
      G.tiles[tileIndex(x, y)] = {
        t: 'grass',
        elev: clamp(Math.round(noise[y * MAPW + x] * 4), 0, 4),
        river: false, step: -1, dam: false, flooded: false,
        v: rng(), // per-tile art variation
      };
    }
  }

  // ---- carve the river from the west edge to the east edge
  let cy = 6 + rng() * (MAPH - 13);
  const widths = new Array(MAPW).fill(2);
  for (let i = 0; i < 4; i++) widths[2 + Math.floor(rng() * (MAPW - 5))] = 3;
  // two narrows: cheap places to seal the channel
  for (let i = 0; i < 2; i++) {
    const nx = 6 + Math.floor(rng() * (MAPW - 14));
    widths[nx] = 1; widths[nx + 1] = 1;
  }
  let step = 0;
  for (let x = 0; x < MAPW; x++) {
    cy = clamp(cy + (rng() - 0.5) * 1.7, 4, MAPH - 6);
    const top = Math.round(cy);
    for (let k = 0; k < widths[x]; k++) {
      const y = top + k;
      if (!inBounds(x, y)) continue;
      const tile = G.tiles[tileIndex(x, y)];
      tile.t = 'water'; tile.river = true; tile.step = step; tile.elev = 0;
    }
    step++;
  }

  // ---- shape a valley: the ground climbs away from the channel, and the noise
  // adds hummocks that stay dry even close to the water. That gives the pond a
  // ragged, natural shoreline instead of a uniform band.
  const distToRiver = riverDistanceField();
  for (let i = 0; i < G.tiles.length; i++) {
    const tile = G.tiles[i];
    if (tile.river) continue;
    const d = distToRiver[i];
    // the first step out of the channel is shallow, then the valley wall climbs fast
    const bank = d <= 1 ? d : 1 + Math.ceil((d - 1) / 0.8);
    const hummock = Math.round(noise[i] * 5);   // 0..5 lumps in the terrain
    tile.elev = clamp(Math.max(bank, hummock), 0, 6);
    if (d <= 1) tile.t = 'dirt';
    else if (d > 3 && noise[i] > 0.88) tile.t = 'rock';
    else if (noise[i] < 0.2 && d > 2) tile.t = 'dirt';
  }

  // ---- the lodge: a dry, roomy spot a few tiles back from the water
  let best = null;
  for (let y = 2; y < MAPH - 2; y++) {
    for (let x = 2; x < MAPW - 2; x++) {
      const tile = tileAt(x, y);
      const d = distToRiver[tileIndex(x, y)];
      if (isWet(tile.t) || tile.t === 'rock' || d < 2 || d > 4) continue;
      const score = -Math.abs(x - 5) - Math.abs(y - MAPH / 2) * 0.5 + tile.elev;
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  G.lodge = best ? { x: best.x, y: best.y } : { x: 3, y: 3 };
  tileAt(G.lodge.x, G.lodge.y).t = 'dirt';

  // ---- forest: clumps of trees away from the lodge and the channel
  const treeTarget = 46;
  let guard = 0;
  let placed = 0;
  while (placed < treeTarget && guard++ < 3000) {
    const cxs = 2 + Math.floor(rng() * (MAPW - 4));
    const cys = 2 + Math.floor(rng() * (MAPH - 4));
    const clump = 2 + Math.floor(rng() * 4);
    for (let k = 0; k < clump && placed < treeTarget; k++) {
      const x = clamp(cxs + Math.round((rng() - 0.5) * 4), 1, MAPW - 2);
      const y = clamp(cys + Math.round((rng() - 0.5) * 4), 1, MAPH - 2);
      const tile = tileAt(x, y);
      if (!tile || isWet(tile.t) || tile.t === 'rock') continue;
      if (entityAt(x, y)) continue;
      if (chebyshev(x, y, G.lodge.x, G.lodge.y) < 3) continue;
      addEntity(makeTree(x, y, rng));
      placed++;
    }
  }

  // ---- a few wild berry bushes to get the crew fed
  for (let i = 0; i < 5; i++) {
    for (let tries = 0; tries < 60; tries++) {
      const x = 1 + Math.floor(rng() * (MAPW - 2));
      const y = 1 + Math.floor(rng() * (MAPH - 2));
      const tile = tileAt(x, y);
      if (!tile || isWet(tile.t) || tile.t === 'rock' || entityAt(x, y)) continue;
      addEntity({
        kind: 'plant', blueprint: rng() < 0.5 ? 'sunberry' : 'dewberry',
        x, y, growth: 1, berries: 6, wild: true, sway: rng() * 6.28,
      });
      break;
    }
  }

  G.waterLevel = 0;
  G.riverBlocked = false;
  G.riseTimer = 0;
  refreshWater(true);
}

export function makeTree(x, y, rng = G.rng, grown = true) {
  return {
    kind: 'tree', x, y,
    wood: 13 + Math.floor(rng() * 8),
    growth: grown ? 1 : 0,
    variant: Math.floor(rng() * 3),
    sway: rng() * 6.28,
    marked: false,
  };
}

/** Chebyshev distance from every tile to the nearest river tile (BFS). */
function riverDistanceField() {
  const d = new Int16Array(MAPW * MAPH).fill(999);
  const queue = [];
  for (let i = 0; i < G.tiles.length; i++) if (G.tiles[i].river) { d[i] = 0; queue.push(i); }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % MAPW, y = (i / MAPW) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const ni = tileIndex(nx, ny);
        if (d[ni] > d[i] + 1) { d[ni] = d[i] + 1; queue.push(ni); }
      }
    }
  }
  return d;
}

// ------------------------------------------------------------ water system

/** True when no undammed path of river tiles links the source to the outlet. */
export function computeBlocked() {
  const seen = new Uint8Array(MAPW * MAPH);
  const queue = [];
  for (let y = 0; y < MAPH; y++) {
    for (let x = 0; x < 2; x++) {
      const tile = tileAt(x, y);
      if (tile && tile.river && !tile.dam) { seen[tileIndex(x, y)] = 1; queue.push([x, y]); }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    if (x >= MAPW - 2) return false; // water still reaches the outlet
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const ni = tileIndex(nx, ny);
        if (seen[ni]) continue;
        const tile = G.tiles[ni];
        if (!tile.river || tile.dam) continue;
        seen[ni] = 1; queue.push([nx, ny]);
      }
    }
  }
  return true;
}

export function updateWater(dt) {
  const blocked = computeBlocked();
  if (blocked !== G.riverBlocked) {
    G.riverBlocked = blocked;
    toast(blocked ? '🌊 The channel is sealed! The water starts to rise.'
                  : '💧 The river found a way through — the water is draining.',
          blocked ? 'good' : 'warn');
  }
  const before = G.waterLevel;
  if (blocked) {
    if (G.waterLevel < MAX_WATER_LEVEL) {
      G.riseTimer += dt;
      if (G.riseTimer >= 26) { G.riseTimer = 0; G.waterLevel++; }
    } else G.riseTimer = 0;
  } else if (G.waterLevel > 0) {
    G.riseTimer -= dt;
    if (G.riseTimer <= -18) { G.riseTimer = 0; G.waterLevel--; }
  } else G.riseTimer = 0;

  if (G.waterLevel !== before) {
    refreshWater();
    toast(`🌊 Water level is now ${G.waterLevel} of ${MAX_WATER_LEVEL}.`,
          G.waterLevel > before ? 'good' : 'warn');
  }
}

/** Recompute which tiles are underwater for the current water level. */
export function refreshWater(silent = false) {
  const level = G.waterLevel;
  const flooded = new Uint8Array(MAPW * MAPH);
  const queue = [];
  for (let i = 0; i < G.tiles.length; i++) {
    if (G.tiles[i].river) { flooded[i] = 1; queue.push(i); }
  }
  if (level > 0) {
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      const x = i % MAPW, y = (i / MAPW) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx && dy) continue; // water spreads orthogonally, keeps edges tidy
          const nx = x + dx, ny = y + dy;
          if (!inBounds(nx, ny)) continue;
          const ni = tileIndex(nx, ny);
          if (flooded[ni]) continue;
          const tile = G.tiles[ni];
          if (tile.t === 'rock' || tile.elev > level) continue;
          const occupant = G.occupied.get(ni);
          if (occupant && (occupant.kind === 'structure' || occupant.kind === 'site')) continue;
          flooded[ni] = 1; queue.push(ni);
        }
      }
    }
  }

  let drowned = 0;
  for (let i = 0; i < G.tiles.length; i++) {
    const tile = G.tiles[i];
    const wet = flooded[i] === 1;
    if (wet) {
      if (!tile.river) {
        if (!tile.flooded) { tile.baseType = tile.t; tile.flooded = true; }
        tile.t = 'pond';
      } else {
        tile.t = level > 0 ? 'pond' : 'water';
      }
      const occupant = G.occupied.get(i);
      if (occupant && (occupant.kind === 'tree' || (occupant.kind === 'plant' && occupant.blueprint !== 'reed'))) {
        removeEntity(occupant);
        drowned++;
      }
    } else if (tile.flooded) {
      tile.flooded = false;
      tile.t = tile.baseType || 'grass';
    } else if (tile.river) {
      tile.t = 'water';
    }
  }
  if (drowned) {
    gain('seeds', drowned);
    if (!silent) toast(`🌧️ ${drowned} plant${drowned > 1 ? 's were' : ' was'} lost to the rising water — ${drowned} seed${drowned > 1 ? 's' : ''} salvaged.`, 'warn');
  }
  // A drowned plant may have been someone's job.
  G.jobs = G.jobs.filter((j) => G.entities.includes(j.entity));
  for (const b of G.beavers) if (b.task && !G.jobs.includes(b.task)) { b.task = null; b.taskId = null; b.state = 'idle'; }
}

// ------------------------------------------------------------ area queries
export function countNear(cx, cy, radius, test) {
  let n = 0;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (!inBounds(x, y)) continue;
      if (test(x, y)) n++;
    }
  }
  return n;
}

export function countTileNear(cx, cy, radius, type) {
  return countNear(cx, cy, radius, (x, y) => tileAt(x, y).t === type);
}

export function countPlantNear(cx, cy, radius, blueprintId) {
  return countNear(cx, cy, radius, (x, y) => {
    const e = entityAt(x, y);
    return !!e && e.kind === 'plant' && e.blueprint === blueprintId && e.growth >= 1;
  });
}

export function countStructureNear(cx, cy, radius, blueprintId) {
  return countNear(cx, cy, radius, (x, y) => {
    const e = entityAt(x, y);
    return !!e && e.kind === 'structure' && e.blueprint === blueprintId;
  });
}

export function countTreesNear(cx, cy, radius) {
  return countNear(cx, cy, radius, (x, y) => {
    const e = entityAt(x, y);
    return !!e && e.kind === 'tree' && e.growth >= 1;
  });
}

export const isPlantBlueprint = (id) => PLANT_IDS.includes(id);
