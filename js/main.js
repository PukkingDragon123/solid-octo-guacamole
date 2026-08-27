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
import { updateCampPlayer, updateSidePlayer, updateRider, seatRider } from './player.js';
import { drawResourceStrip, drawDayChip, drawToasts, drawHotbar, drawHint, PAGES } from './ui/hud.js';
import { drawStation, openStation, closeStation } from './ui/board.js';
import { keyPrompt, button, panel, scrim, hovering } from './ui/widgets.js';
import { updateTouch, drawTouchControls, drawOrientationHint, touchUI } from './ui/touch.js';
import { drawTitleScene, drawTitleText } from './scenes/title.js';
import { mini, openMinigame, updateMinigame, drawMinigame, canPlay } from './minigame.js';

// ---- the campaign: the story, the workshop, and everything it leads to
import { story, freshStory, tutorialStep, tutorialDone, TUTORIAL, HOSPITAL_BILL } from './story.js';
import { dailyOffers, makeOffer, pushOffer, NPCS, FURNITURE, outstanding } from './orders.js';
import { runRobots } from './shop.js';
import { cut, playCutscene, updateCutscene, drawCutscene } from './scenes/cutscene.js';
import { drawWorkshop, drawWorkshopHud, nearestWorkStation, WORKSHOP_GROUND, WORKSHOP_BOUNDS }
  from './scenes/workshop.js';
import { drawHeroSide } from './gfx/actors.js';
import { forest, makeForest, growForest, updateForest, drawForest, drawForestHud, fell,
         FOREST_GROUND, FOREST_BOUNDS } from './scenes/forest.js';
import { travel, openMap, closeMap, updateTravel, drawMap, drawFlight, startFlight } from './scenes/travel.js';
import { site, openSite, closeSite, updateSite, drawSite, geometry as siteGeometry } from './scenes/site.js';
import { yard, openYard, closeYard, updateYard, drawYard, enteredHouse } from './scenes/yard.js';
import { phone, openPhone, closePhone, drawPhone } from './ui/phone.js';
import { saw, openSaw, closeSaw, updateSaw, drawSaw, canSaw } from './minigames/saw.js';
import { asm, openAssemble, closeAssemble, updateAssemble, drawAssemble } from './minigames/assemble.js';
import { drawBuildMenu, buildMenu, openBuildMenu, closeBuildMenu } from './ui/buildmenu.js';
import { unlockAudio, sfx } from './audio.js';

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

  // ---- the campaign starts in grandpa's workshop, the morning after the fall
  G.story = freshStory();
  G.forest = makeForest();
  G.mode = 'workshop';
  G.player = { x: 200, y: WORKSHOP_GROUND, vx: 0, vy: 0, onGround: true, face: 1 };
  pushOffer(makeOffer('willow', {
    pool: ['stool'], count: 1, repair: null,
    text: 'WILLOW HERE - YOUR GRANDPA SAID YOU ARE TAKING WORK NOW. I NEED A STOOL.',
  }));
  invalidateGround();
  seedCritters();
  seedCampCritters();
  logMsg('Welcome to the valley.', 'good');
}

/** The camera limits for whichever scene we are in. */
function boundsFor(mode) {
  if (mode === 'sky') return SKY_BOUNDS;
  if (mode === 'workshop') return WORKSHOP_BOUNDS;
  if (mode === 'forest') return FOREST_BOUNDS;
  return CAMP_BOUNDS;
}

function groundFor(mode) {
  if (mode === 'workshop') return WORKSHOP_GROUND;
  if (mode === 'forest') return FOREST_GROUND;
  return CAMP_GROUND;
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
               boundsFor(G.mode));
  screenMode = 'game';
  last = performance.now();
}

function startNewGame() {
  newGame();
  enterGame();
  screenMode = 'cutscene';
  playCutscene('intro', () => {
    screenMode = 'game';
    const s = story();
    s.seenIntro = true;
    s.beat = 'tutorial';
    s.chapter = 1;
    helpOpen = true;
  });
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
    dailyOffers();
    runRobots();
    growForest();
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

/** Any campaign screen that should freeze the world behind it. */
function campaignOverlay() {
  return phone.open || saw.active || asm.active || buildMenu.open || travel.open || travel.flying;
}

/** Walk into a scene, with a wipe over the join. */
function goMode(mode, colour) {
  startFade(() => {
    G.mode = mode;
    G.ui.build = null;
    const ground = groundFor(mode);
    if (mode === 'workshop') G.player.x = travel.dest ? 424 : 200;
    else if (mode === 'forest') G.player.x = 120;
    else if (mode === 'camp') G.player.x = 352;
    G.player.y = ground;
    G.player.vx = 0; G.player.vy = 0; G.player.onGround = true;
    if (mode !== 'site') cam.centreOn(G.player.x, VIEW_H / 2, boundsFor(mode));
  }, colour || PAL.wood1);
}

/** The map table picked a site: fly out, then drop into it. */
travel.onCamp = () => {
  closeMap();
  goMode('camp', PAL.grass1);
  toast('THE OLD DAM CAMP. PRESS M TO GO BACK TO THE WORKSHOP.', 'info');
};

travel.onPick = (npcId) => {
  // the heron sets you down at the gate; you walk in from there
  openYard(npcId);
  G.mode = 'yard';
  closeMap();
};

function leaveSite() {
  closeSite();
  goMode('workshop');
  if (story().tutorial >= 0) tutorialDone('deliver');
}

/** Through the front door: the yard hands over to the room inside. */
function enterHouse() {
  const npcId = yard.npc;
  closeYard();
  startFade(() => {
    openSite(npcId);
    G.mode = 'site';
  }, PAL.wood1);
}

function handleWorkshopInput() {
  const station = nearestWorkStation(G.player.x);
  if (!station || !pressed('KeyE')) return;
  consume('KeyE');
  if (station.id === 'phone') openPhone();
  else if (station.id === 'saw') { if (openSaw()) tutorialDone('saw'); }
  else if (station.id === 'bench') openBuildMenu();
  else if (station.id === 'map') openMap();
  else if (station.id === 'door') { goMode('forest', PAL.leaf1); tutorialDone('forest'); }
}

function handleForestInput() {
  if (fell.phase !== 'idle') return;
  if (Math.abs(G.player.x - 70) < 30 && pressed('KeyE')) {
    consume('KeyE');
    goMode('workshop');
  }
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
  if (pressed('KeyM')) { consume('KeyM'); goMode('workshop'); return; }
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
let timeOverride = null;
const wallClock = () => (timeOverride !== null ? timeOverride : performance.now() / 1000);

function step(now) {
  const real = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(real);
  render(real);
  endFrame();
  requestAnimationFrame(step);
}

function update(real) {
  const overlayNow = helpOpen || mini.active || !!G.station || screenMode === 'title' || campaignOverlay();
  updateTouch(G.mode === 'site' || G.mode === 'yard' ? 'site' : G.mode, overlayNow);
  if (screenMode === 'title') { updateTitle(real); return; }
  if (screenMode === 'cutscene') {
    updateCutscene(real);
    if (!cut.active) screenMode = 'game';
    return;
  }
  updateMinigame(real);
  updateSaw(real);
  updateAssemble(real);
  updateTravel(real);
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

  const overlay = helpOpen || mini.active || !!G.station || campaignOverlay();
  const busy = overlay || fade.dur > 0;

  if (!overlay && pressed('KeyP')) G.paused = !G.paused;
  if (!overlay && pressed('KeyH', 'F1')) helpOpen = true;
  G.speed = held('ShiftLeft', 'ShiftRight') ? 3 : 1;

  const simDt = G.paused || overlay ? 0 : real * G.speed;
  if (simDt > 0) simulate(simDt);

  if (G.mode === 'yard') {
    if (!overlay) updateYard(real);
    if (enteredHouse() && fade.dur <= 0) enterHouse();
  } else if (G.mode === 'site') {
    if (!overlay) updateSite(real);
    if (!site.active) leaveSite();
  } else if (G.mode === 'workshop') {
    updateSidePlayer(real, busy, WORKSHOP_BOUNDS.w, WORKSHOP_GROUND);
    cam.follow(G.player.x, VIEW_H / 2, real, WORKSHOP_BOUNDS, 8);
    if (!busy) handleWorkshopInput();
  } else if (G.mode === 'forest') {
    updateForest(real, busy);
    cam.follow(G.player.x, VIEW_H / 2, real, FOREST_BOUNDS, 8);
    if (!busy) handleForestInput();
  } else if (G.mode === 'camp') {
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
  if (screenMode === 'title') { renderTitle(real); drawTouchControls(ctx, wallClock()); return; }
  const t = G.time;
  const wall = wallClock();
  ctx.imageSmoothingEnabled = false;

  if (screenMode === 'cutscene') {
    drawCutscene(ctx, wall);
    drawTouchControls(ctx, wall);
    return;
  }

  if (travel.flying) {
    drawFlight(ctx, wall);
    drawTouchControls(ctx, wall);
    return;
  }

  if (G.mode === 'yard') {
    drawYard(ctx, wall);
    drawToasts(ctx, real, 30, false);
    drawTouchControls(ctx, wall);
    if (fade.dur > 0) drawFade(ctx);
    return;
  }

  if (G.mode === 'site') {
    drawSite(ctx, wall);
    drawToasts(ctx, real, 30, false);
    drawTouchControls(ctx, wall);
    if (fade.dur > 0) drawFade(ctx);
    return;
  }

  if (G.mode === 'workshop' || G.mode === 'forest') {
    if (G.mode === 'workshop') {
      drawWorkshop(ctx, wall);
      drawHeroSide(ctx, cam.sx(G.player.x), G.player.y, wall, { player: G.player });
      if (!campaignOverlay()) drawWorkshopHud(ctx, wall);
    } else {
      drawForest(ctx, wall);
      // chopping shows in the world, not just on the meter
      const pose = fell.phase === 'chop' ? 'chop' : fell.phase === 'blackout' ? 'sit' : null;
      drawHeroSide(ctx, cam.sx(G.player.x), G.player.y, wall,
                   { player: G.player, pose, face: fell.phase === 'chop' ? fell.dodgeSide * -1 : undefined });
      drawForestHud(ctx, wall);
    }
    drawCampaignHud(ctx, real);
    if (phone.open) { if (!drawPhone(ctx, wall)) closePhone(); }
    else if (buildMenu.open) {
      const pick = drawBuildMenu(ctx, wall);
      if (pick) { if (openAssemble(pick)) tutorialDone('craft'); }
    } else if (saw.active) { if (!drawSaw(ctx, wall)) closeSaw(); }
    else if (asm.active) { if (!drawAssemble(ctx, wall)) closeAssemble(); }
    else if (travel.open) { if (!drawMap(ctx, wall)) closeMap(); }
    if (helpOpen) drawHelp(ctx);
    drawTouchControls(ctx, wall);
    if (fade.dur > 0) drawFade(ctx);
    return;
  }

  if (G.mode === 'camp') {
    drawCamp(ctx, wallClock());
    drawPlayer(ctx, G.player, wallClock());
    const station = nearestStation(G.player.x);
    if (station && !G.station && !mini.active) {
      const sx = cam.sx(station.x);
      keyPrompt(ctx, sx, CAMP_GROUND - 58, 'E', station.label, wallClock());
    }
  } else {
    drawValley(ctx, t, screen);
    const tile = mouseTile();
    if (input.overCanvas && input.my < VIEW_H - 40) drawCursor(ctx, tile.x, tile.y, t);
    drawRider(ctx, G.rider, wallClock());
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
  if (mini.active) { if (!drawMinigame(ctx, wallClock())) closeMinigame2(); }
  else if (G.station) drawStation(ctx, wallClock(), real);
  if (helpOpen) drawHelp(ctx);

  drawTouchControls(ctx, wallClock());

  if (fade.dur > 0) drawFade(ctx);
}

function drawFade(ctx) {
  {
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

/**
 * The strip that follows you round the campaign: what you owe, what you have,
 * and whatever grandpa is nudging you toward next.
 */
function drawCampaignHud(ctx, real) {
  const s = story();
  rect(ctx, 0, 0, VIEW_W, 13, 'rgba(13,10,9,0.66)');
  text(ctx, `DAY ${G.day}`, 5, 3, PAL.paper3);
  text(ctx, `${s.money} ACORNS`, 52, 3, PAL.gold2);
  text(ctx, `BILL ${s.debt}`, 128, 3, s.debt > 0 ? PAL.red2 : PAL.grass4);
  const mats = s.materials;
  text(ctx, `LOGS ${mats.hardwood || 0}  PLANKS ${mats.plank || 0}  SCREWS ${mats.screw || 0}`,
       VIEW_W - 5, 3, PAL.paper2, { align: 'right' });

  const step = tutorialStep();
  if (step) {
    const w = 250, x = (VIEW_W - w) >> 1;
    rect(ctx, x, 15, w, 12, 'rgba(21,14,40,0.78)');
    frame(ctx, x, 15, w, 12, PAL.wood2);
    text(ctx, step.tip, VIEW_W / 2, 18, PAL.gold2, { align: 'center' });
  } else if (s.orders.length) {
    const order = s.orders[0];
    const need = outstanding(order);
    const label = need.length
      ? `BUILD ${FURNITURE[need[0]].name.toUpperCase()} FOR ${NPCS[order.npc].name.toUpperCase()}`
      : `DELIVER TO ${NPCS[order.npc].name.toUpperCase()} - MAP TABLE`;
    text(ctx, label, VIEW_W / 2, 17, PAL.paper3, { align: 'center', shadow: PAL.black });
  }
  drawToasts(ctx, real, 30, false);
}

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
  const w = 300, h = 186;
  const x = (VIEW_W - w) >> 1, y = (VIEW_H - h) >> 1;
  const box = panel(ctx, x, y, w, h, 'DAM IT');
  const bird = S.birdSprite(1, true);
  ctx.drawImage(bird, box.x + box.w - bird.width - 2, box.y - 2);

  const lines = [
    ['GRANDMA IS IN HOSPITAL. THE BILL IS 4800.', PAL.paper],
    ['YOU ARE A CARPENTER NOW. GET TO WORK.', PAL.paper3],
    ['', PAL.paper],
    ['THE WORKSHOP', PAL.gold2],
    ['A / D  WALK      E  USE THE BENCH YOU ARE AT', PAL.paper],
    ['PHONE TAKE JOBS  SAW  LOGS INTO PLANKS', PAL.paper],
    ['BENCH BUILD IT   MAP  FLY OUT AND FIT IT', PAL.paper],
    ['', PAL.paper],
    ['IN THE TREES', PAL.gold2],
    ['E CHOP, SPACE ON THE SWING - THEN RUN WHEN', PAL.paper],
    ['IT CREAKS, OR IT LANDS ON YOU.', PAL.paper],
    ['', PAL.paper],
    ['AT A CUSTOMER: WASD WALK, E CARRY AND FIT,', PAL.paper3],
    ['B BLUEPRINT, R RE-DRESS THE ROOM.', PAL.paper3],
    ['M FROM THE OLD CAMP COMES HOME. H HELP.', PAL.paper3],
  ];
  lines.forEach((entry, i) => text(ctx, entry[0], box.x, box.y + i * 9, entry[1]));
  if (button(ctx, box.x + (box.w >> 1) - 34, box.y + box.h - 14, 68, 12, 'LET\'S BUILD')) helpOpen = false;
}

// ------------------------------------------------------------------- wire
boot();
// Sound can only start after a gesture, so the first tap or key does it.
for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(ev, () => unlockAudio(), { once: true });
}
requestAnimationFrame(step);
window.addEventListener('beforeunload', () => saveGame());

// Test hooks: pin the camera to a whole pixel, and freeze the animation clock,
// so one frame can be compared against another taken at a different camera
// offset. Without the frozen clock, sway and flicker swamp the comparison.
window.__pinCam = (x) => { cam.x = x; render(0); };
window.__freezeTime = (t) => { timeOverride = t; };

Object.defineProperty(window, '__scale', { get: () => screen.scale });
Object.defineProperty(window, '__camx', { get: () => Math.round(cam.x) });
Object.defineProperty(window, '__camy', { get: () => Math.round(cam.y) });
Object.defineProperty(window, '__touchEnabled', { get: () => touchUI.enabled });

Object.defineProperty(window, '__inputSnapshot', { get: () => ({ mx: input.mx, my: input.my, over: input.overCanvas, clicked: input.clicked, touches: input.touches.size, isTouch: input.isTouch }) });

window.DAMIT = {
  // the campaign, exposed so the story can be poked at from the console
  story, fell, forest, site, yard, travel, phone, saw, asm, buildMenu, cut, siteGeometry,
  openYard,
  goMode, openPhone, openSaw, openAssemble, openMap, openSite, playCutscene,
  G, simulate, newGame, placeSite, completeSite, spawnRequest, makeBeaver,
  toggleTreeMark, takeOff, landHome, openStation, closeStation,
  setHelp: (v) => { helpOpen = v; },
  invalidateGround,
};
