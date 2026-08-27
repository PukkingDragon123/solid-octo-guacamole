// Furniture art, in one place, because the same piece has to look like itself
// on the assembly bench, in the van, and standing in a customer's room.
//
// Every piece is drawn from a base point (x, floor y) and can be drawn
// part-built: `built` 0..1 reveals the parts in fitting order.

import { PAL, rect, frame, px, line, disc } from './pixel.js';

const WOOD = { face: PAL.wood3, top: PAL.wood4, side: PAL.wood2, dark: PAL.wood1, edge: PAL.wood0 };

/** A board with a lit top face - the trick that makes flat pixels read solid. */
function board(ctx, x, y, w, h, tone = WOOD) {
  rect(ctx, x, y, w, h, tone.face);
  rect(ctx, x, y, w, 1, tone.top);
  rect(ctx, x, y + h - 1, w, 1, tone.dark);
  frame(ctx, x, y, w, h, tone.edge);
}

/** A board seen in shallow perspective: front face plus a sliver of top. */
function slab(ctx, x, y, w, h, depth = 3, tone = WOOD) {
  for (let i = 0; i < depth; i++) {
    rect(ctx, x + depth - i, y - i - 1, w, 1, i === depth - 1 ? tone.top : tone.side);
  }
  board(ctx, x, y, w, h, tone);
}

const PIECES = {
  stool(ctx, x, y, s) {
    slab(ctx, x - 11 * s, y - 13 * s, 22 * s, 4 * s, 2 * s);
    for (const dx of [-9, 5]) board(ctx, x + dx * s, y - 9 * s, 3 * s, 9 * s);
    board(ctx, x - 2 * s, y - 9 * s, 3 * s, 9 * s);
  },
  chair(ctx, x, y, s) {
    board(ctx, x - 9 * s, y - 26 * s, 3 * s, 18 * s);              // back post
    board(ctx, x - 7 * s, y - 24 * s, 15 * s, 3 * s);              // top rail
    board(ctx, x - 7 * s, y - 18 * s, 15 * s, 2 * s);
    slab(ctx, x - 11 * s, y - 12 * s, 22 * s, 4 * s, 2 * s);       // seat
    for (const dx of [-9, 6]) board(ctx, x + dx * s, y - 8 * s, 3 * s, 8 * s);
  },
  table(ctx, x, y, s) {
    slab(ctx, x - 22 * s, y - 16 * s, 44 * s, 4 * s, 3 * s);
    rect(ctx, x - 20 * s, y - 12 * s, 40 * s, 2 * s, WOOD.side);   // apron
    for (const dx of [-19, 15]) board(ctx, x + dx * s, y - 10 * s, 4 * s, 10 * s);
    for (const dx of [-13, 9]) board(ctx, x + dx * s, y - 10 * s, 3 * s, 10 * s);
  },
  bed(ctx, x, y, s) {
    board(ctx, x - 24 * s, y - 26 * s, 5 * s, 26 * s);             // headboard
    board(ctx, x - 24 * s, y - 26 * s, 20 * s, 6 * s);
    rect(ctx, x - 22 * s, y - 12 * s, 46 * s, 4 * s, WOOD.side);   // rails
    slab(ctx, x - 20 * s, y - 14 * s, 42 * s, 3 * s, 2 * s);
    rect(ctx, x - 19 * s, y - 17 * s, 38 * s, 4 * s, PAL.paper2);  // bedding
    rect(ctx, x - 19 * s, y - 17 * s, 38 * s, 1 * s, PAL.white);
    rect(ctx, x - 19 * s, y - 20 * s, 12 * s, 4 * s, PAL.pink);    // pillow
    board(ctx, x + 20 * s, y - 10 * s, 4 * s, 10 * s);
  },
  shelf(ctx, x, y, s) {
    board(ctx, x - 14 * s, y - 40 * s, 3 * s, 40 * s);
    board(ctx, x + 11 * s, y - 40 * s, 3 * s, 40 * s);
    rect(ctx, x - 12 * s, y - 39 * s, 23 * s, 38 * s, PAL.wood1);
    for (let i = 0; i < 3; i++) slab(ctx, x - 12 * s, y - (12 + i * 12) * s, 23 * s, 3 * s, 2 * s);
    for (let i = 0; i < 5; i++) {   // books
      rect(ctx, x - 10 * s + i * 4 * s, y - 20 * s, 3 * s, 8 * s,
           [PAL.red, PAL.blue, PAL.gold, PAL.purple, PAL.grass2][i]);
    }
  },
  wardrobe(ctx, x, y, s) {
    rect(ctx, x - 18 * s, y - 44 * s, 36 * s, 44 * s, PAL.wood1);
    frame(ctx, x - 18 * s, y - 44 * s, 36 * s, 44 * s, PAL.wood0);
    slab(ctx, x - 20 * s, y - 46 * s, 40 * s, 3 * s, 2 * s);
    board(ctx, x - 17 * s, y - 41 * s, 16 * s, 40 * s);
    board(ctx, x + 1 * s, y - 41 * s, 16 * s, 40 * s);
    px(ctx, x - 3 * s, y - 22 * s, PAL.gold2);
    px(ctx, x + 3 * s, y - 22 * s, PAL.gold2);
  },
  cradle(ctx, x, y, s) {
    for (const dx of [-14, 10]) {
      for (let i = 0; i < 5; i++) px(ctx, x + dx * s + i, y - 2 * s - Math.round(i / 2), PAL.wood1);
    }
    rect(ctx, x - 15 * s, y - 4 * s, 30 * s, 3 * s, WOOD.dark);     // rockers
    board(ctx, x - 14 * s, y - 14 * s, 28 * s, 10 * s);
    rect(ctx, x - 12 * s, y - 16 * s, 24 * s, 3 * s, PAL.cloth || PAL.paper2);
    board(ctx, x - 14 * s, y - 22 * s, 10 * s, 9 * s);              // hood
    rect(ctx, x - 12 * s, y - 20 * s, 6 * s, 5 * s, PAL.pink);
  },
  desk(ctx, x, y, s) {
    slab(ctx, x - 20 * s, y - 18 * s, 40 * s, 4 * s, 3 * s);
    rect(ctx, x - 18 * s, y - 14 * s, 22 * s, 8 * s, PAL.wood1);    // drawer
    frame(ctx, x - 18 * s, y - 14 * s, 22 * s, 8 * s, PAL.wood0);
    rect(ctx, x - 9 * s, y - 11 * s, 5 * s, 2 * s, PAL.stone3);
    for (const dx of [-19, 15]) board(ctx, x + dx * s, y - 12 * s, 4 * s, 12 * s);
    rect(ctx, x - 6 * s, y - 22 * s, 12 * s, 4 * s, PAL.sky3);      // glass top piece
  },
  window(ctx, x, y, s) {
    rect(ctx, x - 14 * s, y - 30 * s, 28 * s, 26 * s, PAL.sky3);
    rect(ctx, x - 14 * s, y - 30 * s, 28 * s, 8 * s, PAL.sky4);
    frame(ctx, x - 15 * s, y - 31 * s, 30 * s, 28 * s, PAL.wood2);
    frame(ctx, x - 16 * s, y - 32 * s, 32 * s, 30 * s, PAL.wood0);
    rect(ctx, x - 1 * s, y - 30 * s, 2 * s, 26 * s, PAL.wood2);
    rect(ctx, x - 14 * s, y - 18 * s, 28 * s, 2 * s, PAL.wood2);
    px(ctx, x + 8 * s, y - 6 * s, PAL.stone3);
  },
  loom(ctx, x, y, s) {
    board(ctx, x - 18 * s, y - 42 * s, 4 * s, 42 * s);
    board(ctx, x + 14 * s, y - 42 * s, 4 * s, 42 * s);
    slab(ctx, x - 18 * s, y - 44 * s, 36 * s, 3 * s, 2 * s);
    rect(ctx, x - 14 * s, y - 38 * s, 28 * s, 2 * s, WOOD.dark);
    for (let i = 0; i < 10; i++) {   // warp threads
      rect(ctx, x - 13 * s + i * 3 * s, y - 36 * s, 1, 24 * s, i % 2 ? PAL.paper2 : PAL.pink);
    }
    rect(ctx, x - 14 * s, y - 20 * s, 28 * s, 3 * s, PAL.wood2);
    board(ctx, x - 8 * s, y - 6 * s, 16 * s, 3 * s);                // treadle
  },
  nestbox(ctx, x, y, s) {
    rect(ctx, x - 8 * s, y - 16 * s, 16 * s, 16 * s, PAL.wood2);
    frame(ctx, x - 8 * s, y - 16 * s, 16 * s, 16 * s, PAL.wood0);
    rect(ctx, x - 10 * s, y - 20 * s, 20 * s, 5 * s, PAL.wood1);
    rect(ctx, x - 10 * s, y - 20 * s, 20 * s, 2 * s, PAL.wood3);
    disc(ctx, x, y - 10 * s, 3 * s, PAL.wood0);
    rect(ctx, x - 1 * s, y - 5 * s, 4 * s, 2 * s, PAL.wood4);       // perch
  },
  deck(ctx, x, y, s) {
    for (let i = 0; i < 7; i++) board(ctx, x - 22 * s + i * 6 * s, y - 8 * s, 5 * s, 3 * s);
    rect(ctx, x - 22 * s, y - 5 * s, 44 * s, 3 * s, WOOD.dark);
    for (const dx of [-20, 16]) board(ctx, x + dx * s, y - 2 * s, 4 * s, 2 * s);
    board(ctx, x - 22 * s, y - 20 * s, 3 * s, 13 * s);              // rail
    board(ctx, x + 19 * s, y - 20 * s, 3 * s, 13 * s);
    rect(ctx, x - 22 * s, y - 20 * s, 44 * s, 2 * s, WOOD.face);
  },
};

/**
 * Draw a piece. opts: { scale, built (0..1), screwed (0..1), quality, ghost }.
 * A part-built piece is clipped from the floor up, so it grows as it is made.
 */
export function drawFurniture(ctx, id, x, y, opts = {}) {
  const draw = PIECES[id] || PIECES.stool;
  const s = opts.scale || 1;
  if (opts.ghost) {
    ctx.globalAlpha = 0.35;
    draw(ctx, x, y, s);
    ctx.globalAlpha = 1;
    return;
  }
  const built = opts.built === undefined ? 1 : opts.built;
  if (built >= 1) {
    draw(ctx, x, y, s);
  } else {
    // reveal from the ground up as parts go on
    const h = 48 * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 30 * s, y - Math.round(h * built), 60 * s, Math.round(h * built) + 2);
    ctx.clip();
    draw(ctx, x, y, s);
    ctx.restore();
    // the outline of what is still to come
    ctx.globalAlpha = 0.18;
    draw(ctx, x, y, s);
    ctx.globalAlpha = 1;
  }
  // fixings, appearing as they are driven
  if (opts.screwed) {
    const n = Math.round(opts.screwed * 6);
    for (let i = 0; i < n; i++) {
      px(ctx, x - 14 * s + i * 6 * s, y - 12 * s, PAL.stone3);
    }
  }
}

export const FURNITURE_ART = PIECES;
