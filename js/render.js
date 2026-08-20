// Everything you see on the canvas. All art is drawn by hand — no assets.

import { TILE, MAPW, MAPH, CANVAS_W, CANVAS_H, COLORS, BLUEPRINTS, CREW_JOBS, BERRY_IDS } from './config.js';
import { G, tileAt } from './state.js';
import { circle, ellipse, roundRect, clamp, lerp } from './util.js';
import { animalDef, needStatus } from './animals.js';
import { ripeness } from './plants.js';
import { capacity } from './beavers.js';
import { canPlace } from './build.js';

const STRUCTURE_GLYPH = {
  duck_nest: '🪺', frog_log: '🪵', rabbit_burrow: '🕳️', hedgehog_hut: '🏕️',
  bird_house: '🏠', otter_holt: '🛖', turtle_bask: '🪜', lodge: '🏚️', shed: '📦',
};

export function draw(ctx) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawGround(ctx);
  drawWater(ctx);
  drawRequests(ctx);

  const sorted = [...G.entities].sort((a, b) => (a.py !== undefined ? a.py : a.y * TILE) - (b.py !== undefined ? b.py : b.y * TILE));
  drawLodge(ctx, G.lodge.x, G.lodge.y);
  for (const e of sorted) {
    if (e.kind === 'tree') drawTree(ctx, e);
    else if (e.kind === 'plant') drawPlant(ctx, e);
    else if (e.kind === 'site') drawSite(ctx, e);
    else if (e.kind === 'structure') drawStructure(ctx, e);
  }
  for (const e of sorted) if (e.kind === 'animal') drawAnimal(ctx, e);
  for (const b of [...G.beavers].sort((a, b2) => a.py - b2.py)) drawBeaver(ctx, b);

  drawOverlays(ctx);
  drawNight(ctx);
}

// ------------------------------------------------------------------ ground
function drawGround(ctx) {
  for (let y = 0; y < MAPH; y++) {
    for (let x = 0; x < MAPW; x++) {
      const tile = tileAt(x, y);
      const px = x * TILE, py = y * TILE;
      if (tile.t === 'water' || tile.t === 'pond') continue;
      if (tile.t === 'rock') {
        ctx.fillStyle = (x + y) % 2 ? COLORS.grassA : COLORS.grassB;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ellipse(ctx, px + 16, py + 23, 11, 4.5); ctx.fill();
        ctx.fillStyle = COLORS.rock;
        circle(ctx, px + 12 + tile.v * 3, py + 16, 8); ctx.fill();
        circle(ctx, px + 22, py + 20, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        circle(ctx, px + 10 + tile.v * 3, py + 13, 3); ctx.fill();
        ctx.fillStyle = COLORS.rockDark;
        circle(ctx, px + 24, py + 22, 2.5); ctx.fill();
        continue;
      }
      if (tile.t === 'dirt') {
        ctx.fillStyle = (x + y) % 2 ? COLORS.dirt : COLORS.dirtDark;
        ctx.fillRect(px, py, TILE, TILE);
        drawFloodHint(ctx, tile, x, y, px, py);
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.fillRect(px + 6 + tile.v * 12, py + 8 + tile.v * 10, 3, 2);
        ctx.fillRect(px + 18, py + 21, 4, 2);
        continue;
      }
      ctx.fillStyle = (x + y) % 2 ? COLORS.grassA : COLORS.grassB;
      ctx.fillRect(px, py, TILE, TILE);
      drawFloodHint(ctx, tile, x, y, px, py);
      // scatter a little ground detail so the meadow is not a flat checkerboard
      const gx = px + 5 + tile.v * 18, gy = py + 18 + tile.v * 8;
      if (tile.v > 0.72) {
        ctx.strokeStyle = COLORS.grassDark;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx + 1, gy - 5, gx + 3, gy - 7);
        ctx.moveTo(gx + 5, gy); ctx.quadraticCurveTo(gx + 5, gy - 4, gx + 8, gy - 6);
        ctx.stroke();
      } else if (tile.v > 0.62) {
        ctx.fillStyle = tile.v > 0.67 ? '#fff2b8' : '#f7b7c8';
        circle(ctx, gx, gy - 3, 1.8); ctx.fill();
        circle(ctx, gx + 6, gy + 1, 1.5); ctx.fill();
      } else if (tile.v < 0.08) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        circle(ctx, gx, gy, 4); ctx.fill();
      }
    }
  }
}

/**
 * Ground that the next rise of the water would swallow, tinted so the player can
 * see the future shoreline before planting an orchard in it.
 */
function drawFloodHint(ctx, tile, x, y, px, py) {
  const line = G.waterLevel + 1;
  if (tile.elev > line) return;
  ctx.fillStyle = tile.elev <= G.waterLevel ? 'rgba(80,170,225,0.26)' : 'rgba(120,195,235,0.15)';
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  const above = tileAt(x, y - 1), below = tileAt(x, y + 1);
  const left = tileAt(x - 1, y), right = tileAt(x + 1, y);
  if (above && above.elev > line) { ctx.moveTo(px, py + 0.75); ctx.lineTo(px + TILE, py + 0.75); }
  if (below && below.elev > line) { ctx.moveTo(px, py + TILE - 0.75); ctx.lineTo(px + TILE, py + TILE - 0.75); }
  if (left && left.elev > line) { ctx.moveTo(px + 0.75, py); ctx.lineTo(px + 0.75, py + TILE); }
  if (right && right.elev > line) { ctx.moveTo(px + TILE - 0.75, py); ctx.lineTo(px + TILE - 0.75, py + TILE); }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawWater(ctx) {
  const t = G.time;
  for (let y = 0; y < MAPH; y++) {
    for (let x = 0; x < MAPW; x++) {
      const tile = tileAt(x, y);
      if (tile.t !== 'water' && tile.t !== 'pond') continue;
      const px = x * TILE, py = y * TILE;
      const still = tile.t === 'pond';
      ctx.fillStyle = still ? COLORS.pond : COLORS.water;
      ctx.fillRect(px, py, TILE, TILE);

      // ripples: a river hurries, a pond just breathes
      const speed = still ? 0.6 : 2.2;
      const phase = t * speed + tile.v * 6.28 + x * 0.4 + y * 0.25;
      ctx.strokeStyle = still ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const wy = py + 10 + Math.sin(phase) * 3;
      ctx.moveTo(px + 6, wy);
      ctx.quadraticCurveTo(px + 12, wy - 2.5, px + 18, wy);
      const wy2 = py + 22 + Math.cos(phase * 0.8) * 3;
      ctx.moveTo(px + 14, wy2);
      ctx.quadraticCurveTo(px + 20, wy2 - 2.5, px + 26, wy2);
      ctx.stroke();

      // shoreline highlight where water meets land
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      const up = tileAt(x, y - 1);
      if (up && up.t !== 'water' && up.t !== 'pond') ctx.fillRect(px, py, TILE, 3);
      const left = tileAt(x - 1, y);
      if (left && left.t !== 'water' && left.t !== 'pond') ctx.fillRect(px, py, 3, TILE);

      if (tile.dam) drawDam(ctx, px, py);
    }
  }
}

function drawDam(ctx, px, py) {
  ctx.fillStyle = COLORS.woodDark;
  roundRect(ctx, px + 1, py + 4, TILE - 2, TILE - 8, 4); ctx.fill();
  ctx.fillStyle = COLORS.wood;
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, px + 2, py + 5 + i * 8, TILE - 4, 6, 3); ctx.fill();
  }
  ctx.strokeStyle = COLORS.woodDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px + 9, py + 3); ctx.lineTo(px + 9, py + TILE - 3);
  ctx.moveTo(px + 22, py + 3); ctx.lineTo(px + 22, py + TILE - 3);
  ctx.stroke();
}

// ------------------------------------------------------------------ plants
function drawTree(ctx, e) {
  const px = e.x * TILE + TILE / 2;
  const py = e.y * TILE + TILE / 2;
  const s = lerp(0.35, 1, e.growth);
  const sway = Math.sin(G.time * 1.4 + e.sway) * 1.6 * s;
  const shake = e.shake > 0 ? Math.sin(G.time * 40) * 2 : 0;

  ctx.save();
  ctx.translate(px + shake, py);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ellipse(ctx, 0, 11 * s, 10 * s, 4 * s); ctx.fill();

  ctx.fillStyle = COLORS.woodDark;
  roundRect(ctx, -2.5 * s, -2 * s, 5 * s, 14 * s, 2 * s); ctx.fill();

  const greens = [['#4f9c46', '#67b85a'], ['#3f8f52', '#59ad63'], ['#5aa845', '#76c25c']][e.variant % 3];
  ctx.translate(sway, 0);
  ctx.fillStyle = greens[0];
  circle(ctx, -7 * s, -8 * s, 8 * s); ctx.fill();
  circle(ctx, 7 * s, -7 * s, 7.5 * s); ctx.fill();
  circle(ctx, 0, -15 * s, 9 * s); ctx.fill();
  ctx.fillStyle = greens[1];
  circle(ctx, -3 * s, -12 * s, 6.5 * s); ctx.fill();
  circle(ctx, 4 * s, -13 * s, 5 * s); ctx.fill();
  ctx.restore();

  if (e.growth >= 1) {
    // wood remaining, as a thin ring under the tree
    if (e.wood < 13) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py + 11, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(e.wood / 20, 0, 1));
      ctx.stroke();
    }
    if (e.marked) {
      ctx.fillStyle = COLORS.ink;
      ctx.font = '13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('🪓', px, py - 22);
      ctx.strokeStyle = 'rgba(255,90,70,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      circle(ctx, px, py, 14); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawPlant(ctx, e) {
  const bp = BLUEPRINTS[e.blueprint];
  const px = e.x * TILE + TILE / 2;
  const py = e.y * TILE + TILE / 2;
  const s = lerp(0.4, 1, e.growth);
  const sway = Math.sin(G.time * 1.8 + e.sway) * 1.4;

  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ellipse(ctx, 0, 9 * s, 8 * s, 3 * s); ctx.fill();

  if (e.blueprint === 'reed') {
    ctx.strokeStyle = '#8fb95e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 5, 8 * s);
      ctx.quadraticCurveTo(i * 5 + sway, -4 * s, i * 5 + sway * 1.6, -12 * s);
      ctx.stroke();
      ctx.fillStyle = '#a8894f';
      roundRect(ctx, i * 5 + sway * 1.6 - 1.6, -16 * s, 3.2, 5, 1.6); ctx.fill();
    }
  } else if (BERRY_IDS.includes(e.blueprint)) {
    ctx.fillStyle = '#4f9450';
    circle(ctx, -5 * s, 0, 6.5 * s); ctx.fill();
    circle(ctx, 5 * s, 0, 6 * s); ctx.fill();
    circle(ctx, 0, -5 * s, 7 * s); ctx.fill();
    const r = ripeness(e);
    if (r > 0.25) {
      ctx.fillStyle = bp.tint;
      ctx.globalAlpha = clamp((r - 0.2) / 0.6, 0, 1);
      const n = e.berries > 0 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const a = i * 1.5 + e.sway;
        circle(ctx, Math.cos(a) * 6 * s, Math.sin(a) * 5 * s - 3, 2.3 * s); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  } else {
    // flowers: clover, bluebell, sunflower
    ctx.strokeStyle = '#5fa34e';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 6, 8 * s);
      ctx.quadraticCurveTo(i * 6 + sway * 0.5, 0, i * 6 + sway, -7 * s);
      ctx.stroke();
      ctx.fillStyle = bp.tint;
      if (e.blueprint === 'clover') {
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2;
          circle(ctx, i * 6 + sway + Math.cos(a) * 2.6, -8 * s + Math.sin(a) * 2.6, 2.6 * s); ctx.fill();
        }
      } else if (e.blueprint === 'sunflower') {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          circle(ctx, i * 6 + sway + Math.cos(a) * 3.4, -9 * s + Math.sin(a) * 3.4, 2.1 * s); ctx.fill();
        }
        ctx.fillStyle = '#7d5129';
        circle(ctx, i * 6 + sway, -9 * s, 2.2 * s); ctx.fill();
      } else {
        circle(ctx, i * 6 + sway, -8 * s, 3 * s); ctx.fill();
      }
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------- built stuff
function drawSite(ctx, e) {
  const bp = BLUEPRINTS[e.blueprint];
  const px = e.x * TILE, py = e.y * TILE;
  const pulse = e.pulse > 0 ? 1 + Math.sin(G.time * 22) * 0.06 : 1;

  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = COLORS.ink;
  ctx.font = `${Math.round(18 * pulse)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bp.icon, px + TILE / 2, py + TILE / 2 - 2);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 2;
  roundRect(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 5); ctx.stroke();
  ctx.setLineDash([]);

  const p = clamp(e.workDone / e.work, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, px + 4, py + TILE - 8, TILE - 8, 5, 2.5); ctx.fill();
  ctx.fillStyle = COLORS.gold;
  roundRect(ctx, px + 4, py + TILE - 8, (TILE - 8) * p, 5, 2.5); ctx.fill();
  ctx.restore();
}

function drawStructure(ctx, e) {
  const px = e.x * TILE + TILE / 2;
  const py = e.y * TILE + TILE / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ellipse(ctx, px, py + 10, 11, 4.5); ctx.fill();
  ctx.fillStyle = 'rgba(255,246,229,0.72)';
  circle(ctx, px, py - 1, 13); ctx.fill();
  ctx.strokeStyle = 'rgba(93,72,50,0.35)';
  ctx.lineWidth = 1.5;
  circle(ctx, px, py - 1, 13); ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.font = '20px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(STRUCTURE_GLYPH[e.blueprint] || BLUEPRINTS[e.blueprint].icon, px, py - 1);
  if (e.animalId) {
    ctx.font = '12px system-ui';
    ctx.fillText('💤', px + 12, py - 12);
  }
  ctx.restore();
}

function drawLodge(ctx, x, y) {
  const px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ellipse(ctx, px, py + 11, 15, 6); ctx.fill();
  // a dome of sticks
  ctx.fillStyle = COLORS.woodDark;
  ctx.beginPath();
  ctx.moveTo(px - 15, py + 11);
  ctx.quadraticCurveTo(px, py - 20, px + 15, py + 11);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = COLORS.wood;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(px + i * 5.5, py + 10);
    ctx.lineTo(px + i * 2.5, py - 8 + Math.abs(i) * 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#2b2118';
  ellipse(ctx, px, py + 8, 5, 4); ctx.fill();
  ctx.fillStyle = COLORS.ink;
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('📦', px + 14, py + 8);
  ctx.restore();
}

function drawAnimal(ctx, e) {
  const def = animalDef(e.animalId);
  const hop = Math.abs(Math.sin(e.hop)) * 3;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ellipse(ctx, e.px, e.py + 8, 8 - hop * 0.6, 3.2); ctx.fill();
  ctx.fillStyle = COLORS.ink;
  ctx.font = '18px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.icon, e.px, e.py - hop);
  ctx.restore();
}

// ----------------------------------------------------------------- beavers
function drawBeaver(ctx, b) {
  const bob = b.state === 'moving' ? Math.abs(Math.sin(b.anim * 9)) * 2 : Math.sin(b.anim * 2) * 0.8;
  const work = b.working > 0 ? Math.sin(b.anim * 24) * 3 : 0;
  const x = b.px, y = b.py - bob;
  const role = CREW_JOBS[b.role];
  const sleeping = b.state === 'resting';

  const onTile = tileAt(Math.floor(b.px / TILE), Math.floor(b.py / TILE));
  const swimming = !!onTile && (onTile.t === 'water' || onTile.t === 'pond') && !onTile.dam;

  ctx.save();
  ctx.translate(x, y);
  if (swimming) {
    // ripples instead of a shadow, and the body rides low in the water
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.6;
    const spread = 9 + Math.sin(b.anim * 3) * 1.6;
    ellipse(ctx, 0, 6, spread, 3.4); ctx.stroke();
    ellipse(ctx, 0, 6, spread + 4, 5); ctx.stroke();
    ctx.beginPath();
    ctx.rect(-16, -30, 32, 36);      // clip away everything below the waterline
    ctx.clip();
    ctx.translate(0, 2);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ellipse(ctx, 0, 9, 9, 3.6); ctx.fill();
  }
  ctx.scale(b.face, 1);

  // tail
  ctx.fillStyle = COLORS.furDark;
  ellipse(ctx, -9, 4, 6, 4, -0.3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-12, 3); ctx.lineTo(-6, 5); ctx.stroke();

  // body
  ctx.fillStyle = COLORS.fur;
  ellipse(ctx, 0, 2, 9, 8); ctx.fill();
  ctx.fillStyle = COLORS.furLight;
  ellipse(ctx, 1.5, 4, 5.5, 4.5); ctx.fill();

  // head
  ctx.save();
  ctx.translate(3 + work * 0.4, -6 + work * 0.5);
  ctx.fillStyle = COLORS.fur;
  circle(ctx, 0, 0, 6.4); ctx.fill();
  ctx.fillStyle = COLORS.furDark;
  circle(ctx, -3.5, -5, 2.2); ctx.fill();
  circle(ctx, 3, -5.2, 2.2); ctx.fill();
  ctx.fillStyle = COLORS.ink;
  if (sleeping) {
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(1.2, -1, 2, 0.2, Math.PI - 0.2);
    ctx.arc(5.2, -1, 1.6, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    circle(ctx, 1.6, -1.4, 1.25); ctx.fill();
    circle(ctx, 5.2, -1.6, 1.25); ctx.fill();
  }
  ctx.fillStyle = COLORS.furLight;
  ellipse(ctx, 3.6, 2.2, 3.6, 2.6); ctx.fill();
  ctx.fillStyle = '#fff8e6';
  roundRect(ctx, 2.6, 3.4, 2.1, 3.2, 0.6); ctx.fill();
  ctx.restore();

  // role scarf
  ctx.fillStyle = role.color;
  roundRect(ctx, -4.5, -2, 9, 3, 1.5); ctx.fill();
  ctx.restore();

  // carried goods
  if (b.carry.n >= 1) {
    ctx.save();
    ctx.translate(x, y - 18);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRect(ctx, -14, -8, 28, 14, 7); ctx.fill();
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.ink;
    const icon = b.carry.type === 'wood' ? '🪵' : '🫐';
    ctx.fillText(`${icon}${Math.floor(b.carry.n)}/${Math.round(capacity(b))}`, 0, -1);
    ctx.restore();
  }
  if (sleeping) {
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('💤', x + 10, y - 14 - Math.sin(b.anim * 2) * 2);
  }
  if (b.popup) {
    ctx.font = '700 11px system-ui';
    ctx.textAlign = 'center';
    ctx.globalAlpha = clamp(1.6 - b.popup.t, 0, 1);
    ctx.fillStyle = '#ffd76a';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(b.popup.text, x, y - 26 - b.popup.t * 10);
    ctx.fillText(b.popup.text, x, y - 26 - b.popup.t * 10);
    ctx.globalAlpha = 1;
  }
  if (G.ui.selectedBeaver === b.id) {
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -G.time * 12;
    ellipse(ctx, x, y + 9, 12, 5.5); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // energy pip
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, x - 12, y + 13, 24, 4, 2); ctx.fill();
    ctx.fillStyle = b.energy > 40 ? '#7ddc7d' : '#ff9a5a';
    roundRect(ctx, x - 12, y + 13, 24 * clamp(b.energy / (100 + 20 * b.skills.endurance), 0, 1), 4, 2); ctx.fill();
  }
}

// ---------------------------------------------------------------- overlays
function drawRequests(ctx) {
  for (const request of G.requests) {
    const def = animalDef(request.animalId);
    const cx = request.x * TILE + TILE / 2;
    const cy = request.y * TILE + TILE / 2;
    const r = request.radius * TILE;
    const focused = G.ui.focusRequest === request.animalId;
    ctx.save();
    ctx.globalAlpha = focused ? 0.5 : 0.24;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = focused ? 4 : 2.5;
    ctx.setLineDash([9, 7]);
    ctx.lineDashOffset = -G.time * 10;
    circle(ctx, cx, cy, r); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = focused ? 0.14 : 0.07;
    ctx.fillStyle = def.color;
    circle(ctx, cx, cy, r); ctx.fill();
    ctx.restore();

    const bounce = Math.sin(G.time * 2.5 + request.x) * 2;
    ctx.save();
    ctx.translate(cx, cy - 16 + bounce);
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    roundRect(ctx, -17, -14, 34, 26, 9); ctx.fill();
    ctx.fillStyle = def.color;
    roundRect(ctx, -17, 8, 34, 4, 2); ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = '17px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, 0, -2);
    const st = needStatus(request);
    ctx.font = '700 9px system-ui';
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(`${st.filter((s) => s.met).length}/${st.length}`, 0, 18);
    ctx.restore();
  }
}

function drawOverlays(ctx) {
  const hover = G.ui.hoverTile;
  if (!hover) return;
  const px = hover.x * TILE, py = hover.y * TILE;

  if (G.ui.build) {
    const bp = BLUEPRINTS[G.ui.build];
    const check = canPlace(G.ui.build, hover.x, hover.y);
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = check.ok ? 'rgba(120,230,140,0.55)' : 'rgba(255,110,110,0.5)';
    roundRect(ctx, px + 2, py + 2, TILE - 4, TILE - 4, 6); ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = COLORS.ink;
    ctx.font = '18px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bp.icon, px + TILE / 2, py + TILE / 2);
    ctx.restore();
  } else {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    roundRect(ctx, px + 2, py + 2, TILE - 4, TILE - 4, 6); ctx.stroke();
    ctx.restore();
  }
}

function drawNight(ctx) {
  // 0 = dawn, 0.5 = midday, 1 = midnight-ish
  const t = G.dayT;
  let dark = 0;
  if (t > 0.72) dark = clamp((t - 0.72) / 0.22, 0, 1);
  if (t < 0.08) dark = clamp(1 - t / 0.08, 0, 1);
  if (dark <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = dark * 0.42;
  ctx.fillStyle = '#1b2a5e';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.globalAlpha = dark * 0.5;
  const gx = G.lodge.x * TILE + TILE / 2, gy = G.lodge.y * TILE + TILE / 2;
  const grad = ctx.createRadialGradient(gx, gy, 4, gx, gy, 90);
  grad.addColorStop(0, 'rgba(255,214,130,0.55)');
  grad.addColorStop(1, 'rgba(255,214,130,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(gx - 90, gy - 90, 180, 180);
  ctx.restore();
}
