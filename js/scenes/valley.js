// The bird's-eye valley: terrain, water, everything living in it, and the
// heron you are riding while you build.

import { TILE, MAPW, MAPH, WORLD_W, WORLD_H, VIEW_W, VIEW_H, BLUEPRINTS, MAX_WATER_LEVEL } from '../config.js';
import { G, tileAt, entityAt } from '../state.js';
import { PAL, surface, rect, frame, px, text, disc, outline } from '../gfx/pixel.js';
import { cam } from '../gfx/screen.js';
import * as S from '../gfx/sprites.js';
import { animalDef, needStatus } from '../animals.js';
import { ripeness } from '../plants.js';
import { capacity } from '../beavers.js';
import { canPlace } from '../build.js';

let ground = null;         // pre-rendered land, blitted in one go each frame
let groundDirty = true;

export function invalidateGround() { groundDirty = true; }

export function buildGround() {
  if (!ground) ground = surface(WORLD_W, WORLD_H);
  const ctx = ground.ctx;
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  for (let y = 0; y < MAPH; y++) {
    for (let x = 0; x < MAPW; x++) {
      const tile = tileAt(x, y);
      if (tile.t === 'water' || tile.t === 'pond') continue;   // water animates on top
      // most of the meadow is plain; flowers and worn patches stay rare
      const v = tile.v < 0.52 ? 0 : tile.v < 0.8 ? 1 : tile.v < 0.92 ? 2 : 3;
      let img;
      if (tile.t === 'rock') img = S.rockTile(Math.floor(tile.v * 4) % 4);
      else if (tile.t === 'dirt') img = S.dirtTile(v & 1);
      else img = S.grassTile(v, tile.elev >= 4);   // high ground dries out
      ctx.drawImage(img, x * TILE, y * TILE);
    }
  }
  groundDirty = false;
}

const isWet = (t) => t === 'water' || t === 'pond';

/** Ground the next rise of the water would take, hatched so you can see it. */
function drawFloodHint(ctx, tile, sx, sy) {
  if (tile.elev > G.waterLevel + 1 || G.waterLevel >= MAX_WATER_LEVEL) return;
  const soon = tile.elev <= G.waterLevel;
  ctx.fillStyle = soon ? 'rgba(79,169,216,0.34)' : 'rgba(79,169,216,0.17)';
  for (let j = 0; j < TILE; j++) {
    for (let i = (j % 2); i < TILE; i += 2) ctx.fillRect(sx + i, sy + j, 1, 1);
  }
}

export function drawValley(ctx, t, view) {
  if (groundDirty) buildGround();
  const x0 = Math.max(0, Math.floor(cam.x / TILE));
  const y0 = Math.max(0, Math.floor(cam.y / TILE));
  const x1 = Math.min(MAPW - 1, Math.ceil((cam.x + VIEW_W) / TILE));
  const y1 = Math.min(MAPH - 1, Math.ceil((cam.y + VIEW_H) / TILE));

  // --- land
  rect(ctx, 0, 0, VIEW_W, VIEW_H, PAL.water0);
  const gx = Math.min(Math.max(0, Math.round(cam.x) - cam.ox), Math.max(0, WORLD_W - VIEW_W));
  const gy = Math.min(Math.max(0, Math.round(cam.y) - cam.oy), Math.max(0, WORLD_H - VIEW_H));
  ctx.drawImage(ground.canvas, gx, gy, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

  // --- water, foam and dams
  const animFrame = Math.floor(t * 4) % 4;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const tile = tileAt(x, y);
      const sx = cam.sx(x * TILE), sy = cam.sy(y * TILE);
      if (isWet(tile.t)) {
        // a tile ringed by water is open water, and reads darker for it
        let shore = false;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const n = tileAt(x + dx, y + dy);
          if (!n || !isWet(n.t)) { shore = true; break; }
        }
        ctx.drawImage(S.waterTile(tile.t === 'pond', (animFrame + x + y) % 4, !shore), sx, sy);
        for (const [dir, dx, dy] of [[0, 0, -1], [1, 1, 0], [2, 0, 1], [3, -1, 0]]) {
          const n = tileAt(x + dx, y + dy);
          if (n && !isWet(n.t)) ctx.drawImage(S.foamEdge(dir), sx, sy);
        }
        if (tile.dam) ctx.drawImage(S.damTile(), sx, sy);
      } else {
        drawFloodHint(ctx, tile, sx, sy);
      }
    }
  }

  // --- contract circles sit under everything else
  for (const request of G.requests) drawRequestRing(ctx, request, t);

  // --- everything with a footprint, painted back to front
  const drawables = [];
  for (const e of G.entities) {
    const wy = e.kind === 'animal' ? e.py : e.y * TILE + TILE;
    const wx = e.kind === 'animal' ? e.px : e.x * TILE;
    if (wx < cam.x - 40 || wx > cam.x + VIEW_W + 40 || wy < cam.y - 48 || wy > cam.y + VIEW_H + 48) continue;
    drawables.push({ e, sortY: wy });
  }
  for (const b of G.beavers) {
    if (b.px < cam.x - 30 || b.px > cam.x + VIEW_W + 30 || b.py < cam.y - 30 || b.py > cam.y + VIEW_H + 30) continue;
    drawables.push({ b, sortY: b.py });
  }
  drawables.sort((a, z) => a.sortY - z.sortY);

  // the lodge is a fixture, not an entity
  const lodgeImg = S.structureSprite('lodge');
  ctx.drawImage(lodgeImg, cam.sx(G.lodge.x * TILE + TILE / 2 - lodgeImg.width / 2),
                cam.sy(G.lodge.y * TILE + TILE - lodgeImg.height + 3));

  for (const item of drawables) {
    if (item.b) drawBeaver(ctx, item.b, t);
    else drawEntity(ctx, item.e, t);
  }

  // --- contract pins float above the scene
  for (const request of G.requests) drawRequestPin(ctx, request, t);
}

function drawEntity(ctx, e, t) {
  const sx = cam.sx(e.x * TILE);
  const sy = cam.sy(e.y * TILE);

  if (e.kind === 'tree') {
    if (e.growth < 0.35) { ctx.drawImage(S.saplingSprite(), sx + 2, sy + 4); return; }
    const stage = e.growth >= 1 ? 1 : 0.45;
    const img = S.treeSprite(e.variant % 3, stage);
    const sway = Math.round(Math.sin(t * 1.3 + e.sway) * (e.growth >= 1 ? 1 : 0));
    const shake = e.shake > 0 ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0;
    ctx.drawImage(img, sx - 2 + sway + shake, sy + TILE - img.height + 2);
    if (e.marked && e.growth >= 1) {
      const axe = S.icon('axe');
      const bob = Math.round(Math.sin(t * 4 + e.x) * 1.5);
      ctx.drawImage(axe, sx + 4, sy - img.height + 12 + bob);
      rect(ctx, sx + 3, sy - img.height + 22 + bob, 11, 1, PAL.red2);
    }
    if (e.growth >= 1 && e.wood < 13) {
      const w = Math.max(1, Math.round((e.wood / 20) * 12));
      rect(ctx, sx + 2, sy + TILE - 2, 12, 2, PAL.ink);
      rect(ctx, sx + 2, sy + TILE - 2, w, 2, PAL.wood3);
    }
    return;
  }

  if (e.kind === 'plant') {
    const id = e.blueprint;
    let img;
    if (id === 'reed') img = S.reedSprite();
    else if (id === 'clover' || id === 'bluebell' || id === 'sunflower') img = S.flowerSprite(id);
    else img = S.bushSprite(id, ripeness(e) > 0.55);
    // young plants rise out of the ground: clip the top off until they are grown
    const hidden = e.growth >= 1 ? 0 : Math.round((1 - e.growth) * (img.height - 4));
    const visible = img.height - hidden;
    ctx.drawImage(img, 0, hidden, img.width, visible,
                  sx, sy + TILE - visible + 2, img.width, visible);
    if (e.berries > 0) {
      const spark = S.icon('spark');
      if (Math.floor(t * 2) % 2) ctx.drawImage(spark, sx + 10, sy - 4);
    }
    return;
  }

  if (e.kind === 'site') {
    const img = S.siteSprite(Math.floor(t * 3) % 2);
    ctx.drawImage(img, sx, sy + TILE - img.height + 2);
    const p = Math.max(0, Math.min(1, e.workDone / e.work));
    rect(ctx, sx + 2, sy + TILE - 3, 12, 3, PAL.ink);
    rect(ctx, sx + 3, sy + TILE - 2, Math.round(10 * p), 1, PAL.gold2);
    const ghost = blueprintSprite(e.blueprint);
    if (ghost && Math.floor(t * 1.5) % 2) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(ghost, sx + ((TILE - ghost.width) >> 1), sy + TILE - ghost.height - 2);
      ctx.globalAlpha = 1;
    }
    return;
  }

  if (e.kind === 'structure') {
    const img = S.structureSprite(e.blueprint);
    ctx.drawImage(img, sx + ((TILE - img.width) >> 1), sy + TILE - img.height + 2);
    if (e.animalId) {
      const zzz = Math.floor(t * 1.5) % 2;
      text(ctx, zzz ? 'Z' : 'z', sx + 12, sy - 4, PAL.paper, { shadow: PAL.ink });
    }
    return;
  }

  if (e.kind === 'animal') {
    const img = S.animalSprite(e.animalId, Math.floor(t * 3 + e.hop) % 2);
    ctx.drawImage(img, cam.sx(e.px) - (img.width >> 1), cam.sy(e.py) - img.height + 4);
  }
}

function drawBeaver(ctx, b, t) {
  const frameIdx = b.state === 'moving' ? (Math.floor(t * 7) % 2) : (Math.floor(t * 1.6) % 2);
  const img = S.beaverSprite(b.role, frameIdx, b.swimming);
  const sx = cam.sx(b.px) - (img.width >> 1);
  const sy = cam.sy(b.py) - img.height + 5;

  if (b.face < 0) {
    ctx.save();
    ctx.translate(sx + img.width, sy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(img, sx, sy);
  }

  if (b.state === 'working' && Math.floor(t * 8) % 2) {
    const tool = S.icon(b.task && b.task.type === 'CHOP' ? 'axe' : 'hammer');
    ctx.drawImage(tool, sx + (b.face < 0 ? -4 : 10), sy + 2);
  }
  if (b.carry.n >= 1) {
    const bubble = S.carrySprite(b.carry.type === 'wood' ? 'wood' : 'berries');
    ctx.drawImage(bubble, sx + 3, sy - 7);
    if (b.carry.n >= capacity(b) - 0.01) px(ctx, sx + 12, sy - 6, PAL.gold2);
  }
  if (b.state === 'resting') {
    text(ctx, Math.floor(t * 2) % 2 ? 'Z' : 'z', sx + 12, sy - 5, PAL.paper, { shadow: PAL.ink });
  }
  if (b.morale < 40 && Math.floor(t * 2) % 2) {
    text(ctx, '!', sx + 6, sy - 7, PAL.red2, { shadow: PAL.ink });
  }
}

// ------------------------------------------------------------- contracts
function drawRequestRing(ctx, request, t) {
  const def = animalDef(request.animalId);
  const cx = cam.sx(request.x * TILE + TILE / 2);
  const cy = cam.sy(request.y * TILE + TILE / 2);
  const r = request.radius * TILE;
  if (cx + r < 0 || cx - r > VIEW_W || cy + r < 0 || cy - r > VIEW_H) return;
  const focused = G.ui.focusRequest === request.animalId;
  ctx.fillStyle = def.color;
  ctx.globalAlpha = focused ? 0.95 : 0.6;
  const step = 0.16;
  for (let a = 0; a < Math.PI * 2; a += step) {
    if (((a * 3 + t * 1.2) % 0.9) > 0.45) continue;   // marching dashes
    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
  ctx.globalAlpha = focused ? 0.1 : 0.05;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawRequestPin(ctx, request, t) {
  const def = animalDef(request.animalId);
  const cx = cam.sx(request.x * TILE + TILE / 2);
  const cy = cam.sy(request.y * TILE + TILE / 2);
  if (cx < -20 || cx > VIEW_W + 20 || cy < -30 || cy > VIEW_H + 20) return;
  const bob = Math.round(Math.sin(t * 2.4 + request.x) * 2);
  const st = needStatus(request);
  const met = st.filter((n) => n.met).length;
  const w = 22, h = 22;
  const x = cx - (w >> 1), y = cy - 30 + bob;

  rect(ctx, x, y, w, h, PAL.paper);
  frame(ctx, x, y, w, h, PAL.ink);
  rect(ctx, x + 1, y + 1, w - 2, 1, PAL.white);
  rect(ctx, x + 1, y + h - 5, w - 2, 4, def.color);
  const img = S.animalSprite(def.id, 0);
  ctx.drawImage(img, x + ((w - img.width) >> 1), y - 1);
  text(ctx, `${met}/${st.length}`, cx, y + h - 4, PAL.ink);
  // little tail on the speech pin
  px(ctx, cx, y + h, PAL.ink); px(ctx, cx - 1, y + h, PAL.ink);
  px(ctx, cx, y + h + 1, PAL.ink);
}

// ---------------------------------------------------------------- helpers
export function blueprintSprite(id) {
  if (id === 'dam') return S.damTile();
  if (id === 'sapling') return S.saplingSprite();
  if (id === 'reed') return S.reedSprite();
  if (id === 'clover' || id === 'bluebell' || id === 'sunflower') return S.flowerSprite(id);
  if (id === 'sunberry' || id === 'dewberry' || id === 'goldberry') return S.bushSprite(id, true);
  return S.structureSprite(id);
}

/** The tile highlight and the ghost of whatever you are about to place. */
export function drawCursor(ctx, tx, ty, t) {
  if (tx < 0 || ty < 0 || tx >= MAPW || ty >= MAPH) return;
  const sx = cam.sx(tx * TILE), sy = cam.sy(ty * TILE);
  const build = G.ui.build;
  if (build) {
    const ok = canPlace(build, tx, ty).ok;
    const img = blueprintSprite(build);
    ctx.fillStyle = ok ? 'rgba(122,224,120,0.32)' : 'rgba(224,90,80,0.38)';
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.globalAlpha = ok ? 0.85 : 0.5;
    ctx.drawImage(img, sx + ((TILE - img.width) >> 1), sy + TILE - img.height + 2);
    ctx.globalAlpha = 1;
    frame(ctx, sx, sy, TILE, TILE, ok ? PAL.grass4 : PAL.red2);
  } else {
    const e = entityAt(tx, ty);
    const c = e && e.kind === 'tree' && e.growth >= 1 ? PAL.gold2 : PAL.paper;
    // corner brackets, so the cursor never hides the tile
    for (const [ox, oy, dx, dy] of [[0, 0, 1, 1], [TILE - 1, 0, -1, 1], [0, TILE - 1, 1, -1], [TILE - 1, TILE - 1, -1, -1]]) {
      px(ctx, sx + ox, sy + oy, c);
      px(ctx, sx + ox + dx, sy + oy, c);
      px(ctx, sx + ox, sy + oy + dy, c);
    }
  }
}

/** The heron and its shadow, drawn last so it flies over everything. */
export function drawRider(ctx, rider, t) {
  const flap = Math.floor(t * 9) % 4;
  const img = S.birdSprite(flap, true);
  const sx = cam.sx(rider.x) - (img.width >> 1);
  const sy = cam.sy(rider.y) - (img.height >> 1) - Math.round(rider.height);
  // the shadow stays on the ground, which is what sells the altitude
  ctx.globalAlpha = 0.34;
  const shadow = S.shadowSprite(16);
  ctx.drawImage(shadow, cam.sx(rider.x) - 8, cam.sy(rider.y) - 2);
  ctx.globalAlpha = 1;
  ctx.save();
  if (rider.face < 0) {
    ctx.translate(sx + img.width, sy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
  } else {
    ctx.drawImage(img, sx, sy);
  }
  ctx.restore();
}
