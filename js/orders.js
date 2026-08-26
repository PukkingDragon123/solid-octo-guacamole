// Customers, the things they want built, and the jobs that flow between them.
//
// A job starts as a text on your phone, becomes an order once you accept, gets
// its furniture built at the bench, and closes when you fly it out and fit it.

import { G, toast } from './state.js';
import { story, addFriendship, earn, addMaterial, friendRank } from './story.js';

/**
 * Everyone in the valley has a trade of their own, and pays you partly in what
 * that trade produces - that is how a workshop gets glass without a furnace.
 */
export const NPCS = {
  willow:  { id: 'willow',  name: 'Willow',  species: 'otter',    job: 'River Fisher',
             site: 'Willow Bend',   tone: '#84552c', gift: { hardwood: 2 },
             hello: 'You came all this way. Sit, sit - mind the wet.' },
  bramble: { id: 'bramble', name: 'Bramble', species: 'hedgehog',  job: 'Baker',
             site: 'Bramble Row',   tone: '#a3703f', gift: { cloth: 2 },
             hello: 'Smells better in here since I got the oven going.' },
  pip:     { id: 'pip',     name: 'Pip',     species: 'squirrel',  job: 'Seed Miller',
             site: 'Pip\'s Mill',   tone: '#a8541f', gift: { screw: 8 },
             hello: 'Careful of the sacks. Everything here is sacks.' },
  quill:   { id: 'quill',   name: 'Quill',   species: 'hedgehog',  job: 'Blacksmith',
             site: 'The Forge',     tone: '#6d7783', gift: { screw: 14 },
             hello: 'Hot in here. Stand where I can see you.' },
  marsh:   { id: 'marsh',   name: 'Marsh',   species: 'frog',      job: 'Glassblower',
             site: 'Marsh Hollow',  tone: '#40853c', gift: { glass: 3 },
             hello: 'Do not breathe on the shelves. Please.' },
  juniper: { id: 'juniper', name: 'Juniper', species: 'rabbit',    job: 'Weaver',
             site: 'Juniper Field', tone: '#d7bd8d', gift: { cloth: 4 },
             hello: 'I have got a loom with a broken heart. Can you look?' },
  cobb:    { id: 'cobb',    name: 'Cobb',    species: 'turtle',    job: 'Quarryman',
             site: 'Cobb\'s Cut',   tone: '#2d6330', gift: { hardwood: 4, glass: 1 },
             hello: 'Slow down. Nothing in a quarry is in a hurry.' },
};

export const NPC_IDS = Object.keys(NPCS);

/**
 * Furniture. `parts` drives the assembly bench: each part is fitted in order,
 * and `screws` is how many fixings it takes once the parts are together.
 */
export const FURNITURE = {
  stool:     { id: 'stool',     name: 'Stool',        mats: { plank: 2, screw: 3 },
               parts: ['seat', 'leg', 'leg', 'leg'], screws: 3, pay: 45,  size: [1, 1] },
  chair:     { id: 'chair',     name: 'Chair',        mats: { plank: 3, screw: 4 },
               parts: ['seat', 'back', 'leg', 'leg'], screws: 4, pay: 70, size: [1, 1] },
  table:     { id: 'table',     name: 'Table',        mats: { plank: 4, hardwood: 1, screw: 6 },
               parts: ['top', 'apron', 'leg', 'leg', 'leg', 'leg'], screws: 6, pay: 130, size: [2, 1] },
  bed:       { id: 'bed',       name: 'Bed Frame',    mats: { plank: 5, hardwood: 2, screw: 8, cloth: 2 },
               parts: ['headboard', 'rail', 'rail', 'slats'], screws: 8, pay: 210, size: [2, 2] },
  shelf:     { id: 'shelf',     name: 'Bookshelf',    mats: { plank: 5, screw: 6 },
               parts: ['side', 'side', 'shelf', 'shelf', 'back'], screws: 6, pay: 160, size: [1, 2] },
  wardrobe:  { id: 'wardrobe',  name: 'Wardrobe',     mats: { plank: 6, hardwood: 2, screw: 9 },
               parts: ['side', 'side', 'door', 'door', 'top'], screws: 9, pay: 250, size: [2, 2] },
  cradle:    { id: 'cradle',    name: 'Cradle',       mats: { plank: 3, cloth: 2, screw: 4 },
               parts: ['rocker', 'rocker', 'basket', 'hood'], screws: 4, pay: 175, size: [1, 1] },
  desk:      { id: 'desk',      name: 'Writing Desk', mats: { plank: 4, hardwood: 1, glass: 1, screw: 7 },
               parts: ['top', 'drawer', 'leg', 'leg'], screws: 7, pay: 195, size: [2, 1] },
  window:    { id: 'window',    name: 'Window Frame', mats: { plank: 2, glass: 2, screw: 4 },
               parts: ['frame', 'pane', 'pane', 'catch'], screws: 4, pay: 120, size: [1, 1] },
  loom:      { id: 'loom',      name: 'Loom',         mats: { hardwood: 3, plank: 2, cloth: 1, screw: 8 },
               parts: ['upright', 'upright', 'beam', 'treadle'], screws: 8, pay: 280, size: [2, 2] },
  nestbox:   { id: 'nestbox',   name: 'Nest Box',     mats: { plank: 2, screw: 2 },
               parts: ['box', 'roof', 'perch'], screws: 2, pay: 60, size: [1, 1] },
  deck:      { id: 'deck',      name: 'Bank Deck',    mats: { plank: 4, hardwood: 2, screw: 6 },
               parts: ['joist', 'joist', 'boards', 'rail'], screws: 6, pay: 165, size: [2, 1] },
};

export const FURNITURE_IDS = Object.keys(FURNITURE);

/** Habitat repairs a site can ask for on top of the furniture. */
export const REPAIRS = {
  roof:   { id: 'roof',   name: 'Patch the roof',    mats: { plank: 2, screw: 2 } },
  bank:   { id: 'bank',   name: 'Shore up the bank', mats: { hardwood: 2, plank: 1 } },
  door:   { id: 'door',   name: 'Rehang the door',   mats: { plank: 1, screw: 3 } },
  pane:   { id: 'pane',   name: 'Reglaze a pane',    mats: { glass: 1, screw: 1 } },
};

let orderSeq = 1;

/** A text message offering work. Small early on, bigger as friendships grow. */
export function makeOffer(npcId, opts = {}) {
  const npc = NPCS[npcId];
  const rank = friendRank(npcId);
  const pool = opts.pool || (rank >= 3
    ? ['bed', 'wardrobe', 'loom', 'desk', 'shelf', 'table']
    : rank >= 1 ? ['chair', 'table', 'shelf', 'cradle', 'window', 'deck']
                : ['stool', 'chair', 'nestbox', 'window']);
  const wants = [];
  const count = opts.count || (rank >= 2 ? 2 : 1);
  for (let i = 0; i < count; i++) {
    const id = pool[Math.floor(G.rng() * pool.length) % pool.length];
    wants.push(id);
  }
  const repairKeys = Object.keys(REPAIRS);
  const repair = opts.repair !== undefined ? opts.repair
    : (G.rng() < 0.5 ? repairKeys[Math.floor(G.rng() * repairKeys.length) % repairKeys.length] : null);
  const pay = wants.reduce((sum, id) => sum + FURNITURE[id].pay, 0) + (repair ? 55 : 0);
  return {
    id: orderSeq++,
    npc: npcId,
    wants,
    repair,
    pay: Math.round(pay * (1 + rank * 0.08)),
    text: opts.text || pickText(npc, wants, repair),
    day: G.day,
    state: 'offer',
    built: [],       // furniture ids already crafted for this order
    placed: [],      // ids fitted at the site
    repaired: false,
  };
}

function pickText(npc, wants, repair) {
  const list = wants.map((id) => FURNITURE[id].name.toUpperCase()).join(' AND A ');
  const lines = [
    `HI - ${npc.name.toUpperCase()} HERE. NEED A ${list}. CAN YOU DO IT?`,
    `${npc.name.toUpperCase()}: MY OLD ${list} FINALLY GAVE UP. HELP?`,
    `HEARD YOU TOOK OVER THE WORKSHOP. I WANT A ${list}.`,
  ];
  const base = lines[Math.floor(G.rng() * lines.length) % lines.length];
  return repair ? `${base} ALSO ${REPAIRS[repair].name.toUpperCase()}?` : base;
}

/** Drop a new text on the phone, if there is room for one. */
export function pushOffer(offer) {
  const s = story();
  if (s.offers.length >= 4) s.offers.shift();
  s.offers.push(offer);
  s.phone.unread++;
  toast(`PHONE: NEW JOB FROM ${NPCS[offer.npc].name.toUpperCase()}`, 'info');
}

/** Called each dawn: the valley remembers you and rings again. */
export function dailyOffers() {
  const s = story();
  if (s.beat !== 'open') return;
  const unlocked = NPC_IDS.filter((id) => s.unlocked[id]);
  const pool = unlocked.length ? unlocked : ['willow'];
  const rolls = 1 + (s.completed >= 4 ? 1 : 0);
  for (let i = 0; i < rolls; i++) {
    if (s.orders.length + s.offers.length >= 5) break;
    const npc = pool[Math.floor(G.rng() * pool.length) % pool.length];
    pushOffer(makeOffer(npc));
  }
  // A new name hears about you every few jobs.
  const locked = NPC_IDS.filter((id) => !s.unlocked[id]);
  if (locked.length && s.completed >= 2 && s.completed % 2 === 0 && G.rng() < 0.8) {
    const id = locked[0];
    s.unlocked[id] = true;
    pushOffer(makeOffer(id, { text: `${NPCS[id].name.toUpperCase()} HERE - ${NPCS[id].job.toUpperCase()} AT ${NPCS[id].site.toUpperCase()}. ${NPCS[id].name.toUpperCase()} NEEDS YOU.` }));
    toast(`${NPCS[id].site.toUpperCase()} IS ON THE MAP NOW`, 'good');
  }
}

export function acceptOffer(offer) {
  const s = story();
  const i = s.offers.indexOf(offer);
  if (i >= 0) s.offers.splice(i, 1);
  offer.state = 'open';
  s.orders.push(offer);
  s.unlocked[offer.npc] = true;
  toast(`JOB TAKEN - ${NPCS[offer.npc].name.toUpperCase()}, ${offer.pay} ACORNS`, 'good');
  return offer;
}

export function declineOffer(offer) {
  const s = story();
  const i = s.offers.indexOf(offer);
  if (i >= 0) s.offers.splice(i, 1);
}

/** What still needs building for this order? */
export function outstanding(order) {
  const need = order.wants.slice();
  for (const id of order.built) {
    const at = need.indexOf(id);
    if (at >= 0) need.splice(at, 1);
  }
  return need;
}

/** Anything crafted goes in the van; match it to an order when it is made. */
export function creditBuild(furnitureId, quality) {
  const s = story();
  s.furniture.push({ id: furnitureId, quality });
  for (const order of s.orders) {
    if (outstanding(order).includes(furnitureId)) { order.built.push(furnitureId); break; }
  }
  s.stats.crafted++;
}

/** Take a finished piece out of the van (used when fitting it at a site). */
export function takeFurniture(furnitureId) {
  const s = story();
  const i = s.furniture.findIndex((f) => f.id === furnitureId);
  return i >= 0 ? s.furniture.splice(i, 1)[0] : null;
}

export const readyFor = (order) => order.wants.every((id) => story().furniture.some((f) => f.id === id)
  || order.placed.includes(id));

/** Everything fitted, repair done: close the job and get paid. */
export function completeOrder(order, quality) {
  const s = story();
  const i = s.orders.indexOf(order);
  if (i >= 0) s.orders.splice(i, 1);
  const npc = NPCS[order.npc];
  const bonus = Math.round(order.pay * 0.25 * quality);
  earn(order.pay + bonus, `${npc.name} paid up`);
  const points = 2 + Math.round(quality * 3);
  addFriendship(order.npc, points);
  for (const k in npc.gift) addMaterial(k, npc.gift[k] * (1 + friendRank(order.npc)));
  s.completed++;
  s.stats.delivered++;
  order.state = 'done';
  toast(`${npc.name.toUpperCase()} IS DELIGHTED - +${points} FRIENDSHIP`, 'good');
  return { pay: order.pay + bonus, points };
}
