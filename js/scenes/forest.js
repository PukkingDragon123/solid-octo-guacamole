// Out the back of the workshop: a side-scrolling stand of timber. The trees
// grow day by day and lean in the wind, and every one of them warns you before
// it comes down. Miss the warning and you wake up in the leaves.

import { VIEW_W, VIEW_H } from '../config.js';
import { G, toast } from '../state.js';
import { PAL, rect, frame, px, text, disc, line, rngFrom, wrap, sprite, surface, outline, rimLight }
  from '../gfx/pixel.js';
import { SUN } from '../gfx/actors.js';
import { RAMPS, ramp, mix, noise as pnoise, turf, soilBand, contact, plank, speck, band,
         tile as pTile } from '../gfx/paint.js';
import * as N from '../gfx/nature.js';
import * as B from '../gfx/structures.js';
import * as PROP from '../gfx/props.js';
import { cam } from '../gfx/screen.js';
import * as S from '../gfx/sprites.js';
import { input, pressed, held } from '../input.js';
import { keyPrompt, bar, panel } from '../ui/widgets.js';
import { story, addMaterial, tutorialDone } from '../story.js';
import { sfx } from '../audio.js';

export const FOREST_W = 1600;
export const FOREST_GROUND = 214;
/** The top of the 2x zoom window the scene is viewed through. */
export const FOREST_ZOOM_TOP = 112;
export const FOREST_BOUNDS = { w: FOREST_W, h: VIEW_H };

const GRAVITY = 520, WALK_ACCEL = 640, WALK_MAX = 74, FRICTION = 900, JUMP_V = -168;
const CHOP_REACH = 34;
const FALL_WINDOW = 1.5;     // how long the creak gives you to get clear
const FALL_LENGTH = 120;      // how far the trunk reaches when it lands

// The timber itself is drawn by js/gfx/nature.js - trunks with bark, branch
// skeletons and canopies built from overlapping leaf clumps. This scene only
// decides where the trees stand, how they lean, and what happens when one comes
// down on you.
export const FOREST_SPECIES = N.TREE_KINDS;

/** Chopping, falling, blacked out - all the state the felling needs. */
export const fell = {
  phase: 'idle',        // idle | chop | creak | falling | blackout | log
  tree: null, swing: 0, dir: 1, hits: 0, need: 4, damage: 0,
  timer: 0, dodgeSide: 1, angle: 0, quality: 0, wake: 0, message: '',
};

export function makeForest() {
  const rng = rngFrom(0xF0FE57);
  const trees = [];
  for (let i = 0; i < 13; i++) {
    trees.push({
      x: 240 + i * 122 + Math.round(rng() * 36),
      size: rng(),
      // weighted, so no one species takes over the wood
      variant: [0, 1, 1, 2, 3, 3][Math.floor(rng() * 6) % 6],   // weighted, so no one species takes over
      growth: 0.4 + rng() * 0.6,
      phase: rng() * Math.PI * 2,
      stump: false,
      regrow: 0,
    });
  }
  return { trees, wind: 0, gust: 0, day: G.day };
}

export function forest() {
  if (!G.forest) G.forest = makeForest();
  return G.forest;
}

/** Trees put on growth overnight, and stumps eventually send up a new stem. */
export function growForest() {
  const f = forest();
  for (const tree of f.trees) {
    if (tree.stump) {
      tree.regrow += 0.34;
      if (tree.regrow >= 1) { tree.stump = false; tree.growth = 0.25; tree.regrow = 0; }
    } else if (tree.growth < 1) {
      tree.growth = Math.min(1, tree.growth + 0.22);
    }
  }
}

export function nearestTree(px0) {
  const f = forest();
  let best = null;
  for (const tree of f.trees) {
    if (tree.stump || tree.growth < 0.9) continue;
    const d = Math.abs(px0 - tree.x);
    if (d < CHOP_REACH && (!best || d < best.d)) best = { tree, d };
  }
  return best ? best.tree : null;
}

// ------------------------------------------------------------------ update
export function updateForest(dt, locked) {
  const f = forest();
  // wind: a slow base breeze with gusts rolling through it
  f.wind = Math.sin(G.time * 0.5) * 0.5 + Math.sin(G.time * 0.17) * 0.5;
  f.gust = Math.max(0, Math.sin(G.time * 0.11) - 0.4) * 2.2;

  updateFell(dt);
  if (fell.phase === 'blackout') { movePlayer(dt, true); return; }
  movePlayer(dt, locked || fell.phase === 'chop' || fell.phase === 'creak' ? fell.phase === 'creak' ? false : true : false);

  if (!locked && fell.phase === 'idle') {
    const tree = nearestTree(G.player.x);
    if (tree && pressed('KeyE')) {
      startChop(tree);
    }
  }
}

function movePlayer(dt, locked) {
  const p = G.player;
  const left = !locked && held('ArrowLeft', 'KeyA');
  const right = !locked && held('ArrowRight', 'KeyD');
  if (left && !right) { p.vx -= WALK_ACCEL * dt; p.face = -1; }
  else if (right && !left) { p.vx += WALK_ACCEL * dt; p.face = 1; }
  else {
    const drop = FRICTION * dt;
    p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - Math.sign(p.vx) * drop;
  }
  p.vx = Math.max(-WALK_MAX, Math.min(WALK_MAX, p.vx));
  if (!locked && p.onGround && held('Space', 'ArrowUp', 'KeyW')) { p.vy = JUMP_V; p.onGround = false; }
  p.vy += GRAVITY * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.y >= FOREST_GROUND) { p.y = FOREST_GROUND; p.vy = 0; p.onGround = true; }
  p.x = Math.max(14, Math.min(FOREST_W - 14, p.x));
}

function startChop(tree) {
  fell.phase = 'chop';
  fell.tree = tree;
  fell.swing = 0; fell.dir = 1; fell.hits = 0; fell.damage = 0;
  fell.need = 4;
  fell.quality = 0;
  fell.message = '';
  // which way it will go: away from where you are standing, mostly
  fell.dodgeSide = G.player.x <= tree.x ? 1 : -1;
}

function updateFell(dt) {
  const p = G.player;
  if (fell.phase === 'chop') {
    fell.swing += fell.dir * dt * 1.9;
    if (fell.swing > 1) { fell.swing = 1; fell.dir = -1; }
    if (fell.swing < 0) { fell.swing = 0; fell.dir = 1; }
    if (pressed('Space', 'KeyE') || input.clicked) swingAxe();
    if (pressed('Escape')) { fell.phase = 'idle'; fell.tree = null; }
  } else if (fell.phase === 'creak') {
    fell.timer -= dt;
    if (fell.timer <= 0) {
      fell.phase = 'falling';
      fell.angle = 0;
      sfx.fall();
      cam.kick(1.4);
    }
  } else if (fell.phase === 'falling') {
    fell.angle = Math.min(1, fell.angle + dt * 1.5);
    if (fell.angle >= 1) {
      // was the player still standing in the fall zone?
      const tree = fell.tree;
      const zoneA = tree.x;
      const zoneB = tree.x + FALL_LENGTH * fell.dodgeSide;
      const inZone = p.x > Math.min(zoneA, zoneB) - 6 && p.x < Math.max(zoneA, zoneB) + 6;
      if (inZone) blackout();
      else land();
    }
  } else if (fell.phase === 'blackout') {
    fell.wake -= dt;
    if (fell.wake <= 0) {
      fell.phase = 'idle';
      fell.tree = null;
      G.dayT = Math.min(0.98, G.dayT + 0.12);   // you lost a chunk of the day
    }
  } else if (fell.phase === 'log') {
    fell.timer -= dt;
    if (fell.timer <= 0) { fell.phase = 'idle'; fell.tree = null; }
  }
}

function swingAxe() {
  // the sweet spot is the middle of the arc - hit it and the axe bites deep
  const off = Math.abs(fell.swing - 0.5);
  const bite = off < 0.05 ? 1 : off < 0.14 ? 0.65 : off < 0.28 ? 0.3 : 0.1;
  fell.damage += bite;
  fell.hits++;
  fell.quality += bite;
  cam.kick(bite * 0.5);
  if (bite >= 1) sfx.chop(); else if (bite > 0.3) sfx.chop(); else sfx.thunk();
  fell.message = bite >= 1 ? 'CLEAN BITE' : bite > 0.3 ? 'SOLID' : 'GLANCING BLOW';
  if (fell.damage >= fell.need) {
    fell.phase = 'creak';
    fell.timer = FALL_WINDOW;
    sfx.creak(FALL_WINDOW * 0.9);
    toast('LISTEN - IT IS GOING. GET OUT FROM UNDER IT.', 'warn');
  }
}

function land() {
  const tree = fell.tree;
  tree.stump = true;
  tree.regrow = 0;
  const q = Math.min(1, fell.quality / Math.max(1, fell.hits));
  const logs = 2 + Math.round(q * 2);
  addMaterial('hardwood', logs);
  story().stats.felled++;
  fell.phase = 'log';
  fell.timer = 1.6;
  fell.message = `${logs} LOGS`;
  toast(`TIMBER - ${logs} LOGS HAULED IN`, 'good');
  sfx.cash();
  tutorialDone('fell');
}

function blackout() {
  fell.phase = 'blackout';
  fell.wake = 3.2;
  story().stats.blackouts++;
  sfx.bad();
  cam.kick(2);
  toast('THE TRUNK CAUGHT YOU. LISTEN FOR THE CREAK NEXT TIME.', 'warn');
}

// -------------------------------------------------------------------- draw
/** Trees lean by shearing the whole sprite about its base. */
function drawTree(ctx, tree, t, f) {
  const img = tree.stump ? N.stump(tree.variant)
    : N.tree(tree.variant, tree.growth, tree.size === undefined ? 0.5 : tree.size);
  const sx = cam.sx(tree.x) - (img.width >> 1);
  const base = FOREST_GROUND + 2;
  const sy = base - img.height;
  if (sx < -img.width - 20 || sx > VIEW_W + 20) return;

  // the shadow it casts, pooled flat at the foot
  ctx.globalAlpha = 0.16;
  const shw = Math.round(img.width * 0.3);
  for (let dy = -3; dy <= 3; dy++) {
    const span = Math.round(shw * Math.sqrt(Math.max(0, 1 - (dy * dy) / 10)));
    rect(ctx, cam.sx(tree.x) - span, base - 2 + dy, span * 2, 1, PAL.black);
  }
  ctx.globalAlpha = 1;
  if (tree.stump) { ctx.drawImage(img, sx, sy); return; }

  const felling = fell.tree === tree;
  let lean = (Math.sin(t * 1.1 + tree.phase) * 0.9 + f.wind * 1.4 + f.gust * 2.2) * 0.012 * tree.growth;
  if (felling && fell.phase === 'creak') lean += Math.sin(t * 26) * 0.02;
  if (felling && fell.phase === 'falling') {
    lean = fell.dodgeSide * fell.angle * fell.angle * 1.5;
  }
  ctx.save();
  // shear about the foot of the trunk: x' = x + lean * (base - y)
  ctx.transform(1, 0, -lean, 1, lean * base, 0);
  ctx.drawImage(img, sx, sy);
  ctx.restore();

  if (felling) {
    // the notch, and chips flying out of it
    if (fell.phase === 'chop' || fell.phase === 'creak') {
      const cut = Math.min(1, fell.damage / fell.need);
      rect(ctx, sx + (img.width >> 1) - 5, base - 12, Math.round(10 * cut), 4, PAL.wood0);
      px(ctx, sx + (img.width >> 1) - 6, base - 10, PAL.wood4);
    }
    if (fell.phase === 'creak') {
      // leaves shaking loose, and the shadow of where it will land
      for (let i = 0; i < 10; i++) {
        const lx = sx + (img.width >> 1) + Math.round(Math.sin(t * 3 + i) * 22);
        const ly = sy + 20 + ((t * 40 + i * 17) % 90);
        px(ctx, lx, Math.round(ly), i % 2 ? PAL.leaf2 : PAL.leaf3);
      }
    }
  }
}

function drawFallZone(ctx) {
  if (fell.phase !== 'creak' && fell.phase !== 'falling') return;
  const tree = fell.tree;
  const x0 = cam.sx(tree.x);
  const x1 = cam.sx(tree.x + FALL_LENGTH * fell.dodgeSide);
  const left = Math.min(x0, x1), w = Math.abs(x1 - x0);
  const flash = fell.phase === 'creak' && Math.floor(fell.timer * 8) % 2 === 0;
  ctx.globalAlpha = flash ? 0.34 : 0.18;
  rect(ctx, left, FOREST_GROUND - 4, w, 8, PAL.red2);
  ctx.globalAlpha = 1;
  for (let x = left; x < left + w; x += 8) px(ctx, x, FOREST_GROUND - 6, PAL.red2);
  // the arrow that tells you which way to run
  const ax = cam.sx(tree.x + 40 * fell.dodgeSide);
  const ay = FOREST_GROUND - 40;
  for (let i = 0; i < 10; i++) px(ctx, ax + i * fell.dodgeSide, ay, PAL.gold2);
  for (let i = 0; i < 4; i++) {
    px(ctx, ax + (10 - i) * fell.dodgeSide, ay - i, PAL.gold2);
    px(ctx, ax + (10 - i) * fell.dodgeSide, ay + i, PAL.gold2);
  }
}

function drawFallenTrunk(ctx) {
  if (fell.phase !== 'log' || !fell.tree) return;
  const tree = fell.tree;
  const x0 = cam.sx(tree.x);
  const dir = fell.dodgeSide;
  const w = FALL_LENGTH;
  const left = dir > 0 ? x0 : x0 - w;
  rect(ctx, left, FOREST_GROUND - 12, w, 12, PAL.wood2);
  rect(ctx, left, FOREST_GROUND - 12, w, 3, PAL.wood3);
  rect(ctx, left, FOREST_GROUND - 3, w, 3, PAL.wood0);
  for (let i = 6; i < w; i += 13) px(ctx, left + i, FOREST_GROUND - 7, PAL.wood0);
  // end grain
  const ex = dir > 0 ? left : left + w - 6;
  for (let r = 5; r > 0; r--) disc(ctx, ex + 3, FOREST_GROUND - 6, r, r % 2 ? PAL.wood3 : PAL.wood4);
}

export function drawForest(ctx, t) {
  const f = forest();
  // ---- sky and distance
  // The scene is played through a 2x window whose top edge is FOREST_ZOOM_TOP,
  // so the sky, the sun and the ridge lines all live just above the treetops -
  // high up in view space nothing would ever be seen.
  const bands = [SUN.sky0, SUN.sky1, SUN.sky2, SUN.sky3];
  for (let i = 0; i < bands.length; i++) {
    rect(ctx, 0, Math.round(FOREST_ZOOM_TOP - 20 + i * 14), VIEW_W, 15, bands[i]);
  }
  rect(ctx, 0, 0, VIEW_W, FOREST_ZOOM_TOP - 20, SUN.sky0);
  // a fat sun, low and warm, with soft clouds crossing it
  const sunY = FOREST_ZOOM_TOP + 8;
  disc(ctx, 96, sunY, 13, '#fff3c4');
  ctx.globalAlpha = 0.18;
  for (let i = 1; i <= 3; i++) disc(ctx, 96, sunY, 13 + i * 6, '#fff3c4');
  ctx.globalAlpha = 1;
  for (let i = 0; i < 5; i++) {
    const img = S.cloudSprite(i % 2);
    const cx = ((i * 118 - cam.x * 0.05 - G.time * 4) % (VIEW_W + 140)) - 70;
    ctx.drawImage(img, Math.round(cx < -70 ? cx + VIEW_W + 140 : cx),
                  FOREST_ZOOM_TOP - 6 + (i * 13) % 26);
  }
  // far ridge lines, three deep
  // three ranges of hills. The silhouette is a sum of sines of the world
  // coordinate, so it is continuous however far you walk - a wrapped noise
  // buffer leaves a visible step in the skyline.
  for (let layer = 0; layer < 3; layer++) {
    const tone = ['#93b8d8', '#6fa763', '#4f9243'][layer];
    const crest = ['#a9c8e0', '#84b877', '#63a651'][layer];
    const yBase = FOREST_ZOOM_TOP + 26 + layer * 18;
    const par = 0.06 + layer * 0.05;
    for (let x = 0; x < VIEW_W + 2; x++) {
      const wx = x + cam.x * par + layer * 300;
      const hill = Math.sin(wx * 0.011) * 13 + Math.sin(wx * 0.027 + layer) * 6
                 + Math.sin(wx * 0.061 + layer * 2) * 2.5;
      const y = Math.round(yBase + hill);
      rect(ctx, x, y, 1, VIEW_H, tone);
      rect(ctx, x, y, 1, 2, crest);
    }
  }
  // two ranks of trees behind the stand, each on its own parallax and haze
  const midRng = rngFrom(4000);
  const mid = [];
  for (let i = 0; i < 46; i++) {
    mid.push({ x: midRng() * FOREST_W, v: [0, 1, 1, 2, 3, 3][Math.floor(midRng() * 6) % 6],
               g: 0.55 + midRng() * 0.45, size: midRng(), depth: midRng() < 0.5 ? 0.34 : 0.6 });
  }
  for (const depth of [0.34, 0.6]) {
    // their feet must be on the turf, or the trunks float in the hills
    const groundY = FOREST_GROUND + (depth < 0.5 ? 2 : 6);
    for (const tree of mid) {
      if (tree.depth !== depth) continue;
      const sx = Math.round(tree.x - cam.x * depth);
      if (sx < -90 || sx > VIEW_W + 90) continue;
      const img = N.tree(tree.v, tree.g * (depth < 0.5 ? 0.4 : 0.62), tree.size * 0.5);
      const lean = (Math.sin(t * 0.8 + tree.x) * 0.5 + f.wind) * 0.008;
      ctx.save();
      ctx.transform(1, 0, -lean, 1, lean * groundY, 0);
      ctx.drawImage(img, sx - (img.width >> 1), groundY - img.height);
      ctx.restore();
    }
    // haze between the ranks - a cool tint, not a wash of white
    ctx.globalAlpha = depth < 0.5 ? 0.2 : 0.1;
    rect(ctx, 0, 40, VIEW_W, FOREST_GROUND - 34, '#7fb0d8');
    ctx.globalAlpha = 1;
  }

  // ---- ground
  // turf with a lit crown and blades standing off it, then the soil beneath -
  // both as world-anchored tiles, or they crawl as you walk
  band(ctx, 'forest:turf', 96, cam.x, FOREST_GROUND, 56, VIEW_W,
       (c, w, h) => turf(c, 0, 0, w, h, RAMPS.grass, { seed: 4477 }));
  band(ctx, 'forest:soil', 96, cam.x, FOREST_GROUND + 56, VIEW_H - FOREST_GROUND - 56, VIEW_W,
       (c, w, h) => soilBand(c, 0, 0, w, h, RAMPS.soil, { seed: 2211 }));
  // the path and everything growing on the turf, baked into one world-anchored
  // tile: flowers, clover, trodden stones, dapples of sun
  const pathY = FOREST_GROUND + 20;
  band(ctx, 'forest:path', 128, cam.x, pathY, 14, VIEW_W, (c, w, h) => {
    rect(c, 0, 0, w, h, '#a3854f');
    rect(c, 0, 0, w, 2, '#bd9c5f');
    rect(c, 0, h - 1, w, 1, '#7c6338');
    const pth = pnoise(6060);
    for (let i = 0; i < 44; i++) {
      const sx = pth() * w, py = 2 + pth() * (h - 4);
      const roll = pth();
      if (roll > 0.85) { rect(c, sx, py, 3, 2, '#c9c0b5'); px(c, sx, py, PAL.white); }
      else px(c, sx, py, roll > 0.5 ? '#8f7442' : '#b89355');
    }
    // ragged grassy edges
    for (let x = 0; x < w; x += 2) {
      const wob = Math.round(Math.sin(x * 0.11) * 2 + Math.sin(x * 0.37));
      rect(c, x, wob, 2, 2, RAMPS.grass[2]);
      rect(c, x, h - 2 - wob, 2, 2, RAMPS.grass[2]);
    }
  });
  for (let v = 0; v < 3; v++) {
    const tileW = 128;
    const img = pTile(`forest:bloom:${v}`, tileW, 52, (c, w, h) => bloomTile(c, w, h, 9111 + v * 977));
    const start = Math.floor(cam.x / tileW) * tileW;
    for (let wx = start - tileW; wx < cam.x + VIEW_W + tileW; wx += tileW) {
      // a repeatable shuffle: which of the three tiles goes at this world slot
      if (Math.abs(Math.round(wx / tileW)) % 3 !== v) continue;
      ctx.drawImage(img, Math.round(wx - cam.x), FOREST_GROUND + 2);
    }
  }

  drawClearing(ctx, t, f);
}

/** One tile of meadow: flowers, clover, and dapples of sun through the canopy. */
function bloomTile(c, w, h, seed) {
  {
    const bloom = pnoise(seed);
    for (let i = 0; i < 34; i++) {
      const sx = bloom() * w, by = bloom() * h;
      if (by > 16 && by < 34) continue;                 // keep the path clear
      const kind = bloom();
      if (kind < 0.34) { px(c, sx, by, '#f7cc55'); px(c, sx, by + 1, RAMPS.grass[1]); }
      else if (kind < 0.58) { px(c, sx, by, '#f2f2f2'); px(c, sx + 1, by, '#f2f2f2'); }
      else if (kind < 0.74) { px(c, sx, by, '#e8626f'); px(c, sx, by + 1, RAMPS.grass[1]); }
      else { px(c, sx, by, RAMPS.grass[4]); px(c, sx + 1, by - 1, RAMPS.grass[3]); }
    }
    // dapples of sun through the canopy
    c.globalAlpha = 0.1;
    const dap = pnoise(seed + 41);
    for (let i = 0; i < 10; i++) {
      const sx = dap() * w, dy = dap() * 18, rw = 5 + dap() * 9;
      for (let k = -2; k <= 2; k++) {
        const span = Math.round(rw * Math.sqrt(Math.max(0, 1 - (k * k) / 6)));
        rect(c, sx - span, dy + k, span * 2, 1, '#ffe9b0');
      }
    }
    c.globalAlpha = 1;
  }
}

/** The rest of the clearing: scrub, undergrowth, the cabin and what flies. */
function drawClearing(ctx, t, f) {

  // scrub along the back of the clearing: irregular, gappy, and three greens
  // deep, so it never reads as a row of stamped bushes
  const scrub = rngFrom(1234);
  if (!f.scrub) {
    f.scrub = [];
    for (let i = 0; i < 90; i++) {
      f.scrub.push({ x: scrub() * FOREST_W, r: 7 + scrub() * 10, h: 8 + scrub() * 18,
                     tone: scrub(), gap: scrub() });
    }
  }
  const clumps = f.scrub;
  for (const c of clumps) {
    if (c.gap > 0.78) continue;                       // a gap you can see through
    const sx = cam.sx(c.x);
    if (sx < -40 || sx > VIEW_W + 40) continue;
    const img = N.scrubBush(c.r > 14 ? 2 : c.r > 10 ? 1 : 0, Math.floor(c.tone * 3));
    ctx.drawImage(img, sx - (img.width >> 1), FOREST_GROUND + 2 - img.height);
  }

  // undergrowth: bushes, ferns, tufts, mushrooms, stones and fallen wood, laid
  // out once and remembered, so nothing shuffles as you walk
  const flora = rngFrom(818);
  if (!f.under) {
    f.under = [];
    for (let i = 0; i < 150; i++) {
      f.under.push({ x: flora() * FOREST_W, roll: flora(), v: (flora() * 4) | 0, y: flora() });
    }
  }
  const under = f.under;

  const pathTop = FOREST_GROUND + 20, pathBottom = FOREST_GROUND + 34;
  for (const it of under) {
    const sx = cam.sx(it.x);
    if (sx < -40 || sx > VIEW_W + 10) continue;
    const baseY = FOREST_GROUND + 6 + Math.round(it.y * 44);
    if (baseY > pathTop - 2 && baseY < pathBottom + 6) continue;   // nothing grows on the path
    let img;
    if (it.roll < 0.2) img = N.bush(it.v % 3, it.v === 1 ? '#e8626f' : null);
    else if (it.roll < 0.42) img = N.grassTuft(it.v % 3);
    else if (it.roll < 0.58) img = N.fern();
    else if (it.roll < 0.7) img = N.flower(it.v);
    else if (it.roll < 0.8) img = N.mushroom(it.v % 2);
    else if (it.roll < 0.88) img = N.rock(it.v % 3);
    else if (it.roll < 0.94) img = N.log(it.v % N.TREE_KINDS, 40);
    else img = N.stump(it.v % N.TREE_KINDS);
    ctx.drawImage(img, sx, baseY - img.height);
  }

  // ---- the stand itself, far to near
  const sorted = f.trees.slice().sort((a, b) => a.x - b.x);
  for (const tree of sorted) drawTree(ctx, tree, t, f);
  drawFallZone(ctx);
  drawFallenTrunk(ctx);

  // ---- the back of the workshop, standing in its own clearing
  drawCabin(ctx, t);

  // a fringe of grass right under the camera, anchored to the world so it moves
  // with the ground rather than sliding across it
  for (let x = -8; x < VIEW_W + 8; x += 3) {
    const wx = Math.round(x + cam.x);
    const hh = 4 + Math.round(Math.sin(wx * 0.7) * 2 + Math.sin(wx * 0.13) * 2);
    const bend = Math.round((Math.sin(t * 2.2 + wx * 0.05) + f.gust) * 2);
    for (let k = 0; k < hh; k++) {
      px(ctx, x + Math.round((k / hh) * bend), VIEW_H - 1 - k, k > hh - 2 ? PAL.grass4 : PAL.grass2);
    }
  }

  // birds crossing, and butterflies over the flowers
  for (let i = 0; i < 3; i++) {
    const bx = ((i * 190 + t * (26 + i * 9)) % (VIEW_W + 80)) - 40;
    const by = 40 + i * 18 + Math.sin(t * 1.4 + i) * 6;
    const flap = Math.sin(t * (9 + i)) * 3;
    line(ctx, bx, by, bx + 4, by - flap, PAL.ink2);
    line(ctx, bx + 4, by - flap, bx + 8, by, PAL.ink2);
  }
  const flit = rngFrom(2929);
  for (let i = 0; i < 6; i++) {
    const seed = flit();
    const bx = cam.sx(seed * FOREST_W + Math.sin(t * 0.8 + i * 2) * 40);
    const by = FOREST_GROUND - 6 + Math.sin(t * 2.2 + i) * 12;
    if (bx < 0 || bx > VIEW_W) continue;
    const wing = Math.floor(t * 12 + i) % 2;
    const tone = seed > 0.5 ? '#f7cc55' : '#e8e2d0';
    px(ctx, Math.round(bx), Math.round(by), tone);
    px(ctx, Math.round(bx) + (wing ? 1 : 2), Math.round(by) - (wing ? 1 : 0), tone);
    px(ctx, Math.round(bx) - (wing ? 1 : 2), Math.round(by) - (wing ? 1 : 0), tone);
  }

  // leaves blowing through, on top of everything
  const leafRng = rngFrom(6161);
  for (let i = 0; i < 24; i++) {
    const seed = leafRng();
    const lx = ((seed * FOREST_W + t * (30 + seed * 40) * (1 + f.gust)) % (FOREST_W)) - cam.x;
    const ly = 40 + ((seed * 200 + Math.sin(t + i) * 30 + t * 12) % (FOREST_GROUND - 40));
    if (lx < 0 || lx > VIEW_W) continue;
    px(ctx, Math.round(lx), Math.round(ly), seed > 0.5 ? PAL.leaf3 : PAL.gold);
  }
}

/**
 * The back of grandpa's workshop, standing in its own clearing: the cabin from
 * js/gfx/structures.js, with the yard clutter of a working carpenter round it.
 */
function drawCabin(ctx, t) {
  const sx = cam.sx(96);
  if (sx < -190 || sx > VIEW_W + 190) return;
  const base = FOREST_GROUND + 10;
  const img = B.cabinSide('workshop', { lit: true, door: 'open' });
  const x = sx - (img.width >> 1);
  const y = base - img.height;

  // the shadow it casts on the turf
  ctx.globalAlpha = 0.26;
  for (let i = 0; i < 8; i++) {
    rect(ctx, x + 12 + i, FOREST_GROUND - 3 + i, img.width - 24 - i, 1, PAL.black);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(img, x, y);

  // smoke: puffs leaving the pot, growing and fading as they rise, curling a
  // little rather than tracking off in a straight line
  const stackX = x + Math.round(img.width * 0.66);
  const stackY = y + 6;
  for (let i = 0; i < 8; i++) {
    const age = ((t * 0.34 + i * 0.125) % 1);          // 0 at the pot, 1 gone
    const sy = stackY - age * 54;
    const curl = Math.sin(age * 3.4 + i) * 6 * age;
    const r = 2 + age * 5;
    ctx.globalAlpha = Math.max(0, 0.5 * (1 - age));
    disc(ctx, Math.round(stackX + curl), Math.round(sy), Math.round(r), PAL.paper2);
    disc(ctx, Math.round(stackX + curl - 1), Math.round(sy - 1), Math.max(1, Math.round(r * 0.6)), PAL.paper);
    ctx.globalAlpha = 1;
  }

  // a hand-painted sign, a woodpile, a chopping block and the sawhorse
  const sign = B.signPost();
  ctx.drawImage(sign, sx + 60, base - sign.height);
  text(ctx, 'WORKSHOP', sx + 88, base - sign.height + 7, PAL.ink, { align: 'center' });
  for (let i = 0; i < 8; i++) {
    const lx = x - 44 + (i % 4) * 11;
    const ly = base - 6 - Math.floor(i / 4) * 9;
    const lg = N.log(i % N.TREE_KINDS, 12);
    ctx.drawImage(lg, lx, ly - lg.height);
  }
  const block = N.stump(0);
  ctx.drawImage(block, x + img.width + 6, base - block.height);
  plank(ctx, x + img.width + 12, base - block.height - 8, 3, 10, RAMPS.oak, { dir: 'v', knots: 0 });
  rect(ctx, x + img.width + 8, base - block.height - 14, 12, 7, RAMPS.iron[2]);
  rect(ctx, x + img.width + 8, base - block.height - 14, 12, 2, RAMPS.iron[4]);
}

/** The chop meter, the creak warning and the blackout, all drawn over the top. */
export function drawForestHud(ctx, t) {
  const p = G.player;
  if (fell.phase === 'idle') {
    const tree = nearestTree(p.x);
    if (tree) keyPrompt(ctx, cam.sx(tree.x), FOREST_GROUND - 74, 'E', 'CHOP', t);
    else if (Math.abs(p.x - 96) < 36) keyPrompt(ctx, cam.sx(96), FOREST_GROUND - 46, 'E', 'GO IN', t);
  }

  if (fell.phase === 'chop') {
    // the axe arc: tap in the middle band for a clean bite
    const w = 180, x = (VIEW_W - w) >> 1, y = VIEW_H - 52;
    rect(ctx, x - 2, y - 12, w + 4, 34, 'rgba(13,10,9,0.72)');
    text(ctx, 'TAP SPACE AT THE TOP OF THE SWING', VIEW_W / 2, y - 10, PAL.paper3, { align: 'center' });
    rect(ctx, x, y, w, 10, PAL.wood0);
    rect(ctx, x + Math.round(w * 0.36), y, Math.round(w * 0.28), 10, PAL.wood3);
    rect(ctx, x + Math.round(w * 0.45), y, Math.round(w * 0.10), 10, PAL.gold2);
    frame(ctx, x, y, w, 10, PAL.ink);
    const mx = x + Math.round(fell.swing * w);
    rect(ctx, mx - 1, y - 3, 3, 16, PAL.white);
    bar(ctx, x, y + 14, w, 4, Math.min(1, fell.damage / fell.need), PAL.red2);
    if (fell.message) text(ctx, fell.message, VIEW_W / 2, y + 20, PAL.gold2, { align: 'center' });
  }

  if (fell.phase === 'creak') {
    const pulse = Math.floor(t * 8) % 2 === 0;
    const msg = 'CREEEAK';
    text(ctx, msg, VIEW_W / 2, 40, pulse ? PAL.red2 : PAL.gold2, { align: 'center', shadow: PAL.black });
    text(ctx, fell.dodgeSide > 0 ? 'RUN LEFT' : 'RUN RIGHT', VIEW_W / 2, 52, PAL.white,
         { align: 'center', shadow: PAL.black });
    bar(ctx, (VIEW_W - 120) >> 1, 62, 120, 5, fell.timer / FALL_WINDOW, PAL.red2);
  }

  if (fell.phase === 'blackout') {
    const fade = Math.min(1, (3.2 - fell.wake) * 1.6);
    ctx.fillStyle = `rgba(13,10,9,${Math.min(0.92, fade)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (fell.wake < 2.4) {
      const lines = ['YOU WOKE UP IN THE LEAVES.', 'A TREE TELLS YOU BEFORE IT FALLS -', 'LISTEN FOR THE CREAK.'];
      lines.forEach((ln, i) => text(ctx, ln, VIEW_W / 2, 110 + i * 12, i ? PAL.paper3 : PAL.paper,
                                   { align: 'center', shadow: PAL.black }));
      // little spinning stars
      for (let i = 0; i < 5; i++) {
        const a = t * 3 + i * 1.3;
        px(ctx, Math.round(VIEW_W / 2 + Math.cos(a) * 40), Math.round(90 + Math.sin(a) * 8), PAL.gold2);
      }
    }
  }

  if (fell.phase === 'log' && fell.message) {
    text(ctx, fell.message, VIEW_W / 2, 60, PAL.gold2, { align: 'center', shadow: PAL.black });
  }
}
