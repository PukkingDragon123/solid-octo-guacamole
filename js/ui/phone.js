// Your phone. Jobs come in on it, the internet sells you machines through it,
// and it is where you send money to the infirmary.

import { VIEW_W, VIEW_H } from '../config.js';
import { PAL, rect, frame, px, text, textWidth, disc, wrap } from '../gfx/pixel.js';
import { button, scrim, bar, hovering } from './widgets.js';
import { input, pressed } from '../input.js';
import { G } from '../state.js';
import { story, payBill, HOSPITAL_BILL, MATERIALS, tutorialDone, friendRank } from '../story.js';
import { NPCS, FURNITURE, acceptOffer, declineOffer, outstanding } from '../orders.js';
import { CATALOGUE, buy, owned, canBuy } from '../shop.js';
import { sfx } from '../audio.js';

export const phone = { open: false, tab: 'texts', scroll: 0 };

const TABS = [
  ['texts', 'TEXTS'], ['jobs', 'JOBS'], ['shop', 'SHOP'], ['bill', 'BILL'],
];

export function openPhone(tab) {
  phone.open = true;
  phone.tab = tab || (story().offers.length ? 'texts' : 'jobs');
  phone.scroll = 0;
  story().phone.unread = 0;
  sfx.click();
}

export function closePhone() { phone.open = false; }

/** Returns false once the player puts the phone down. */
export function drawPhone(ctx, t) {
  const s = story();
  scrim(ctx, VIEW_W, VIEW_H, 0.72);

  // ---- the handset
  const w = 250, h = 246, x = (VIEW_W - w) >> 1, y = (VIEW_H - h) >> 1;
  rect(ctx, x + 3, y + 4, w, h, 'rgba(0,0,0,0.4)');
  rect(ctx, x, y, w, h, '#22262e');
  frame(ctx, x, y, w, h, PAL.black);
  frame(ctx, x + 1, y + 1, w - 2, h - 2, '#3a404a');
  disc(ctx, x + (w >> 1), y + h - 9, 5, '#151820');
  rect(ctx, x + (w >> 1) - 12, y + 7, 24, 3, '#151820');

  // ---- screen
  const sx = x + 8, sy = y + 16, sw = w - 16, sh = h - 34;
  rect(ctx, sx, sy, sw, sh, '#101820');
  frame(ctx, sx, sy, sw, sh, '#0a0e12');

  // status bar
  rect(ctx, sx, sy, sw, 10, '#182430');
  text(ctx, `DAY ${G.day}`, sx + 4, sy + 2, PAL.sky3);
  text(ctx, `${s.money} ACORNS`, sx + sw - 4, sy + 2, PAL.gold2, { align: 'right' });

  // tabs
  const tw = Math.floor(sw / TABS.length);
  TABS.forEach(([id, label], i) => {
    const bx = sx + i * tw;
    const on = phone.tab === id;
    rect(ctx, bx, sy + 10, tw, 13, on ? '#2f4a5e' : '#1a2632');
    if (on) rect(ctx, bx, sy + 10, tw, 1, PAL.sky4);
    const badge = id === 'texts' && s.offers.length ? ` ${s.offers.length}` : '';
    text(ctx, label + badge, bx + tw / 2, sy + 13, on ? PAL.white : PAL.stone3, { align: 'center' });
    if (hovering(bx, sy + 10, tw, 13) && input.clicked) { phone.tab = id; phone.scroll = 0; sfx.click(); }
  });

  const body = { x: sx + 5, y: sy + 28, w: sw - 10, h: sh - 34 };
  if (phone.tab === 'texts') drawTexts(ctx, body, t);
  else if (phone.tab === 'jobs') drawJobs(ctx, body, t);
  else if (phone.tab === 'shop') drawShop(ctx, body, t);
  else drawBill(ctx, body, t);

  // ---- put it away
  if (button(ctx, x + (w >> 1) - 34, y + h - 16, 68, 12, 'E  POCKET') || pressed('KeyE', 'Escape')) {
    closePhone();
    return false;
  }
  if (input.wheel) phone.scroll = Math.max(0, phone.scroll + input.wheel);
  return true;
}

// ------------------------------------------------------------------- texts
function drawTexts(ctx, b, t) {
  const s = story();
  if (!s.offers.length) {
    text(ctx, 'NO NEW MESSAGES', b.x + b.w / 2, b.y + 30, PAL.stone2, { align: 'center' });
    text(ctx, 'WORD GETS ROUND. WAIT FOR MORNING.', b.x + b.w / 2, b.y + 44, PAL.stone1, { align: 'center' });
    return;
  }
  let cy = b.y;
  for (const offer of s.offers.slice(0, 3)) {
    const npc = NPCS[offer.npc];
    const lines = wrap(offer.text, b.w - 14);
    const h = 30 + lines.length * 8;
    // a chat bubble, tail on the left
    rect(ctx, b.x, cy, b.w, h, '#1d2b38');
    rect(ctx, b.x, cy, 2, h, npc.tone);
    disc(ctx, b.x + 9, cy + 9, 6, npc.tone);
    text(ctx, npc.name.toUpperCase(), b.x + 19, cy + 4, PAL.white);
    text(ctx, npc.job.toUpperCase(), b.x + 19 + textWidth(npc.name) + 8, cy + 4, PAL.stone2);
    lines.forEach((ln, i) => text(ctx, ln, b.x + 6, cy + 15 + i * 8, PAL.sky3));
    text(ctx, `${offer.pay} ACORNS`, b.x + b.w - 4, cy + 4, PAL.gold2, { align: 'right' });
    const by = cy + h - 13;
    if (button(ctx, b.x + 4, by, 52, 11, 'ACCEPT')) {
      acceptOffer(offer);
      tutorialDone('phone');
      sfx.good();
      return;
    }
    if (button(ctx, b.x + 60, by, 44, 11, 'LATER')) { declineOffer(offer); sfx.click(); return; }
    cy += h + 4;
    if (cy > b.y + b.h - 20) break;
  }
}

// -------------------------------------------------------------------- jobs
function drawJobs(ctx, b, t) {
  const s = story();
  if (!s.orders.length) {
    text(ctx, 'NOTHING ON THE BOOKS', b.x + b.w / 2, b.y + 30, PAL.stone2, { align: 'center' });
    return;
  }
  let cy = b.y;
  for (const order of s.orders) {
    const npc = NPCS[order.npc];
    const need = outstanding(order);
    const h = 34;
    rect(ctx, b.x, cy, b.w, h, '#1d2b38');
    rect(ctx, b.x, cy, 2, h, npc.tone);
    text(ctx, `${npc.name.toUpperCase()} - ${npc.site.toUpperCase()}`, b.x + 6, cy + 3, PAL.white);
    const items = order.wants.map((id) => FURNITURE[id].name.toUpperCase()).join(', ');
    wrap(items, b.w - 12).slice(0, 1).forEach((ln, i) => text(ctx, ln, b.x + 6, cy + 13 + i * 8, PAL.sky3));
    text(ctx, need.length ? `${need.length} STILL TO BUILD` : 'READY TO FIT', b.x + 6, cy + 23,
         need.length ? PAL.gold2 : PAL.grass4);
    text(ctx, `${order.pay}`, b.x + b.w - 4, cy + 3, PAL.gold2, { align: 'right' });
    if (order.repair) text(ctx, '+ REPAIR', b.x + b.w - 4, cy + 23, PAL.purple2, { align: 'right' });
    cy += h + 3;
    if (cy > b.y + b.h - 10) break;
  }
}

// -------------------------------------------------------------------- shop
function drawShop(ctx, b, t) {
  const s = story();
  const rows = 4;
  const rowH = Math.floor((b.h - 12) / rows);
  const max = Math.max(0, CATALOGUE.length - rows);
  const start = Math.max(0, Math.min(max, Math.floor(phone.scroll / 12)));
  text(ctx, 'VALLEY.NET - TOOLS AND WORKERS', b.x + b.w / 2, b.y - 8, PAL.stone2, { align: 'center' });
  for (let i = 0; i < rows; i++) {
    const item = CATALOGUE[start + i];
    if (!item) break;
    const cy = b.y + 4 + i * rowH;
    const have = owned(item.id);
    rect(ctx, b.x, cy, b.w, rowH - 3, '#1d2b38');
    text(ctx, item.name.toUpperCase(), b.x + 5, cy + 3, have ? PAL.grass4 : PAL.white);
    text(ctx, `${item.price}`, b.x + b.w - 5, cy + 3, s.money >= item.price ? PAL.gold2 : PAL.red2, { align: 'right' });
    wrap(item.blurb, b.w - 62).slice(0, 2).forEach((ln, k) => text(ctx, ln, b.x + 5, cy + 13 + k * 7, PAL.stone3));
    const full = item.max && have >= item.max;
    if (button(ctx, b.x + b.w - 46, cy + rowH - 16, 42, 11, full ? 'OWNED' : 'BUY',
               { enabled: !full && s.money >= item.price })) {
      if (buy(item)) sfx.cash();
    }
    if (have && item.kind !== 'stock') text(ctx, `x${have}`, b.x + b.w - 52, cy + 3, PAL.grass4, { align: 'right' });
  }
  if (CATALOGUE.length > rows) {
    text(ctx, 'SCROLL FOR MORE', b.x + b.w / 2, b.y + b.h - 6, PAL.stone1, { align: 'center' });
  }
}

// -------------------------------------------------------------------- bill
function drawBill(ctx, b, t) {
  const s = story();
  text(ctx, 'VALLEY INFIRMARY', b.x + b.w / 2, b.y + 2, PAL.white, { align: 'center' });
  text(ctx, 'ACCOUNT: MARGUERITE', b.x + b.w / 2, b.y + 12, PAL.stone2, { align: 'center' });
  const paid = 1 - s.debt / HOSPITAL_BILL;
  bar(ctx, b.x + 8, b.y + 26, b.w - 16, 8, paid, PAL.grass3);
  text(ctx, `${s.paidTotal} PAID`, b.x + 8, b.y + 38, PAL.grass4);
  text(ctx, `${s.debt} OWING`, b.x + b.w - 8, b.y + 38, PAL.red2, { align: 'right' });

  if (s.debt <= 0) {
    text(ctx, 'PAID IN FULL', b.x + b.w / 2, b.y + 58, PAL.gold2, { align: 'center' });
    text(ctx, 'SHE IS COMING HOME.', b.x + b.w / 2, b.y + 70, PAL.paper, { align: 'center' });
    // a little heart, because it has been earned
    for (const [dx, dy] of [[0, 0], [4, 0], [-4, 0], [0, 4], [2, 6], [-2, 6], [0, 8]]) {
      rect(ctx, b.x + b.w / 2 + dx - 1, b.y + 84 + dy, 3, 3, PAL.red2);
    }
    return;
  }

  const amounts = [100, 250, 500];
  amounts.forEach((amount, i) => {
    if (button(ctx, b.x + 6 + i * 56, b.y + 52, 52, 13, `PAY ${amount}`,
               { enabled: s.money >= Math.min(amount, s.debt) })) {
      if (payBill(amount)) sfx.cash();
    }
  });
  if (button(ctx, b.x + 6, b.y + 70, 108, 13, 'PAY EVERYTHING',
             { enabled: s.money > 0 })) {
    if (payBill(s.money)) sfx.cash();
  }
  text(ctx, 'PAY WHAT YOU CAN, WHEN YOU CAN.', b.x + b.w / 2, b.y + 92, PAL.stone2, { align: 'center' });
  // friendships, since this is the other ledger that matters
  text(ctx, 'FRIENDS', b.x + 6, b.y + 106, PAL.gold2);
  let cy = b.y + 116;
  for (const id of Object.keys(s.friendship)) {
    const npc = NPCS[id];
    if (!npc) continue;
    text(ctx, npc.name.toUpperCase(), b.x + 6, cy, PAL.sky3);
    for (let i = 0; i < 5; i++) {
      rect(ctx, b.x + 70 + i * 6, cy + 1, 4, 4, i < friendRank(id) ? PAL.red2 : '#2a3644');
    }
    text(ctx, npc.job.toUpperCase(), b.x + b.w - 4, cy, PAL.stone2, { align: 'right' });
    cy += 9;
    if (cy > b.y + b.h - 4) break;
  }
}
