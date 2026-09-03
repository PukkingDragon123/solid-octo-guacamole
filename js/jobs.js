// The job board. Everything a beaver can be told to do lives here.

import { G } from './state.js';
import { CREW_JOBS } from './config.js';
import { dist } from './util.js';

export function addJob(type, entity, priority = 0) {
  if (jobFor(entity)) return null;
  const job = {
    id: G.nextId++, type, entity, entityId: entity.id,
    x: entity.x, y: entity.y, claimedBy: null, priority,
  };
  G.jobs.push(job);
  return job;
}

export function jobFor(entity) {
  return G.jobs.find((j) => j.entity === entity) || null;
}

export function removeJob(job) {
  const i = G.jobs.indexOf(job);
  if (i >= 0) G.jobs.splice(i, 1);
  for (const b of G.beavers) if (b.task === job) { b.task = null; b.taskId = null; b.state = 'idle'; }
}

export function removeJobFor(entity) {
  const job = jobFor(entity);
  if (job) removeJob(job);
}

export function releaseJob(beaver) {
  if (beaver.task) {
    beaver.task.claimedBy = null;
    beaver.task = null;
    beaver.taskId = null;
  }
}

/**
 * Pick the most attractive open job for this beaver: near beats far, and a job
 * the beaver is trained for is worth walking a long way for.
 */
export function findJobFor(beaver) {
  const woodFull = G.resources.wood >= G.caps.wood;
  const berriesFull = G.resources.berries >= G.caps.berries;
  const orders = G.orders || {};
  let best = null, bestScore = -Infinity;
  for (const job of G.jobs) {
    if (job.claimedBy) continue;
    if (job.entity.blocked) continue;
    if (orders[job.type] === 0) continue;                // the board says leave it
    if (job.type === 'CHOP' && woodFull) continue;       // nowhere to put it
    if (job.type === 'HARVEST' && berriesFull) continue;
    const mult = CREW_JOBS[beaver.role].mult[job.type] || 1;
    const d = dist(beaver.tx, beaver.ty, job.x, job.y);
    const boost = orders[job.type] === 2 ? 90 : 0;       // pinned to the top of the board
    const score = mult * 24 + job.priority * 30 + boost - d;
    if (score > bestScore) { bestScore = score; best = job; }
  }
  return best;
}

export function jobCounts() {
  const counts = { CHOP: 0, BUILD: 0, PLANT: 0, HARVEST: 0 };
  for (const j of G.jobs) counts[j.type] = (counts[j.type] || 0) + 1;
  return counts;
}
