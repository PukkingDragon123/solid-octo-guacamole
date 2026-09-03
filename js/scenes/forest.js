// The forest floor. You set the heron down in the valley and walk the woods
// yourself: chopping, picking and foraging by hand. What you carry out is what
// the stores get, so this is where wood actually comes from.

import { TILE, MAPW, MAPH, VIEW_W, VIEW_H } from '../config.js';
import { G, tileAt, entityAt, removeEntity, gain, toast } from '../state.js';
import { PAL, rect, px, disc, line, text, rngFrom } from '../gfx/pixel.js';
import { cam } from '../gfx/screen.js';
import * as S from '../gfx/sprites.js';
import { removeJobFor } from '../jobs.js';
import { clearClutter } from '../world.js';
import { ripeness } from '../plants.js';

export const SPACING = 58;
export const RADIUS = 7;                       // tiles either side of the landing spot
export const STRIP_W = (RADIUS * 2 + 1) * SPACING;
export const GROUND = 214;
export const FOREST_BOUNDS = { w: STRIP_W, h: VIEW_H };

const DEPTH_Y = { '-1': -18, 0: 0, 1: 12 };    // how far back each row sits

export const forest = {
  props: [],
  heronX: STRIP_W / 2,
  chopT: 0,
  target: null,
  chips: [],
  shake: 0,
  banner: 0,
  bannerText: '',
};

export const packTotal = () => G.pack.wood + G.pack.berries + G.pack.seeds;
export const packFull = () => packTotal() >= G.packCap;

/** Lay out a strip of the valley as a side-on scene. */
export function buildStrip() {
  const { lx, ly } = G.forestSite;
  const props = [];
  const colX = (x) => (x - (lx - RADIUS)) * SPACING + SPACING / 2;

  for (const e of G.entities) {
    const dy = e.y - ly;
    if (dy < -1 || dy > 1) continue;
    if (e.x < lx - RADIUS || e.x > lx + RADIUS) continue;
    if (e.kind === 'animal') continue;
    const jitter = ((e.x * 37 + e.y * 61) % 17) - 8;
    props.push({ e, kind: e.kind, x: colX(e.x) + jitter, depth: dy, wobble: ((e.x * 13 + e.y * 7) % 62) / 10 });
  }
  for (const c of G.clutter) {
    const dy = c.y - ly;
    if (dy < -1 || dy > 1) continue;
    if (c.x < lx - RADIUS || c.x > lx + RADIUS) continue;
    const jitter = ((c.x * 29 + c.y * 43) % 25) - 12;
    props.push({ clutter: c, kind: 'clutter', x: colX(c.x) + jitter, depth: dy, wobble: 0 });
  }
  props.sort((a, b) => a.depth - b.depth || a.x - b.x);
  forest.props = props;
  const worth = props.filter((p) => p.kind === 'tree' || p.kind === 'plant' || p.kind === 'clutter').length;
  if (worth < 3) {
    forest.banner = 2.4;
    forest.bannerText = 'NOT MUCH HERE - TRY LANDING IN THE WOODS';
  }
  forest.heronX = colX(lx);
  forest.chips = [];
  forest.chopT = 0;
}

export function enterForest(lx, ly) {
  G.forestSite = { lx, ly };
  G.mode = 'forest';
  G.player.x = (RADIUS * SPACING) + SPACING / 2;
  G.player.y = GROUND;
  G.player.vx = 0; G.player.vy = 0; G.player.onGround = true;
  buildStrip();
  cam.centreOn(G.player.x, VIEW_H / 2, FOREST_BOUNDS);
}

/** Everything in the pack goes into the stores when you fly out. */
export function emptyPack() {
  const carried = { ...G.pack };
  let any = false;
  for (const k of ['wood', 'berries', 'seeds']) {
    if (!carried[k]) continue;
    any = true;
    const fitted = gain(k, carried[k]);
    if (fitted < carried[k]) toast(`Stores full - ${carried[k] - fitted} ${k} left behind.`, 'warn');
  }
  G.pack = { wood: 0, berries: 0, seeds: 0 };
  if (any) {
    toast(`Hauled home: ${carried.wood} wood, ${carried.berries} berries, ${carried.seeds} seeds.`, 'good');
  }
  return carried;
}

// ------------------------------------------------------------- interaction
const CLUTTER_YIELD = {
  mushroom: { seeds: 1, berries: 2, verb: 'PICK' },
  flowers: { seeds: 2, verb: 'PICK' },
  tallgrass: { seeds: 1, verb: 'CUT' },
  fern: { seeds: 1, verb: 'CUT' },
  log: { wood: 3, verb: 'SPLIT' },
  stone: null,
  lilypad: null,
};

/** What the player is standing in front of, if anything. */
export function nearestTarget() {
  const px0 = G.player.x;
  if (Math.abs(px0 - forest.heronX) < 30) return { kind: 'heron', label: 'FLY OUT' };
  let best = null;
  for (const p of forest.props) {
    if (p.falling) continue;
    const reach = p.kind === 'tree' ? 34 : 26;
    const d = Math.abs(px0 - p.x);
    if (d > reach) continue;
    let label = null;
    if (p.kind === 'tree' && p.e.growth >= 1) label = 'CHOP';
    else if (p.kind === 'plant' && p.e.berries > 0) label = 'PICK';
    else if (p.kind === 'log') label = 'HAUL';
    else if (p.kind === 'clutter') {
      const y = CLUTTER_YIELD[p.clutter.kind];
      if (y) label = y.verb;
    }
    if (!label) continue;
    if (!best || d < best.d) best = { kind: p.kind, prop: p, label, d };
  }
  return best;
}

function spawnChips(x, y, n, colour) {
  for (let i = 0; i < n; i++) {
    forest.chips.push({
      x, y,
      vx: (Math.random() - 0.5) * 90,
      vy: -40 - Math.random() * 70,
      life: 0.5 + Math.random() * 0.4,
      colour,
    });
  }
}

function addToPack(kind, amount) {
  const room = G.packCap - packTotal();
  const took = Math.max(0, Math.min(amount, room));
  G.pack[kind] += took;
  if (kind === 'wood') G.stats.gathered = (G.stats.gathered || 0) + took;
  if (took < amount) {
    forest.banner = 1.6;
    forest.bannerText = 'YOUR ARMS ARE FULL - FLY IT HOME';
  }
  return took;
}

/** One completed swing of the axe, or one gathered thing. */
function harvest(target) {
  const p = target.prop;
  if (target.kind === 'tree') {
    const tree = p.e;
    const bite = Math.min(3, tree.wood);
    tree.wood -= bite;
    tree.shake = 0.3;
    addToPack('wood', bite);
    spawnChips(p.x, GROUND + DEPTH_Y[p.depth] - 28, 5, PAL.wood3);
    forest.shake = 0.35;
    if (tree.wood <= 0.01) {
      // it comes down: leave a stump, and a log to haul away
      p.falling = 1;
      p.fallDir = G.player.x < p.x ? 1 : -1;
      removeJobFor(tree);
      removeEntity(tree);
      G.stats.felled++;
      addToPack('seeds', 2);
      forest.banner = 1.8;
      forest.bannerText = 'TIMBER!';
      forest.shake = 1;
    }
    return;
  }
  if (target.kind === 'plant') {
    const picked = Math.ceil(p.e.berries);
    p.e.berries = 0;
    p.e.ripeT = 0;
    removeJobFor(p.e);
    G.stats.harvested++;
    addToPack('berries', picked);
    spawnChips(p.x, GROUND + DEPTH_Y[p.depth] - 16, 6, PAL.red2);
    return;
  }
  if (target.kind === 'log') {
    addToPack('wood', p.logWood || 4);
    spawnChips(p.x, GROUND + DEPTH_Y[p.depth] - 6, 5, PAL.wood3);
    forest.props.splice(forest.props.indexOf(p), 1);
    return;
  }
  if (target.kind === 'clutter') {
    const y = CLUTTER_YIELD[p.clutter.kind];
    for (const k of ['wood', 'berries', 'seeds']) if (y[k]) addToPack(k, y[k]);
    spawnChips(p.x, GROUND + DEPTH_Y[p.depth] - 8, 4, PAL.grass4);
    clearClutter(p.clutter.x, p.clutter.y);
    forest.props.splice(forest.props.indexOf(p), 1);
  }
}

export function updateForest(dt, acting) {
  // props can vanish under us if the crew is working the same patch
  forest.props = forest.props.filter((p) => p.falling || p.kind === 'log' || p.clutter || G.entities.includes(p.e));

  const target = nearestTarget();
  forest.target = target;

  if (acting && target && target.kind !== 'heron' && !packFull()) {
    forest.chopT += dt;
    const swing = target.kind === 'tree' ? 0.42 : 0.3;
    if (forest.chopT >= swing) {
      forest.chopT = 0;
      harvest(target);
    }
  } else {
    forest.chopT = Math.max(0, forest.chopT - dt * 2);
  }

  for (const p of forest.props) {
    if (!p.falling) continue;
    p.falling -= dt * 1.6;
    if (p.falling <= 0) {
      p.falling = 0;
      p.kind = 'stump';
      p.stumpVariant = (p.x | 0) % 3;
      // the trunk it dropped, ready to be hauled
      forest.props.push({
        kind: 'log', x: p.x + p.fallDir * 40, depth: p.depth, logWood: 5, wobble: 0,
      });
      forest.props.sort((a, b) => a.depth - b.depth || a.x - b.x);
    }
  }

  for (const c of forest.chips) {
    c.life -= dt;
    c.vy += 320 * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
  }
  forest.chips = forest.chips.filter((c) => c.life > 0);
  if (forest.shake > 0) forest.shake = Math.max(0, forest.shake - dt * 2);
  if (forest.banner > 0) forest.banner -= dt;
}

// ---------------------------------------------------------------- drawing
function drawBackdrop(ctx, t) {
  // deep woodland light: green all the way up, brightest at eye level
  const bands = ['#1b3a1c', '#24491f', '#2f5c26', '#3d7130', '#4f8a3b', '#6aa64a', '#8cc25f'];
  for (let i = 0; i < bands.length; i++) {
    const top = Math.round((i / bands.length) * (GROUND - 30));
    const bottom = Math.round(((i + 1) / bands.length) * (GROUND - 30));
    rect(ctx, 0, top, VIEW_W, bottom - top, bands[i]);
    ctx.fillStyle = bands[Math.min(bands.length - 1, i + 1)];
    for (let x = (bottom % 2); x < VIEW_W; x += 2) ctx.fillRect(x, bottom - 2, 1, 1);
  }
  rect(ctx, 0, GROUND - 30, VIEW_W, 32, '#8cc25f');

  // far trunks, hazed out by the distance so they read as depth, not stripes
  const trunkRng = rngFrom(2024);
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 18; i++) {
    const wx = trunkRng() * STRIP_W * 1.4;
    const sx = Math.round(wx - cam.x * 0.32) % (VIEW_W + 120) - 20;
    if (sx < -14 || sx > VIEW_W) continue;
    const w = 3 + ((trunkRng() * 4) | 0);
    const top = 26 + ((trunkRng() * 70) | 0);
    rect(ctx, sx, top, w, GROUND - 26 - top, '#24491f');
    rect(ctx, sx, top, 1, GROUND - 26 - top, '#2f5c26');
  }
  ctx.globalAlpha = 1;

  // mid-distance conifers
  for (let i = -1; i < 12; i++) {
    const x = Math.round(i * 82 - (cam.x * 0.42) % 82);
    const img = S.bgTreeSprite(i % 2, i % 3 === 0);
    ctx.drawImage(img, x, GROUND - 26 - img.height);
  }

  // the canopy overhead, hanging into frame
  const leafRng = rngFrom(808);
  for (let layer = 0; layer < 3; layer++) {
    const colour = ['#12290f', '#1b3a1c', '#24491f'][layer];
    const drop = layer * 9;
    const drift = Math.round(-cam.x * (0.1 + layer * 0.06)) % 64;
    for (let i = -1; i < VIEW_W / 26 + 2; i++) {
      const cx = i * 26 + drift + (layer * 11);
      const r = 12 + ((leafRng() * 9) | 0);
      disc(ctx, cx, drop - 4 + ((leafRng() * 6) | 0), r, colour);
    }
  }
  // leaves catching the light at the canopy's edge
  const edgeRng = rngFrom(909);
  for (let i = 0; i < 70; i++) {
    const x = (edgeRng() * VIEW_W) | 0;
    const y = 18 + ((edgeRng() * 22) | 0);
    px(ctx, x, y, edgeRng() < 0.5 ? '#3d7130' : '#4f8a3b');
  }

  // shafts of light coming through the gaps
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 5; i++) {
    const x = Math.round((i * 137 - cam.x * 0.25) % (VIEW_W + 200)) - 100;
    for (let y = 20; y < GROUND - 10; y++) {
      rect(ctx, x + Math.round(y * 0.42), y, 11 + (i % 3) * 6, 1, PAL.gold2);
    }
  }
  ctx.globalAlpha = 1;
  // motes drifting in the beams
  for (let i = 0; i < 16; i++) {
    const x = Math.round((i * 61 + t * 6) % VIEW_W);
    const y = Math.round(40 + ((i * 37) % 120) + Math.sin(t * 0.8 + i) * 6);
    px(ctx, x, y, '#c8e89a');
  }
}

function drawGround(ctx, t) {
  const strip = S.groundStrip();
  const startX = Math.floor(cam.x / 16) * 16;
  for (let x = startX - 16; x < cam.x + VIEW_W + 16; x += 16) {
    ctx.drawImage(strip, cam.sx(x), GROUND);
    ctx.drawImage(strip, cam.sx(x), GROUND + DEPTH_Y['-1'] - 2);
  }
  rect(ctx, 0, GROUND + 40, VIEW_W, VIEW_H - GROUND - 40, PAL.dirt0);
  const rng = rngFrom(4711);
  for (let i = 0; i < 160; i++) {
    const sx = cam.sx(rng() * STRIP_W);
    if (sx < 0 || sx > VIEW_W) continue;
    const sy = GROUND + 42 + rng() * (VIEW_H - GROUND - 42);
    const roll = rng();
    if (roll < 0.6) px(ctx, sx, Math.round(sy), PAL.dirt1);
    else if (roll < 0.82) { px(ctx, sx, Math.round(sy), PAL.stone0); px(ctx, sx + 1, Math.round(sy), PAL.stone1); }
    else rect(ctx, sx, Math.round(sy), 3, 1, PAL.dirt2);
  }
  // roots winding down out of the turf
  for (let i = 0; i < 26; i++) {
    const sx = cam.sx(rng() * STRIP_W);
    if (sx < 0 || sx > VIEW_W) continue;
    const len = 6 + Math.floor(rng() * 14);
    for (let k = 0; k < len; k++) px(ctx, sx + (k % 4 === 3 ? 1 : 0), GROUND + 36 + k, PAL.dirt2);
  }
  // leaf litter along the path
  const lit = rngFrom(99);
  for (let i = 0; i < 150; i++) {
    const sx = cam.sx(lit() * STRIP_W);
    if (sx < -2 || sx > VIEW_W) continue;
    const roll = lit();
    const y = GROUND + 1 + Math.round(lit() * 6);
    if (roll < 0.4) px(ctx, sx, y, PAL.leaf1);
    else if (roll < 0.6) { px(ctx, sx, y, PAL.wood3); px(ctx, sx + 1, y, PAL.wood2); }
    else if (roll < 0.72) px(ctx, sx, y, PAL.gold);
  }
}

function drawProp(ctx, p, t) {
  const baseY = GROUND + DEPTH_Y[p.depth];
  const sx = cam.sx(p.x);
  if (sx < -90 || sx > VIEW_W + 90) return;
  const back = p.depth === -1;

  if (p.kind === 'tree') {
    const wind = Math.sin(t * 1.1 + p.wobble) + Math.sin(t * 0.43 + p.wobble * 2) * 0.4;
    const sway = Math.max(0, Math.min(2, Math.round(wind) + 1));
    const img = S.forestTree(p.e.variant % S.TREE_SPECIES, sway);
    const shake = p.e.shake > 0 ? (Math.floor(t * 34) % 2 ? 1 : -1) : 0;
    if (p.falling) {
      // shear each row over as the trunk goes down
      const k = 1 - p.falling;
      const lean = k * k * 46 * p.fallDir;
      for (let row = 0; row < img.height; row++) {
        const f = (img.height - row) / img.height;
        ctx.drawImage(img, 0, row, img.width, 1,
                      Math.round(sx - img.width / 2 + lean * f), baseY - img.height + row + Math.round(k * 6 * f),
                      img.width, 1);
      }
      return;
    }
    ctx.save();
    if (back) ctx.globalAlpha = 0.8;
    ctx.drawImage(img, Math.round(sx - img.width / 2 + shake), baseY - img.height);
    ctx.restore();
    // how much timber is left in it
    if (p.e.wood < 12) {
      const w = Math.max(1, Math.round((p.e.wood / 20) * 22));
      rect(ctx, sx - 11, baseY + 2, 22, 3, PAL.ink);
      rect(ctx, sx - 11, baseY + 2, w, 3, PAL.wood3);
    }
    if (p.e.marked) {
      const axe = S.icon('axe');
      ctx.drawImage(axe, sx - 4, baseY - img.height - 10 + Math.round(Math.sin(t * 4) * 2));
    }
    return;
  }

  if (p.kind === 'stump') { ctx.drawImage(S.forestStump(p.stumpVariant || 0), sx - 15, baseY - 22); return; }
  if (p.kind === 'log') {
    const img = S.forestLog();
    ctx.drawImage(img, sx - (img.width >> 1), baseY - img.height + 2);
    return;
  }

  if (p.kind === 'plant') {
    const id = p.e.blueprint;
    if (id === 'reed' || id === 'clover' || id === 'bluebell' || id === 'sunflower') {
      const img = id === 'reed' ? S.reedSprite() : S.flowerSprite(id);
      ctx.drawImage(img, sx - (img.width >> 1), baseY - img.height + 2);
      ctx.drawImage(img, sx - (img.width >> 1) + 12, baseY - img.height + 4);
      return;
    }
    const img = S.forestBush(id, ripeness(p.e) > 0.55);
    ctx.save();
    if (back) ctx.globalAlpha = 0.8;
    ctx.drawImage(img, sx - (img.width >> 1), baseY - img.height + 2);
    ctx.restore();
    return;
  }

  if (p.kind === 'structure' || p.kind === 'site') {
    const img = p.kind === 'site' ? S.siteSprite(Math.floor(t * 3) % 2) : S.structureSprite(p.e.blueprint);
    ctx.drawImage(img, sx - (img.width >> 1), baseY - img.height + 2);
    return;
  }

  if (p.kind === 'clutter') {
    const img = S.clutterSprite(p.clutter.kind, p.clutter.variant);
    ctx.drawImage(img, sx - 8, baseY - img.height + 4);
    ctx.drawImage(img, sx + 4, baseY - img.height + 6);
  }
}

export function drawForest(ctx, t, player) {
  drawBackdrop(ctx, t);
  // back row first, then the ground, then everything in front of it
  for (const p of forest.props) if (p.depth === -1) drawProp(ctx, p, t);
  drawGround(ctx, t);
  for (const p of forest.props) if (p.depth === 0) drawProp(ctx, p, t);

  // the heron, waiting where it set you down
  const heron = S.heronSideSprite(Math.floor(t * 1.1) % 2);
  ctx.drawImage(heron, cam.sx(forest.heronX) - (heron.width >> 1), GROUND - heron.height + 2);

  drawPlayer(ctx, player, t);

  for (const p of forest.props) if (p.depth === 1) drawProp(ctx, p, t);

  // wood chips and berries flying about
  for (const c of forest.chips) {
    px(ctx, cam.sx(c.x), Math.round(c.y), c.colour);
    px(ctx, cam.sx(c.x) + 1, Math.round(c.y), c.colour);
  }

  // a fringe of grass right at the camera, for depth
  const rng = rngFrom(1234);
  for (let i = 0; i < 70; i++) {
    const sx = cam.sx(rng() * STRIP_W * 1.15 - STRIP_W * 0.07);
    if (sx < -6 || sx > VIEW_W) continue;
    const h = 8 + Math.round(rng() * 14);
    const bend = Math.round(Math.sin(t * 1.6 + i) * 1.5);
    for (let k = 0; k < h; k++) {
      px(ctx, sx + (k > h - 4 ? bend : 0), VIEW_H - 2 - k, k > h - 5 ? PAL.grass2 : PAL.grass0);
    }
  }
}

function drawPlayer(ctx, player, t) {
  const target = forest.target;
  const chopping = forest.chopT > 0 && target && target.kind !== 'heron';
  const pose = chopping ? 'chop' : !player.onGround ? 'jump' : Math.abs(player.vx) > 4 ? 'walk' : 'idle';
  const frameIdx = chopping ? (forest.chopT > 0.18 ? 2 : 0)
    : pose === 'walk' ? Math.floor(t * 9) % 4 : Math.floor(t * 2) % 2;
  const img = S.playerSprite(pose, frameIdx);
  const sx = cam.sx(player.x) - (img.width >> 1);
  const sy = Math.round(player.y) - img.height + 1;
  ctx.save();
  if (player.face < 0) {
    ctx.translate(sx + img.width, sy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
  } else {
    ctx.drawImage(img, sx, sy);
  }
  ctx.restore();
}

/** The pack you are carrying, and what you are standing in front of. */
export function drawForestHud(ctx, t) {
  const total = packTotal();
  const w = 92;
  const x = (VIEW_W - w) >> 1;
  const y = 6;
  rect(ctx, x, y, w, 22, 'rgba(20,15,10,0.75)');
  rect(ctx, x + 1, y + 1, w - 2, 1, PAL.wood2);
  text(ctx, 'PACK', x + 4, y + 3, PAL.paper3);
  const frac = total / G.packCap;
  rect(ctx, x + 30, y + 3, 58, 6, PAL.wood0);
  rect(ctx, x + 30, y + 3, Math.round(58 * Math.min(1, frac)), 6, frac >= 1 ? PAL.red2 : PAL.gold);
  text(ctx, `${total}/${G.packCap}`, x + 60, y + 3, PAL.ink);
  let ix = x + 4;
  for (const [k, icon] of [['wood', 'wood'], ['berries', 'berry'], ['seeds', 'seed']]) {
    ctx.drawImage(S.icon(icon), ix, y + 12);
    text(ctx, String(G.pack[k]), ix + 10, y + 13, PAL.paper);
    ix += 30;
  }

  if (forest.banner > 0) {
    const a = Math.min(1, forest.banner * 2);
    ctx.globalAlpha = a;
    const bw = forest.bannerText.length * 6 + 12;
    rect(ctx, (VIEW_W - bw) >> 1, 40, bw, 13, 'rgba(20,15,10,0.85)');
    text(ctx, forest.bannerText, VIEW_W / 2, 43, PAL.gold2, { align: 'center' });
    ctx.globalAlpha = 1;
  }
}
