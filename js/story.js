// The campaign: grandma's hospital bill, the debt that hangs over it, the money
// and materials you earn paying it off, and the friendships you make on the way.
//
// Everything the story needs lives in `G.story` so it rides along in the save.

import { G, toast, logMsg } from './state.js';

/** The bill. Every acorn you earn is measured against it. */
export const HOSPITAL_BILL = 4800;

/** Materials you actually hold in the workshop, as opposed to camp stores. */
export const MATERIALS = {
  plank:    { name: 'Planks',    icon: 'plank',  tone: '#c99a5f' },
  hardwood: { name: 'Hardwood',  icon: 'log',    tone: '#7a4e29' },
  screw:    { name: 'Screws',    icon: 'screw',  tone: '#98a2ad' },
  cloth:    { name: 'Cloth',     icon: 'cloth',  tone: '#e08bab' },
  glass:    { name: 'Glass',     icon: 'glass',  tone: '#8fd6f0' },
};

export const CHAPTERS = [
  'THE NIGHT OF THE CRASH',
  'GRANDPA\'S WORKSHOP',
  'OPEN FOR BUSINESS',
  'THE VALLEY KNOWS YOUR NAME',
];

export function freshStory() {
  return {
    chapter: 0,
    beat: 'intro',              // intro -> tutorial -> open
    seenIntro: false,
    tutorial: 0,                // index into TUTORIAL below, -1 once finished
    debt: HOSPITAL_BILL,
    money: 120,                 // what was in the tin by the door
    paidTotal: 0,
    lastPaymentDay: 1,
    materials: { plank: 4, hardwood: 2, screw: 12, cloth: 2, glass: 1 },
    furniture: [],              // finished pieces, waiting to be delivered
    orders: [],                 // live jobs
    offers: [],                 // texts waiting on the phone
    completed: 0,
    friendship: {},             // npcId -> points
    unlocked: { willow: true }, // map sites you may fly to
    machines: {},               // shop id -> count
    robots: [],
    stats: { felled: 0, planed: 0, crafted: 0, delivered: 0, blackouts: 0, perfect: 0 },
    phone: { tab: 'texts', unread: 0 },
    grandpaLine: 0,
  };
}

export function story() {
  if (!G.story) G.story = freshStory();
  return G.story;
}

// ------------------------------------------------------------------ money
export function earn(amount, why) {
  const s = story();
  s.money += amount;
  if (why) toast(`+${amount} ACORNS - ${why}`, 'good');
  return s.money;
}

export function spendMoney(amount) {
  const s = story();
  if (s.money < amount) return false;
  s.money -= amount;
  return true;
}

/** Put money against the bill. Returns how much actually went through. */
export function payBill(amount) {
  const s = story();
  const pay = Math.max(0, Math.min(Math.min(amount, s.money), s.debt));
  if (pay <= 0) return 0;
  s.money -= pay;
  s.debt -= pay;
  s.paidTotal += pay;
  s.lastPaymentDay = G.day;
  logMsg(`Paid ${pay} acorns to the hospital. ${s.debt} left.`, 'good');
  if (s.debt <= 0) {
    s.debt = 0;
    toast('THE BILL IS PAID. GRANDMA IS COMING HOME.', 'good');
    s.chapter = 3;
  } else {
    toast(`PAID ${pay} - ${s.debt} STILL OWING`, 'good');
  }
  return pay;
}

export const debtFraction = () => 1 - story().debt / HOSPITAL_BILL;

// -------------------------------------------------------------- materials
export function haveMaterials(cost) {
  const m = story().materials;
  for (const k in cost) if ((m[k] || 0) < cost[k]) return false;
  return true;
}

export function takeMaterials(cost) {
  if (!haveMaterials(cost)) return false;
  const m = story().materials;
  for (const k in cost) m[k] -= cost[k];
  return true;
}

export function addMaterial(kind, amount) {
  const m = story().materials;
  m[kind] = (m[kind] || 0) + amount;
  return m[kind];
}

export function missingMaterials(cost) {
  const m = story().materials;
  const out = [];
  for (const k in cost) {
    const short = cost[k] - (m[k] || 0);
    if (short > 0) out.push(`${short} ${MATERIALS[k] ? MATERIALS[k].name : k}`);
  }
  return out.join(', ');
}

// ------------------------------------------------------------- friendship
export function addFriendship(npcId, points) {
  const s = story();
  s.friendship[npcId] = (s.friendship[npcId] || 0) + points;
  return s.friendship[npcId];
}

export const friendshipOf = (npcId) => story().friendship[npcId] || 0;
export const friendRank = (npcId) => Math.min(5, Math.floor(friendshipOf(npcId) / 3));

// -------------------------------------------------------------- tutorial
// Grandpa walks you through the whole loop once, in the order you will use it.
export const TUTORIAL = [
  { id: 'phone',   where: 'workshop', tip: 'ANSWER THE PHONE - TAKE THE JOB',
    line: 'That will be work. Nobody rings a workshop to chat.' },
  { id: 'forest',  where: 'workshop', tip: 'OUT THE BACK DOOR - GO AND FELL A TREE',
    line: 'No wood, no furniture. The trees are out back. Listen to them.' },
  { id: 'fell',    where: 'forest',   tip: 'CHOP - THEN MOVE WHEN IT CREAKS',
    line: 'A tree tells you before it falls. Ignore it and you wake up in the leaves.' },
  { id: 'saw',     where: 'workshop', tip: 'AT THE SAW BENCH - RIP THE LOG INTO PLANKS',
    line: 'Follow the line. Slow hands, straight cut.' },
  { id: 'craft',   where: 'workshop', tip: 'AT THE ASSEMBLY BENCH - BUILD THE ORDER',
    line: 'Screws by hand. A machine cannot feel when it is tight.' },
  { id: 'deliver', where: 'workshop', tip: 'AT THE MAP - THE HERON WILL FLY YOU OUT',
    line: 'Take it to them yourself. That is the whole trick of this trade.' },
];

export function tutorialStep() {
  const s = story();
  return s.tutorial >= 0 && s.tutorial < TUTORIAL.length ? TUTORIAL[s.tutorial] : null;
}

/** Tick the tutorial on if `id` is the step we are waiting for. */
export function tutorialDone(id) {
  const s = story();
  const step = tutorialStep();
  if (!step || step.id !== id) return false;
  s.tutorial++;
  if (s.tutorial >= TUTORIAL.length) {
    s.tutorial = -1;
    s.beat = 'open';
    s.chapter = 2;
    toast('GRANDPA: "RIGHT. THE SHOP IS YOURS."', 'good');
  }
  return true;
}
