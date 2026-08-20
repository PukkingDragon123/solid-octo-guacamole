// The sidebar, HUD and every button in the game.

import { BLUEPRINTS, CREW_JOBS, SKILLS, ANIMALS, MAX_WATER_LEVEL, TIPS } from './config.js';
import { G, saveGame, toast } from './state.js';
import { hire, hireCost, fire, spendSkillPoint, salaryOf, xpForNext, maxEnergy } from './beavers.js';
import { animalDef, needStatus } from './animals.js';
import { mini, canPlay, openMinigame } from './minigame.js';

const RES_ICON = { wood: '🪵', berries: '🫐', seeds: '🌰', hearts: '❤️' };
const el = (id) => document.getElementById(id);
let api = {};
let lastSignature = '';
let syncTimer = 0;

export function initUI(callbacks) {
  api = callbacks;
  el('tabs').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-tab]');
    if (!btn) return;
    G.ui.tab = btn.dataset.tab;
    forceSync();
  });
  el('panel').addEventListener('click', onPanelClick);
  el('controls').addEventListener('click', onControlClick);
  document.addEventListener('keydown', onKey);
  forceSync();
}

function onControlClick(ev) {
  const btn = ev.target.closest('[data-action]');
  if (!btn) return;
  const { action, value } = btn.dataset;
  if (action === 'speed') {
    if (value === '0') G.paused = !G.paused;
    else { G.paused = false; G.speed = Number(value); }
  } else if (action === 'help') {
    openHelp();
  } else if (action === 'save') {
    toast(saveGame() ? '💾 Saved.' : 'Could not save — storage is unavailable.', 'info');
  } else if (action === 'reset') {
    if (confirm('Start a brand new valley? Your current dam will be lost.')) api.newGame();
  } else if (action === 'minigame') {
    if (!openMinigame()) toast(`The crew needs a breather — ${Math.ceil(mini.cooldown)}s to go.`, 'warn');
    else showModal('minigame');
  }
  forceSync();
}

function onPanelClick(ev) {
  const btn = ev.target.closest('[data-action]');
  if (!btn) return;
  const { action, id, bp, skill, animal } = btn.dataset;
  if (action === 'hire') hire(id);
  else if (action === 'select-beaver') {
    G.ui.selectedBeaver = G.ui.selectedBeaver === Number(id) ? null : Number(id);
  } else if (action === 'upgrade') {
    const b = G.beavers.find((x) => x.id === Number(id));
    if (b) spendSkillPoint(b, skill);
    ev.stopPropagation();
  } else if (action === 'fire') {
    const b = G.beavers.find((x) => x.id === Number(id));
    if (b && confirm(`Let ${b.name} go?`)) fire(b);
    ev.stopPropagation();
  } else if (action === 'build') {
    G.ui.build = G.ui.build === bp ? null : bp;
  } else if (action === 'cancel-build') {
    G.ui.build = null;
  } else if (action === 'focus') {
    G.ui.focusRequest = G.ui.focusRequest === animal ? null : animal;
  }
  forceSync();
}

function onKey(ev) {
  if (ev.key === 'Escape') {
    if (mini.active) { closeModal(); }
    else if (!el('modal').classList.contains('hidden')) closeModal();
    else if (G.ui.build) G.ui.build = null;
    forceSync();
    return;
  }
  if (ev.code === 'Space') {
    ev.preventDefault();
    if (mini.active) { api.slam(); return; }
    G.paused = !G.paused;
    forceSync();
    return;
  }
  if (ev.key === '1' || ev.key === '2' || ev.key === '3') {
    G.paused = false;
    G.speed = Number(ev.key);
    forceSync();
  }
}

// ------------------------------------------------------------------- sync
export function tickUI(dt) {
  syncTimer -= dt;
  if (syncTimer <= 0) { syncTimer = 0.22; syncUI(); }
  updateToasts(dt);
}

export function forceSync() { lastSignature = ''; syncUI(); }

function signature() {
  const beavers = G.beavers.map((b) =>
    `${b.id}${b.role}${b.level}${b.sp}${b.state}${Math.round(b.energy / 8)}${Math.round(b.xp / 8)}${Math.round(b.morale / 10)}`).join('|');
  const requests = G.requests.map((r) => `${r.animalId}${needStatus(r).map((s) => (s.met ? 1 : 0) + '' + s.have).join('')}`).join('|');
  return [
    G.ui.tab, G.ui.build, G.ui.selectedBeaver, G.ui.focusRequest,
    Math.floor(G.resources.wood), Math.floor(G.resources.berries), Math.floor(G.resources.seeds), G.resources.hearts,
    G.caps.wood, G.crewCap, G.day, Math.floor(G.dayT * 24), G.waterLevel, G.riverBlocked,
    G.paused, G.speed, G.jobs.length, G.housed.length, Math.ceil(mini.cooldown / 5),
    beavers, requests, G.log.length,
  ].join('~');
}

export function syncUI() {
  const sig = signature();
  if (sig === lastSignature) return;
  lastSignature = sig;

  el('resbar').innerHTML = ['wood', 'berries', 'seeds', 'hearts'].map((k) => {
    const cap = G.caps[k];
    const value = Math.floor(G.resources[k]);
    const full = cap !== undefined && value >= cap;
    return `<span class="res ${full ? 'full' : ''}" title="${k}">${RES_ICON[k]} <b>${value}</b>${cap !== undefined ? `<i>/${cap}</i>` : ''}</span>`;
  }).join('');

  el('daybar').innerHTML = `
    <span class="chip">📅 Day <b>${G.day}</b></span>
    <span class="chip">${phaseIcon()} ${phaseName()}</span>
    <span class="chip" title="Dam the whole channel to raise the water">
      🌊 ${'💧'.repeat(G.waterLevel)}${'·'.repeat(MAX_WATER_LEVEL - G.waterLevel)}
      ${G.riverBlocked ? '<b class="ok">sealed</b>' : '<b class="bad">flowing</b>'}
    </span>
    <span class="chip">🧰 ${G.jobs.length} job${G.jobs.length === 1 ? '' : 's'}</span>`;

  const speedBtn = (v, label) => {
    const on = v === 0 ? G.paused : (!G.paused && G.speed === v);
    return `<button class="ctl ${on ? 'on' : ''}" data-action="speed" data-value="${v}">${label}</button>`;
  };
  el('controls').innerHTML = [
    speedBtn(0, '⏸'), speedBtn(1, '▶'), speedBtn(2, '⏩'), speedBtn(3, '⏭'),
    `<button class="ctl slam ${canPlay() ? '' : 'cool'}" data-action="minigame">🪵 Log Slam${canPlay() ? '' : ` ${Math.ceil(mini.cooldown)}s`}</button>`,
    `<button class="ctl" data-action="help">❔</button>`,
    `<button class="ctl" data-action="save">💾</button>`,
    `<button class="ctl" data-action="reset">🔄</button>`,
  ].join('');

  el('tabs').innerHTML = [
    ['crew', `🦫 Crew <i>${G.beavers.length}/${G.crewCap}</i>`],
    ['build', '🔨 Build'],
    ['wild', `🐾 Wild <i>${G.housed.length}/${ANIMALS.length}</i>`],
    ['log', '📜 Log'],
  ].map(([id, label]) => `<button data-tab="${id}" class="${G.ui.tab === id ? 'on' : ''}">${label}</button>`).join('');

  const panel = el('panel');
  const scroll = panel.scrollTop;
  panel.innerHTML = G.ui.tab === 'crew' ? crewPanel()
    : G.ui.tab === 'build' ? buildPanel()
    : G.ui.tab === 'wild' ? wildPanel()
    : logPanel();
  panel.scrollTop = scroll;

  el('tipbar').innerHTML = G.ui.build
    ? `<b>Placing ${BLUEPRINTS[G.ui.build].name}</b> — click the map to site it. <button class="link" data-action="cancel-build">cancel (Esc)</button>`
    : `💡 ${TIPS[G.ui.tipIndex % TIPS.length]}`;
  el('tipbar').onclick = (ev) => {
    if (ev.target.closest('[data-action="cancel-build"]')) { G.ui.build = null; forceSync(); }
  };
}

const phaseName = () => (G.dayT < 0.08 ? 'Dawn' : G.dayT < 0.45 ? 'Morning' : G.dayT < 0.72 ? 'Afternoon' : G.dayT < 0.86 ? 'Dusk' : 'Night');
const phaseIcon = () => (G.dayT < 0.08 ? '🌅' : G.dayT < 0.72 ? '☀️' : G.dayT < 0.86 ? '🌇' : '🌙');

// ------------------------------------------------------------- crew panel
function stateLabel(b) {
  if (b.state === 'resting') return 'napping at the lodge';
  if (b.carry.n >= 1 && b.onArrive === 'deposit') return `hauling ${b.carry.type}`;
  if (b.state === 'working' && b.task) {
    return { CHOP: 'felling a tree', BUILD: 'building', PLANT: 'planting', HARVEST: 'picking berries' }[b.task.type];
  }
  if (b.state === 'moving') return 'on the way';
  return 'looking for work';
}

function crewPanel() {
  const cards = G.beavers.map((b) => {
    const role = CREW_JOBS[b.role];
    const selected = G.ui.selectedBeaver === b.id;
    const xpPct = Math.round((b.xp / xpForNext(b)) * 100);
    const enPct = Math.round((b.energy / maxEnergy(b)) * 100);
    const skills = Object.entries(SKILLS).map(([key, s]) => {
      const rank = b.skills[key];
      const maxed = rank >= s.max;
      return `<div class="skill">
        <span class="sname" title="${s.desc}">${s.icon} ${s.name}</span>
        <span class="pips">${'●'.repeat(rank)}${'○'.repeat(s.max - rank)}</span>
        <button class="mini" data-action="upgrade" data-id="${b.id}" data-skill="${key}"
          ${b.sp > 0 && !maxed ? '' : 'disabled'}>+</button>
      </div>`;
    }).join('');
    return `<div class="card beaver ${selected ? 'sel' : ''}" data-action="select-beaver" data-id="${b.id}">
      <div class="row">
        <span class="ava" style="background:${role.color}">${role.icon}</span>
        <div class="grow">
          <div class="name">${b.name} <span class="lvl">Lv ${b.level}</span>${b.sp ? `<span class="sp">+${b.sp} SP</span>` : ''}</div>
          <div class="muted small">${role.name} · ${stateLabel(b)}</div>
        </div>
      </div>
      <div class="bar xp"><i style="width:${xpPct}%"></i><em>XP ${xpPct}%</em></div>
      <div class="bar en"><i style="width:${enPct}%"></i><em>Energy ${enPct}%</em></div>
      ${selected ? `<div class="details">
        <div class="muted small">${role.blurb}</div>
        <div class="skills">${skills}</div>
        <div class="row spread small">
          <span class="muted">Wage ${salaryOf(b)} 🫐 / day · Morale ${Math.round(b.morale)}%</span>
          <button class="mini danger" data-action="fire" data-id="${b.id}">Let go</button>
        </div>
      </div>` : ''}
    </div>`;
  }).join('') || '<p class="muted">Nobody on the payroll yet. Hire your first beaver below.</p>';

  const wages = G.beavers.reduce((sum, b) => sum + salaryOf(b), 0);
  const hires = Object.entries(CREW_JOBS).map(([id, role]) => {
    const cost = hireCost(id);
    const full = G.beavers.length >= G.crewCap;
    const afford = Object.entries(cost).every(([k, v]) => G.resources[k] >= v);
    return `<div class="card hire">
      <div class="row">
        <span class="ava" style="background:${role.color}">${role.icon}</span>
        <div class="grow">
          <div class="name">${role.name}</div>
          <div class="muted small">${role.blurb}</div>
        </div>
        <button class="mini go" data-action="hire" data-id="${id}" ${full || !afford ? 'disabled' : ''}>
          ${costLabel(cost)}
        </button>
      </div>
    </div>`;
  }).join('');

  return `<div class="section">
      <h3>Crew <span class="muted">${G.beavers.length} / ${G.crewCap} · ${wages} 🫐 a day</span></h3>
      ${cards}
    </div>
    <div class="section">
      <h3>Hire</h3>
      ${G.beavers.length >= G.crewCap ? '<p class="warn small">The lodge is full — build another Crew Lodge for two more bunks.</p>' : ''}
      ${hires}
    </div>`;
}

function costLabel(cost) {
  return Object.entries(cost).map(([k, v]) => `${RES_ICON[k]}${v}`).join(' ');
}

// ------------------------------------------------------------ build panel
function buildPanel() {
  const cats = [
    ['dam', '🌊 The Dam', 'Seal every water tile across the channel.'],
    ['plant', '🌱 Planting', 'Food for the crew, and the plants animals ask for.'],
    ['habitat', '🏡 Habitats', 'Homes for the animals in the Wild tab.'],
    ['base', '🏚️ Camp', 'Room for more beavers and more supplies.'],
  ];
  return cats.map(([cat, title, blurb]) => {
    const items = Object.values(BLUEPRINTS).filter((bp) => bp.cat === cat).map((bp) => {
      const afford = Object.entries(bp.cost).every(([k, v]) => G.resources[k] >= v);
      return `<button class="bp ${G.ui.build === bp.id ? 'on' : ''} ${afford ? '' : 'poor'}" data-action="build" data-bp="${bp.id}">
        <span class="ico">${bp.icon}</span>
        <span class="grow"><b>${bp.name}</b><small>${bp.desc}</small></span>
        <span class="cost">${costLabel(bp.cost)}</span>
      </button>`;
    }).join('');
    return `<div class="section"><h3>${title} <span class="muted">${blurb}</span></h3>${items}</div>`;
  }).join('');
}

// ------------------------------------------------------------- wild panel
function wildPanel() {
  const requests = G.requests.map((r) => {
    const def = animalDef(r.animalId);
    const status = needStatus(r);
    const met = status.filter((s) => s.met).length;
    const needs = status.map((s) => `<li class="${s.met ? 'met' : ''}">
        <span class="tick">${s.met ? '✔' : '○'}</span>
        <span class="grow">${s.label}</span>
        <b>${s.need.type === 'water' ? s.have : Math.min(s.have, s.want)}/${s.want}</b>
      </li>`).join('');
    return `<div class="card quest ${G.ui.focusRequest === r.animalId ? 'sel' : ''}">
      <div class="row">
        <span class="ava" style="background:${def.color}">${def.icon}</span>
        <div class="grow">
          <div class="name">${def.name} <span class="lvl">${met}/${status.length}</span></div>
          <div class="muted small">“${def.intro}”</div>
        </div>
      </div>
      <ul class="needs">${needs}</ul>
      <div class="row spread small">
        <span class="muted">Reward ${def.reward.hearts}❤️ ${def.reward.berries}🫐 ${def.reward.seeds}🌰${def.reward.skill ? ' +SP' : ''}</span>
        <button class="mini" data-action="focus" data-animal="${r.animalId}">
          ${G.ui.focusRequest === r.animalId ? 'Hide circle' : 'Show on map'}
        </button>
      </div>
      <p class="muted tiny">Everything must sit inside the dashed circle on the map.</p>
    </div>`;
  }).join('') || '<p class="muted">No one is asking for a home right now. A new neighbour turns up most mornings.</p>';

  const housed = ANIMALS.map((a) => {
    const home = G.housed.includes(a.id);
    return `<span class="dex ${home ? 'has' : ''}" title="${a.name}">${a.icon}</span>`;
  }).join('');

  return `<div class="section"><h3>Looking for a home</h3>${requests}</div>
    <div class="section"><h3>Valley residents <span class="muted">${G.housed.length}/${ANIMALS.length}</span></h3>
      <div class="dexrow">${housed}</div>
      ${G.won ? '<p class="good">🏆 Every animal has moved in. The valley is complete!</p>' : ''}
    </div>
    <div class="section"><h3>Site report</h3>
      <div class="stats">
        <span>🌲 ${G.entities.filter((e) => e.kind === 'tree' && e.growth >= 1).length} grown trees</span>
        <span>🌱 ${G.entities.filter((e) => e.kind === 'tree' && e.growth < 1).length} saplings</span>
        <span>🪓 ${G.stats.felled} felled</span>
        <span>🔨 ${G.stats.built} built</span>
      </div>
    </div>`;
}

function logPanel() {
  if (!G.log.length) return '<p class="muted">Nothing has happened yet.</p>';
  return `<div class="section">${G.log.map((entry) =>
    `<div class="logline ${entry.tone}"><span class="muted tiny">D${entry.day}</span> ${entry.text}</div>`).join('')}</div>`;
}

// ----------------------------------------------------------------- toasts
let shownToasts = 0;
function updateToasts(dt) {
  const host = el('toasts');
  // a reset empties the queue, so never sit ahead of it
  if (shownToasts > G.toasts.length) shownToasts = G.toasts.length;
  while (shownToasts < G.toasts.length) {
    const t = G.toasts[shownToasts++];
    const div = document.createElement('div');
    div.className = `toast ${t.tone}`;
    div.textContent = t.text;
    host.appendChild(div);
    setTimeout(() => { div.classList.add('out'); setTimeout(() => div.remove(), 400); }, 4200);
  }
  if (G.toasts.length > 40) { G.toasts.splice(0, 20); shownToasts -= 20; }
}

// ----------------------------------------------------------------- modals
export function showModal(kind) {
  const modal = el('modal');
  modal.classList.remove('hidden');
  el('modalHelp').classList.toggle('hidden', kind !== 'help');
  el('modalMini').classList.toggle('hidden', kind !== 'minigame');
}

export function closeModal() {
  el('modal').classList.add('hidden');
  if (mini.active) api.closeMinigame();
}

export function openHelp() { showModal('help'); }

export function initModal(callbacks) {
  el('modalClose').addEventListener('click', closeModal);
  el('modal').addEventListener('click', (ev) => { if (ev.target.id === 'modal') closeModal(); });
  el('miniSlam').addEventListener('click', () => callbacks.slam());
}
