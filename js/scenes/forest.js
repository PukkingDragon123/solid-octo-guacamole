// Out the back of the workshop: a side-scrolling stand of timber. The trees
// grow day by day and lean in the wind, and every one of them warns you before
// it comes down. Miss the warning and you wake up in the leaves.

import { VIEW_W, VIEW_H } from '../config.js';
import { G, toast } from '../state.js';
import { PAL, rect, frame, px, text, disc, line, rngFrom, wrap, sprite, surface, outline, rimLight }
  from '../gfx/pixel.js';
import { SUN } from '../gfx/actors.js';
import { RAMPS, ramp, mix, noise as pnoise, turf, soilBand, contact, plank, speck } from '../gfx/paint.js';
import * as N from '../gfx/nature.js';
import * as B from '../gfx/structures.js';
import { cam } from '../gfx/screen.js';
import * as S from '../gfx/sprites.js';
import { input, pressed, held } from '../input.js';
import { keyPrompt, bar, panel } from '../ui/widgets.js';
import { story, addMaterial, tutorialDone } from '../story.js';
import { sfx } from '../audio.js';

export const FOREST_W = 1600;
export const FOREST_GROUND = 214;
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
  const bands = [SUN.sky0, SUN.sky1, SUN.sky2, SUN.sky3];
  for (let i = 0; i < bands.length; i++) {
    rect(ctx, 0, Math.round(i * 46), VIEW_W, 46, bands[i]);
  }
  // a fat sun, low and warm, with soft clouds crossing it
  disc(ctx, 96, 44, 15, '#fff3c4');
  ctx.globalAlpha = 0.18;
  for (let i = 1; i <= 3; i++) disc(ctx, 96, 44, 15 + i * 7, '#fff3c4');
  ctx.globalAlpha = 1;
  for (let i = 0; i < 5; i++) {
    const img = S.cloudSprite(i % 2);
    const cx = ((i * 118 - cam.x * 0.05 - G.time * 4) % (VIEW_W + 140)) - 70;
    ctx.drawImage(img, Math.round(cx < -70 ? cx + VIEW_W + 140 : cx), 14 + (i * 23) % 46);
  }
  // far ridge lines, three deep
  for (let layer = 0; layer < 3; layer++) {
    const tone = ['#93b8d8', '#6fa763', '#4f9243'][layer];
    const yBase = 96 + layer * 22;
    const par = 0.06 + layer * 0.05;
    const rng = rngFrom(900 + layer);
    let h = 0;
    for (let x = 0; x < VIEW_W + 2; x++) {
      h += (rng() - 0.5) * 4;
      h = Math.max(-14, Math.min(14, h));
      const wx = Math.round(x + cam.x * par) % 400;
      const hill = Math.sin(wx * 0.02) * 12;
      rect(ctx, x, Math.round(yBase + h * 0.4 + hill), 1, VIEW_H, tone);
    }
  }
  // two ranks of trees behind the stand, each on its own parallax and haze
  const midRng = rngFrom(4000);
  const mid = [];
  for (let i = 0; i < 90; i++) {
    mid.push({ x: midRng() * FOREST_W, v: [0, 1, 1, 2, 3, 3][Math.floor(midRng() * 6) % 6],
               g: 0.55 + midRng() * 0.45, size: midRng(), depth: midRng() < 0.5 ? 0.34 : 0.6 });
  }
  for (const depth of [0.34, 0.6]) {
    const groundY = FOREST_GROUND - (depth < 0.5 ? 26 : 12);
    for (const tree of mid) {
      if (tree.depth !== depth) continue;
      const sx = Math.round(tree.x - cam.x * depth);
      if (sx < -90 || sx > VIEW_W + 90) continue;
      const img = N.tree(tree.v, tree.g * (depth < 0.5 ? 0.55 : 0.78), tree.size);
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
  // turf with a lit crown and blades standing off it, then the soil beneath
  turf(ctx, 0, FOREST_GROUND, VIEW_W, 56, RAMPS.grass, { seed: 4477 });
  soilBand(ctx, 0, FOREST_GROUND + 56, VIEW_W, VIEW_H - FOREST_GROUND - 56, RAMPS.soil, { seed: 2211 });
  // a beaten path along the walk line, with stones trodden into it
  const pathY = FOREST_GROUND + 20;
  rect(ctx, 0, pathY, VIEW_W, 14, '#a3854f');
  rect(ctx, 0, pathY, VIEW_W, 2, '#bd9c5f');
  rect(ctx, 0, pathY + 13, VIEW_W, 1, '#7c6338');
  const pth = rngFrom(6060);
  for (let i = 0; i < 120; i++) {
    const sx = cam.sx(pth() * FOREST_W);
    if (sx < 0 || sx > VIEW_W) continue;
    const py = pathY + 2 + Math.round(pth() * 10);
    const roll = pth();
    if (roll > 0.85) { rect(ctx, sx, py, 3, 2, '#c9c0b5'); px(ctx, sx, py, PAL.white); }
    else px(ctx, sx, py, roll > 0.5 ? '#8f7442' : '#b89355');
  }
  // ragged edges, so it looks walked rather than drawn
  for (let x = 0; x < VIEW_W; x += 2) {
    const wx = x + cam.x;
    const wob = Math.round(Math.sin(wx * 0.11) * 2 + Math.sin(wx * 0.37) * 1);
    rect(ctx, x, pathY + wob, 2, 2, SUN.grass1);
    rect(ctx, x, pathY + 12 - wob, 2, 2, SUN.grass1);
  }

  // wildflowers and clover on the turf
  const bloom = rngFrom(9111);
  for (let i = 0; i < 90; i++) {
    const sx = cam.sx(bloom() * FOREST_W);
    const by = FOREST_GROUND + 4 + Math.round(bloom() * 48);
    if (sx < 0 || sx > VIEW_W) continue;
    if (Math.abs(by - (pathY + 7)) < 9) continue;      // not on the path
    const kind = bloom();
    if (kind < 0.34) { px(ctx, sx, by, '#f7cc55'); px(ctx, sx, by + 1, SUN.grass0); }
    else if (kind < 0.58) { px(ctx, sx, by, '#f2f2f2'); px(ctx, sx + 1, by, '#f2f2f2'); px(ctx, sx, by + 1, SUN.grass0); }
    else if (kind < 0.74) { px(ctx, sx, by, '#e8626f'); px(ctx, sx, by + 1, SUN.grass0); }
    else { px(ctx, sx, by, SUN.grass3); px(ctx, sx + 1, by - 1, SUN.grass4); }
  }

  // dapples of sun coming through the canopy
  ctx.globalAlpha = 0.09;
  const dap = rngFrom(5522);
  for (let i = 0; i < 34; i++) {
    const sx = cam.sx(dap() * FOREST_W);
    const dy = FOREST_GROUND + 3 + Math.round(dap() * 22);
    const rw = 5 + Math.round(dap() * 9);
    if (sx < -20 || sx > VIEW_W) continue;
    for (let k = -2; k <= 2; k++) {
      const span = Math.round(rw * Math.sqrt(Math.max(0, 1 - (k * k) / 6)));
      rect(ctx, sx - span, dy + k, span * 2, 1, '#ffe9b0');
    }
  }
  ctx.globalAlpha = 1;

  // undergrowth: bushes, ferns, tufts, mushrooms, stones and fallen wood
  const flora = rngFrom(818);
  const under = [];
  for (let i = 0; i < 90; i++) {
    under.push({ x: flora() * FOREST_W, roll: flora(), v: (flora() * 4) | 0, y: flora() });
  }
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
    else if (it.roll < 0.92) img = N.rock(it.v % 3);
    else img = N.log(it.v % N.TREE_KINDS, 40);
    ctx.drawImage(img, sx, baseY - img.height);
  }

  // ---- the stand itself, far to near
  const sorted = f.trees.slice().sort((a, b) => a.x - b.x);
  for (const tree of sorted) drawTree(ctx, tree, t, f);
  drawFallZone(ctx);
  drawFallenTrunk(ctx);

  // ---- the back of the workshop, standing in its own clearing
  drawCabin(ctx, t);

  // a fringe of grass right under the camera, so the ground has a near edge
  for (let x = -8; x < VIEW_W + 8; x += 3) {
    const wx = x + cam.x * 1.12;
    const hh = 4 + Math.round(Math.sin(wx * 0.7) * 2 + Math.sin(wx * 0.13) * 2);
    const bend = Math.round((Math.sin(t * 2.2 + wx * 0.05) + f.gust) * 2);
    for (let k = 0; k < hh; k++) {
      px(ctx, x + Math.round((k / hh) * bend), VIEW_H - 1 - k, k > hh - 2 ? PAL.grass4 : PAL.grass2);
    }
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
  const sx = cam.sx(70);
  if (sx < -190 || sx > VIEW_W + 190) return;
  const base = FOREST_GROUND + 14;
  const img = B.cabinSide('workshop', { lit: true, door: 'open' });
  const x = sx - (img.width >> 1);
  const y = base - img.height;

  // the shadow it casts on the turf
  ctx.globalAlpha = 0.26;
  for (let i = 0; i < 10; i++) {
    rect(ctx, x + 14 + i, base - 10 + i, img.width - 20, 1, PAL.black);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(img, x, y);

  // smoke from the chimney
  for (let i = 0; i < 7; i++) {
    const sy = y + 4 - ((t * 12 + i * 8) % 52);
    const drift = Math.sin(sy * 0.08 + t * 0.7) * 8;
    ctx.globalAlpha = Math.max(0, 0.45 - i * 0.06);
    disc(ctx, Math.round(x + img.width - 32 + drift), Math.round(sy), 3 + i, PAL.paper2);
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
    else if (Math.abs(p.x - 70) < 34) keyPrompt(ctx, cam.sx(70), FOREST_GROUND - 46, 'E', 'GO IN', t);
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
