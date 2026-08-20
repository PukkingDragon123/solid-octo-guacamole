// DAM IT — global configuration, balance tables and content definitions.

export const TILE = 32;
export const MAPW = 34;
export const MAPH = 22;
export const CANVAS_W = TILE * MAPW;
export const CANVAS_H = TILE * MAPH;

export const DAY_LENGTH = 100;      // seconds of real time per in-game day
export const MAX_WATER_LEVEL = 3;   // how high the pond can rise
export const SAVE_KEY = 'damit.save.v1';

export const COLORS = {
  grassA: '#7cc16a', grassB: '#74b862', grassDark: '#5d9c4e',
  dirt: '#bb8d5c', dirtDark: '#a2764a',
  rock: '#9aa4ad', rockDark: '#7d8792',
  water: '#3f9ad4', waterLight: '#6fbde9', waterDeep: '#2f7fb4',
  pond: '#57b2e2', pondLight: '#8ad2f2',
  wood: '#a9713e', woodDark: '#7d5129',
  fur: '#a4703f', furDark: '#7d5129', furLight: '#c99460',
  ink: '#2b2118',
  gold: '#f2a444',
};

// ---------------------------------------------------------------- crew jobs
// Each beaver job multiplies the speed of certain task types. Everyone can do
// everything — specialists are simply much faster at their calling.
export const CREW_JOBS = {
  logger:   { name: 'Logger',   icon: '🪓', color: '#c2703a', hire: { berries: 18, wood: 0 },
              mult: { CHOP: 2.2, BUILD: 0.9, PLANT: 0.8, HARVEST: 0.8 },
              blurb: 'Fells trees at double speed. The backbone of any dam.' },
  hauler:   { name: 'Hauler',   icon: '🎒', color: '#6d8fc4', hire: { berries: 16, wood: 0 },
              mult: { CHOP: 1.0, BUILD: 1.0, PLANT: 1.0, HARVEST: 1.1 },
              carryBonus: 2.0, speedBonus: 1.35,
              blurb: 'Carries twice the load and trots 35% faster.' },
  engineer: { name: 'Engineer', icon: '📐', color: '#8b6bc4', hire: { berries: 26, wood: 6 },
              mult: { CHOP: 0.8, BUILD: 2.2, PLANT: 0.8, HARVEST: 0.8 },
              blurb: 'Raises dams and habitats at double speed.' },
  gardener: { name: 'Gardener', icon: '🌱', color: '#5aa85f', hire: { berries: 20, wood: 4 },
              mult: { CHOP: 0.8, BUILD: 1.0, PLANT: 2.4, HARVEST: 1.4 },
              blurb: 'Plants saplings and bushes in a flash. Plants grow faster nearby.' },
  forager:  { name: 'Forager',  icon: '🧺', color: '#d2694f', hire: { berries: 14, wood: 0 },
              mult: { CHOP: 0.9, BUILD: 0.9, PLANT: 1.2, HARVEST: 2.4 },
              blurb: 'Strips a berry bush in seconds and finds stray seeds.' },
};

// ------------------------------------------------------------- crew skills
export const SKILLS = {
  speed:     { name: 'Swift Paws', icon: '💨', max: 5, desc: '+12% walking speed per rank.' },
  carry:     { name: 'Big Pockets', icon: '🎒', max: 5, desc: '+3 carrying capacity per rank.' },
  work:      { name: 'Craft', icon: '🛠️', max: 5, desc: '+15% work speed per rank.' },
  endurance: { name: 'Endurance', icon: '❤️', max: 5, desc: '+20 stamina, tires 10% slower per rank.' },
};

export const XP_PER_LEVEL = 100;

// ------------------------------------------------------------- blueprints
// `on` lists the tile types a blueprint may be placed on.
// `work` is how many worker-seconds of labour the site needs.
export const BLUEPRINTS = {
  dam: {
    id: 'dam', name: 'Dam Segment', cat: 'dam', icon: '🪵',
    cost: { wood: 3 }, work: 4, on: ['water'], jobType: 'BUILD',
    desc: 'Blocks one tile of river. Seal every channel to raise the water.',
  },
  sapling: {
    id: 'sapling', name: 'Plant Sapling', cat: 'plant', icon: '🌱',
    cost: { seeds: 1 }, work: 3, on: ['grass', 'dirt'], jobType: 'PLANT',
    desc: 'Grows into a full tree in about two days. Replant what you fell!',
  },
  sunberry: {
    id: 'sunberry', name: 'Sunberry Bush', cat: 'plant', icon: '🍓', tint: '#e8564a',
    cost: { seeds: 2 }, work: 3, on: ['grass', 'dirt'], jobType: 'PLANT',
    desc: 'Sweet red berries. Loved by rabbits and hedgehogs.',
  },
  dewberry: {
    id: 'dewberry', name: 'Dewberry Bush', cat: 'plant', icon: '🫐', tint: '#5b6fd8',
    cost: { seeds: 2 }, work: 3, on: ['grass', 'dirt'], jobType: 'PLANT',
    desc: 'Cool blue berries that like damp ground. Ducks and frogs adore them.',
  },
  goldberry: {
    id: 'goldberry', name: 'Goldberry Bush', cat: 'plant', icon: '🌟', tint: '#f0b83c',
    cost: { seeds: 3 }, work: 4, on: ['grass', 'dirt'], jobType: 'PLANT',
    desc: 'Rare golden berries. Songbirds and otters will not settle without them.',
  },
  clover: {
    id: 'clover', name: 'Clover Patch', cat: 'plant', icon: '🍀', tint: '#69b95c',
    cost: { seeds: 1 }, work: 2, on: ['grass'], jobType: 'PLANT',
    desc: 'A soft green carpet. Grazers feel safe on it.',
  },
  bluebell: {
    id: 'bluebell', name: 'Bluebells', cat: 'plant', icon: '🔔', tint: '#7c6fe0',
    cost: { seeds: 1 }, work: 2, on: ['grass'], jobType: 'PLANT',
    desc: 'Nodding blue flowers. Pollinators cannot resist them.',
  },
  sunflower: {
    id: 'sunflower', name: 'Sunflowers', cat: 'plant', icon: '🌻', tint: '#f5c33b',
    cost: { seeds: 1 }, work: 2, on: ['grass', 'dirt'], jobType: 'PLANT',
    desc: 'Tall, cheerful and full of seeds for the birds.',
  },
  reed: {
    id: 'reed', name: 'Reed Bed', cat: 'plant', icon: '🌾', tint: '#9ec46a',
    cost: { seeds: 1 }, work: 2, on: ['pond'], jobType: 'PLANT',
    desc: 'Only grows in still pond water. Shelter for shy waterfolk.',
  },
  duck_nest: {
    id: 'duck_nest', name: 'Duck Nest', cat: 'habitat', icon: '🪺',
    cost: { wood: 10 }, work: 8, on: ['grass', 'dirt'], jobType: 'BUILD',
    desc: 'A woven bowl on the bank, built for a nesting mallard.',
  },
  frog_log: {
    id: 'frog_log', name: 'Frog Log', cat: 'habitat', icon: '🪵',
    cost: { wood: 8 }, work: 6, on: ['pond'], jobType: 'BUILD',
    desc: 'A hollow floating log. Must sit in still pond water.',
  },
  rabbit_burrow: {
    id: 'rabbit_burrow', name: 'Rabbit Burrow', cat: 'habitat', icon: '🕳️',
    cost: { wood: 9 }, work: 7, on: ['dirt', 'grass'], jobType: 'BUILD',
    desc: 'A shored-up tunnel in dry earth.',
  },
  hedgehog_hut: {
    id: 'hedgehog_hut', name: 'Hedgehog Hut', cat: 'habitat', icon: '🏕️',
    cost: { wood: 12 }, work: 8, on: ['grass', 'dirt'], jobType: 'BUILD',
    desc: 'A snug leaf-packed shelter for a prickly lodger.',
  },
  bird_house: {
    id: 'bird_house', name: 'Songbird House', cat: 'habitat', icon: '🏠',
    cost: { wood: 14 }, work: 9, on: ['grass', 'dirt'], jobType: 'BUILD',
    desc: 'A little box on a pole with a perfectly round door.',
  },
  otter_holt: {
    id: 'otter_holt', name: 'Otter Holt', cat: 'habitat', icon: '🛖',
    cost: { wood: 20 }, work: 12, on: ['grass', 'dirt'], jobType: 'BUILD',
    desc: 'A riverside den with an underwater entrance. Needs deep water.',
  },
  turtle_bask: {
    id: 'turtle_bask', name: 'Basking Deck', cat: 'habitat', icon: '🪜',
    cost: { wood: 16 }, work: 10, on: ['pond'], jobType: 'BUILD',
    desc: 'A sun-warmed platform over the pond.',
  },
  lodge: {
    id: 'lodge', name: 'Crew Lodge', cat: 'base', icon: '🏚️',
    cost: { wood: 24 }, work: 12, on: ['grass', 'dirt'], jobType: 'BUILD',
    desc: 'Room for two more beavers on the payroll.',
  },
  shed: {
    id: 'shed', name: 'Storage Shed', cat: 'base', icon: '📦',
    cost: { wood: 16 }, work: 8, on: ['grass', 'dirt'], jobType: 'BUILD',
    desc: '+80 storage for wood, berries and seeds.',
  },
};

export const PLANT_IDS = ['sapling', 'sunberry', 'dewberry', 'goldberry', 'clover', 'bluebell', 'sunflower', 'reed'];
export const BERRY_IDS = ['sunberry', 'dewberry', 'goldberry'];
export const FLOWER_IDS = ['clover', 'bluebell', 'sunflower'];

// ---------------------------------------------------------------- animals
// Every need is checked inside `radius` tiles of the animal's chosen spot.
export const ANIMALS = [
  {
    id: 'duck', name: 'Mallard Duck', icon: '🦆', color: '#4c8c3f', near: 'water', radius: 6,
    intro: 'I need a quiet bank to nest on, dewberries to snack on, and a proper pond.',
    needs: [
      { type: 'structure', id: 'duck_nest', count: 1 },
      { type: 'plant', id: 'dewberry', count: 2 },
      { type: 'tile', tile: 'pond', count: 6 },
    ],
    reward: { hearts: 1, berries: 25, seeds: 4 },
  },
  {
    id: 'frog', name: 'Bullfrog', icon: '🐸', color: '#5fae4c', near: 'water', radius: 6,
    intro: 'Still water, a hollow log to sing from and reeds to hide in. Ribbit.',
    needs: [
      { type: 'structure', id: 'frog_log', count: 1 },
      { type: 'plant', id: 'reed', count: 3 },
      { type: 'tile', tile: 'pond', count: 10 },
    ],
    reward: { hearts: 1, berries: 20, seeds: 6 },
  },
  {
    id: 'rabbit', name: 'Cottontail Rabbit', icon: '🐰', color: '#c9a789', near: 'land', radius: 6,
    intro: 'A dry burrow, clover to nibble and sunberries for pudding, please!',
    needs: [
      { type: 'structure', id: 'rabbit_burrow', count: 1 },
      { type: 'plant', id: 'clover', count: 3 },
      { type: 'plant', id: 'sunberry', count: 2 },
    ],
    reward: { hearts: 1, berries: 22, seeds: 5 },
  },
  {
    id: 'hedgehog', name: 'Hedgehog', icon: '🦔', color: '#8d7357', near: 'land', radius: 6,
    intro: 'Somewhere snug out of the wind, with sunberries and a few trees for cover.',
    needs: [
      { type: 'structure', id: 'hedgehog_hut', count: 1 },
      { type: 'plant', id: 'sunberry', count: 3 },
      { type: 'tree', count: 3 },
    ],
    reward: { hearts: 2, berries: 26, seeds: 5 },
  },
  {
    id: 'songbird', name: 'Songbird', icon: '🐦', color: '#e0a13c', near: 'land', radius: 6,
    intro: 'A house on a pole, sunflowers for seed and goldberries for the little ones.',
    needs: [
      { type: 'structure', id: 'bird_house', count: 1 },
      { type: 'plant', id: 'sunflower', count: 3 },
      { type: 'plant', id: 'goldberry', count: 2 },
    ],
    reward: { hearts: 2, berries: 30, seeds: 6, skill: 1 },
  },
  {
    id: 'otter', name: 'River Otter', icon: '🦦', color: '#7a5a3c', near: 'water', radius: 7,
    intro: 'Deep water to dive in, a holt on the bank, and goldberries. I have standards.',
    needs: [
      { type: 'structure', id: 'otter_holt', count: 1 },
      { type: 'plant', id: 'goldberry', count: 2 },
      { type: 'tile', tile: 'pond', count: 14 },
      { type: 'water', level: 2 },
    ],
    reward: { hearts: 3, berries: 40, seeds: 8, skill: 1 },
  },
  {
    id: 'turtle', name: 'Pond Turtle', icon: '🐢', color: '#5e8f52', near: 'water', radius: 7,
    intro: 'A sunny deck over deep water, some reeds, and bluebells on the bank.',
    needs: [
      { type: 'structure', id: 'turtle_bask', count: 1 },
      { type: 'plant', id: 'reed', count: 2 },
      { type: 'plant', id: 'bluebell', count: 2 },
      { type: 'water', level: 3 },
    ],
    reward: { hearts: 3, berries: 45, seeds: 8, skill: 1 },
  },
  {
    id: 'dragonfly', name: 'Dragonfly', icon: '🪰', color: '#4bb6c4', near: 'water', radius: 6,
    intro: 'Bluebells, reeds and a bit of open water. I am easy to please, honestly.',
    needs: [
      { type: 'plant', id: 'bluebell', count: 3 },
      { type: 'plant', id: 'reed', count: 2 },
      { type: 'tile', tile: 'pond', count: 8 },
    ],
    reward: { hearts: 1, berries: 18, seeds: 4 },
  },
];

export const NEED_LABEL = {
  structure: (n) => `Build ${n.count}× ${BLUEPRINTS[n.id].name}`,
  plant: (n) => `Grow ${n.count}× ${BLUEPRINTS[n.id].name}`,
  tile: (n) => `${n.count} tiles of ${n.tile === 'pond' ? 'pond water' : n.tile}`,
  tree: (n) => `${n.count} grown trees for cover`,
  water: (n) => `Water level ${n.level} or higher`,
};

export const TIPS = [
  'Click a tree to mark it for felling. Idle beavers take the nearest marked tree.',
  'Dam every water tile across a channel — one gap and the river keeps running.',
  'Beavers are paid in berries at dawn. Plant berry bushes before you hire.',
  'Replant saplings. A felled forest never grows back on its own.',
  'Reed beds only grow in pond water, so dam first and plant second.',
  'Gardeners make nearby plants grow faster. Park one in your orchard.',
  'Tired beavers nap at the lodge. Endurance ranks keep them working longer.',
  'Hit the Log Slam mini-game for a burst of free building work.',
];
