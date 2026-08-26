// Out the back of the workshop: a side-scrolling stand of timber. The trees
// grow day by day and lean in the wind, and every one of them warns you before
// it comes down. Miss the warning and you wake up in the leaves.

import { VIEW_W, VIEW_H } from '../config.js';
import { G, toast } from '../state.js';
import { PAL, rect, frame, px, text, disc, line, rngFrom, wrap, sprite, surface, outline, rimLight }
  from '../gfx/pixel.js';
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

// Four kinds of timber, each with its own trunk colour and canopy shape. These
// are drawn far bigger than the tile trees in the valley view - a side-scrolling
// wood only works if the trees tower over you.
const SPECIES = [
  { name: 'fir',    trunk: [PAL.wood1, PAL.wood2, PAL.wood0], leaf: [PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3], shape: 'cone' },
  { name: 'oak',    trunk: [PAL.wood2, PAL.wood3, PAL.wood1], leaf: ['#2d6330', '#40853c', '#5aa74b', '#74b94d'], shape: 'round' },
  { name: 'birch',  trunk: ['#a3906f', '#c9b68f', '#4a4034'], leaf: ['#3f7a37', '#559a3f', '#74b94d', '#9ad35f'], shape: 'round' },
  { name: 'maple',  trunk: [PAL.wood1, PAL.wood2, PAL.wood0], leaf: ['#8a4a1e', '#b4652a', '#d98b35', '#e0a02e'], shape: 'round' },
];

export const FOREST_SPECIES = SPECIES.length;

/** One canopy blob, dithered from the inside out so it holds together. */
function canopyBlob(ctx, cx, cy, r, leaf) {
  // slightly squashed - foliage sits on branches, it does not float
  const squash = 0.82;
  const ell = (rad, tone) => {
    ctx.fillStyle = tone;
    for (let y = -Math.round(rad * squash); y <= Math.round(rad * squash); y++) {
      const span = Math.round(rad * Math.sqrt(Math.max(0, 1 - (y * y) / (rad * rad * squash * squash))));
      if (span > 0) ctx.fillRect(cx - span, cy + y, span * 2 + 1, 1);
    }
  };
  ell(r, leaf[0]);
  ell(Math.max(1, r - 2), leaf[1]);
  ell(Math.max(1, r - 5), leaf[2]);
  // a broken, clumpy edge so it never reads as a circle
  const rng = rngFrom(Math.round(cx * 31 + cy * 17 + r));
  for (let i = 0; i < r * 8; i++) {
    const a = (i / (r * 8)) * Math.PI * 2;
    const rr = r + Math.round((rng() - 0.4) * 3);
    px(ctx, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * squash),
       rng() > 0.4 ? leaf[1] : leaf[0]);
  }
  for (let i = 0; i < r; i++) {   // gaps you can see sky through
    const a = rng() * Math.PI * 2, rr = rng() * r * 0.7;
    px(ctx, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * squash), leaf[0]);
  }
  // sun on the top left
  for (let i = 0; i < r * 2; i++) {
    const a = -2.4 + (i / (r * 2)) * 1.6;
    px(ctx, Math.round(cx + Math.cos(a) * (r - 3)), Math.round(cy + Math.sin(a) * (r - 3)), leaf[3]);
  }
}

/** A whole tree, painted once and remembered. */
export function bigTree(variant, stage, size = 1) {
  const sp = SPECIES[variant % SPECIES.length];
  const step = Math.max(1, Math.round(stage * 4));       // four growth stages
  const bucket = Math.max(0, Math.min(2, Math.round(size * 2)));
  const key = `bigtree:${variant}:${step}:${bucket}`;
  const grow = step / 4;
  const h = Math.round((74 + (variant % 3) * 14 + bucket * 15) * (0.34 + grow * 0.66));
  const w = Math.round(h * 0.86);
  return sprite(key, w, h + 2, (ctx) => {
    const cx = w >> 1;
    const trunkW = Math.max(2, Math.round(h * 0.045));
    const trunkTop = Math.round(h * (sp.shape === 'cone' ? 0.34 : 0.42));
    // roots flaring into the ground
    rect(ctx, cx - trunkW, h - 4, trunkW * 2, 4, sp.trunk[2]);
    rect(ctx, cx - trunkW - 2, h - 2, trunkW * 2 + 4, 2, sp.trunk[2]);
    // trunk, tapering
    for (let y = h - 4; y > trunkTop; y--) {
      const k = (h - y) / (h - trunkTop);
      const tw = Math.max(2, Math.round(trunkW * (1.15 - k * 0.45)));
      rect(ctx, cx - tw, y, tw * 2, 1, sp.trunk[0]);
      rect(ctx, cx - tw, y, Math.max(1, tw >> 1), 1, sp.trunk[1]);
      rect(ctx, cx + tw - Math.max(1, tw >> 2), y, Math.max(1, tw >> 2), 1, sp.trunk[2]);
      if (sp.name === 'birch' && y % 7 === 0) rect(ctx, cx - tw, y, tw + 1, 1, sp.trunk[2]);
      else if (y % 5 === 0) px(ctx, cx + (y % 3) - 1, y, sp.trunk[2]);
    }
    // a couple of branches, then the canopy
    if (grow > 0.5) {
      for (const [dx, dy, len] of [[-1, 0.62, 0.28], [1, 0.54, 0.24]]) {
        const bx = cx, by = Math.round(h * dy);
        line(ctx, bx, by, Math.round(bx + dx * h * len), Math.round(by - h * 0.1), sp.trunk[0]);
      }
    }
    if (sp.shape === 'cone') {
      // a fir: overlapping skirts, each a ragged triangle, widest at the bottom
      const tiers = 5;
      const top = Math.round(h * 0.06);
      const rng = rngFrom(variant * 977 + step * 31 + bucket);
      for (let i = 0; i < tiers; i++) {
        const k = i / (tiers - 1);
        const ty = Math.round(top + k * (trunkTop + h * 0.42 - top));
        const tw = Math.round((w * 0.5) * (0.22 + k * 0.78));
        const th = Math.round(h * 0.16);
        for (let row = 0; row < th; row++) {
          const span = Math.round(tw * (row / th));
          const jag = Math.round(rng() * 2);
          const tone = row < 2 ? sp.leaf[3] : row < th * 0.5 ? sp.leaf[2] : sp.leaf[1];
          rect(ctx, cx - span - jag, ty + row, (span + jag) * 2, 1, tone);
          if (row > th * 0.6) {
            px(ctx, cx - span - jag, ty + row, sp.leaf[0]);
            px(ctx, cx + span + jag, ty + row, sp.leaf[0]);
          }
        }
      }
    } else {
      const r = Math.round(w * 0.26);
      canopyBlob(ctx, cx, trunkTop - Math.round(r * 0.2), Math.round(r * 1.15), sp.leaf);
      canopyBlob(ctx, cx - Math.round(r * 1.1), trunkTop + Math.round(r * 0.5), r, sp.leaf);
      canopyBlob(ctx, cx + Math.round(r * 1.1), trunkTop + Math.round(r * 0.45), r, sp.leaf);
      canopyBlob(ctx, cx - Math.round(r * 0.5), trunkTop - Math.round(r * 0.9), Math.round(r * 0.85), sp.leaf);
      canopyBlob(ctx, cx + Math.round(r * 0.6), trunkTop - Math.round(r * 0.75), Math.round(r * 0.8), sp.leaf);
    }
    outline(ctx, w, h + 2, PAL.ink);
    rimLight(ctx, w, h + 2, sp.leaf[3], -1, -1);
  });
}

/** The stump left behind, with the axe cut showing. */
export function bigStump(variant) {
  return sprite(`bigstump:${variant}`, 22, 14, (ctx) => {
    const sp = SPECIES[variant % SPECIES.length];
    rect(ctx, 3, 4, 16, 10, sp.trunk[0]);
    rect(ctx, 3, 4, 16, 2, sp.trunk[1]);
    for (let r = 7; r > 0; r -= 2) {
      for (let x = -r; x <= r; x++) px(ctx, 11 + x, 5, r % 4 === 0 ? PAL.wood4 : PAL.wood3);
    }
    rect(ctx, 1, 12, 20, 2, sp.trunk[2]);
    // the notch, on the side the axe went in
    rect(ctx, 3, 7, 6, 3, PAL.wood0);
    outline(ctx, 22, 14, PAL.ink);
  });
}

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
      x: 170 + i * 128 + Math.round(rng() * 40),
      size: rng(),
      // weighted, so no one species takes over the wood
      variant: [0, 1, 1, 2, 3, 3][Math.floor(rng() * 6) % 6],
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
  const img = tree.stump ? bigStump(tree.variant)
    : bigTree(tree.variant, tree.growth, tree.size === undefined ? 0.5 : tree.size);
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
  const bands = ['#7fb6e6', '#a9dcf5', '#c8e9fa', '#dff3fb'];
  for (let i = 0; i < bands.length; i++) {
    rect(ctx, 0, Math.round(i * 46), VIEW_W, 46, bands[i]);
  }
  // far ridge lines, three deep
  for (let layer = 0; layer < 3; layer++) {
    const tone = ['#8fa9c0', '#6e8a72', '#4f7355'][layer];
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
      const img = bigTree(tree.v, tree.g * (depth < 0.5 ? 0.55 : 0.78), tree.size);
      const lean = (Math.sin(t * 0.8 + tree.x) * 0.5 + f.wind) * 0.008;
      ctx.save();
      ctx.transform(1, 0, -lean, 1, lean * groundY, 0);
      ctx.drawImage(img, sx - (img.width >> 1), groundY - img.height);
      ctx.restore();
    }
    // haze between the ranks - this is what gives the wood its depth
    ctx.globalAlpha = depth < 0.5 ? 0.3 : 0.14;
    rect(ctx, 0, 40, VIEW_W, FOREST_GROUND - 34, PAL.sky3);
    ctx.globalAlpha = 1;
  }

  // ---- ground
  const strip = S.groundStrip();
  for (let x = Math.floor(cam.x / 16) * 16 - 16; x < cam.x + VIEW_W + 16; x += 16) {
    ctx.drawImage(strip, cam.sx(x), FOREST_GROUND);
  }
  rect(ctx, 0, FOREST_GROUND + 40, VIEW_W, VIEW_H, PAL.dirt0);
  const soil = rngFrom(2211);
  for (let i = 0; i < 130; i++) {
    const sx = cam.sx(soil() * FOREST_W);
    const sy = FOREST_GROUND + 40 + soil() * (VIEW_H - FOREST_GROUND - 40);
    if (sx < 0 || sx > VIEW_W) continue;
    px(ctx, sx, Math.round(sy), soil() > 0.6 ? PAL.dirt1 : PAL.dirt2);
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

  // undergrowth
  const flora = rngFrom(818);
  for (let i = 0; i < 70; i++) {
    const wx = flora() * FOREST_W;
    const sx = cam.sx(wx);
    const kind = S.CLUTTER_KINDS[(flora() * S.CLUTTER_KINDS.length) | 0];
    if (sx < -18 || sx > VIEW_W) continue;
    const img = S.clutterSprite(kind, (flora() * 4) | 0);
    ctx.drawImage(img, sx, FOREST_GROUND - img.height + 3);
  }

  // ---- the stand itself, far to near
  const sorted = f.trees.slice().sort((a, b) => a.x - b.x);
  for (const tree of sorted) drawTree(ctx, tree, t, f);
  drawFallZone(ctx);
  drawFallenTrunk(ctx);

  // the door back to the workshop
  const dx = cam.sx(70);
  rect(ctx, dx - 22, FOREST_GROUND - 60, 44, 60, PAL.wood1);
  rect(ctx, dx - 26, FOREST_GROUND - 66, 52, 8, PAL.wood2);
  rect(ctx, dx - 16, FOREST_GROUND - 52, 32, 52, PAL.wood0);
  rect(ctx, dx - 14, FOREST_GROUND - 50, 28, 48, PAL.wood2);
  px(ctx, dx + 8, FOREST_GROUND - 28, PAL.gold2);
  text(ctx, 'WORKSHOP', dx, FOREST_GROUND - 76, PAL.paper, { align: 'center', shadow: PAL.ink });

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

/** The chop meter, the creak warning and the blackout, all drawn over the top. */
export function drawForestHud(ctx, t) {
  const p = G.player;
  if (fell.phase === 'idle') {
    const tree = nearestTree(p.x);
    if (tree) keyPrompt(ctx, cam.sx(tree.x), FOREST_GROUND - 74, 'E', 'CHOP', t);
    else if (Math.abs(p.x - 70) < 30) keyPrompt(ctx, cam.sx(70), FOREST_GROUND - 88, 'E', 'GO IN', t);
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
