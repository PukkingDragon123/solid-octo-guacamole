// The crew: hiring, skills, wages and the little state machine each beaver runs.

import { MAPW, MAPH, TILE, CREW_JOBS, SKILLS, XP_PER_LEVEL } from './config.js';
import { G, gain, spend, canAfford, toast, removeEntity } from './state.js';
import { findPath, clamp, pick, BEAVER_NAMES } from './util.js';
import { passable, isSwimTile } from './world.js';
import { findJobFor, releaseJob, removeJob } from './jobs.js';
import { completeSite } from './build.js';

export const capacity = (b) =>
  (8 + 4 * b.skills.carry) * (CREW_JOBS[b.role].carryBonus || 1);

export const walkSpeed = (b) =>
  58 * (1 + 0.12 * b.skills.speed) * (CREW_JOBS[b.role].speedBonus || 1);

export const workRate = (b, taskType) =>
  (1 + 0.15 * b.skills.work) * (CREW_JOBS[b.role].mult[taskType] || 1) * (b.morale < 40 ? 0.6 : 1);

export const maxEnergy = (b) => 100 + 20 * b.skills.endurance;
export const salaryOf = (b) => 2 + b.level;
export const xpForNext = (b) => XP_PER_LEVEL * b.level;

export function hireCost(role) {
  const base = CREW_JOBS[role].hire;
  const scale = 1 + G.beavers.length * 0.35;
  return {
    berries: Math.round(base.berries * scale),
    ...(base.wood ? { wood: Math.round(base.wood * scale) } : {}),
  };
}

function freshName() {
  const taken = new Set(G.beavers.map((b) => b.name));
  const free = BEAVER_NAMES.filter((n) => !taken.has(n));
  if (free.length) return pick(G.rng, free);
  return `${pick(G.rng, BEAVER_NAMES)} ${G.beavers.length + 1}`;
}

export function makeBeaver(role, tx, ty) {
  return {
    id: G.nextId++,
    name: freshName(),
    role,
    level: 1, xp: 0, sp: 1,
    skills: { speed: 0, carry: 0, work: 0, endurance: 0 },
    tx, ty,
    px: tx * TILE + TILE / 2, py: ty * TILE + TILE / 2,
    path: [], state: 'idle', onArrive: null,
    task: null, taskId: null,
    carry: { type: null, n: 0 },
    energy: 100, morale: 100,
    anim: G.rng() * 6.28, face: 1, idleT: 0, popup: null,
  };
}

export function hire(role) {
  if (G.beavers.length >= G.crewCap) { toast('No bunks left - build another Crew Lodge.', 'warn'); return false; }
  const cost = hireCost(role);
  if (!canAfford(cost)) { toast(`Not enough berries to hire a ${CREW_JOBS[role].name}.`, 'warn'); return false; }
  spend(cost);
  const b = makeBeaver(role, G.lodge.x, G.lodge.y);
  G.beavers.push(b);
  toast(`${b.name} the ${CREW_JOBS[role].name} joined the crew!`, 'good');
  return true;
}

export function fire(b) {
  releaseJob(b);
  const i = G.beavers.indexOf(b);
  if (i >= 0) G.beavers.splice(i, 1);
  if (G.ui.selectedBeaver === b.id) G.ui.selectedBeaver = null;
}

export function spendSkillPoint(b, skill) {
  if (b.sp <= 0 || b.skills[skill] >= SKILLS[skill].max) return false;
  b.sp--;
  b.skills[skill]++;
  if (skill === 'endurance') b.energy = Math.min(maxEnergy(b), b.energy + 20);
  return true;
}

function grantXp(b, amount) {
  b.xp += amount;
  while (b.xp >= xpForNext(b)) {
    b.xp -= xpForNext(b);
    b.level++;
    b.sp++;
    b.popup = { text: 'Level up!', t: 0 };
    toast(`${b.name} reached level ${b.level} - skill point ready.`, 'good');
  }
}

// ---------------------------------------------------------------- movement
function setPath(b, tx, ty, onArrive) {
  const path = findPath(b.tx, b.ty, tx, ty, MAPW, MAPH, passable);
  if (!path) return false;
  b.path = path;
  b.onArrive = onArrive;
  b.state = 'moving';
  return true;
}

function stepAlongPath(b, dt) {
  if (!b.path.length) return true;
  const next = b.path[0];
  const gx = next.x * TILE + TILE / 2;
  const gy = next.y * TILE + TILE / 2;
  const dx = gx - b.px, dy = gy - b.py;
  const d = Math.hypot(dx, dy);
  b.swimming = isSwimTile(b.tx, b.ty);
  const step = walkSpeed(b) * (b.swimming ? 0.62 : 1) * dt;
  if (d <= step) {
    b.px = gx; b.py = gy;
    b.tx = next.x; b.ty = next.y;
    b.path.shift();
  } else {
    b.px += (dx / d) * step;
    b.py += (dy / d) * step;
    if (Math.abs(dx) > 1) b.face = dx > 0 ? 1 : -1;
  }
  return b.path.length === 0;
}

function goDeposit(b) {
  releaseTaskIfDone(b);
  if (!setPath(b, G.lodge.x, G.lodge.y, 'deposit')) { b.state = 'idle'; }
}

function releaseTaskIfDone(b) {
  if (b.task && !G.jobs.includes(b.task)) { b.task = null; b.taskId = null; }
}

function goRest(b) {
  releaseJob(b);
  if (!setPath(b, G.lodge.x, G.lodge.y, 'rest')) { b.state = 'resting'; }
}

function deposit(b) {
  if (b.carry.n > 0 && b.carry.type) {
    const amount = Math.floor(b.carry.n);
    const fitted = gain(b.carry.type, amount);
    if (fitted < amount) toast(`Stores full - ${amount - fitted} ${b.carry.type} wasted.`, 'warn');
    b.carry = { type: null, n: 0 };
    grantXp(b, 3);
  }
  b.state = 'idle';
}

// ------------------------------------------------------------------- work
function doWork(b, dt) {
  const task = b.task;
  if (!task || !G.jobs.includes(task)) { b.task = null; b.taskId = null; b.state = 'idle'; return; }
  const e = task.entity;
  if (!e || !G.entities.includes(e)) { removeJob(task); b.state = 'idle'; return; }

  const rate = workRate(b, task.type);
  b.energy -= (3.4 - 0.28 * b.skills.endurance) * dt;
  b.working = 0.2;

  if (task.type === 'CHOP') {
    if (e.growth < 1) { removeJob(task); b.state = 'idle'; return; }
    if (b.carry.type && b.carry.type !== 'wood') { goDeposit(b); return; }
    const room = capacity(b) - b.carry.n;
    const amt = Math.min(2.6 * rate * dt, e.wood, room);
    e.wood -= amt;
    e.shake = 0.3;
    b.carry.type = 'wood';
    b.carry.n += amt;
    if (e.wood <= 0.02) {
      fellTree(e, b);
      grantXp(b, 12);
      removeJob(task);
      goDeposit(b);
    } else if (b.carry.n >= capacity(b) - 0.01) {
      goDeposit(b);
    }
  } else if (task.type === 'HARVEST') {
    if (b.carry.type && b.carry.type !== 'berries') { goDeposit(b); return; }
    const room = capacity(b) - b.carry.n;
    const amt = Math.min(2.2 * rate * dt, e.berries, room);
    e.berries -= amt;
    b.carry.type = 'berries';
    b.carry.n += amt;
    if (e.berries <= 0.02) {
      e.berries = 0;
      e.ripeT = 0;
      G.stats.harvested++;
      if (G.rng() < 0.55) gain('seeds', 1);
      grantXp(b, 6);
      removeJob(task);
      goDeposit(b);
    } else if (b.carry.n >= capacity(b) - 0.01) {
      goDeposit(b);
    }
  } else { // BUILD or PLANT - both pour labour into a site
    e.workDone += rate * dt;
    e.pulse = 0.25;
    if (e.workDone >= e.work) {
      completeSite(e);
      grantXp(b, task.type === 'BUILD' ? 15 : 7);
      removeJob(task);
      b.state = 'idle';
    }
  }
}

function fellTree(tree, b) {
  removeEntity(tree);
  G.stats.felled++;
  const seeds = 1 + (b && b.role === 'forager' && G.rng() < 0.5 ? 1 : 0);
  gain('seeds', seeds);
  const left = G.entities.filter((e) => e.kind === 'tree' && e.growth >= 1).length;
  if (left === 8) toast('Only 8 trees left - start replanting!', 'warn');
  if (left === 0) toast('The forest is bare. Plant saplings!', 'bad');
}

// ------------------------------------------------------------------ update
export function updateBeavers(dt) {
  for (const b of G.beavers) {
    b.anim += dt;
    if (b.working > 0) b.working -= dt;
    if (b.popup) { b.popup.t += dt; if (b.popup.t > 1.6) b.popup = null; }

    if (b.state !== 'resting' && b.energy <= 6) { goRest(b); }

    switch (b.state) {
      case 'idle': {
        if (b.carry.n > 0) { goDeposit(b); break; }
        if (b.energy < maxEnergy(b) * 0.18) { goRest(b); break; }
        // Still holding a job from before the delivery run? Go back and finish it.
        if (b.task && G.jobs.includes(b.task)) {
          if (!setPath(b, b.task.x, b.task.y, 'work')) releaseJob(b);
          break;
        }
        const task = findJobFor(b);
        if (task) {
          task.claimedBy = b.id;
          b.task = task;
          b.taskId = task.id;
          if (!setPath(b, task.x, task.y, 'work')) {
            task.claimedBy = null;
            task.entity.blocked = true;   // unreachable - stop offering it
            b.task = null; b.taskId = null;
          }
        } else {
          b.idleT -= dt;
          if (b.idleT <= 0) {
            b.idleT = 1.5 + G.rng() * 3;
            const nx = clamp(b.tx + Math.round((G.rng() - 0.5) * 3), 0, MAPW - 1);
            const ny = clamp(b.ty + Math.round((G.rng() - 0.5) * 3), 0, MAPH - 1);
            if (passable(nx, ny)) setPath(b, nx, ny, 'idle');
          }
          b.energy = Math.min(maxEnergy(b), b.energy + 2 * dt);
        }
        break;
      }
      case 'moving': {
        const done = stepAlongPath(b, dt);
        b.energy -= 0.7 * dt;
        if (done) {
          if (b.onArrive === 'work') b.state = 'working';
          else if (b.onArrive === 'deposit') deposit(b);
          else if (b.onArrive === 'rest') b.state = 'resting';
          else b.state = 'idle';
        }
        break;
      }
      case 'working':
        doWork(b, dt);
        break;
      case 'resting': {
        b.energy += 26 * dt;
        b.morale = Math.min(100, b.morale + 4 * dt);
        if (b.energy >= maxEnergy(b)) { b.energy = maxEnergy(b); b.state = 'idle'; }
        break;
      }
      default:
        b.state = 'idle';
    }
    b.energy = clamp(b.energy, 0, maxEnergy(b));
  }
}

// ----------------------------------------------------------------- payday
export function payday() {
  if (!G.beavers.length) {
    // Nobody left on the payroll - a young beaver wanders in looking for work.
    if (G.beavers.length < G.crewCap) {
      const b = makeBeaver('forager', G.lodge.x, G.lodge.y);
      G.beavers.push(b);
      toast(`${b.name}, a young forager, wandered in looking for work.`, 'good');
    }
    return;
  }
  const total = G.beavers.reduce((sum, b) => sum + salaryOf(b), 0);
  if (G.resources.berries >= total) {
    G.resources.berries -= total;
    G.stats.paid += total;
    for (const b of G.beavers) b.morale = Math.min(100, b.morale + 15);
    toast(`Payday: ${total} berries paid to ${G.beavers.length} beaver${G.beavers.length > 1 ? 's' : ''}.`, 'info');
    return;
  }
  // Not enough in the basket - pay who we can, the rest grumble.
  let purse = G.resources.berries;
  const unpaid = [];
  for (const b of G.beavers) {
    const wage = salaryOf(b);
    if (purse >= wage) { purse -= wage; b.morale = Math.min(100, b.morale + 15); }
    else { b.morale -= 38; unpaid.push(b); }
  }
  G.resources.berries = purse;
  G.stats.missedPay++;
  toast(`Not enough berries! ${unpaid.length} beaver${unpaid.length > 1 ? 's went' : ' went'} unpaid.`, 'bad');
  for (const b of [...unpaid]) {
    if (b.morale <= 0) {
      toast(`${b.name} the ${CREW_JOBS[b.role].name} quit.`, 'bad');
      fire(b);
    }
  }
}
