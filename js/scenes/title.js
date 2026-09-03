// The title screen: a beaver on a rock at sunset, looking out across the water
// at the dam it has been building. Drawn entirely with the same pixel toolkit
// as the rest of the game, then held as a cached backdrop so it costs nothing
// to keep on screen.

import { VIEW_W, VIEW_H } from '../config.js';
import { PAL, surface, rect, px, disc, line, text, bigText, textWidth, rngFrom, rimLight } from '../gfx/pixel.js';
import * as S from '../gfx/sprites.js';

const HORIZON = 168;      // where the water meets the dam
const DAM_TOP = 132;
const SUN_X = 306;        // right of centre, on the third
const SUN_Y = 112;

let backdrop = null;

/** The still parts of the scene, painted once into an offscreen buffer. */
function paintBackdrop() {
  const surf = surface(VIEW_W, VIEW_H);
  const ctx = surf.ctx;
  const rng = rngFrom(0xDA3115);

  // ---- sky: deep indigo overhead falling to hot gold at the horizon
  const ramp = ['#241a4a', '#331f52', '#45255a', '#5b2a60', '#753362', '#8f3f5f',
                '#a94f57', '#c2624e', '#d67846', '#e69044', '#f0a748', '#f6c05c'];
  const skyH = DAM_TOP + 6;
  for (let i = 0; i < ramp.length; i++) {
    const top = Math.round((i / ramp.length) * skyH);
    const bottom = Math.round(((i + 1) / ramp.length) * skyH);
    rect(ctx, 0, top, VIEW_W, bottom - top, ramp[i]);
    if (i < ramp.length - 1) {
      ctx.fillStyle = ramp[i + 1];
      for (let x = (bottom % 2); x < VIEW_W; x += 2) ctx.fillRect(x, bottom - 2, 1, 1);
      for (let x = ((bottom + 1) % 2); x < VIEW_W; x += 4) ctx.fillRect(x, bottom - 3, 1, 1);
    }
  }

  // ---- the sun, sitting low and huge
  disc(ctx, SUN_X, SUN_Y, 26, '#f6c05c');
  disc(ctx, SUN_X, SUN_Y, 22, '#fbd97e');
  disc(ctx, SUN_X, SUN_Y, 16, '#fff0b8');
  // the classic banded sun: slots cut across it
  for (let i = 0; i < 5; i++) {
    const y = SUN_Y - 12 + i * 7;
    rect(ctx, SUN_X - 28, y, 56, 1 + (i > 2 ? 1 : 0), ramp[8 + Math.min(3, i)]);
  }
  // glow
  ctx.globalAlpha = 0.16;
  disc(ctx, SUN_X, SUN_Y, 40, '#f6c05c');
  ctx.globalAlpha = 0.1;
  disc(ctx, SUN_X, SUN_Y, 56, '#f6c05c');
  ctx.globalAlpha = 1;

  // ---- three ranges of hills, each darker and closer
  const ridge = (baseY, height, colour, seed, roughness) => {
    const r = rngFrom(seed);
    let h = height;
    for (let x = 0; x < VIEW_W; x++) {
      h += (r() - 0.5) * roughness;
      h = Math.max(height - 9, Math.min(height + 9, h));
      const top = Math.round(baseY - h);
      rect(ctx, x, top, 1, baseY - top, colour);
    }
  };
  ridge(DAM_TOP + 4, 30, '#5b3a63', 11, 2.4);
  ridge(DAM_TOP + 4, 20, '#402a53', 27, 3.0);
  ridge(DAM_TOP + 4, 12, '#2c1d42', 41, 3.6);

  // ---- pine silhouettes along the near ridge
  const pineRng = rngFrom(88);
  for (let i = 0; i < 26; i++) {
    const x = Math.round(pineRng() * VIEW_W);
    const h = 10 + Math.round(pineRng() * 9);
    const baseY = DAM_TOP + 4;
    for (let k = 0; k < h; k++) {
      const half = Math.round(((h - k) / h) * 4.5);
      rect(ctx, x - half, baseY - k, half * 2 + 1, 1, '#20143a');
    }
    rect(ctx, x, baseY - h - 2, 1, 3, '#20143a');
  }

  // ---- the dam: a solid wall of stacked logs, backlit along every top edge
  rect(ctx, 0, DAM_TOP, VIEW_W, HORIZON - DAM_TOP + 2, '#20143a');
  for (let row = 0; row < 5; row++) {
    const y = DAM_TOP + 1 + row * 7;
    rect(ctx, 0, y, VIEW_W, 6, '#2c1d42');
    rect(ctx, 0, y, VIEW_W, 1, '#6b3560');            // light along the top of each log
    rect(ctx, 0, y + 5, VIEW_W, 1, '#150e28');        // shadow beneath it
    // log ends, staggered row to row
    for (let x = -6 + (row % 2) * 9; x < VIEW_W; x += 18) {
      rect(ctx, x, y, 1, 6, '#1a1130');
      px(ctx, x, y, '#8f3f5f');
      px(ctx, x + 1, y + 2, '#3a2450');
    }
  }
  // stakes driven down through the face
  for (let x = 14; x < VIEW_W; x += 53) {
    rect(ctx, x, DAM_TOP - 4, 3, HORIZON - DAM_TOP + 5, '#241a3c');
    rect(ctx, x, DAM_TOP - 4, 1, HORIZON - DAM_TOP + 5, '#5b3a63');
    px(ctx, x + 1, DAM_TOP - 4, '#c2624e');
  }
  // the crest, hot against the sky
  rect(ctx, 0, DAM_TOP - 2, VIEW_W, 2, '#8f3f5f');
  rect(ctx, 0, DAM_TOP - 3, VIEW_W, 1, '#c2624e');
  for (let x = 0; x < VIEW_W; x += 3) px(ctx, x + ((x * 3) % 2), DAM_TOP - 4, '#f0a748');

  // ---- the spillway: water pouring through a notch in the crest
  const gapX = 198, gapW = 15;
  rect(ctx, gapX, DAM_TOP - 3, gapW, 4, '#d6a08a');           // the lip
  rect(ctx, gapX + 1, DAM_TOP - 4, gapW - 2, 1, '#fbd97e');
  for (let i = 0; i < gapW; i++) {
    const x = gapX + i;
    const edge = i < 2 || i > gapW - 3;
    rect(ctx, x, DAM_TOP, 1, HORIZON - DAM_TOP + 1, edge ? '#8f5f7a' : '#c08a92');
  }
  // streaks in the falling water
  for (let i = 0; i < 16; i++) {
    const x = gapX + 2 + ((i * 5) % (gapW - 4));
    const y = DAM_TOP + 2 + ((i * 7) % (HORIZON - DAM_TOP - 6));
    rect(ctx, x, y, 1, 4 + (i % 4), '#e8c0b0');
  }
  // the churn where it lands
  rect(ctx, gapX - 5, HORIZON - 3, gapW + 10, 4, '#f0c8b0');
  rect(ctx, gapX - 8, HORIZON, gapW + 16, 2, '#d6a08a');
  for (let i = 0; i < 12; i++) {
    px(ctx, gapX - 8 + ((i * 7) % (gapW + 16)), HORIZON - 5 - (i % 3), '#fff0d8');
  }

  // ---- the water: darker as it comes toward us, with a reflected sun column
  for (let y = HORIZON; y < VIEW_H; y++) {
    const t = (y - HORIZON) / (VIEW_H - HORIZON);
    const shade = t < 0.25 ? '#5b3a63' : t < 0.5 ? '#43284f' : t < 0.75 ? '#2f1c3e' : '#20142f';
    rect(ctx, 0, y, VIEW_W, 1, shade);
  }
  ctx.globalAlpha = 0.85;
  for (let y = HORIZON; y < VIEW_H; y += 1) {
    const t = (y - HORIZON) / (VIEW_H - HORIZON);
    const spread = 6 + t * 40;
    const count = 1 + Math.round(t * 5);
    for (let i = 0; i < count; i++) {
      if (rng() > 0.55 - t * 0.2) continue;
      const x = Math.round(SUN_X + (rng() - 0.5) * spread * 2);
      const w = 2 + Math.round(rng() * (3 + t * 6));
      const c = t < 0.3 ? '#fbd97e' : t < 0.6 ? '#e69044' : '#c2624e';
      rect(ctx, x, y, w, 1, c);
    }
  }
  ctx.globalAlpha = 1;
  // the dam's reflection, smeared by the surface
  for (let row = 0; row < 5; row++) {
    const y = HORIZON + 2 + row * 5;
    if (y > VIEW_H) break;
    ctx.globalAlpha = 0.5 - row * 0.08;
    rect(ctx, 0, y, VIEW_W, 3, '#2c1d42');
    rect(ctx, 0, y, VIEW_W, 1, '#5b3a63');
    ctx.globalAlpha = 1;
    for (let x = 0; x < VIEW_W; x += 3) {
      if (rng() < 0.45) px(ctx, x + ((row * 2) % 3), y + 1, '#43284f');
    }
  }
  // the spillway's froth reflects brightest of all
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 26; i++) {
    const y = HORIZON + 1 + Math.round(rng() * 26);
    rect(ctx, 192 + Math.round(rng() * 22), y, 2 + Math.round(rng() * 5), 1, '#d6a08a');
  }
  ctx.globalAlpha = 1;

  // ripples further out
  for (let i = 0; i < 90; i++) {
    const y = HORIZON + Math.round(rng() * (VIEW_H - HORIZON));
    const x = Math.round(rng() * VIEW_W);
    const t = (y - HORIZON) / (VIEW_H - HORIZON);
    rect(ctx, x, y, 2 + Math.round(rng() * 4 * (1 + t)), 1, t < 0.4 ? '#6b4570' : '#3a2450');
  }

  // ---- foreground: a rock shelf on the near bank, in full silhouette
  const shelfTop = 214;
  for (let x = 0; x < 210; x++) {
    const wobble = Math.sin(x * 0.06) * 4 + Math.sin(x * 0.21) * 2;
    const top = Math.round(shelfTop + wobble + (x > 150 ? (x - 150) * 0.5 : 0));
    rect(ctx, x, top, 1, VIEW_H - top, '#150e28');
    px(ctx, x, top, x % 3 ? '#3a2450' : '#5b3a63');
  }
  // reeds framing the right-hand edge
  const reedRng = rngFrom(303);
  for (let i = 0; i < 22; i++) {
    const x = 330 + Math.round(reedRng() * 150);
    const h = 26 + Math.round(reedRng() * 34);
    const bend = reedRng() < 0.5 ? 1 : -1;
    for (let k = 0; k < h; k++) {
      const dx = Math.round((k / h) * (k / h) * 3) * bend;
      px(ctx, x + dx, VIEW_H - k, '#0d0819');
    }
    rect(ctx, x + bend * 2, VIEW_H - h - 4, 2, 5, '#0d0819');
  }
  // a couple of tufts on the left, breaking the shelf edge
  for (let i = 0; i < 14; i++) {
    const x = Math.round(reedRng() * 190);
    const h = 6 + Math.round(reedRng() * 10);
    for (let k = 0; k < h; k++) px(ctx, x + (k > h - 3 ? 1 : 0), shelfTop + 4 - k, '#0d0819');
  }

  return surf.canvas;
}

/**
 * The beaver itself: sitting on the shelf in profile, facing the dam. Drawn as
 * a flat silhouette in its own buffer, then rim-lit along the sunward edges.
 */
let beaverCache = null;

function paintBeaver() {
  const w = 84, h = 74;
  const surf = surface(w, h);
  const ctx = surf.ctx;
  const dark = '#150e28';
  const baseY = h - 3;
  const cx = 36;

  // Same build as the beaver you play: paddle tail, round body, big head with
  // a muzzle and buck teeth, one round ear, tool belt and a hard hat. Just
  // three times the size and lit from behind.

  // paddle tail, laid out flat behind
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const halfH = Math.round(7 - Math.abs(t - 0.5) * 5);
    rect(ctx, cx - 12 - i, baseY - 10 + Math.round(t * 7) - halfH, 1, halfH * 2, dark);
  }

  // haunch and body, sitting up
  disc(ctx, cx + 2, baseY - 17, 15, dark);
  disc(ctx, cx + 7, baseY - 24, 12, dark);
  rect(ctx, cx - 11, baseY - 20, 26, 18, dark);
  disc(ctx, cx + 13, baseY - 9, 7, dark);          // hind foot
  rect(ctx, cx + 6, baseY - 3, 14, 3, dark);

  // head: round skull, muzzle out to the right
  disc(ctx, cx + 16, baseY - 40, 11, dark);
  disc(ctx, cx + 26, baseY - 36, 7, dark);         // muzzle
  disc(ctx, cx + 9, baseY - 50, 4, dark);          // ear
  // buck teeth, the one bright detail on the whole silhouette
  rect(ctx, cx + 27, baseY - 31, 5, 4, '#f6c05c');
  rect(ctx, cx + 29, baseY - 31, 1, 4, '#c2624e');

  // front paw resting on the knee, holding nothing for once
  disc(ctx, cx + 15, baseY - 22, 5, dark);

  // tool belt
  rect(ctx, cx - 9, baseY - 20, 24, 3, dark);
  rect(ctx, cx + 2, baseY - 18, 4, 5, dark);

  // hard hat: brim then dome, the way the game sprite wears it
  rect(ctx, cx + 4, baseY - 50, 26, 4, dark);
  rect(ctx, cx + 9, baseY - 56, 15, 7, dark);
  disc(ctx, cx + 16, baseY - 55, 7, dark);

  rimLight(ctx, w, h, '#fbd97e', 1, -1, '#c2624e');

  // the eye catches the last of the sun
  px(ctx, cx + 21, baseY - 42, '#fff0b8');
  px(ctx, cx + 22, baseY - 42, '#f6c05c');
  // and a hot line along the top of the hat
  rect(ctx, cx + 10, baseY - 57, 13, 1, '#fff0b8');
  return surf.canvas;
}

function drawBeaver(ctx, t) {
  if (!beaverCache) beaverCache = paintBeaver();
  const breathe = Math.round(Math.sin(t * 1.3) * 1);
  ctx.drawImage(beaverCache, 74, 154 + breathe);

  // a felled log lying beside it on the shelf
  rect(ctx, 22, 218, 28, 7, '#1a1130');
  rect(ctx, 22, 218, 28, 1, '#4a2a52');
  px(ctx, 49, 219, '#e69044'); px(ctx, 49, 220, '#c2624e');
  disc(ctx, 23, 221, 2, '#241a3c');
  px(ctx, 23, 220, '#3a2450');
}

export function drawTitleScene(ctx, t) {
  if (!backdrop) backdrop = paintBackdrop();
  ctx.drawImage(backdrop, 0, 0);

  // drifting cloud bars, lit along their undersides
  const clouds = [[18, 46, 96, 3], [-40, 74, 150, 4], [250, 58, 120, 3], [180, 92, 90, 2]];
  clouds.forEach((c, i) => {
    const [cx, cy, cw, ch] = c;
    const x = Math.round((cx + t * (3 + i)) % (VIEW_W + 200)) - 100;
    rect(ctx, x, cy, cw, ch, '#3a2258');
    rect(ctx, x + 4, cy + ch, cw - 12, 1, '#a04a5c');
    rect(ctx, x + 10, cy - 1, cw - 30, 1, '#5b2a60');
    if (Math.abs(x + cw / 2 - SUN_X) < 120) {
      rect(ctx, x + Math.round(cw * 0.4), cy + ch, Math.round(cw * 0.3), 1, '#e69044');
    }
  });

  // a V of birds crossing in front of the sun
  const flockX = ((t * 13) % (VIEW_W + 120)) - 60;
  for (let i = 0; i < 5; i++) {
    const bx = Math.round(flockX - i * 9);
    const by = 74 + Math.abs(i - 2) * 5 + Math.round(Math.sin(t * 2 + i) * 2);
    ctx.drawImage(S.flyingBirdSprite(Math.floor(t * 7 + i) % 4), bx, by);
  }

  // the shimmer on the reflected column
  for (let i = 0; i < 22; i++) {
    const p = (t * 0.35 + i * 0.045) % 1;
    const y = HORIZON + Math.round(p * (VIEW_H - HORIZON));
    const spread = 6 + p * 44;
    const x = Math.round(SUN_X + Math.sin(t * 1.6 + i * 2.1) * spread);
    const w = 2 + Math.round(p * 6);
    rect(ctx, x, y, w, 1, p < 0.4 ? '#fff0b8' : '#f0a748');
  }

  drawBeaver(ctx, t);

  // fireflies over the near water
  for (let i = 0; i < 12; i++) {
    const fx = Math.round(40 + ((i * 71 + t * 6) % 400));
    const fy = Math.round(196 + Math.sin(t * 0.9 + i) * 12);
    if (Math.sin(t * 2 + i * 1.7) > 0.3) ctx.drawImage(S.fireflySprite(true), fx, fy);
  }

  // letterbox bars — the one bit of pure showmanship
  rect(ctx, 0, 0, VIEW_W, 7, PAL.black);
  rect(ctx, 0, VIEW_H - 7, VIEW_W, 7, PAL.black);

  // vignette
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 26; i++) {
    const a = i / 26;
    ctx.fillStyle = `rgba(10,6,20,${0.05 * (1 - a)})`;
    ctx.fillRect(i, 0, 1, VIEW_H);
    ctx.fillRect(VIEW_W - 1 - i, 0, 1, VIEW_H);
  }
  ctx.globalAlpha = 1;
}

export function drawTitleText(ctx, t) {
  const bob = Math.round(Math.sin(t * 1.1) * 1);
  bigText(ctx, 'DAM IT', 132, 34 + bob, 4, PAL.gold2, '#2c1d42');
  const sub = 'A BEAVER CONTRACTOR\'S TALE';
  rect(ctx, 132 - textWidth(sub) / 2 - 4, 66 + bob, textWidth(sub) + 8, 11, 'rgba(21,14,40,0.72)');
  text(ctx, sub, 132, 68 + bob, PAL.paper2, { align: 'center' });
}

export function invalidateTitle() { backdrop = null; }
