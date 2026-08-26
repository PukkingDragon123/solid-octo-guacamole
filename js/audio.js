// Every sound in the game is synthesised on the spot - there are no audio files
// to download. It matters most in the forest: the creak that warns you a tree is
// coming down is a real cue you have to hear, not just read.

let ctxA = null;
let master = null;
export const audio = { enabled: true, unlocked: false };

function ac() {
  if (!ctxA) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctxA = new Ctor();
    master = ctxA.createGain();
    master.gain.value = 0.5;
    master.connect(ctxA.destination);
  }
  return ctxA;
}

/** Browsers only allow sound after a gesture, so the first tap starts it. */
export function unlockAudio() {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  audio.unlocked = true;
}

export function setVolume(v) { if (master) master.gain.value = Math.max(0, Math.min(1, v)); }

function env(node, t0, attack, hold, release, peak = 0.5) {
  const g = ctxA.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  node.connect(g);
  g.connect(master);
  return g;
}

function tone(freq, t0, dur, type = 'sine', peak = 0.4, bend = 0) {
  const c = ac(); if (!c || !audio.enabled) return;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + bend), t0 + dur);
  env(o, t0, Math.min(0.02, dur / 4), dur * 0.3, dur * 0.6, peak);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(t0, dur, freq, q, peak = 0.4, type = 'bandpass') {
  const c = ac(); if (!c || !audio.enabled) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f);
  env(f, t0, 0.005, dur * 0.2, dur * 0.7, peak);
  src.start(t0);
}

const now = () => (ac() ? ctxA.currentTime : 0);

export const sfx = {
  chop() { const t = now(); noise(t, 0.18, 320, 1.2, 0.5); tone(120, t, 0.12, 'triangle', 0.3, -60); },
  thunk() { const t = now(); tone(70, t, 0.3, 'sine', 0.5, -30); noise(t, 0.12, 180, 0.8, 0.25); },
  /** The warning. Rising, wooden, unmistakable once you have heard it once. */
  creak(dur = 1.1) {
    const c = ac(); if (!c || !audio.enabled) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, t);
    o.frequency.linearRampToValueAtTime(210, t + dur);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 6;
    const lfo = c.createOscillator();
    lfo.type = 'square'; lfo.frequency.value = 11;
    const lg = c.createGain(); lg.gain.value = 40;
    lfo.connect(lg); lg.connect(o.frequency);
    o.connect(f);
    env(f, t, 0.08, dur * 0.6, dur * 0.4, 0.34);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  },
  fall() { const t = now(); noise(t, 0.9, 220, 0.5, 0.55, 'lowpass'); tone(58, t + 0.5, 0.5, 'sine', 0.5, -20); },
  saw() { const t = now(); noise(t, 0.14, 2600, 3, 0.22, 'bandpass'); },
  screw() { const t = now(); noise(t, 0.07, 1800, 6, 0.3); tone(420, t, 0.06, 'square', 0.12); },
  click() { const t = now(); tone(880, t, 0.05, 'square', 0.16); },
  good() { const t = now(); [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.07, 0.16, 'triangle', 0.28)); },
  bad() { const t = now(); tone(180, t, 0.28, 'sawtooth', 0.28, -90); },
  cash() { const t = now(); [1046, 1318].forEach((f, i) => tone(f, t + i * 0.06, 0.2, 'sine', 0.22)); },
  ring() { const t = now(); for (let i = 0; i < 6; i++) tone(i % 2 ? 1100 : 880, t + i * 0.09, 0.08, 'square', 0.14); },
  crash() {
    const t = now();
    noise(t, 0.7, 900, 0.4, 0.7, 'highpass');
    noise(t, 0.5, 260, 0.7, 0.6, 'lowpass');
    tone(90, t, 0.5, 'triangle', 0.4, -50);
  },
  siren() {
    const c = ac(); if (!c || !audio.enabled) return;
    const t = c.currentTime;
    for (let i = 0; i < 4; i++) {
      tone(i % 2 ? 740 : 560, t + i * 0.34, 0.32, 'square', 0.14);
    }
  },
  wing() { const t = now(); for (let i = 0; i < 3; i++) noise(t + i * 0.16, 0.12, 300, 0.6, 0.18, 'lowpass'); },
  step() { const t = now(); noise(t, 0.05, 240, 1.4, 0.12); },
  tv() { const t = now(); noise(t, 0.4, 3000, 0.6, 0.1, 'highpass'); },
};
