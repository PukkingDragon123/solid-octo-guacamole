// The single mutable game state, plus the little accessors every system uses.

import { MAPW, MAPH, SAVE_KEY, CAMP_GROUND } from './config.js';
import { makeRng } from './util.js';

export const G = {
  seed: 1,
  rng: makeRng(1),
  tiles: [],            // flat MAPW*MAPH array of tile records
  entities: [],         // trees, plants, structures, build sites, animals
  clutter: [],          // mushrooms, ferns, logs - decoration only, never blocks
  occupied: new Map(),  // tileIndex -> entity (one static entity per tile)
  beavers: [],
  jobs: [],
  nextId: 1,

  resources: { wood: 30, berries: 40, seeds: 12, hearts: 0 },
  caps: { wood: 150, berries: 150, seeds: 80 },

  time: 0,              // seconds since the game began
  day: 1,
  dayT: 0,              // 0..1 through the current day
  speed: 1,
  paused: false,

  waterLevel: 0,
  riverBlocked: false,
  riseTimer: 0,
  lodge: { x: 4, y: 4 },
  crewCap: 4,

  requests: [],         // animal requests waiting to be satisfied
  housed: [],           // animal ids already living here
  animalPool: [],       // ids not yet offered

  // where the player is and what they are doing
  mode: 'camp',                 // 'camp' (side view) or 'sky' (bird's eye)
  player: { x: 352, y: CAMP_GROUND, vx: 0, vy: 0, onGround: true, face: 1 },
  rider: { x: 0, y: 0, vx: 0, vy: 0, face: 1, height: 23, bob: 0, flying: false },
  station: null,                // the screen open at a camp station, if any

  ui: {
    tab: 'contracts',
    build: null,        // blueprint id currently being placed
    selectedBeaver: null,
    hoverTile: null,
    focusRequest: null,
    tipIndex: 0,
  },
  won: false,
  minigame: { active: false, cooldown: 0 },
  toasts: [],
  log: [],
  stats: { felled: 0, planted: 0, built: 0, harvested: 0, paid: 0, missedPay: 0 },
  gameOverShown: false,
};

export const tileIndex = (x, y) => y * MAPW + x;
export const inBounds = (x, y) => x >= 0 && y >= 0 && x < MAPW && y < MAPH;
export const tileAt = (x, y) => (inBounds(x, y) ? G.tiles[tileIndex(x, y)] : null);
export const entityAt = (x, y) => (inBounds(x, y) ? G.occupied.get(tileIndex(x, y)) || null : null);

export function addEntity(e) {
  e.id = G.nextId++;
  G.entities.push(e);
  if (e.kind !== 'animal') G.occupied.set(tileIndex(e.x, e.y), e);
  return e;
}

export function removeEntity(e) {
  const i = G.entities.indexOf(e);
  if (i >= 0) G.entities.splice(i, 1);
  if (e.kind !== 'animal' && G.occupied.get(tileIndex(e.x, e.y)) === e) {
    G.occupied.delete(tileIndex(e.x, e.y));
  }
}

export function reindexOccupancy() {
  G.occupied.clear();
  for (const e of G.entities) if (e.kind !== 'animal') G.occupied.set(tileIndex(e.x, e.y), e);
}

// -------------------------------------------------------------- resources
export function canAfford(cost) {
  for (const k in cost) if ((G.resources[k] || 0) < cost[k]) return false;
  return true;
}

export function spend(cost) {
  if (!canAfford(cost)) return false;
  for (const k in cost) G.resources[k] -= cost[k];
  return true;
}

export function gain(res, amount) {
  const cap = G.caps[res];
  const before = G.resources[res] || 0;
  // Capped, but never destructive: a delivery into a full store adds nothing
  // rather than trimming what is already there.
  const next = cap === undefined ? before + amount : Math.max(before, Math.min(cap, before + amount));
  G.resources[res] = next;
  return next - before; // how much actually fitted
}

export function missingLabel(cost) {
  const parts = [];
  for (const k in cost) if ((G.resources[k] || 0) < cost[k]) parts.push(`${cost[k] - G.resources[k]} more ${k}`);
  return parts.join(' and ');
}

// ------------------------------------------------------------------- feed
export function logMsg(text, tone = 'info') {
  G.log.unshift({ text, tone, day: G.day });
  if (G.log.length > 60) G.log.pop();
}

export function toast(text, tone = 'info') {
  const last = G.toasts[G.toasts.length - 1];
  if (last && last.text === text) { last.t = 0; last.repeat = (last.repeat || 1) + 1; return; }
  G.toasts.push({ text, tone, t: 0, life: 3.4 });
  if (G.toasts.length > 6) G.toasts.shift();
  logMsg(text, tone);
}

// ------------------------------------------------------------- save / load
const SAVED_KEYS = [
  'seed', 'tiles', 'entities', 'beavers', 'jobs', 'nextId', 'resources', 'caps',
  'time', 'day', 'dayT', 'waterLevel', 'riverBlocked', 'riseTimer', 'lodge',
  'crewCap', 'requests', 'housed', 'animalPool', 'stats', 'won', 'clutter',
  'mode', 'player', 'rider',
];

export function saveGame() {
  try {
    const data = {};
    for (const k of SAVED_KEYS) data[k] = G[k];
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn('DAM IT: could not save', err);
    return false;
  }
}

export function loadGame() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (err) { return false; }
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.tiles) || data.tiles.length !== MAPW * MAPH) return false;
    for (const k of SAVED_KEYS) if (data[k] !== undefined) G[k] = data[k];
    G.rng = makeRng((G.seed ^ Date.now()) >>> 0);
    reindexOccupancy();
    // Re-link jobs to their entities after the round trip through JSON.
    const byId = new Map(G.entities.map((e) => [e.id, e]));
    for (const j of G.jobs) j.entity = byId.get(j.entityId) || null;
    G.jobs = G.jobs.filter((j) => j.entity);
    for (const b of G.beavers) {
      b.task = b.taskId ? G.jobs.find((j) => j.id === b.taskId) || null : null;
      if (b.task) b.task.claimedBy = b.id;
      else { b.taskId = null; b.state = 'idle'; }
    }
    return true;
  } catch (err) {
    console.warn('DAM IT: save was unreadable', err);
    return false;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (err) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
}
