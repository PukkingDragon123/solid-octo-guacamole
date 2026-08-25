// DAM IT - bootstrap, the game loop, and the two modes: the camp on foot and
// the valley from the back of a heron.

import {
  TILE, MAPW, MAPH, WORLD_W, WORLD_H, VIEW_W, VIEW_H, CAMP_W, CAMP_GROUND,
  DAY_LENGTH, BLUEPRINTS, TIPS,
} from './config.js';
import { G, tileAt, entityAt, toast, saveGame, loadGame, clearSave, hasSave, logMsg } from './state.js';
import { generateWorld, updateWater, refreshWater } from './world.js';
import { updateBeavers, payday, makeBeaver } from './beavers.js';
import { updatePlants } from './plants.js';
import { seedCritters, updateCritters, seedCampCritters, updateCampCritters, reseedFish } from './critters.js';
import { updateAnimals, resetAnimalPool, spawnRequest } from './animals.js';
import { placeSite, completeSite, toggleTreeMark, demolish, removeDam, canPlace } from './build.js';

import { PAL, rect, frame, px, text, textWidth, disc } from './gfx/pixel.js';
import { initScreen, screen, cam } from './gfx/screen.js';
import { initInput, input, pressed, held, consume, endFrame } from './input.js';
import * as S from './gfx/sprites.js';

import { drawValley, drawCursor, drawRider, invalidateGround, buildGround } from './scenes/valley.js';
import { drawCamp, drawPlayer, nearestStation, CAMP_BOUNDS, STATIONS, skyPhase } from './scenes/camp.js';
import { updateCampPlayer, updateRider, seatRider } from './player.js';
import { drawResourceStrip, drawDayChip, drawToasts, drawHotbar, drawHint, PAGES } from './ui/hud.js';
import { drawStation, openStation, closeStation } from './ui/board.js';
import { keyPrompt, button, panel, scrim, hovering } from './ui/widgets.js';
import { updateTouch, drawTouchControls, drawOrientationHint, touchUI } from './ui/touch.js';
import { drawTitleScene, drawTitleText } from './scenes/title.js';
import { mini, openMinigame, updateMinigame, drawMinigame, canPlay } from './minigame.js';

const CREW_JOBS_KEYS = { logger: 1, hauler: 1, engineer: 1, gardener: 1, forager: 1 };
const ANIMAL_KEYS = ['duck', 'frog', 'rabbit', 'hedgehog', 'songbird', 'otter', 'turtle',
                     'dragonfly', 'squirrel', 'bee', 'kingfisher'];
const STRUCTURE_KEYS = ['duck_nest', 'frog_log', 'rabbit_burrow', 'hedgehog_hut', 'bird_house',
                        'otter_holt', 'turtle_bask', 'squirrel_drey', 'bee_hive', 'kingfisher_post',
                        'lodge', 'shed'];

const canvas = document.getElementById('game');
const ctx = initScreen(canvas);
initInput(canvas);

const SKY_BOUNDS = { w: WORLD_W, h: WORLD_H };
const fade = { t: 0, dur: 0, action: null, colour: PAL.sky3 };
let helpOpen = false;
let tipTimer = 0;
let waterTimer = 0;
let autosave = 0;

// ------------------------------------------------------------- new / load
function newGame() {
  clearSave();
  generateWorld((Math.random() * 1e9) >>> 0);
  G.resources = { wood: 34, berries: 46, seeds: 14, hearts: 0 };
  G.caps = { wood: 150, berries: 150, seeds: 80 };
  G.beavers = [];
  G.jobs = [];
  G.time = 0; G.day = 1; G.dayT = 0.14;
  G.speed = 1; G.paused = false;
  G.crewCap = 4;
  G.won = false;
  G.log = []; G.toasts = [];
  G.stats = { felled: 0, planted: 0, built: 0, harvested: 0, paid: 0, missedPay: 0 };
  G.mode = 'camp';
  G.station = null;
  G.player = { x: 352, y: CAMP_GROUND, vx: 0, vy: 0, onGround: true, face: 1 };
  G.rider = { x: 0, y: 0, vx: 0, vy: 0, face: 1, height: 23, bob: 0, flying: false };
  G.ui.build = null;
  G.ui.tab = 'contracts';
  G.ui.focusRequest = null;
  G.ui.hotbarPage = 0;
  resetAnimalPool();
  G.beavers.push(makeBeaver('logger', G.lodge.x, G.lodge.y));
  G.beavers.push(makeBeaver('forager', G.lodge.x + 1, G.lodge.y));
  spawnRequest(true);
  seatRider();
  invalidateGround();
  seedCritters();
  seedCampCritters();
  logMsg('Welcome to the valley.', 'good');
}

/** Shared tail end of both "new valley" and "continue". */
function enterGame() {
  invalidateGround();
  buildGround();
  seedCritters();
  seedCampCritters();
  G.station = null;
  G.ui.hotbarPage = G.ui.hotbarPage || 0;
  cam.centreOn(G.mode === 'sky' ? G.rider.x : G.player.x,
               G.mode === 'sky' ? G.rider.y : VIEW_H / 2,
               G.mode === 'sky' ? SKY_BOUNDS : CAMP_BOUNDS);
  screenMode = 'game';
  last = performance.now();
}

function startNewGame() {
  newGame();
  enterGame();
  helpOpen = true;
}

function continueGame() {
  if (!loadGame()) { startNewGame(); return; }
  refreshWater(true);
  seatRider();
  logMsg('Save loaded.', 'info');
  enterGame();
}

// Generating every sprite up front means the game never stutters later. The
// work is spread over a few frames so the title screen paints immediately.
const WARMUP = [
  () => { for (let v = 0; v < 4; v++) { S.grassTile(v); S.grassTile(v, true); } },
  () => { for (let v = 0; v < 4; v++) { S.rockTile(v); S.rockTile(v, true); S.dirtTile(v & 1); } },
  () => { for (let f = 0; f < 4; f++) for (const still of [0, 1]) for (const deep of [0, 1]) S.waterTile(!!still, f, !!deep); },
  () => { for (let d = 0; d < 4; d++) S.foamEdge(d); S.damTile(); },
  () => { for (let v = 0; v < S.TREE_SPECIES; v++) for (const w of [0, 1, 2]) S.treeSprite(v, 1, w); },
  () => { for (let v = 0; v < S.TREE_SPECIES; v++) S.treeSprite(v, 0.45, 1); S.saplingSprite(); S.stumpSprite(); },
  () => { for (const k of S.CLUTTER_KINDS) for (let v = 0; v < 4; v++) S.clutterSprite(k, v); S.clutterSprite('lilypad', 0); },
  () => { for (const id of ['sunberry', 'dewberry', 'goldberry']) { S.bushSprite(id, true); S.bushSprite(id, false); }
          for (const id of ['clover', 'bluebell', 'sunflower']) S.flowerSprite(id); S.reedSprite(); },
  () => { for (const r of Object.keys(CREW_JOBS_KEYS)) for (const f of [0, 1]) { S.beaverSprite(r, f); S.beaverSprite(r, f, true); S.crewSideSprite(r, f); } },
  () => { for (const id of ANIMAL_KEYS) for (const f of [0, 1]) S.animalSprite(id, f); },
  () => { for (const id of STRUCTURE_KEYS) S.structureSprite(id); S.siteSprite(0); S.siteSprite(1); },
  () => { for (let f = 0; f < 4; f++) { S.birdSprite(f, true); S.flyingBirdSprite(f); } S.heronSideSprite(0); S.heronSideSprite(1); },
  () => { for (const p of ['jobboard', 'storehouse', 'bunkhouse', 'logpile', 'perch', 'sawhorse', 'lantern', 'bucket']) S.propSprite(p); },
  () => { for (const pose of ['idle', 'walk', 'jump']) for (let f = 0; f < 4; f++) S.playerSprite(pose, f);
          S.groundStrip(); S.hillSprite(0); S.hillSprite(1); S.cloudSprite(0); S.cloudSprite(1);
          S.bgTreeSprite(0); S.bgTreeSprite(1); S.bgTreeSprite(0, true); S.bgTreeSprite(1, true); },
  () => { for (const n of ['wood', 'berry', 'seed', 'heart', 'axe', 'hammer', 'clock', 'drop', 'spark']) S.icon(n);
          S.carrySprite('wood'); S.carrySprite('berries'); S.shadowSprite(16); S.shadowSprite(20); },
];

let screenMode = 'title';
let warmIndex = 0;

function boot() {
  // nothing to do but show the title; the world is built when you pick an option
}

// ------------------------------------------------------------- simulation
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
  if (waterTimer >= 0.5) {
    const before = G.waterLevel;
    updateWater(waterTimer);
    waterTimer = 0;
    if (before !== G.waterLevel) { invalidateGround(); reseedFish(); }
  }
  autosave += dt;
  if (autosave >= 30) { autosave = 0; saveGame(); }
}

// ------------------------------------------------------------ transitions
function startFade(action, colour) {
  if (fade.dur > 0) return;
  fade.t = 0; fade.dur = 0.7; fade.action = action; fade.colour = colour || PAL.sky3;
}

function takeOff() {
  startFade(() => {
    G.mode = 'sky';
    G.rider.flying = true;
    seatRider();
    cam.centreOn(G.rider.x, G.rider.y, SKY_BOUNDS);
    toast('The heron lifts off. Click the valley to put the crew to work.', 'info');
  }, PAL.sky3);
}

function landHome() {
  startFade(() => {
    G.mode = 'camp';
    G.rider.flying = false;
    G.ui.build = null;
    const perch = STATIONS.find((s) => s.id === 'perch');
    G.player.x = perch.x - 26;
    G.player.y = CAMP_GROUND;
    G.player.vx = 0; G.player.vy = 0;
    cam.centreOn(G.player.x, VIEW_H / 2, CAMP_BOUNDS);
  }, PAL.sky3);
}

// ------------------------------------------------------------------ input
function mouseTile() {
  return {
    x: Math.floor((cam.x + input.mx) / TILE),
    y: Math.floor((cam.y + input.my) / TILE),
  };
}

let dragTile = null;
let markMode = null;

function handleSkyInput() {
  // tool selection
  if (pressed('Tab')) G.ui.hotbarPage = (G.ui.hotbarPage + 1) % PAGES.length;
  const slots = PAGES[G.ui.hotbarPage % PAGES.length].slots;
  for (let i = 0; i < 10; i++) {
    if (pressed(`Digit${(i + 1) % 10}`)) {
      const id = slots[i];
      if (id) G.ui.build = G.ui.build === id ? null : id;
    }
  }
  if (pressed('KeyQ')) G.ui.build = null;
  if (pressed('KeyE', 'Escape')) {
    consume('KeyE', 'Escape');
    if (G.ui.build) G.ui.build = null;
    else landHome();
    return;
  }

  const overHotbar = input.my > VIEW_H - 40;
  if (!input.overCanvas || overHotbar) { dragTile = null; return; }
  const t = mouseTile();
  if (t.x < 0 || t.y < 0 || t.x >= MAPW || t.y >= MAPH) return;

  if (input.rightClicked) {
    if (G.ui.build) { G.ui.build = null; return; }
    const e = entityAt(t.x, t.y);
    const tile = tileAt(t.x, t.y);
    if (e && e.kind === 'tree' && e.marked) toggleTreeMark(e);
    else if (e && e.kind !== 'tree') demolish(e);
    else if (tile && tile.dam) { removeDam(t.x, t.y); invalidateGround(); }
    return;
  }

  if (input.clicked) {
    dragTile = { x: t.x, y: t.y };
    if (G.ui.build) {
      placeSite(G.ui.build, t.x, t.y);
    } else {
      const e = entityAt(t.x, t.y);
      if (e && e.kind === 'tree' && e.growth >= 1) {
        markMode = e.marked ? 'unmark' : 'mark';
        toggleTreeMark(e);
      } else if (e && e.kind === 'site') {
        toast(`${BLUEPRINTS[e.blueprint].name}: ${Math.round((e.workDone / e.work) * 100)}% built`, 'info');
      }
    }
    return;
  }

  // drag to paint dams or mark a whole stand
  if (input.dragging && dragTile && (dragTile.x !== t.x || dragTile.y !== t.y)) {
    dragTile = { x: t.x, y: t.y };
    if (G.ui.build) {
      placeSite(G.ui.build, t.x, t.y);
    } else if (markMode) {
      const e = entityAt(t.x, t.y);
      if (e && e.kind === 'tree' && e.growth >= 1 && e.marked !== (markMode === 'mark')) toggleTreeMark(e);
    }
  }
  if (!input.dragging) markMode = null;
}

function handleCampInput() {
  const station = nearestStation(G.player.x);
  if (station && pressed('KeyE')) {
    consume('KeyE');   // the screen we are about to open also listens for E
    if (station.id === 'perch') takeOff();
    else if (station.id === 'logpile') {
      if (openMinigame()) { /* opened */ }
      else toast(`The crew needs a breather - ${Math.ceil(mini.cooldown)}s`, 'warn');
    } else if (station.id === 'jobboard') { openStation('board'); G.ui.tab = 'contracts'; }
    else if (station.id === 'bunkhouse') openStation('crew');
    else if (station.id === 'storehouse') openStation('stores');
  }
}

// ------------------------------------------------------------------- loop
let last = performance.now();

function step(now) {
  const real = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(real);
  render(real);
  endFrame();
  requestAnimationFrame(step);
}

function update(real) {
  const overlayNow = helpOpen || mini.active || !!G.station || screenMode === 'title';
  updateTouch(G.mode, overlayNow);
  if (screenMode === 'title') { updateTitle(real); return; }
  updateMinigame(real);
  tipTimer += real;

  if (fade.dur > 0) {
    fade.t += real;
    if (fade.t >= fade.dur / 2 && fade.action) { fade.action(); fade.action = null; }
    if (fade.t >= fade.dur) { fade.dur = 0; fade.t = 0; }
  }

  if (G.pendingNewGame) {
    G.pendingNewGame = false;
    closeStation();
    newGame();
    cam.centreOn(G.player.x, VIEW_H / 2, CAMP_BOUNDS);
    return;
  }

  const overlay = helpOpen || mini.active || !!G.station;
  const busy = overlay || fade.dur > 0;

  if (!overlay && pressed('KeyP')) G.paused = !G.paused;
  if (!overlay && pressed('KeyH', 'F1')) helpOpen = true;
  G.speed = held('ShiftLeft', 'ShiftRight') ? 3 : 1;

  const simDt = G.paused || overlay ? 0 : real * G.speed;
  if (simDt > 0) simulate(simDt);

  if (G.mode === 'camp') {
    updateCampCritters(real);
    updateCampPlayer(real, busy);
    cam.follow(G.player.x, VIEW_H / 2, real, CAMP_BOUNDS, 8);
    if (!busy) handleCampInput();
  } else {
    updateCritters(real);
    updateRider(real, busy);
    cam.follow(G.rider.x, G.rider.y, real, SKY_BOUNDS, 7);
    if (!busy) handleSkyInput();
  }
  cam.update(real);

  if (helpOpen && pressed('KeyE', 'Escape', 'Space', 'Enter')) {
    helpOpen = false;
    consume('KeyE', 'Escape', 'Space', 'Enter');
  }
}

function render(real) {
  if (drawOrientationHint(ctx)) return;
  if (screenMode === 'title') { renderTitle(real); drawTouchControls(ctx, performance.now() / 1000); return; }
  const t = G.time;
  ctx.imageSmoothingEnabled = false;

  if (G.mode === 'camp') {
    drawCamp(ctx, performance.now() / 1000);
    drawPlayer(ctx, G.player, performance.now() / 1000);
    const station = nearestStation(G.player.x);
    if (station && !G.station && !mini.active) {
      const sx = cam.sx(station.x);
      keyPrompt(ctx, sx, CAMP_GROUND - 58, 'E', station.label, performance.now() / 1000);
    }
  } else {
    drawValley(ctx, t, screen);
    const tile = mouseTile();
    if (input.overCanvas && input.my < VIEW_H - 40) drawCursor(ctx, tile.x, tile.y, t);
    drawRider(ctx, G.rider, performance.now() / 1000);
    nightWash(ctx);
  }

  // --- HUD
  drawResourceStrip(ctx);
  drawDayChip(ctx);
  if (G.mode === 'sky' && !G.station && !mini.active && !helpOpen) {
    const picked = drawHotbar(ctx, t);
    if (picked) G.ui.build = G.ui.build === picked ? null : picked;
    drawHint(ctx, G.ui.build
      ? (touchUI.enabled ? 'TAP THE VALLEY TO PLACE' : 'CLICK TO PLACE - E CANCELS')
      : (touchUI.enabled ? 'TAP A TREE TO FELL IT' : 'E  FLY HOME'), PAL.paper3);
  }
  if (G.paused) {
    text(ctx, 'PAUSED', VIEW_W / 2, 30, PAL.gold2, { align: 'center', shadow: PAL.ink });
  }
  drawToasts(ctx, real, G.mode === 'sky' ? 44 : 16, touchUI.enabled);

  // --- overlays
  if (mini.active) { if (!drawMinigame(ctx, performance.now() / 1000)) closeMinigame2(); }
  else if (G.station) drawStation(ctx, performance.now() / 1000, real);
  if (helpOpen) drawHelp(ctx);

  drawTouchControls(ctx, performance.now() / 1000);

  if (fade.dur > 0) {
    const half = fade.dur / 2;
    const a = fade.t < half ? fade.t / half : 1 - (fade.t - half) / half;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    rect(ctx, 0, 0, VIEW_W, VIEW_H, fade.colour);
    // feathers drifting through the wipe
    for (let i = 0; i < 9; i++) {
      const fx = ((i * 71 + fade.t * 90) % (VIEW_W + 40)) - 20;
      const fy = (i * 37 + fade.t * 40) % VIEW_H;
      rect(ctx, Math.round(fx), Math.round(fy), 3, 1, PAL.white);
      px(ctx, Math.round(fx) + 3, Math.round(fy) + 1, PAL.paper2);
    }
    ctx.globalAlpha = 1;
  }
}

function closeMinigame2() { mini.active = false; }

/** Dusk and night wash over the valley too, so both views share a clock. */
function nightWash(ctx) {
  const phase = skyPhase(G.dayT);
  if (phase === 'day') return;
  ctx.fillStyle = phase === 'night' ? 'rgba(24,32,72,0.34)'
    : phase === 'dusk' ? 'rgba(120,60,60,0.18)' : 'rgba(200,130,80,0.14)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// ------------------------------------------------------------------ title
let titleT = 0;

function updateTitle(real) {
  titleT += real;
  if (warmIndex < WARMUP.length) {
    // one batch per frame keeps the screen responsive while it builds
    WARMUP[warmIndex++]();
  }
}

function renderTitle(real) {
  drawTitleScene(ctx, titleT);
  drawTitleText(ctx, titleT);

  if (warmIndex < WARMUP.length) {
    const p = warmIndex / WARMUP.length;
    const w = 120, x = (VIEW_W - w) >> 1, y = VIEW_H - 30;
    text(ctx, 'CARVING THE VALLEY', VIEW_W / 2, y - 11, PAL.paper2, { align: 'center', shadow: PAL.black });
    rect(ctx, x, y, w, 6, 'rgba(21,14,40,0.8)');
    rect(ctx, x + 1, y + 1, Math.round((w - 2) * p), 4, PAL.gold2);
    frame(ctx, x, y, w, 6, PAL.ink);
    return;
  }

  const saved = hasSave();
  const bx = 132 - 44, by = 90;
  if (saved) {
    if (button(ctx, bx, by, 88, 17, 'CONTINUE')) continueGame();
    if (button(ctx, bx, by + 21, 88, 17, 'NEW VALLEY')) startNewGame();
    if (button(ctx, bx, by + 42, 88, 17, 'HOW TO PLAY')) { startNewGame(); helpOpen = true; }
  } else {
    if (button(ctx, bx, by, 88, 17, 'START')) startNewGame();
    if (button(ctx, bx, by + 21, 88, 17, 'HOW TO PLAY')) { startNewGame(); helpOpen = true; }
  }
  if (Math.floor(titleT * 1.4) % 2 === 0) {
    text(ctx, 'PRESS ENTER', VIEW_W / 2, VIEW_H - 20, PAL.paper3, { align: 'center', shadow: PAL.black });
  }
  if (pressed('Enter', 'Space', 'KeyE')) {
    consume('Enter', 'Space', 'KeyE');
    if (saved) continueGame(); else startNewGame();
  }
}

// ------------------------------------------------------------------- help
function drawHelp(ctx) {
  scrim(ctx, VIEW_W, VIEW_H, 0.68);
  const w = 300, h = 176;
  const x = (VIEW_W - w) >> 1, y = (VIEW_H - h) >> 1;
  const box = panel(ctx, x, y, w, h, 'DAM IT');
  const bird = S.birdSprite(1, true);
  ctx.drawImage(bird, box.x + box.w - bird.width - 2, box.y - 2);

  const lines = [
    ['YOU ARE THE VALLEY\'S BEAVER CONTRACTOR.', PAL.paper],
    ['WILD ANIMALS WANT HOMES. BUILD THEM.', PAL.paper3],
    ['', PAL.paper],
    ['IN CAMP', PAL.gold2],
    ['A / D   WALK      SPACE  JUMP', PAL.paper],
    ['E       USE WHAT YOU ARE STANDING AT', PAL.paper],
    ['', PAL.paper],
    ['ON THE HERON', PAL.gold2],
    ['WASD    FLY       CLICK  MARK / BUILD', PAL.paper],
    ['1-9     TOOLS     TAB    OTHER TOOLS', PAL.paper],
    ['RCLICK  CANCEL    E      FLY HOME', PAL.paper],
    ['', PAL.paper],
    ['SHIFT SPEEDS TIME UP.  P PAUSES.  H HELP.', PAL.paper3],
  ];
  lines.forEach((entry, i) => text(ctx, entry[0], box.x, box.y + i * 9, entry[1]));
  if (button(ctx, box.x + (box.w >> 1) - 34, box.y + box.h - 14, 68, 12, 'LET\'S BUILD')) helpOpen = false;
}

// ------------------------------------------------------------------- wire
boot();
requestAnimationFrame(step);
window.addEventListener('beforeunload', () => saveGame());

Object.defineProperty(window, '__scale', { get: () => screen.scale });
Object.defineProperty(window, '__camx', { get: () => Math.round(cam.x) });
Object.defineProperty(window, '__camy', { get: () => Math.round(cam.y) });
Object.defineProperty(window, '__touchEnabled', { get: () => touchUI.enabled });

Object.defineProperty(window, '__inputSnapshot', { get: () => ({ mx: input.mx, my: input.my, over: input.overCanvas, clicked: input.clicked, touches: input.touches.size, isTouch: input.isTouch }) });

window.DAMIT = {
  G, simulate, newGame, placeSite, completeSite, spawnRequest, makeBeaver,
  toggleTreeMark, takeOff, landHome, openStation, closeStation,
  setHelp: (v) => { helpOpen = v; },
  invalidateGround,
};
