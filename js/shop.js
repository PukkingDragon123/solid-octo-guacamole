// THE INTERNET, on a phone the size of a matchbox. Machines make the workshop
// faster; robot workers do a job while you are out on a delivery.

import { toast } from './state.js';
import { story, spendMoney, addMaterial } from './story.js';

export const CATALOGUE = [
  { id: 'bandsaw', name: 'Band Saw', price: 420, kind: 'machine', max: 1,
    blurb: 'Rips planks straight. The saw bench cut line wobbles half as much.' },
  { id: 'kiln', name: 'Drying Kiln', price: 560, kind: 'machine', max: 1,
    blurb: 'Seasoned timber. Every plank you cut counts as a grade better.' },
  { id: 'lathe', name: 'Lathe', price: 640, kind: 'machine', max: 1,
    blurb: 'Turns legs while you work. Assembly needs one fewer part fitted.' },
  { id: 'driver', name: 'Power Driver', price: 380, kind: 'machine', max: 1,
    blurb: 'Screws bite faster - the screw window at the bench is wider.' },
  { id: 'sawbot', name: 'SawBot 1', price: 900, kind: 'robot', max: 3,
    blurb: 'A little robot that rips one log into planks each day.' },
  { id: 'fixbot', name: 'FixBot', price: 1100, kind: 'robot', max: 2,
    blurb: 'Fits screws on its own. Finishes one part of a build each day.' },
  { id: 'crate', name: 'Crate of Screws', price: 90, kind: 'stock', give: { screw: 30 },
    blurb: 'Thirty screws, delivered by heron. No questions asked.' },
  { id: 'bolt', name: 'Bolt of Cloth', price: 140, kind: 'stock', give: { cloth: 6 },
    blurb: 'Six lengths of good cloth for beds and cradles.' },
  { id: 'glasspack', name: 'Glass Pack', price: 180, kind: 'stock', give: { glass: 5 },
    blurb: 'Five panes, packed in straw.' },
  { id: 'hardpack', name: 'Hardwood Bundle', price: 220, kind: 'stock', give: { hardwood: 6 },
    blurb: 'Six lengths of dense old timber.' },
];

export const owned = (id) => (story().machines[id] || 0);
export const has = (id) => owned(id) > 0;

export function canBuy(item) {
  const s = story();
  if (item.max && owned(item.id) >= item.max) return false;
  return s.money >= item.price;
}

export function buy(item) {
  const s = story();
  if (item.max && owned(item.id) >= item.max) { toast('YOU ALREADY HAVE THAT', 'warn'); return false; }
  if (!spendMoney(item.price)) { toast('NOT ENOUGH ACORNS', 'warn'); return false; }
  if (item.kind === 'stock') {
    for (const k in item.give) addMaterial(k, item.give[k]);
    toast(`ORDERED - ${item.name.toUpperCase()} ARRIVES BY HERON`, 'good');
    return true;
  }
  s.machines[item.id] = owned(item.id) + 1;
  if (item.kind === 'robot') s.robots.push({ id: item.id, cooldown: 0 });
  toast(`${item.name.toUpperCase()} INSTALLED`, 'good');
  return true;
}

// ------------------------------------------------------- what machines do
export const sawWobble = () => (has('bandsaw') ? 0.5 : 1);
export const plankBonus = () => (has('kiln') ? 1 : 0);
export const screwWindow = () => (has('driver') ? 1.6 : 1);
export const partsSkipped = () => (has('lathe') ? 1 : 0);

/** Robots work a night shift while the day rolls over. */
export function runRobots() {
  const s = story();
  let worked = 0;
  for (const bot of s.robots) {
    if (bot.id === 'sawbot' && (s.materials.hardwood || 0) >= 1) {
      s.materials.hardwood -= 1;
      addMaterial('plank', 3);
      worked++;
    } else if (bot.id === 'fixbot') {
      addMaterial('screw', 4);
      worked++;
    }
  }
  if (worked) toast(`${worked} ROBOT${worked === 1 ? '' : 'S'} WORKED THE NIGHT SHIFT`, 'info');
}
