/* ============================================================
   AVERAGE CANADIAN SIMULATOR - main game
   ============================================================ */
(function () {
  'use strict';
  var ACS = window.ACS;
  var L = ACS.LINES, UI = ACS.UI;
  var VW = ACS.VW, VH = ACS.VH, WORLD_W = ACS.WORLD_W;
  var $ = function (id) { return document.getElementById(id); };
  var clamp = ACS.clamp;

  /* ============================================================ AUDIO */
  var AC = null, master = null, muted = false;
  function audioInit() {
    if (AC) return;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 0.20;
      master.connect(AC.destination);
    } catch (e) { AC = null; }
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!AC || muted) return;
    var t = AC.currentTime;
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, hp) {
    if (!AC || muted) return;
    var n = AC.sampleRate * dur | 0;
    var buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = AC.createBufferSource(); s.buffer = buf;
    var f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 900;
    var g = AC.createGain(); g.gain.value = vol || 0.12;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  var SFX = {
    jump: function () { tone(320, 0.12, 'square', 0.13, 620); },
    step: function () { noise(0.05, 0.05, 2400); },
    chop: function () { noise(0.10, 0.20, 500); tone(150, 0.09, 'sawtooth', 0.12, 70); },
    coin: function () { tone(880, 0.07, 'square', 0.14); setTimeout(function () { tone(1320, 0.10, 'square', 0.12); }, 60); },
    sell: function () { tone(660, 0.07, 'square', 0.13); setTimeout(function () { tone(990, 0.07, 'square', 0.12); }, 55); setTimeout(function () { tone(1320, 0.12, 'square', 0.11); }, 110); },
    hire: function () { tone(440, 0.09, 'triangle', 0.16, 660); },
    build: function () { noise(0.22, 0.18, 300); tone(180, 0.22, 'sawtooth', 0.12, 90); },
    sorry: function () { tone(520, 0.08, 'sine', 0.10, 400); },
    bonk: function () { tone(240, 0.09, 'square', 0.16, 120); },
    rank: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, 'square', 0.15); }, i * 90); }); },
    moose: function () { tone(120, 0.45, 'sawtooth', 0.20, 90); setTimeout(function () { tone(95, 0.4, 'sawtooth', 0.15, 70); }, 220); },
    deny: function () { tone(200, 0.14, 'square', 0.12, 130); }
  };

  /* gentle pentatonic loop, because silence is un-Canadian */
  var MEL = [0, 3, 5, 7, 5, 3, 0, -2, 0, 3, 7, 10, 7, 5, 3, 0];
  var melI = 0, melT = 0;
  function musicTick(dt) {
    if (!AC || muted) return;
    melT -= dt;
    if (melT > 0) return;
    melT = 0.42;
    var n = MEL[melI % MEL.length];
    tone(220 * Math.pow(2, n / 12), 0.34, 'triangle', 0.045);
    if (melI % 4 === 0) tone(110 * Math.pow(2, (n % 12) / 12), 0.5, 'sine', 0.05);
    melI++;
  }

  /* ============================================================ GAME */
  var G = {
    state: 'title',
    t: 0, playtime: 0,
    money: 150, earned: 0,
    res: { sap: 0, lumber: 25, potato: 0, curds: 0, syrup: 0, pancakes: 0, poutine: 0 },
    crew: { beaver: 0, ferret: 0, moose: 0 },
    politeness: 25,
    buildings: [], npcs: [], workers: [], caravans: [], timbits: [], decoMoose: [],
    panelOpen: false,
    incomeRate: 0,
    camX: 0, camShake: 0,
    skyPhase: 0.72,
    hauled: 0, sorries: 0, chops: 0, totalHires: 0,
    rankIdx: 0
  };
  window.ACS_GAME = G;

  var parts, weather, props, footprints = [], earnLog = [];
  var caravanTimer = 3;

  /* ---------------------------------------------------------- helpers */
  G.byKey = function (k) {
    for (var i = 0; i < G.buildings.length; i++) if (G.buildings[i].key === k) return G.buildings[i];
    return null;
  };
  G.buildCost = function (b) { return b.cost; };
  G.upgradeCost = function (b) {
    var base = b.cost > 0 ? b.cost : 400;
    return Math.round(base * 0.75 * Math.pow(1.85, b.level));
  };
  G.capOf = function (b) { return (b.cap || 0) + (b.level - 1); };
  G.hireCost = function (k) {
    var base = { beaver: 60, ferret: 160, moose: 520 }[k];
    var g = { beaver: 1.16, ferret: 1.19, moose: 1.24 }[k];
    return Math.round(base * Math.pow(g, G.crew[k]));
  };
  G.hireCostN = function (k, n) {
    var base = { beaver: 60, ferret: 160, moose: 520 }[k];
    var g = { beaver: 1.16, ferret: 1.19, moose: 1.24 }[k];
    var tot = 0;
    for (var i = 0; i < n; i++) tot += Math.round(base * Math.pow(g, G.crew[k] + i));
    return tot;
  };
  G.idle = function (k) {
    var used = 0;
    for (var i = 0; i < G.buildings.length; i++) {
      var b = G.buildings[i];
      if (b.worker === k) used += b.assigned;
    }
    return G.crew[k] - used;
  };
  G.politeMult = function () { return 1 + (G.politeness / 100) * 0.5; };
  G.moraleMult = function () {
    var m = 1;
    for (var i = 0; i < G.buildings.length; i++) {
      var b = G.buildings[i];
      if (b.type === 'morale' && b.built) m += b.morale * b.level;
    }
    return m;
  };
  G.nearBuilding = function (b) {
    var w = (b.art ? b.art.w : 96);
    return Math.abs(G.player.x - b.x) < w / 2 + 26;
  };
  G.supervising = function (b) { return G.nearBuilding(b) ? 1.4 : 1; };
  G.globalMult = function (b) { return G.politeMult() * G.moraleMult() * G.supervising(b); };
  G.rateText = function (b) {
    if (!b.worker || b.assigned === 0) return 'IDLE - NOBODY POSTED';
    var per = b.rate * b.level * b.assigned * G.politeMult() * G.moraleMult();
    return per.toFixed(2) + '/S' + (G.nearBuilding(b) ? ' (+40% SUPERVISED)' : '');
  };
  G.rankInfo = function () {
    var R = ACS.RANKS, i = 0;
    for (var k = 0; k < R.length; k++) if (G.earned >= R[k].at) i = k;
    return { idx: i, name: R[i].name, next: R[i + 1] || null };
  };
  G.stats = function () {
    var m = UI.money, sh = UI.short;
    var mins = Math.floor(G.playtime / 60), secs = Math.floor(G.playtime % 60);
    return [
      ['TOTAL EARNED', m(G.earned)],
      ['IN THE POCKET', m(G.money)],
      ['CREW EMPLOYED', (G.crew.beaver + G.crew.ferret + G.crew.moose) + ''],
      ['BEAVERS / FERRETS / MOOSE', G.crew.beaver + ' / ' + G.crew.ferret + ' / ' + G.crew.moose],
      ['CREW OUTPUT MULTIPLIER', 'x' + (G.politeMult() * G.moraleMult()).toFixed(2)],
      ['MOOSE LOADS HAULED', sh(G.hauled)],
      ['TIMES APOLOGIZED', sh(G.sorries)],
      ['TREES PERSONALLY CHOPPED', sh(G.chops)],
      ['SYRUP IN STOCK', sh(G.res.syrup)],
      ['POUTINE IN STOCK', sh(G.res.poutine)],
      ['TIME IN THE GREAT WHITE NORTH', mins + 'M ' + secs + 'S']
    ];
  };

  /* ---------------------------------------------------------- fx hooks */
  G.puff = function (x, y, n) {
    for (var i = 0; i < n; i++) parts.add({
      x: x + (Math.random() - 0.5) * 8, y: y - Math.random() * 3,
      vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 30,
      g: 60, life: 0.5, life0: 0.5, color: '#ffffff', size: 1 + ((Math.random() * 2) | 0)
    });
  };
  G.chip = function (x, y) {
    parts.add({
      x: x, y: y, vx: (Math.random() - 0.5) * 70, vy: -40 - Math.random() * 40,
      g: 320, life: 0.7, life0: 0.7, color: '#c8a06a', size: 1
    });
  };
  G.footprint = function (x, y) {
    footprints.push({ x: x, y: y, life: 9, life0: 9 });
    if (footprints.length > 90) footprints.shift();
  };
  G.float = function (x, y, text, color) {
    parts.add({ x: x, y: y, vx: 0, vy: -22, life: 1.3, life0: 1.3, text: text, color: color || '#fff' });
  };
  G.popItem = function (x, y, name) {
    parts.add({ x: x, y: y, vx: (Math.random() - 0.5) * 20, vy: -34, g: 40, life: 0.9, life0: 0.9, img: ACS.item(name), size: 10 });
  };
  G.shake = function (a) { G.camShake = Math.max(G.camShake, a); };
  G.sfx = function (n) { if (SFX[n]) SFX[n](); };
  G.canTalk = function (who) {
    var n = 0, px = G.player ? G.player.x : 0;
    for (var i = 0; i < G.npcs.length; i++) {
      var o = G.npcs[i];
      if (o === who || o.bubbleT <= 0) continue;
      /* never let two bubbles overlap, and cap how many are up at once */
      if (Math.abs(o.x - who.x) < 96) return false;
      if (Math.abs(o.x - px) < 300 && ++n >= 2) return false;
    }
    return true;
  };
  G.addPolite = function (n) {
    G.politeness = clamp(G.politeness + n, 0, 100);
    if (n > 0) G.sorries++;
  };

  /* ---------------------------------------------------------- actions */
  G.tryBuild = function (key) {
    var b = G.byKey(key);
    if (!b || b.built) return;
    if (G.money < b.cost) { G.sfx('deny'); UI.toast('SORRY, CAN\'T AFFORD IT, EH', 'bad'); return; }
    G.money -= b.cost;
    b.built = true; b.level = 1;
    G.sfx('build'); G.shake(3);
    UI.toast('BUILT ' + b.name + '. SORRY ABOOT THE NOISE.', 'good');
    spawnWorkersFor(b);
    G.float(b.x, ACS.surfaceY(b.x) - 70, 'BUILT!', '#7bd07b');
  };
  G.tryUpgrade = function (key) {
    var b = G.byKey(key);
    if (!b || !b.built) return;
    var c = G.upgradeCost(b);
    if (G.money < c) { G.sfx('deny'); UI.toast('SORRY, NOT ENOUGH LOONIES', 'bad'); return; }
    G.money -= c; b.level++;
    G.sfx('build');
    UI.toast(b.name + ' &#9654; LEVEL ' + b.level, 'good');
  };
  G.tryHire = function (kind, n) {
    var got = 0;
    for (var i = 0; i < n; i++) {
      var c = G.hireCost(kind);
      if (G.money < c) break;
      G.money -= c; G.crew[kind]++; got++; G.totalHires++;
    }
    if (!got) { G.sfx('deny'); UI.toast('SORRY, PAYROLL SAYS NO', 'bad'); return; }
    G.sfx('hire');
    UI.toast('HIRED ' + got + ' ' + kind.toUpperCase() + (got > 1 && kind !== 'moose' ? 'S' : '') + '. ' +
      L.pick(kind === 'beaver' ? L.beaverHire : kind === 'ferret' ? L.ferretHire : L.mooseHire).toUpperCase(), 'good');
    if (kind === 'moose') for (i = 0; i < got && G.decoMoose.length < 8; i++) addDecoMoose();
  };
  G.assign = function (key, d) {
    var b = G.byKey(key);
    if (!b || !b.worker || !b.built) return;
    if (d > 0) {
      if (G.idle(b.worker) <= 0 || b.assigned >= G.capOf(b)) return;
      b.assigned++;
      if (b.worker !== 'moose') spawnWorkersFor(b, 1);
    } else {
      if (b.assigned <= 0) return;
      b.assigned--;
      removeWorkerFrom(b);
    }
  };
  G.autoAssign = function () {
    var kinds = ['beaver', 'ferret', 'moose'], moved = 0;
    kinds.forEach(function (k) {
      var guard = 0;
      while (G.idle(k) > 0 && guard++ < 400) {
        /* fill the emptiest eligible building first */
        var best = null;
        G.buildings.forEach(function (b) {
          if (!b.built || b.worker !== k) return;
          if (b.assigned >= G.capOf(b)) return;
          if (!best || b.assigned < best.assigned) best = b;
        });
        if (!best) break;
        best.assigned++; moved++;
        if (k !== 'moose') spawnWorkersFor(best, 1);
      }
    });
    if (moved) UI.toast('POSTED ' + moved + ' CREW. THEY SAID SORRY.', 'good');
    else UI.toast('NOBODY IDLE, EH', '');
  };
  G.clearAssign = function () {
    G.buildings.forEach(function (b) { b.assigned = 0; });
    G.workers.length = 0;
    UI.toast('EVERYBODY RECALLED. SORRY FOR THE COMMUTE.', '');
  };
  G.sellRes = function (k) {
    var have = Math.floor(G.res[k]);
    if (have <= 0) return;
    var v = Math.round(have * ACS.PRICES[k] * 0.85);
    G.res[k] -= have;
    G.money += v; G.earned += v;
    logEarn(v);
    G.sfx('sell');
    UI.toast('SOLD ' + have + ' ' + ACS.RES_LABEL[k] + ' &#9654; ' + UI.money(v) + '. ' + L.pick(L.sell).toUpperCase(), 'good');
    G.float(G.player.x, G.player.y - 8, '+' + UI.money(v), '#7bd07b');
  };
  G.sellCaravan = function (c) {
    G.money += c.value; G.earned += c.value; G.hauled++;
    logEarn(c.value);
    G.sfx('sell');
    G.float(c.moose.x, c.moose.y - 8, '+' + UI.money(c.value), '#ffd36b');
    for (var i = 0; i < 6; i++) G.popItem(c.moose.x + (Math.random() - 0.5) * 20, c.moose.y, 'money');
  };

  function logEarn(v) {
    earnLog.push({ t: G.playtime, v: v });
  }

  /* ---------------------------------------------------------- crew visuals */
  function spawnWorkersFor(b, only) {
    if (!b.worker || b.worker === 'moose') return;
    var want = only ? 1 : b.assigned;
    for (var i = 0; i < want; i++) {
      var w = new ACS.Worker(b.worker, b.x + (Math.random() - 0.5) * 70, (Math.random() * 4) | 0);
      w.bkey = b.key;
      G.workers.push(w);
    }
  }
  function removeWorkerFrom(b) {
    for (var i = G.workers.length - 1; i >= 0; i--)
      if (G.workers[i].bkey === b.key) { G.workers.splice(i, 1); return; }
  }
  function addDecoMoose() {
    var corral = G.byKey('corral');
    var m = new ACS.Moose(corral.x - 60 + Math.random() * 120, {
      fur: ['#5d3a1f', '#4a2f18', '#6b4626'][(Math.random() * 3) | 0]
    });
    m.dir = Math.random() < 0.5 ? -1 : 1;
    m.graze = Math.random() * 3;
    G.decoMoose.push(m);
  }

  /* ============================================================ SETUP */
  function newGame() {
    G.money = 150; G.earned = 0;
    G.res = { sap: 0, lumber: 25, potato: 0, curds: 0, syrup: 0, pancakes: 0, poutine: 0 };
    G.crew = { beaver: 0, ferret: 0, moose: 0 };
    G.politeness = 25; G.playtime = 0;
    G.hauled = 0; G.sorries = 0; G.chops = 0; G.totalHires = 0;
    G.buildings = ACS.BUILDING_DEFS.map(function (d) {
      var b = Object.assign({}, d);
      b.built = !!d.built;
      b.level = b.built ? 1 : 0;
      b.assigned = 0;
      if (d.art) { var mb = ACS.makeBuilding(d.art); b.img = mb.c; b.meta = mb.meta; b.art = d.art; }
      b.sign = ACS.makeSign(d.name.replace('MAPLE ', ''), d.art ? d.art.roof : '#5c3b1f');
      return b;
    });
    G.workers = []; G.caravans = []; G.timbits = []; G.decoMoose = [];
    footprints = []; earnLog = [];
    G.player = new ACS.Player(230);
    buildNPCs();
    for (var i = 0; i < 3; i++) addDecoMoose();
  }

  function buildNPCs() {
    G.npcs = [];
    var seed = 1;
    G.buildings.forEach(function (b) {
      var n = b.type === 'hire' ? 1 : 2;
      if (b.key === 'timmys' || b.key === 'market') n = 4;
      if (b.key === 'rink') n = 4;
      if (b.key === 'cabin') n = 3;
      for (var i = 0; i < n; i++)
        G.npcs.push(new ACS.NPC(b.x + (Math.random() - 0.5) * 130, seed++, b.kind));
    });
    /* wanderers between towns */
    for (var i = 0; i < 8; i++)
      G.npcs.push(new ACS.NPC(200 + Math.random() * (WORLD_W - 400), seed++, null));
  }

  /* ---------------------------------------------------------- save */
  var SAVE_KEY = 'acs_save_v1';
  function save() {
    try {
      var d = {
        money: G.money, earned: G.earned, res: G.res, crew: G.crew,
        politeness: G.politeness, playtime: G.playtime,
        hauled: G.hauled, sorries: G.sorries, chops: G.chops,
        px: G.player.x,
        b: G.buildings.map(function (b) { return [b.key, b.built ? 1 : 0, b.level, b.assigned]; })
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    } catch (e) { /* sorry */ }
  }
  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d) return false;
      newGame();
      G.money = d.money; G.earned = d.earned;
      Object.keys(G.res).forEach(function (k) { if (typeof d.res[k] === 'number') G.res[k] = d.res[k]; });
      G.crew = d.crew; G.politeness = d.politeness; G.playtime = d.playtime || 0;
      G.hauled = d.hauled || 0; G.sorries = d.sorries || 0; G.chops = d.chops || 0;
      d.b.forEach(function (row) {
        var b = G.byKey(row[0]);
        if (!b) return;
        b.built = !!row[1]; b.level = row[2]; b.assigned = row[3];
      });
      G.buildings.forEach(function (b) { if (b.assigned > 0) spawnWorkersFor(b); });
      var n = Math.min(8, G.crew.moose);
      while (G.decoMoose.length < n) addDecoMoose();
      G.player.x = d.px || 230;
      return true;
    } catch (e) { return false; }
  }

  /* ============================================================ INPUT */
  var input = { left: 0, right: 0, jump: 0 };
  var keyMap = {
    'a': 'left', 'arrowleft': 'left',
    'd': 'right', 'arrowright': 'right',
    'w': 'jump', 'arrowup': 'jump', ' ': 'jump'
  };
  function keyName(e) { return (e.key || '').toLowerCase(); }

  document.addEventListener('keydown', function (e) {
    var k = keyName(e);
    if (k === 'tab') { e.preventDefault(); toggleEmpire(); return; }
    if (k === 'escape') { if (UI.isOpen()) UI.closePanel(); return; }
    if (G.state !== 'play') {
      if (k === 'enter' && G.state === 'title') startGame(false);
      return;
    }
    if (keyMap[k]) { input[keyMap[k]] = 1; e.preventDefault(); return; }
    if (UI.isOpen()) return;
    if (k === 'q') actAxe();
    else if (k === 'e') actInteract();
    else if (k === 'r') actSorry();
    else if (k === 'f') actMoose();
    else if (k === 't') actTimbit();
    else if (k === 'm') { muted = !muted; UI.toast(muted ? 'SOUND OFF, SORRY' : 'SOUND ON, EH', ''); }
  });
  document.addEventListener('keyup', function (e) {
    var k = keyName(e);
    if (keyMap[k]) input[keyMap[k]] = 0;
  });

  function toggleEmpire() {
    if (G.state !== 'play') return;
    if (UI.isOpen()) UI.closePanel(); else UI.openPanel('crew', null);
  }

  /* touch */
  function bindTouch() {
    var acts = {
      left: function (d) { input.left = d; }, right: function (d) { input.right = d; },
      jump: function (d) { input.jump = d; },
      act: function (d) { if (d) actInteract(); }, axe: function (d) { if (d) actAxe(); },
      sorry: function (d) { if (d) actSorry(); }, ride: function (d) { if (d) actMoose(); },
      menu: function (d) { if (d) toggleEmpire(); }
    };
    Array.prototype.forEach.call(document.querySelectorAll('#touch button'), function (b) {
      var k = b.getAttribute('data-k'), fn = acts[k];
      var down = function (e) { e.preventDefault(); audioInit(); fn(1); };
      var up = function (e) { e.preventDefault(); fn(0); };
      b.addEventListener('touchstart', down, { passive: false });
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('mousedown', down);
      b.addEventListener('mouseup', up);
      b.addEventListener('mouseleave', up);
    });
    if ('ontouchstart' in window) $('touch').classList.remove('hidden');
  }

  /* ---------------------------------------------------------- actions */
  function nearestProp(kinds, range) {
    var p = G.player, best = null, bd = range;
    for (var i = 0; i < props.length; i++) {
      var pr = props[i];
      if (pr.s !== 1 || kinds.indexOf(pr.t) < 0) continue;
      var d = Math.abs(pr.x - p.x);
      if (d < bd) { bd = d; best = pr; }
    }
    return best;
  }
  function actAxe() {
    var p = G.player;
    if (p.swing > 0) return;
    p.swing = 0.34;
    G.sfx('chop');
    var tree = nearestProp(['maple', 'pine'], 26);
    if (!tree) return;
    G.shake(1.2);
    var gy = ACS.surfaceY(tree.x);
    for (var i = 0; i < 5; i++) G.chip(tree.x + (Math.random() - 0.5) * 10, gy - 24 - Math.random() * 20);
    G.chops++;
    if (tree.t === 'maple') {
      var amt = 1 + (G.byKey('sugar').built ? 1 : 0);
      G.res.sap += amt;
      G.popItem(tree.x, gy - 30, 'sap');
      G.float(tree.x, gy - 40, '+' + amt + ' SAP', '#ffd36b');
    } else {
      G.res.lumber += 1;
      G.popItem(tree.x, gy - 30, 'lumber');
      G.float(tree.x, gy - 40, '+1 LUMBER', '#e8c9a0');
    }
    /* snow dumps off the branches */
    for (i = 0; i < 12; i++) parts.add({
      x: tree.x + (Math.random() - 0.5) * 40, y: gy - 40 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 20, vy: 20 + Math.random() * 40,
      g: 90, life: 1.1, life0: 1.1, color: '#ffffff', size: 1
    });
  }
  function actInteract() {
    var p = G.player, b = null, bd = 1e9;
    for (var i = 0; i < G.buildings.length; i++) {
      var bb = G.buildings[i];
      var w = (bb.art ? bb.art.w : 96);
      var d = Math.abs(bb.x - p.x);
      if (d < w / 2 + 26 && d < bd) { bd = d; b = bb; }
    }
    if (b) {
      audioInit();
      UI.openPanel(null, b.key);
      var line = L.byBuilding[b.kind];
      if (line) UI.toast(L.pick(line).toUpperCase(), '');
      return;
    }
    actSorry();
  }
  function actSorry() {
    var p = G.player, hits = 0;
    for (var i = 0; i < G.npcs.length; i++) {
      var n = G.npcs[i];
      if (Math.abs(n.x - p.x) < 46) {
        n.say(L.pick(L.reply), 2.8);
        n.talkCd = 2;
        n.dir = p.x > n.x ? 1 : -1;
        hits++;
        if (Math.random() < 0.22) {
          var tip = 2 + Math.floor(Math.random() * 8) + Math.floor(G.earned * 0.0004);
          G.money += tip; G.earned += tip; logEarn(tip);
          G.float(n.x, n.y - 6, '+' + UI.money(tip), '#7bd07b');
        }
      }
    }
    G.player.swing = 0;
    G.addPolite(hits ? 4 : 1.2);
    G.sfx('sorry');
    G.float(p.x, p.y - 6, 'SORRY!', '#ffd36b');
    if (!hits && Math.random() < 0.4)
      UI.toast(L.pick(['APOLOGIZED TO A SNOWBANK, EH', 'SAID SORRY TO NOBODY IN PARTICULAR', 'APOLOGIZED TO THE WEATHER']), '');
  }
  function actMoose() {
    var p = G.player;
    if (p.riding) {
      p.riding = null; p.lift = 0;
      G.sfx('moose');
      UI.toast('DISMOUNTED. THANKS BUD.', '');
      return;
    }
    if (G.crew.moose <= 0) { G.sfx('deny'); UI.toast('SORRY, YA GOTTA HIRE A MOOSE FIRST', 'bad'); return; }
    if (G.res.syrup < 1) { G.sfx('deny'); UI.toast('SORRY, NO SYRUP IN THE TANK', 'bad'); return; }
    var m = new ACS.Moose(p.x, {});
    p.riding = m; p.lift = m.h - 11;
    G.sfx('moose');
    G.puff(p.x, ACS.surfaceY(p.x), 12);
    UI.toast('GIVE\'R! MOOSE BURNS SYRUP, EH', 'good');
  }
  function actTimbit() {
    var p = G.player;
    G.timbits.push(new ACS.Timbit(p.x + p.dir * 8, p.y + 6, p.dir));
    G.sfx('step');
  }

  /* ============================================================ ECONOMY */
  function economy(dt) {
    var i, k;
    for (i = 0; i < G.buildings.length; i++) {
      var b = G.buildings[i];
      if (!b.built) continue;
      if (b.type === 'gather' && b.assigned > 0) {
        var amt = b.rate * b.level * b.assigned * G.globalMult(b) * dt;
        G.res[b.out] += amt;
      } else if (b.type === 'craft' && b.assigned > 0) {
        var cyc = b.rate * b.level * b.assigned * G.globalMult(b) * dt;
        var maxC = Infinity;
        for (k in b.inp) maxC = Math.min(maxC, G.res[k] / b.inp[k]);
        cyc = Math.min(cyc, maxC);
        if (cyc > 0) {
          for (k in b.inp) G.res[k] -= b.inp[k] * cyc;
          for (k in b.outp) G.res[k] += b.outp[k] * cyc;
          b.starved = false;
        } else b.starved = true;
      }
    }

    /* moose caravans */
    var stable = G.byKey('stable'), market = G.byKey('market');
    if (stable.built && stable.assigned > 0) {
      caravanTimer -= dt;
      if (caravanTimer <= 0 && G.caravans.length < stable.assigned) {
        caravanTimer = Math.max(1.4, 6.5 - stable.level * 0.45);
        trySpawnCaravan(stable, market);
      }
    }

    /* burn syrup while riding */
    if (G.player.riding) {
      G.res.syrup -= 0.30 * dt;
      if (G.res.syrup <= 0) {
        G.res.syrup = 0;
        G.player.riding = null; G.player.lift = 0;
        UI.toast('SORRY, OUT OF FUEL. THE MOOSE WALKED HOME.', 'bad');
        G.sfx('deny');
      }
    }

    /* politeness slowly drains, as it does in real life */
    G.politeness = clamp(G.politeness - 0.55 * dt, 0, 100);

    /* rolling income readout */
    while (earnLog.length && earnLog[0].t < G.playtime - 4) earnLog.shift();
    var sum = 0;
    for (i = 0; i < earnLog.length; i++) sum += earnLog[i].v;
    G.incomeRate = sum / 4;

    /* rank up */
    var ri = G.rankInfo();
    if (ri.idx > G.rankIdx) {
      G.rankIdx = ri.idx;
      G.sfx('rank'); G.shake(4);
      UI.toast('RANK UP: ' + ri.name + '! ' + L.pick(L.rank).toUpperCase(), 'rank');
      for (i = 0; i < 26; i++) G.popItem(G.player.x + (Math.random() - 0.5) * 60, G.player.y - Math.random() * 30, 'leaf');
      if (ri.name === 'PRIME MINISTER OF MAPLE') winGame();
    }
  }

  function trySpawnCaravan(stable, market) {
    var cap = 8 + stable.level * 4;
    var best = null, bestV = 0;
    ACS.RES_ORDER.forEach(function (k) {
      var have = Math.floor(G.res[k]);
      if (k === 'syrup') have = Math.max(0, have - 3);   // keep fuel in reserve
      if (have <= 0) return;
      var units = Math.min(cap, have);
      var v = units * ACS.PRICES[k];
      if (v > bestV) { bestV = v; best = { k: k, units: units, v: v }; }
    });
    if (!best || bestV < 30) return;
    if (G.res.syrup < 2) return;
    G.res[best.k] -= best.units;
    G.res.syrup -= 2;
    var cargo = { n: Math.ceil(best.units / 4), icon: best.k, label: ACS.RES_LABEL[best.k], units: best.units };
    var c = new ACS.Caravan(stable.x + 30, market.x - 20, cargo, Math.round(best.v));
    G.caravans.push(c);
  }

  /* ============================================================ RENDER */
  var scr = $('screen'), sctx = scr.getContext('2d');
  var buf = ACS.pc(VW, VH), bx = buf.x;
  var scale = 3, offX = 0, offY = 0;

  function resize() {
    var W = window.innerWidth, H = window.innerHeight;
    scale = Math.max(1, Math.min(Math.floor(W / VW), Math.floor(H / VH)));
    if (scale * VW < W * 0.75) scale = Math.min(W / VW, H / VH);   // avoid tiny letterbox
    var dw = Math.round(VW * scale), dh = Math.round(VH * scale);
    scr.width = dw; scr.height = dh;
    scr.style.width = dw + 'px'; scr.style.height = dh + 'px';
    sctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);

  var HORIZON = 176;

  function drawSky() {
    var s = ACS.skyAt(G.skyPhase);
    var g = bx.createLinearGradient(0, 0, 0, HORIZON + 10);
    g.addColorStop(0, s.top);
    g.addColorStop(1, s.bot);
    bx.fillStyle = g;
    /* paint the whole frame: the ground draws over the lower part, and any
       sliver between the ridges and the terrain must not show last frame */
    bx.fillRect(0, 0, VW, VH);
    ACS.drawStars(bx, G.t, ACS.darkness(G.skyPhase));
    ACS.drawCelestial(bx, G.t, G.skyPhase);
    ACS.drawAurora(bx, G.t, s.aur);
  }

  function drawProps(layerMin, layerMax) {
    var S = ACS.scenery();
    for (var i = 0; i < props.length; i++) {
      var p = props[i];
      if (p.s < layerMin || p.s > layerMax) continue;
      var sx = p.x - G.camX * p.s;
      if (sx < -70 || sx > VW + 70) continue;
      var img, gy;
      if (p.t === 'bgpine') {
        img = S.pines[p.i];
        var w = Math.round(img.width * p.sc * 0.6), h = Math.round(img.height * p.sc * 0.6);
        bx.globalAlpha = 0.85;
        bx.drawImage(img, Math.round(sx - w / 2), Math.round(HORIZON - h + 6), w, h);
        bx.globalAlpha = 1;
        continue;
      }
      gy = ACS.surfaceY(p.x);
      if (p.t === 'pine' || p.t === 'fgpine') {
        img = S.pines[p.i];
        var pw = Math.round(img.width * p.sc), ph = Math.round(img.height * p.sc);
        bx.drawImage(img, Math.round(sx - pw / 2), Math.round(gy - ph + 2), pw, ph);
      } else if (p.t === 'maple') {
        img = S.maples[p.i];
        var mw = Math.round(img.width * p.sc), mh = Math.round(img.height * p.sc);
        bx.drawImage(img, Math.round(sx - mw / 2), Math.round(gy - mh + 2), mw, mh);
      } else if (p.t === 'rock') {
        img = S.rocks[p.i];
        bx.drawImage(img, Math.round(sx - img.width / 2), Math.round(gy - img.height + 3));
      } else if (p.t === 'stump') {
        bx.drawImage(S.stump, Math.round(sx - 6), Math.round(gy - 7));
      } else if (p.t === 'snowman') {
        bx.drawImage(S.snowman, Math.round(sx - 7), Math.round(gy - 15));
      } else if (p.t === 'spudrow') {
        bx.fillStyle = '#6b5a4a';
        bx.fillRect(Math.round(sx), Math.round(gy - 2), 8, 3);
        bx.fillStyle = '#f4f7fb';
        bx.fillRect(Math.round(sx), Math.round(gy - 3), 8, 1);
        bx.fillStyle = '#2f6b34';
        bx.fillRect(Math.round(sx + 3), Math.round(gy - 6), 2, 3);
      }
    }
  }

  function drawFootprints() {
    for (var i = 0; i < footprints.length; i++) {
      var f = footprints[i];
      var sx = Math.round(f.x - G.camX);
      if (sx < -4 || sx > VW + 4) continue;
      bx.globalAlpha = clamp(f.life / f.life0, 0, 1) * 0.5;
      bx.fillStyle = '#8fa6c4';
      bx.fillRect(sx, Math.round(f.y), 3, 2);
      bx.globalAlpha = 1;
    }
  }

  /* --- special (art-less) locations --- */
  function drawSpecial(b, camX) {
    var sx = Math.round(b.x - camX), gy = Math.round(ACS.surfaceY(b.x));
    if (b.key === 'rink') {
      var y = Math.round(ACS.LAKE.y);
      /* boards */
      bx.fillStyle = '#f4f7fb'; bx.fillRect(sx - 76, y - 16, 152, 3);
      bx.fillStyle = '#e6ecf4'; bx.fillRect(sx - 76, y - 13, 152, 11);
      bx.fillStyle = '#d6252b'; bx.fillRect(sx - 76, y - 4, 152, 3);
      for (var i = -76; i < 76; i += 16) { bx.fillStyle = '#b9c6d6'; bx.fillRect(sx + i, y - 13, 1, 11); }
      /* centre line + faceoff dot */
      bx.fillStyle = 'rgba(200,40,40,.5)'; bx.fillRect(sx - 1, y - 2, 2, 3);
      bx.fillStyle = 'rgba(40,90,180,.35)'; bx.fillRect(sx - 40, y - 1, 1, 3); bx.fillRect(sx + 40, y - 1, 1, 3);
      /* nets */
      bx.drawImage(ACS.scenery().net, sx - 74, y - 12);
      bx.drawImage(ACS.scenery().net, sx + 62, y - 12);
      /* a lonely puck */
      bx.drawImage(ACS.item('puck'), sx + Math.round(Math.sin(G.t * 1.3) * 30), y - 6, 8, 8);
      return;
    }
    if (b.key === 'lodge') {
      /* a beaver dam: pile of sticks, snow on top */
      bx.fillStyle = '#3a2614';
      for (var s = 0; s < 26; s++) {
        var a = (s * 2.399);
        var px = sx + Math.cos(a) * (s % 7) * 5 - 2, py = gy - 4 - ((s * 3) % 22);
        bx.fillRect(Math.round(px), Math.round(py), 12, 2);
      }
      bx.fillStyle = '#5c3b1f';
      for (s = 0; s < 16; s++) bx.fillRect(sx - 28 + (s * 4) % 56, gy - 6 - ((s * 5) % 18), 10, 2);
      bx.fillStyle = 'rgba(244,247,251,.92)';
      for (s = 0; s < 20; s++) bx.fillRect(sx - 26 + s * 3, gy - 26 + Math.abs(((s - 10) * (s - 10)) * 0.16) | 0, 3, 2);
      bx.fillStyle = '#16101c'; bx.fillRect(sx - 5, gy - 9, 10, 9);
      return;
    }
    if (b.key === 'burrow') {
      bx.fillStyle = '#e4eef8';
      for (var k = 0; k < 22; k++) {
        var w = 44 - k * 2;
        bx.fillRect(sx - w / 2, gy - k, w, 1);
      }
      bx.fillStyle = '#16101c';
      bx.fillRect(sx - 7, gy - 10, 14, 10);
      bx.fillStyle = '#2b2033';
      bx.fillRect(sx - 5, gy - 8, 10, 8);
      /* a ferret peeks oot */
      var fer = ACS.makeFerret({}).walk[0];
      bx.drawImage(fer, sx - 6, gy - 8 + Math.round(Math.sin(G.t * 2) * 2));
      return;
    }
    if (b.key === 'corral') {
      bx.fillStyle = '#5c3b1f';
      for (var f = -80; f <= 80; f += 20) {
        var fy = Math.round(ACS.surfaceY(b.x + f));
        bx.fillRect(sx + f, fy - 22, 3, 22);
      }
      bx.fillRect(sx - 80, gy - 20, 163, 2);
      bx.fillRect(sx - 80, gy - 12, 163, 2);
      bx.fillStyle = '#f4f7fb';
      bx.fillRect(sx - 80, gy - 21, 163, 1);
      bx.fillRect(sx - 80, gy - 13, 163, 1);
      return;
    }
  }

  function drawBuildings(camX) {
    for (var i = 0; i < G.buildings.length; i++) {
      var b = G.buildings[i];
      var sx = b.x - camX;
      if (sx < -180 || sx > VW + 180) continue;
      var gy = ACS.surfaceY(b.x);
      if (!b.art) { drawSpecial(b, camX); }
      else {
        var w = b.img.width, h = b.img.height;
        var px = Math.round(b.x - w / 2 - camX), py = Math.round(gy - h + 4);
        if (!b.built) {
          /* ghost outline of what could be */
          bx.globalAlpha = 0.24;
          bx.drawImage(b.img, px, py);
          bx.globalAlpha = 1;
          bx.fillStyle = 'rgba(20,15,26,.45)';
          bx.fillRect(px, py, w, h);
        } else {
          bx.drawImage(b.img, px, py);
        }
        b._px = px; b._py = py;
      }
      /* signboard */
      var sgy = Math.round(gy - (b.art ? b.img.height + 1 : 34));
      var sgx = Math.round(b.x - camX - b.sign.width / 2);
      bx.drawImage(b.sign, sgx, sgy);
      bx.fillStyle = '#3a2a1c';
      bx.fillRect(sgx + b.sign.width / 2 - 1, sgy + b.sign.height, 2, 5);
      if (!b.built && b.cost > 0) {
        ACS.drawText(bx, 'BUILD ' + UI.money(b.cost), b.x - camX, sgy + b.sign.height + 8,
          { color: G.money >= b.cost ? '#9ef29e' : '#ff9a9a', align: 'center', shadow: true });
      }
      /* flag on the trading post */
      if (b.key === 'market' && b.built) {
        var fx = Math.round(b.x - camX + 46), fy = Math.round(gy - b.img.height - 26);
        var poleH = Math.round(gy - 8) - fy;
        bx.fillStyle = '#8d99a6'; bx.fillRect(fx, fy, 2, poleH);
        bx.fillStyle = '#c8cfd8'; bx.fillRect(fx, fy, 1, poleH);
        bx.fillStyle = '#f4f7fb'; bx.fillRect(fx - 1, fy - 2, 4, 2);
        var fl = ACS.scenery().flag;
        var wob = Math.round(Math.sin(G.t * 3) * 1);
        bx.drawImage(fl, fx + 2, fy + 2 + wob, 20, 15);
      }
    }
  }

  function drawLights(camX) {
    var dark = ACS.darkness(G.skyPhase);
    if (dark < 0.06) return;
    bx.save();
    bx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < G.buildings.length; i++) {
      var b = G.buildings[i];
      if (!b.built || !b.meta || b._px === undefined) continue;
      var sx = b.x - camX;
      if (sx < -180 || sx > VW + 180) continue;
      var flick = 0.86 + 0.14 * Math.sin(G.t * 5 + b.x);
      for (var w = 0; w < b.meta.windows.length; w++) {
        var win = b.meta.windows[w];
        var wx = b._px + win[0], wy = b._py + win[1];
        bx.globalAlpha = dark * 0.95 * flick;
        bx.fillStyle = '#ffcf6b';
        bx.fillRect(wx, wy, win[2], win[3]);
        /* pool of light on the snow */
        var gy = ACS.surfaceY(b.x);
        var g = bx.createRadialGradient(wx + win[2] / 2, wy + 6, 2, wx + win[2] / 2, wy + 6, 46);
        g.addColorStop(0, 'rgba(255,190,90,' + (0.30 * dark * flick).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,190,90,0)');
        bx.globalAlpha = 1;
        bx.fillStyle = g;
        bx.fillRect(wx - 46, wy - 40, 92, Math.max(20, gy - wy + 40));
      }
    }
    bx.restore();
    bx.globalAlpha = 1;
  }

  function drawSmoke(dt) {
    for (var i = 0; i < G.buildings.length; i++) {
      var b = G.buildings[i];
      if (!b.built || !b.meta || !b.meta.chimney) continue;
      var sx = b.x - G.camX;
      if (sx < -60 || sx > VW + 60) continue;
      if (Math.random() < dt * (b.type === 'craft' && b.assigned > 0 ? 14 : 5)) {
        var cx = b._px + b.meta.chimney[0], cy = b._py + b.meta.chimney[1];
        parts.add({
          x: cx + G.camX - 0, y: cy,
          vx: 6 + Math.random() * 8, vy: -14 - Math.random() * 8,
          drag: 0.4, life: 2.4, life0: 2.4,
          color: b.type === 'craft' ? '#ffe9c8' : '#c9d4e4',
          size: 2 + ((Math.random() * 2) | 0),
          world: true
        });
      }
    }
  }

  function drawPrompt() {
    var p = G.player, near = null, bd = 1e9;
    for (var i = 0; i < G.buildings.length; i++) {
      var b = G.buildings[i];
      var w = (b.art ? b.art.w : 96);
      var d = Math.abs(b.x - p.x);
      if (d < w / 2 + 26 && d < bd) { bd = d; near = b; }
    }
    if (!near) return;
    var gy = ACS.surfaceY(near.x);
    var y = Math.round(gy - (near.art ? near.img.height + 17 : 50)) - Math.round(Math.sin(G.t * 4) * 2);
    var label = near.built ? 'E - OPEN' : (G.money >= near.cost ? 'E - BUILD IT' : 'E - LOOK AT IT SADLY');
    var w2 = ACS.textWidth(label, 1) + 8;
    bx.fillStyle = 'rgba(16,10,22,.86)';
    bx.fillRect(Math.round(near.x - G.camX - w2 / 2), y - 3, w2, 13);
    bx.fillStyle = '#d6252b';
    bx.fillRect(Math.round(near.x - G.camX - w2 / 2), y - 3, w2, 1);
    ACS.drawText(bx, label, near.x - G.camX, y + 1, { color: '#ffe9b8', align: 'center' });
  }

  function drawVignette() {
    var dark = ACS.darkness(G.skyPhase);
    if (dark > 0.04) {
      bx.fillStyle = 'rgba(16,24,58,' + (dark * 0.30).toFixed(3) + ')';
      bx.fillRect(0, 0, VW, VH);
    }
    var g = bx.createRadialGradient(VW / 2, VH / 2, VH * 0.42, VW / 2, VH / 2, VH * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(6,4,12,.5)');
    bx.fillStyle = g;
    bx.fillRect(0, 0, VW, VH);
  }

  var edgeSigns = null;
  function drawWorldBanner() {
    /* the far edges of the map get a polite sign */
    if (!edgeSigns) edgeSigns = [
      { x: 34, img: ACS.makeSign('END OF THE ROAD, EH', '#8f1a18') },
      { x: WORLD_W - 34, img: ACS.makeSign('SORRY, THAT IS ALL THE COUNTRY', '#8f1a18') }
    ];
    for (var i = 0; i < edgeSigns.length; i++) {
      var e = edgeSigns[i];
      var sx = Math.round(e.x - G.camX);
      if (sx < -120 || sx > VW + 120) continue;
      var gy = Math.round(ACS.surfaceY(e.x));
      bx.fillStyle = '#4a2f18'; bx.fillRect(sx - 1, gy - 30, 3, 30);
      bx.fillStyle = '#f4f7fb'; bx.fillRect(sx - 1, gy - 30, 3, 1);
      bx.drawImage(e.img, sx - (e.img.width >> 1), gy - 46);
    }
  }

  function render(dt) {
    bx.imageSmoothingEnabled = false;
    var camX = G.camX;

    drawSky();
    ACS.drawParallax(bx, camX, G.t, G.skyPhase);
    drawProps(0.5, 0.6);
    ACS.drawGround(bx, camX, G.skyPhase);
    drawFootprints();
    drawProps(0.99, 1.01);
    drawBuildings(camX);

    /* crew + folk */
    var i;
    for (i = 0; i < G.decoMoose.length; i++) {
      var dm = G.decoMoose[i];
      if (Math.abs(dm.x - camX - VW / 2) < VW) dm.draw(bx, camX, G.t);
    }
    for (i = 0; i < G.workers.length; i++) {
      var w = G.workers[i];
      if (w.x - camX > -40 && w.x - camX < VW + 40) w.draw(bx, camX, G.t);
    }
    for (i = 0; i < G.npcs.length; i++) {
      var n = G.npcs[i];
      if (n.x - camX > -50 && n.x - camX < VW + 50) n.draw(bx, camX, G.t);
    }
    for (i = 0; i < G.caravans.length; i++) G.caravans[i].draw(bx, camX, G.t);

    /* player (+ mount) */
    if (G.player.riding) {
      var m = G.player.riding;
      m.draw(bx, camX, G.t);
    }
    G.player.draw(bx, camX, G.t);

    for (i = 0; i < G.timbits.length; i++) G.timbits[i].draw(bx, camX);
    parts.draw(bx, camX);

    drawLights(camX);
    drawVignette();

    weather.draw(bx, false);
    weather.drawLeaves(bx);
    weather.draw(bx, true);

    drawProps(1.2, 1.4);
    ACS.drawForegroundBank(bx, camX, G.skyPhase);
    drawWorldBanner();
    drawPrompt();

    /* blit */
    sctx.imageSmoothingEnabled = false;
    sctx.clearRect(0, 0, scr.width, scr.height);
    var shx = 0, shy = 0;
    if (G.camShake > 0.05) {
      shx = (Math.random() - 0.5) * G.camShake * scale;
      shy = (Math.random() - 0.5) * G.camShake * scale;
    }
    sctx.drawImage(buf.c, Math.round(shx), Math.round(shy), scr.width, scr.height);
  }

  /* ============================================================ LOOP */
  var last = 0, acc = 0, saveT = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!last) last = ts;
    var dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    G.t += dt;

    if (G.state === 'title') {
      /* keep the scene alive behind the menu */
      weather.update(dt, G.t);
      G.skyPhase = (G.skyPhase + dt / 260) % 1;
      G.camX = (G.camX + dt * 12) % (WORLD_W - VW);
      parts.update(dt);
      render(dt);
      return;
    }
    if (G.state === 'win') { weather.update(dt, G.t); parts.update(dt); render(dt); return; }

    G.playtime += dt;
    G.skyPhase = (G.skyPhase + dt / 260) % 1;
    musicTick(dt);

    if (!UI.isOpen()) {
      G.player.update(dt, input, G);
    } else {
      G.player.vx = 0;
    }

    /* mount follows the player */
    if (G.player.riding) {
      var m = G.player.riding;
      m.x = G.player.x - G.player.dir * 2;
      m.dir = G.player.dir;
      m.y = ACS.surfaceY(m.x) - m.h;
      if (!G.player.onGround) m.y = G.player.y + G.player.h - m.h + 8;
      m.anim += dt * Math.min(11, Math.abs(G.player.vx) * 0.16 + 1);
      m.frame = (m.anim | 0) % 4;
      if (Math.abs(G.player.vx) > 30 && Math.random() < dt * 8)
        G.puff(m.x - m.dir * 14, ACS.surfaceY(m.x), 2);
    }

    var i;
    for (i = 0; i < G.workers.length; i++) G.workers[i].update(dt, G);
    for (i = 0; i < G.npcs.length; i++) G.npcs[i].update(dt, G);
    for (i = G.caravans.length - 1; i >= 0; i--) {
      G.caravans[i].update(dt, G);
      if (G.caravans[i].done) G.caravans.splice(i, 1);
    }
    for (i = G.timbits.length - 1; i >= 0; i--) {
      G.timbits[i].update(dt, G);
      if (G.timbits[i].dead) G.timbits.splice(i, 1);
    }
    for (i = 0; i < G.decoMoose.length; i++) {
      var dm = G.decoMoose[i];
      dm.graze -= dt;
      if (dm.graze <= 0) { dm.graze = 2 + Math.random() * 4; dm.dir = Math.random() < 0.5 ? -1 : 1; }
      dm.anim += dt * 1.4;
      dm.frame = (dm.anim | 0) % 4;
      dm.y = ACS.surfaceY(dm.x) - dm.h + Math.round(Math.sin(G.t * 1.2 + i) * 1);
    }
    for (i = footprints.length - 1; i >= 0; i--) {
      footprints[i].life -= dt;
      if (footprints[i].life <= 0) footprints.splice(i, 1);
    }

    economy(dt);
    drawSmoke(dt);
    parts.update(dt);
    weather.update(dt, G.t);
    if (G.camShake > 0) G.camShake = Math.max(0, G.camShake - dt * 14);

    /* camera */
    var targetX = clamp(G.player.x - VW / 2 + G.player.dir * 34, 0, WORLD_W - VW);
    G.camX += (targetX - G.camX) * Math.min(1, dt * 5.5);

    render(dt);

    acc += dt;
    if (acc > 0.12) { acc = 0; UI.refresh(); }
    saveT += dt;
    if (saveT > 10) { saveT = 0; save(); }
  }

  /* ============================================================ FLOW */
  function startGame(fromSave) {
    audioInit();
    if (fromSave) { if (!load()) newGame(); }
    else newGame();
    G.rankIdx = G.rankInfo().idx;
    G.state = 'play';
    G.camX = clamp(G.player.x - VW / 2, 0, WORLD_W - VW);
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
    UI.init(G);
    UI.refresh();
    UI.toast('WELCOME TO THE GREAT WHITE NORTH. SORRY IN ADVANCE.', 'rank');
    UI.setHint('WALK RIGHT WITH D. PRESS E AT THE LUMBER CAMP TO GET GOIN, EH');
  }
  function winGame() {
    G.state = 'win';
    $('win').classList.remove('hidden');
    $('winStats').textContent =
      'EARNED ' + UI.money(G.earned) + ' - ' +
      (G.crew.beaver + G.crew.ferret + G.crew.moose) + ' CREW EMPLOYED - ' +
      G.sorries + ' APOLOGIES ISSUED';
  }

  /* ============================================================ BOOT */
  function boot() {
    parts = new ACS.Particles();
    weather = new ACS.Weather();
    props = ACS.buildProps();
    ACS.scenery();
    newGame();                       /* so the title screen has a world behind it */
    G.camX = 760;
    G.skyPhase = 0.83;   /* dusk with a hint of aurora behind the menu */
    resize();
    bindTouch();

    $('btnPlay').addEventListener('click', function () { startGame(false); });
    $('btnLoad').addEventListener('click', function () { startGame(true); });
    $('btnKeep').addEventListener('click', function () {
      $('win').classList.add('hidden');
      G.state = 'play';
    });
    if (!hasSave()) $('btnLoad').classList.add('hidden');

    window.addEventListener('beforeunload', function () { if (G.state === 'play') save(); });
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
