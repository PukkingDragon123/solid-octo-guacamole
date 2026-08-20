// DAM IT — bootstrap, the game loop and all pointer input.

import { TILE, CANVAS_W, CANVAS_H, DAY_LENGTH, BLUEPRINTS } from './config.js';
import { G, tileAt, entityAt, toast, saveGame, loadGame, clearSave, logMsg } from './state.js';
import { generateWorld, updateWater, refreshWater } from './world.js';
import { updateBeavers, payday, makeBeaver, hire } from './beavers.js';
import { updatePlants } from './plants.js';
import { updateAnimals, resetAnimalPool, spawnRequest } from './animals.js';
import { placeSite, completeSite, toggleTreeMark, demolish, removeDam } from './build.js';
import { draw } from './render.js';
import { initUI, initModal, tickUI, forceSync, closeModal, openHelp } from './ui.js';
import { updateMinigame, drawMinigame, slam, closeMinigame, mini, MINI_W, MINI_H } from './minigame.js';

const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');

const miniCanvas = document.getElementById('miniCanvas');
miniCanvas.width = MINI_W;
miniCanvas.height = MINI_H;
const miniCtx = miniCanvas.getContext('2d');

// ------------------------------------------------------------- new / load
function newGame() {
  clearSave();
  generateWorld((Math.random() * 1e9) >>> 0);
  G.resources = { wood: 30, berries: 45, seeds: 12, hearts: 0 };
  G.caps = { wood: 150, berries: 150, seeds: 80 };
  G.beavers = [];
  G.jobs = [];
  G.time = 0; G.day = 1; G.dayT = 0.12;
  G.speed = 1; G.paused = false;
  G.crewCap = 4;
  G.won = false;
  G.log = []; G.toasts = [];
  G.stats = { felled: 0, planted: 0, built: 0, harvested: 0, paid: 0, missedPay: 0 };
  G.ui.build = null; G.ui.selectedBeaver = null; G.ui.focusRequest = null;
  resetAnimalPool();
  G.beavers.push(makeBeaver('logger', G.lodge.x, G.lodge.y));
  G.beavers.push(makeBeaver('forager', G.lodge.x + 1, G.lodge.y));
  spawnRequest(true);
  logMsg('🦫 Welcome to the valley. Click a tree to start gathering wood.', 'good');
  forceSync();
}

function boot() {
  const loaded = loadGame();
  if (loaded) {
    refreshWater(true);
    logMsg('💾 Save loaded. Welcome back!', 'info');
  } else {
    newGame();
    setTimeout(openHelp, 350);
  }
}

// ---------------------------------------------------------------- the loop
let last = performance.now();
let waterTimer = 0;
let autosave = 0;
let tipTimer = 0;

function frame(now) {
  const real = Math.min(0.05, (now - last) / 1000);
  last = now;

  updateMinigame(real);
  tipTimer += real;
  if (tipTimer > 14) { tipTimer = 0; G.ui.tipIndex++; }

  const dt = G.paused || mini.active ? 0 : real * G.speed;
  if (dt > 0) simulate(dt);

  draw(ctx);
  if (mini.active) drawMinigame(miniCtx);
  tickUI(real);
  requestAnimationFrame(frame);
}

function simulate(dt) {
  G.time += dt;
  G.dayT += dt / DAY_LENGTH;
  if (G.dayT >= 1) {
    G.dayT -= 1;
    G.day++;
    payday();
    spawnRequest();
  }

  updatePlants(dt);
  updateBeavers(dt);
  updateAnimals(dt);

  waterTimer += dt;
  if (waterTimer >= 0.5) { updateWater(waterTimer); waterTimer = 0; }

  autosave += dt;
  if (autosave >= 30) { autosave = 0; saveGame(); }
}

// ------------------------------------------------------------------ input
function tileFromEvent(ev) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((ev.clientX - rect.left) * (canvas.width / rect.width)) / TILE);
  const y = Math.floor(((ev.clientY - rect.top) * (canvas.height / rect.height)) / TILE);
  return { x, y };
}

let dragging = false;
let lastPlaced = null;
let markMode = null;   // 'mark' or 'unmark' while dragging across the forest

canvas.addEventListener('mousemove', (ev) => {
  const t = tileFromEvent(ev);
  G.ui.hoverTile = t;
  canvas.title = describeTile(t.x, t.y);
  if (!dragging) return;
  if (lastPlaced && lastPlaced.x === t.x && lastPlaced.y === t.y) return;
  lastPlaced = t;
  if (G.ui.build) {
    placeSite(G.ui.build, t.x, t.y);
  } else if (markMode) {
    // drag across the trees to mark a whole stand for felling
    const e = entityAt(t.x, t.y);
    if (e && e.kind === 'tree' && e.growth >= 1 && e.marked !== (markMode === 'mark')) toggleTreeMark(e);
  }
});

canvas.addEventListener('mouseleave', () => { G.ui.hoverTile = null; dragging = false; });

canvas.addEventListener('mousedown', (ev) => {
  if (ev.button !== 0) return;
  const t = tileFromEvent(ev);
  if (G.ui.build) {
    dragging = true;
    lastPlaced = t;
    placeSite(G.ui.build, t.x, t.y);
    forceSync();
    return;
  }
  const e = entityAt(t.x, t.y);
  if (e && e.kind === 'tree' && e.growth >= 1) {
    dragging = true;
    lastPlaced = t;
    markMode = e.marked ? 'unmark' : 'mark';
  }
  handleSelect(t, ev);
});

window.addEventListener('mouseup', () => { dragging = false; lastPlaced = null; markMode = null; });

canvas.addEventListener('contextmenu', (ev) => {
  ev.preventDefault();
  const t = tileFromEvent(ev);
  if (G.ui.build) { G.ui.build = null; forceSync(); return; }
  const e = entityAt(t.x, t.y);
  const tile = tileAt(t.x, t.y);
  if (e && e.kind !== 'tree') demolish(e);
  else if (e && e.kind === 'tree' && e.marked) toggleTreeMark(e);
  else if (tile && tile.dam) removeDam(t.x, t.y);
  forceSync();
});

function handleSelect(t, ev) {
  // a beaver under the cursor wins over the tile beneath it
  const rect = canvas.getBoundingClientRect();
  const px = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const py = (ev.clientY - rect.top) * (canvas.height / rect.height);
  let hit = null;
  for (const b of G.beavers) {
    if (Math.hypot(b.px - px, b.py - py) < 14) { hit = b; break; }
  }
  if (hit) {
    G.ui.selectedBeaver = G.ui.selectedBeaver === hit.id ? null : hit.id;
    G.ui.tab = 'crew';
    forceSync();
    return;
  }
  const e = entityAt(t.x, t.y);
  if (e && e.kind === 'tree') { toggleTreeMark(e); forceSync(); return; }
  if (e && e.kind === 'site') { toast(`${BLUEPRINTS[e.blueprint].name}: ${Math.round((e.workDone / e.work) * 100)}% built. Right-click to cancel.`, 'info'); }
  else if (e && e.kind === 'structure') { toast(BLUEPRINTS[e.blueprint].desc, 'info'); }
  else G.ui.selectedBeaver = null;
  forceSync();
}

function describeTile(x, y) {
  const tile = tileAt(x, y);
  if (!tile) return '';
  const e = entityAt(x, y);
  if (e) {
    if (e.kind === 'tree') return e.growth < 1 ? `Sapling (${Math.round(e.growth * 100)}% grown)` : `Tree · ${Math.ceil(e.wood)} wood left — click to fell`;
    if (e.kind === 'plant') return `${BLUEPRINTS[e.blueprint].name}${e.growth < 1 ? ` (${Math.round(e.growth * 100)}% grown)` : e.berries > 0 ? ` · ${Math.ceil(e.berries)} berries ready` : ' · ripening'}`;
    if (e.kind === 'site') return `${BLUEPRINTS[e.blueprint].name} under construction`;
    if (e.kind === 'structure') return BLUEPRINTS[e.blueprint].name;
  }
  if (tile.dam) return 'Dam segment — right-click to pull it out';
  if (tile.river) return 'River channel — dam it here';
  if (tile.t === 'pond') return 'Pond water';
  return `${tile.t} · height ${tile.elev}`;
}

// ------------------------------------------------------------------- wire
initUI({ newGame, slam, closeMinigame: () => { closeMinigame(); } });
initModal({ slam: () => { slam(); } });
document.getElementById('newGameBtn').addEventListener('click', () => {
  closeModal();
  if (!G.beavers.length) newGame();
});
miniCanvas.addEventListener('click', () => slam());

boot();
requestAnimationFrame(frame);

// A small hook for the browser console (and the automated smoke test):
//   DAMIT.G — live game state · DAMIT.simulate(0.1) — step the sim by hand
window.DAMIT = { G, simulate, newGame, placeSite, completeSite, spawnRequest, forceSync, makeBeaver, toggleTreeMark, hire };

window.addEventListener('beforeunload', () => saveGame());
