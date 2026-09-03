// The reason you are out here: your application to the Beaver Institute of
// Timberwork. Six things to prove, and a few scenes along the way.

import { G, toast, logMsg } from './state.js';
import { cosiness } from './scenes/lodge.js';
import { playCutscene } from './scenes/cutscene.js';

export const UNIVERSITY = 'BEAVER INSTITUTE OF TIMBERWORK';

/** The portfolio BIT wants to see. Each one is checked against the live game. */
export const GOALS = [
  {
    id: 'timber', title: 'FELL AND HAUL 40 TIMBER BY PAW',
    note: 'They want to see you can still swing an axe yourself.',
    progress: () => [Math.min(40, G.stats.gathered || 0), 40],
  },
  {
    id: 'crew', title: 'KEEP A CREW OF THREE IN WORK',
    note: 'A master builder is trusted with other beavers.',
    progress: () => [Math.min(3, G.beavers.length), 3],
  },
  {
    id: 'water', title: 'RAISE THE WATER TO LEVEL TWO',
    note: 'Anyone can stack logs. Holding back a river is engineering.',
    progress: () => [Math.min(2, G.waterLevel), 2],
  },
  {
    id: 'neighbours', title: 'FIND HOMES FOR THREE ANIMALS',
    note: 'Build for others before you build for yourself.',
    progress: () => [Math.min(3, G.housed.length), 3],
  },
  {
    id: 'lodge', title: 'KEEP A LODGE WORTH VISITING',
    note: 'The examiners will call round. Cosiness of twelve or better.',
    progress: () => [Math.min(12, cosiness()), 12],
  },
  {
    id: 'master', title: 'FIND HOMES FOR EIGHT ANIMALS',
    note: 'The final piece. Then the valley speaks for you.',
    progress: () => [Math.min(8, G.housed.length), 8],
  },
];

export function goalDone(goal) {
  const [have, want] = goal.progress();
  return have >= want;
}

export function goalsDone() {
  return GOALS.filter(goalDone).length;
}

export function applicationComplete() {
  return goalsDone() === GOALS.length;
}

function ensure() {
  if (!G.story) G.story = { seen: {}, done: {}, accepted: false };
  if (!G.story.seen) G.story.seen = {};
  if (!G.story.done) G.story.done = {};
  return G.story;
}

/** Called once a second. Fires the scenes and the little milestone lines. */
export function checkStory() {
  const story = ensure();

  // Never cut away from the player mid-swing: story beats wait until they are
  // out of the woods.
  const busyGathering = G.mode === 'forest';

  for (const goal of GOALS) {
    if (story.done[goal.id]) continue;
    if (!goalDone(goal)) continue;
    story.done[goal.id] = true;
    toast(`APPLICATION: ${goal.title.toLowerCase()} - done.`, 'quest');
    logMsg(`BIT application: ${goal.title}`, 'quest');
  }

  if (busyGathering) return;

  // the letter turns up once you have actually done a day's work
  if (!story.seen.letter && (G.stats.gathered || 0) >= 8) {
    story.seen.letter = true;
    playCutscene('letter');
    return;
  }

  if (!story.seen.accepted && applicationComplete()) {
    story.seen.accepted = true;
    story.accepted = true;
    playCutscene('accepted');
  }
}

export function startStory() {
  const story = ensure();
  if (story.seen.intro) return;
  story.seen.intro = true;
  playCutscene('intro');
}
