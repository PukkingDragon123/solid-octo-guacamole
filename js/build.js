// Placing blueprints, turning finished sites into real things, and demolition.

import { BLUEPRINTS, PLANT_IDS } from './config.js';
import { G, tileAt, entityAt, addEntity, removeEntity, spend, canAfford, gain, toast, missingLabel } from './state.js';
import { refreshWater, isWet, makeTree } from './world.js';
import { addJob, removeJobFor, jobFor } from './jobs.js';

/** Why a blueprint may or may not go on this tile. */
export function canPlace(bpId, x, y) {
  const bp = BLUEPRINTS[bpId];
  const tile = tileAt(x, y);
  if (!bp || !tile) return { ok: false, reason: 'Off the map' };
  if (entityAt(x, y)) return { ok: false, reason: 'Something is already here' };
  if (x === G.lodge.x && y === G.lodge.y) return { ok: false, reason: 'That is the lodge' };

  if (bpId === 'dam') {
    if (!tile.river) return { ok: false, reason: 'Dams go on the river channel' };
    if (tile.dam) return { ok: false, reason: 'Already dammed here' };
  } else if (bp.on.includes('pond')) {
    if (tile.t !== 'pond') return { ok: false, reason: 'Needs still pond water — raise the water first' };
  } else if (!bp.on.includes(tile.t)) {
    if (isWet(tile.t)) return { ok: false, reason: 'Cannot build in the water' };
    return { ok: false, reason: `Cannot build on ${tile.t}` };
  }
  if (!canAfford(bp.cost)) return { ok: false, reason: `Need ${missingLabel(bp.cost)}` };
  return { ok: true };
}

export function placeSite(bpId, x, y) {
  const check = canPlace(bpId, x, y);
  if (!check.ok) { toast(check.reason, 'warn'); return null; }
  const bp = BLUEPRINTS[bpId];
  spend(bp.cost);
  const site = addEntity({
    kind: 'site', blueprint: bpId, x, y,
    work: bp.work, workDone: 0, pulse: 0,
  });
  addJob(bp.jobType, site, bp.cat === 'dam' ? 1 : 0);
  return site;
}

export function completeSite(site) {
  const bpId = site.blueprint;
  const bp = BLUEPRINTS[bpId];
  const { x, y } = site;
  removeEntity(site);

  if (bpId === 'sapling') {
    const tree = makeTree(x, y, G.rng, false);
    tree.growth = 0.02;
    addEntity(tree);
    G.stats.planted++;
    return;
  }
  if (PLANT_IDS.includes(bpId)) {
    addEntity({ kind: 'plant', blueprint: bpId, x, y, growth: 0.05, berries: 0, ripeT: 0, sway: G.rng() * 6.28 });
    G.stats.planted++;
    return;
  }

  if (bpId === 'dam') {
    // A dam is part of the tile itself, not a free-standing entity.
    tileAt(x, y).dam = true;
    G.stats.built++;
    refreshWater(true);
    return;
  }

  const structure = addEntity({ kind: 'structure', blueprint: bpId, x, y, t: 0, animalId: null });
  G.stats.built++;

  if (bpId === 'lodge') {
    G.crewCap += 2;
    toast('🏚️ Another lodge is up — room for two more beavers.', 'good');
  }
  if (bpId === 'shed') {
    G.caps.wood += 80; G.caps.berries += 80; G.caps.seeds += 40;
    toast('📦 Storage shed finished — room for a lot more supplies.', 'good');
  }
  if (bp.cat === 'habitat') toast(`${bp.icon} ${bp.name} finished. Somebody is going to love that.`, 'good');
}

export function cancelSite(site) {
  const bp = BLUEPRINTS[site.blueprint];
  const progress = site.workDone / site.work;
  for (const k in bp.cost) gain(k, Math.max(0, Math.round(bp.cost[k] * (1 - progress) * 0.75)));
  removeJobFor(site);
  removeEntity(site);
  toast('Site cancelled — some materials were recovered.', 'info');
}

export function demolish(entity) {
  if (entity.kind === 'site') { cancelSite(entity); return; }
  if (entity.kind === 'structure') {
    const bp = BLUEPRINTS[entity.blueprint];
    if (entity.animalId) { toast('Somebody lives there! Find them another home first.', 'warn'); return; }
    if (entity.blueprint === 'lodge') { G.crewCap -= 2; }
    if (entity.blueprint === 'shed') { G.caps.wood -= 80; G.caps.berries -= 80; G.caps.seeds -= 40; }
    for (const k in bp.cost) gain(k, Math.round(bp.cost[k] * 0.5));
    removeJobFor(entity);
    removeEntity(entity);
    toast(`${bp.name} taken down — half the materials came back.`, 'info');
    return;
  }
  if (entity.kind === 'plant') {
    removeJobFor(entity);
    removeEntity(entity);
    toast('Plant cleared.', 'info');
  }
}

export function removeDam(x, y) {
  const tile = tileAt(x, y);
  if (!tile || !tile.dam) return;
  tile.dam = false;
  gain('wood', 1);
  refreshWater(true);
  toast('🪵 Dam segment pulled out. The water will find the gap.', 'warn');
}

/** Clicking a grown tree marks or unmarks it for felling. */
export function toggleTreeMark(tree) {
  if (tree.growth < 1) { toast('That sapling is still growing — let it be.', 'warn'); return; }
  const existing = jobFor(tree);
  if (existing) { removeJobFor(tree); tree.marked = false; }
  else { tree.marked = true; tree.blocked = false; addJob('CHOP', tree); }
}
