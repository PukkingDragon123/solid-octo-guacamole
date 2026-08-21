// The screens you open by walking up to something in the camp: the job board,
// the bunkhouse roster and the stores ledger.

import { VIEW_W, VIEW_H, CREW_JOBS, SKILLS, ANIMALS, BLUEPRINTS, MAX_WATER_LEVEL } from '../config.js';
import { G, saveGame, toast } from '../state.js';
import { PAL, rect, frame, px, text, textWidth, wrap } from '../gfx/pixel.js';
import * as S from '../gfx/sprites.js';
import { panel, note, button, bar, pips, scrim, scrollbar, hovering } from './widgets.js';
import { input, pressed } from '../input.js';
import { hire, hireCost, fire, spendSkillPoint, salaryOf, xpForNext, maxEnergy } from '../beavers.js';
import { animalDef, needStatus } from '../animals.js';

const scrolls = { board: 0, crew: 0, stores: 0 };
let confirmFire = null;
let confirmNew = false;

export function openStation(id) {
  G.station = id;
  scrolls.board = 0; scrolls.crew = 0; scrolls.stores = 0;
  confirmFire = null;
  confirmNew = false;
}

export function closeStation() {
  G.station = null;
  confirmFire = null;
}

const RES_ICONS = { wood: 'wood', berries: 'berry', seeds: 'seed', hearts: 'heart' };

function costLine(cost) {
  return Object.entries(cost).map(([k, v]) => `${v} ${k}`).join(', ');
}

/** Draws whichever station screen is open. Returns true if it stays open. */
export function drawStation(ctx, t, dt) {
  if (!G.station) return false;
  scrim(ctx, VIEW_W, VIEW_H, 0.62);

  const w = 452, h = 244;
  const x = (VIEW_W - w) >> 1;
  const y = (VIEW_H - h) >> 1;
  const titles = { board: 'JOB BOARD', crew: 'THE CREW', stores: 'STORES' };
  const body = panel(ctx, x, y, w, h, titles[G.station] || '');

  if (G.station === 'board') drawBoard(ctx, body, t);
  else if (G.station === 'crew') drawCrew(ctx, body, t);
  else if (G.station === 'stores') drawStores(ctx, body, t);

  // close affordance
  const closeW = 54;
  if (button(ctx, x + w - closeW - 6, y + h - 15, closeW, 11, 'E  CLOSE') || pressed('KeyE', 'Escape')) {
    closeStation();
    return false;
  }
  return true;
}

// ------------------------------------------------------------ job board
function drawBoard(ctx, box, t) {
  const tabs = [['contracts', 'CONTRACTS'], ['hire', 'HIRE A BEAVER']];
  let tx = box.x;
  for (const [id, label] of tabs) {
    const tw = textWidth(label) + 12;
    if (button(ctx, tx, box.y, tw, 12, label, { active: G.ui.tab === id })) G.ui.tab = id;
    tx += tw + 3;
  }
  const listY = box.y + 16;
  const listH = box.h - 34;

  if (G.ui.tab === 'hire') { drawHire(ctx, box, listY, listH); return; }

  if (!G.requests.length) {
    note(ctx, box.x, listY, box.w, 40);
    text(ctx, 'NOTHING PINNED UP TODAY.', box.x + box.w / 2, listY + 12, PAL.ink, { align: 'center' });
    text(ctx, 'A NEW NEIGHBOUR USUALLY TURNS UP AT DAWN.', box.x + box.w / 2, listY + 22, PAL.paper3, { align: 'center' });
    return;
  }

  const cardW = (box.w - 6) >> 1;
  const cardH = 96;
  const rows = Math.ceil(G.requests.length / 2);
  const contentH = rows * (cardH + 4);
  scrolls.board = Math.max(0, Math.min(Math.max(0, contentH - listH), scrolls.board + (hovering(box.x, listY, box.w, listH) ? input.wheel : 0)));

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, listY, box.w, listH);
  ctx.clip();

  G.requests.forEach((request, i) => {
    const cx = box.x + (i % 2) * (cardW + 6);
    const cy = listY + Math.floor(i / 2) * (cardH + 4) - scrolls.board;
    if (cy > listY + listH || cy + cardH < listY) return;
    const def = animalDef(request.animalId);
    const status = needStatus(request);
    const met = status.filter((n) => n.met).length;

    note(ctx, cx, cy, cardW, cardH);
    const img = S.animalSprite(def.id, 0);
    ctx.drawImage(img, cx + 3, cy + 3);
    text(ctx, def.name, cx + 20, cy + 5, PAL.ink);
    text(ctx, `${met}/${status.length}`, cx + cardW - 5, cy + 5, met === status.length ? PAL.grass1 : PAL.paper3, { align: 'right' });

    const quote = wrap(`"${def.intro}"`, cardW - 8);
    quote.slice(0, 3).forEach((lineStr, k) => text(ctx, lineStr, cx + 4, cy + 15 + k * 8, PAL.paper3));

    status.forEach((need, k) => {
      const ny = cy + 40 + k * 9;
      if (ny > cy + cardH - 18) return;
      rect(ctx, cx + 3, ny - 1, cardW - 6, 8, need.met ? '#cfe6c0' : '#e6d5b0');
      text(ctx, need.met ? '*' : '-', cx + 5, ny, need.met ? PAL.grass1 : PAL.paper3);
      const label = need.label.length > 26 ? `${need.label.slice(0, 25)}.` : need.label;
      text(ctx, label, cx + 12, ny, PAL.ink);
      const count = need.need.type === 'water' ? `${need.have}/${need.want}`
        : `${Math.min(need.have, need.want)}/${need.want}`;
      text(ctx, count, cx + cardW - 5, ny, need.met ? PAL.grass1 : PAL.ink, { align: 'right' });
    });

    const rw = def.reward;
    text(ctx, `PAYS ${rw.hearts} HEART ${rw.berries} BERRY ${rw.seeds} SEED`, cx + 4, cy + cardH - 10, PAL.paper3);
    const focused = G.ui.focusRequest === def.id;
    if (button(ctx, cx + cardW - 44, cy + cardH - 13, 40, 11, focused ? 'HIDE' : 'FIND', { active: focused })) {
      G.ui.focusRequest = focused ? null : def.id;
    }
  });
  ctx.restore();
  scrollbar(ctx, box.x + box.w + 1, listY, listH, scrolls.board, contentH, listH);
  text(ctx, 'EVERYTHING MUST SIT INSIDE THE RING ON THE MAP.', box.x, box.y + box.h - 12, PAL.paper3);
}

function drawHire(ctx, box, listY, listH) {
  const cardW = (box.w - 6) >> 1;
  const cardH = 46;
  const roles = Object.entries(CREW_JOBS);
  roles.forEach(([id, role], i) => {
    const cx = box.x + (i % 2) * (cardW + 6);
    const cy = listY + Math.floor(i / 2) * (cardH + 4);
    const cost = hireCost(id);
    const afford = Object.entries(cost).every(([k, v]) => G.resources[k] >= v);
    const room = G.beavers.length < G.crewCap;

    note(ctx, cx, cy, cardW, cardH);
    const img = S.crewSideSprite(id, 0);
    ctx.drawImage(img, cx + 2, cy + 2);
    text(ctx, role.name, cx + 18, cy + 4, PAL.ink);
    wrap(role.blurb, cardW - 22).slice(0, 2).forEach((lineStr, k) => text(ctx, lineStr, cx + 18, cy + 14 + k * 8, PAL.paper3));
    text(ctx, costLine(cost), cx + 4, cy + cardH - 10, afford ? PAL.ink : PAL.red);
    if (button(ctx, cx + cardW - 40, cy + cardH - 13, 36, 11, 'HIRE', { enabled: afford && room })) hire(id);
  });

  const wages = G.beavers.reduce((sum, b) => sum + salaryOf(b), 0);
  text(ctx, `CREW ${G.beavers.length}/${G.crewCap}   WAGES ${wages} BERRIES AT DAWN`,
       box.x, box.y + box.h - 12, G.beavers.length >= G.crewCap ? PAL.gold2 : PAL.paper3);
}

// ---------------------------------------------------------------- crew
function drawCrew(ctx, box, t) {
  if (!G.beavers.length) {
    note(ctx, box.x, box.y, box.w, 34);
    text(ctx, 'NOBODY ON THE PAYROLL. HIRE AT THE JOB BOARD.', box.x + box.w / 2, box.y + 13, PAL.ink, { align: 'center' });
    return;
  }
  const cardH = 46;
  const listH = box.h - 22;
  const contentH = G.beavers.length * (cardH + 3);
  scrolls.crew = Math.max(0, Math.min(Math.max(0, contentH - listH), scrolls.crew + (hovering(box.x, box.y, box.w, listH) ? input.wheel : 0)));

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, listH);
  ctx.clip();

  G.beavers.forEach((b, i) => {
    const cy = box.y + i * (cardH + 3) - scrolls.crew;
    if (cy > box.y + listH || cy + cardH < box.y) return;
    const role = CREW_JOBS[b.role];
    note(ctx, box.x, cy, box.w, cardH);

    const img = S.crewSideSprite(b.role, Math.floor(t * 1.5 + i) % 2);
    ctx.drawImage(img, box.x + 3, cy + 3);
    text(ctx, b.name, box.x + 20, cy + 4, PAL.ink);
    text(ctx, `LV ${b.level}`, box.x + 20 + textWidth(b.name) + 6, cy + 4, PAL.wood2);
    const line = `${role.name} - ${stateLabel(b)}`;
    text(ctx, line.length > 16 ? `${line.slice(0, 16)}.` : line, box.x + 20, cy + 14, PAL.paper3);
    text(ctx, `WAGE ${salaryOf(b)}`, box.x + 20, cy + 24, PAL.wood2);
    if (b.morale < 60) text(ctx, `MORALE ${Math.round(b.morale)}%`, box.x + 20, cy + 34, PAL.red);

    // bars
    bar(ctx, box.x + 118, cy + 6, 62, 5, b.xp / xpForNext(b), PAL.gold);
    text(ctx, 'XP', box.x + 184, cy + 5, PAL.paper3);
    bar(ctx, box.x + 118, cy + 15, 62, 5, b.energy / maxEnergy(b), PAL.grass2);
    text(ctx, 'PEP', box.x + 184, cy + 14, PAL.paper3);
    if (b.sp > 0) {
      rect(ctx, box.x + 118, cy + 24, 84, 9, PAL.gold);
      text(ctx, `${b.sp} SKILL POINT${b.sp > 1 ? 'S' : ''}`, box.x + 121, cy + 25, PAL.ink);
    }

    // skills
    const skillX = box.x + 206;
    Object.entries(SKILLS).forEach(([key, skill], k) => {
      const sy = cy + 4 + k * 10;
      text(ctx, skill.name, skillX, sy, PAL.ink);
      const px0 = skillX + 74;
      pips(ctx, px0, sy + 1, b.skills[key], skill.max);
      const canUp = b.sp > 0 && b.skills[key] < skill.max;
      if (button(ctx, px0 + 24, sy - 1, 10, 9, '+', { enabled: canUp })) spendSkillPoint(b, key);
    });

    // dismiss
    if (confirmFire === b.id) {
      if (button(ctx, box.x + box.w - 78, cy + cardH - 13, 36, 11, 'SURE?')) { fire(b); confirmFire = null; }
      if (button(ctx, box.x + box.w - 40, cy + cardH - 13, 36, 11, 'KEEP')) confirmFire = null;
    } else if (button(ctx, box.x + box.w - 40, cy + cardH - 13, 36, 11, 'LET GO')) {
      confirmFire = b.id;
    }
  });
  ctx.restore();
  scrollbar(ctx, box.x + box.w + 1, box.y, listH, scrolls.crew, contentH, listH);
  text(ctx, 'SKILL POINTS COME FROM LEVELS AND FROM HAPPY ANIMALS.', box.x, box.y + box.h - 12, PAL.paper3);
}

function stateLabel(b) {
  if (b.state === 'resting') return 'NAPPING';
  if (b.carry.n >= 1 && b.onArrive === 'deposit') return `HAULING ${b.carry.type}`;
  if (b.state === 'working' && b.task) {
    return { CHOP: 'FELLING', BUILD: 'BUILDING', PLANT: 'PLANTING', HARVEST: 'PICKING' }[b.task.type] || 'WORKING';
  }
  if (b.state === 'moving') return 'WALKING';
  return 'IDLE';
}

// -------------------------------------------------------------- stores
function drawStores(ctx, box, t) {
  const res = [
    ['wood', 'TIMBER', G.resources.wood, G.caps.wood, PAL.wood3],
    ['berries', 'BERRIES', G.resources.berries, G.caps.berries, PAL.red2],
    ['seeds', 'SEEDS', G.resources.seeds, G.caps.seeds, PAL.grass3],
  ];
  note(ctx, box.x, box.y, box.w, 58);
  res.forEach(([key, label, value, cap, color], i) => {
    const ry = box.y + 5 + i * 17;
    ctx.drawImage(S.icon(RES_ICONS[key]), box.x + 4, ry);
    text(ctx, label, box.x + 16, ry + 1, PAL.ink);
    bar(ctx, box.x + 70, ry + 1, 150, 7, value / cap, color);
    text(ctx, `${Math.floor(value)} / ${cap}`, box.x + 226, ry + 1, value >= cap ? PAL.red : PAL.ink);
  });
  ctx.drawImage(S.icon('heart'), box.x + 278, box.y + 6);
  text(ctx, `${G.resources.hearts} HEARTS EARNED`, box.x + 290, box.y + 7, PAL.ink);
  const wages = G.beavers.reduce((sum, b) => sum + salaryOf(b), 0);
  text(ctx, `WAGE BILL ${wages} / DAY`, box.x + 278, box.y + 20, wages > G.resources.berries ? PAL.red : PAL.paper3);
  text(ctx, `WATER ${G.waterLevel}/${MAX_WATER_LEVEL} ${G.riverBlocked ? 'SEALED' : 'FLOWING'}`,
       box.x + 278, box.y + 34, G.riverBlocked ? PAL.grass1 : PAL.wood2);

  // valley report
  const standing = G.entities.filter((e) => e.kind === 'tree' && e.growth >= 1).length;
  const saplings = G.entities.filter((e) => e.kind === 'tree' && e.growth < 1).length;
  note(ctx, box.x, box.y + 62, box.w, 44);
  text(ctx, 'VALLEY REPORT', box.x + 4, box.y + 66, PAL.ink);
  const stats = [
    `TREES STANDING ${standing}`, `SAPLINGS ${saplings}`,
    `FELLED ${G.stats.felled}`, `PLANTED ${G.stats.planted}`,
    `BUILT ${G.stats.built}`, `BASKETS PICKED ${G.stats.harvested}`,
  ];
  stats.forEach((line, i) => {
    text(ctx, line, box.x + 6 + (i % 3) * 150, box.y + 78 + Math.floor(i / 3) * 10, PAL.paper3);
  });
  if (standing + saplings === 0) text(ctx, 'THE FOREST IS GONE - PLANT SAPLINGS!', box.x + 6, box.y + 98, PAL.red);

  // residents
  note(ctx, box.x, box.y + 110, box.w, 40);
  text(ctx, `VALLEY RESIDENTS  ${G.housed.length}/${ANIMALS.length}`, box.x + 4, box.y + 114, PAL.ink);
  ANIMALS.forEach((a, i) => {
    const ax = box.x + 6 + i * 26;
    const ay = box.y + 124;
    const home = G.housed.includes(a.id);
    rect(ctx, ax, ay, 20, 20, home ? '#e8dbb8' : '#c9b48c');
    frame(ctx, ax, ay, 20, 20, PAL.paper3);
    const img = S.animalSprite(a.id, 0);
    ctx.save();
    if (!home) ctx.globalAlpha = 0.28;
    ctx.drawImage(img, ax + 3, ay + 2);
    ctx.restore();
  });

  if (button(ctx, box.x, box.y + box.h - 16, 60, 12, 'SAVE')) {
    toast(saveGame() ? 'SAVED.' : 'COULD NOT SAVE.', 'info');
  }
  if (confirmNew) {
    text(ctx, 'START OVER? THIS VALLEY IS LOST.', box.x + 66, box.y + box.h - 13, PAL.red2);
    if (button(ctx, box.x + 260, box.y + box.h - 16, 44, 12, 'YES')) { G.pendingNewGame = true; confirmNew = false; }
    if (button(ctx, box.x + 308, box.y + box.h - 16, 44, 12, 'NO')) confirmNew = false;
  } else if (button(ctx, box.x + 66, box.y + box.h - 16, 74, 12, 'NEW VALLEY')) {
    confirmNew = true;
  }
  if (G.won && !confirmNew) text(ctx, 'EVERY ANIMAL HAS A HOME - THE VALLEY IS COMPLETE!', box.x + 150, box.y + box.h - 13, PAL.gold2);
}
