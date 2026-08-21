/* ============================================================
   WORLD - terrain, parallax scenery, weather, building layout
   ============================================================ */
(function () {
  'use strict';
  var ACS = (window.ACS = window.ACS || {});

  var VW = 480, VH = 270;          // virtual (art) resolution
  var WORLD_W = 5760;
  ACS.VW = VW; ACS.VH = VH; ACS.WORLD_W = WORLD_W;

  /* ---------------------------------------------------------- terrain */
  function groundY(x) {
    return 196
      + Math.sin(x * 0.00092 + 1.7) * 13
      + Math.sin(x * 0.0031) * 5
      + Math.sin(x * 0.0074 + 4) * 2.2;
  }
  ACS.groundY = groundY;

  /* the frozen lake is dead flat, as lakes tend to be */
  var LAKE = { x0: 3560, x1: 3900, y: 0 };
  LAKE.y = groundY(LAKE.x0);
  ACS.LAKE = LAKE;
  function isLake(x) { return x > LAKE.x0 && x < LAKE.x1; }
  ACS.isLake = isLake;
  function surfaceY(x) { return isLake(x) ? LAKE.y : groundY(x); }
  ACS.surfaceY = surfaceY;

  /* ---------------------------------------------------------- buildings */
  /* type: gather | craft | transport | market | morale | hire | home | hq */
  var BUILDINGS = [
    {
      key: 'cabin', name: 'HOME CABIN', kind: 'cabin', x: 190, type: 'home',
      built: true, cost: 0, art: { w: 96, h: 84, wall: '#7a4a24', roof: '#8f1a18', style: 'log' },
      desc: 'Yer parents\' basement, but it\'s a log cabin and there\'s a chesterfield.'
    },
    {
      key: 'lumber', name: 'LUMBER CAMP', kind: 'lumber', x: 560, type: 'gather',
      built: true, cost: 0, out: 'lumber', rate: 0.34, worker: 'beaver', cap: 4,
      art: { w: 104, h: 76, wall: '#6b4423', roof: '#3f5a3a', style: 'log' },
      desc: 'Beavers chew, logs fall, everybody apologizes to the tree.'
    },
    {
      key: 'sugar', name: 'SUGAR BUSH', kind: 'sugar', x: 900, type: 'gather',
      cost: 180, out: 'sap', rate: 0.42, worker: 'beaver', cap: 4,
      art: { w: 92, h: 70, wall: '#8a6035', roof: '#a8452e', style: 'plank' },
      desc: 'Taps in the maples, buckets on the trunks, sap in the pail.'
    },
    {
      key: 'spud', name: 'SPUD FARM', kind: 'spud', x: 1260, type: 'gather',
      cost: 520, out: 'potato', rate: 0.36, worker: 'beaver', cap: 5,
      art: { w: 110, h: 78, wall: '#9c5b2a', roof: '#7b3220', style: 'plank' },
      desc: 'Island potatoes. The single most important half of a poutine.'
    },
    {
      key: 'dairy', name: 'DAIRY BARN', kind: 'dairy', x: 1620, type: 'gather',
      cost: 1100, out: 'curds', rate: 0.27, worker: 'beaver', cap: 5,
      art: { w: 116, h: 88, wall: '#a72b25', roof: '#5c3b1f', style: 'plank' },
      desc: 'If the curds don\'t squeak, send \'em back. Politely.'
    },
    {
      key: 'boiler', name: 'SYRUP BOILERY', kind: 'boiler', x: 1980, type: 'craft',
      cost: 700, inp: { sap: 3, lumber: 1 }, outp: { syrup: 1 }, rate: 0.30,
      worker: 'ferret', cap: 5,
      art: { w: 98, h: 74, wall: '#6f4b2a', roof: '#c2762a', style: 'plank' },
      desc: 'Forty litres of sap in, one litre of liquid gold oot. Sorry.'
    },
    {
      key: 'pancake', name: 'PANCAKE HOUSE', kind: 'pancake', x: 2340, type: 'craft',
      cost: 1600, inp: { syrup: 1, lumber: 1 }, outp: { pancakes: 1 }, rate: 0.26,
      worker: 'ferret', cap: 5,
      art: { w: 108, h: 80, wall: '#c9a15c', roof: '#8f1a18', style: 'plank' },
      desc: 'All-you-can-eat, which around here is a legally binding challenge.'
    },
    {
      key: 'poutinerie', name: 'LA POUTINERIE', kind: 'poutinerie', x: 2700, type: 'craft',
      cost: 3000, inp: { potato: 2, curds: 1 }, outp: { poutine: 1 }, rate: 0.24,
      worker: 'ferret', cap: 6,
      art: { w: 104, h: 76, wall: '#3f5f8f', roof: '#d6252b', style: 'plank' },
      desc: 'Fries, curds, gravy. Ferrets work the fryer. Do not ask aboot ketchup.'
    },
    {
      key: 'stable', name: 'MOOSE STABLE', kind: 'stable', x: 3080, type: 'transport',
      cost: 2200, worker: 'moose', cap: 6,
      art: { w: 126, h: 92, wall: '#5c3b1f', roof: '#4a3a2a', style: 'log' },
      desc: 'Each moose hauls a load to the trading post. Runs on maple syrup.'
    },
    {
      key: 'timmys', name: 'TIM BORTONS', kind: 'timmys', x: 3400, type: 'morale',
      cost: 1500, morale: 0.14,
      art: { w: 100, h: 74, wall: '#8f3a1a', roof: '#5c2010', style: 'plank' },
      desc: 'Double-doubles for the whole crew. +14% output per level, eh.'
    },
    {
      key: 'rink', name: 'BACKYARD RINK', kind: 'rink', x: 3720, type: 'morale',
      cost: 2600, morale: 0.18, art: null,
      desc: 'Shinny keeps morale up. +18% output per level. Watch the shins.'
    },
    {
      key: 'market', name: 'TRADING POST', kind: 'market', x: 4120, type: 'market',
      built: true, cost: 0,
      art: { w: 118, h: 82, wall: '#7d5a34', roof: '#2f6b34', style: 'plank' },
      desc: 'Sell anything here by hand at 85%, or let the moose haul it for full price.'
    },
    {
      key: 'lodge', name: 'BEAVER LODGE', kind: 'lodge', x: 4470, type: 'hire',
      built: true, hires: 'beaver', art: null,
      desc: 'A big pile of sticks full of extremely employable rodents.'
    },
    {
      key: 'burrow', name: 'FERRET BURROW', kind: 'burrow', x: 4760, type: 'hire',
      built: true, hires: 'ferret', art: null,
      desc: 'A warm hole containing one (1) writhing pile of ferrets.'
    },
    {
      key: 'corral', name: 'MOOSE CORRAL', kind: 'corral', x: 5060, type: 'hire',
      built: true, hires: 'moose', art: null,
      desc: 'Free-range moose. Please do not honk at them, they honk back.'
    },
    {
      key: 'hq', name: 'MAPLE PARLIAMENT', kind: 'hq', x: 5420, type: 'hq',
      built: true, art: { w: 140, h: 104, wall: '#6d6f7a', roof: '#2f6b34', style: 'plank', roofH: 34 },
      desc: 'Where they decide who gets to be Prime Minister of Maple.'
    }
  ];
  ACS.BUILDING_DEFS = BUILDINGS;

  /* ---------------------------------------------------------- economy tables */
  ACS.PRICES = { sap: 1, lumber: 2, potato: 3, curds: 5, syrup: 15, pancakes: 32, poutine: 58 };
  ACS.RES_ORDER = ['sap', 'lumber', 'potato', 'curds', 'syrup', 'pancakes', 'poutine'];
  ACS.RES_LABEL = {
    sap: 'SAP', lumber: 'LUMBER', potato: 'SPUDS', curds: 'CURDS',
    syrup: 'SYRUP', pancakes: 'PANCAKES', poutine: 'POUTINE'
  };

  ACS.RANKS = [
    { at: 0, name: 'LOST TOURIST' },
    { at: 600, name: 'SORRY SAPLING' },
    { at: 3000, name: 'TOQUE APPRENTICE' },
    { at: 11000, name: 'DOUBLE-DOUBLE DEALER' },
    { at: 38000, name: 'SYRUP BARON' },
    { at: 110000, name: 'POUTINE TYCOON' },
    { at: 320000, name: 'MOOSE MARSHAL' },
    { at: 780000, name: 'GREAT WHITE MAGNATE' },
    { at: 1500000, name: 'PRIME MINISTER OF MAPLE' }
  ];

  /* ---------------------------------------------------------- sky */
  var SKY_KEYS = [
    { t: 0.00, top: '#0a0f26', bot: '#22305e', sun: null, aur: 1.0, amb: '#2b3a66' },   // deep night
    { t: 0.18, top: '#241a44', bot: '#8a5a6e', sun: '#ffb46b', aur: 0.5, amb: '#5a4a66' }, // dawn
    { t: 0.30, top: '#3f7fc4', bot: '#bfe3f5', sun: '#fff2c8', aur: 0.0, amb: '#cfe4f5' }, // day
    { t: 0.62, top: '#4a86c8', bot: '#d5ecf8', sun: '#fff6dc', aur: 0.0, amb: '#dcecf8' }, // day
    { t: 0.78, top: '#3a2350', bot: '#ef7a5a', sun: '#ff9a4a', aur: 0.35, amb: '#7a5a6a' },// dusk
    { t: 1.00, top: '#0a0f26', bot: '#22305e', sun: null, aur: 1.0, amb: '#2b3a66' }
  ];
  function skyAt(p) {
    var i = 0;
    while (i < SKY_KEYS.length - 2 && p > SKY_KEYS[i + 1].t) i++;
    var a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
    var t = (p - a.t) / (b.t - a.t);
    return {
      top: ACS.mix(a.top, b.top, t),
      bot: ACS.mix(a.bot, b.bot, t),
      aur: a.aur + (b.aur - a.aur) * t,
      amb: ACS.mix(a.amb, b.amb, t),
      night: Math.max(0, 1 - (a.aur + (b.aur - a.aur) * t) * 0 - 0) // placeholder, see darkness()
    };
  }
  ACS.skyAt = skyAt;
  /* how dark it is: 0 = noon, 1 = midnight */
  function darkness(p) {
    var s = skyAt(p);
    return Math.min(1, s.aur);
  }
  ACS.darkness = darkness;

  /* ---------------------------------------------------------- scenery cache */
  var scenery = null;
  function buildScenery() {
    if (scenery) return scenery;
    scenery = {
      ridgeFar: ACS.makeRidge(720, 120, 7, { base: '#2f3f66', snow: '#8fb0d6', peaks: 7, amp: 100, capDepth: 22 }),
      ridgeMid: ACS.makeRidge(640, 96, 23, { base: '#26355a', snow: '#b9d2ee', peaks: 9, amp: 84, capDepth: 16 }),
      ridgeNear: ACS.makeRidge(560, 70, 61, { base: '#1b2744', snow: '#d2e6f8', peaks: 12, amp: 58, capDepth: 10 }),
      pines: [], maples: [], rocks: [], stump: ACS.makeStump(),
      snowman: ACS.makeSnowman(), flag: ACS.makeFlag(), net: ACS.makeHockeyNet(),
      axe: ACS.makeAxe()
    };
    var i;
    for (i = 0; i < 7; i++) scenery.pines.push(ACS.makePine(11 + i * 37));
    for (i = 0; i < 4; i++) scenery.maples.push(ACS.makeMaple(101 + i * 53, i % 2 === 0));
    for (i = 0; i < 4; i++) scenery.rocks.push(ACS.makeRock(5 + i * 19));
    return scenery;
  }
  ACS.scenery = buildScenery;

  /* ---------------------------------------------------------- props layout */
  function buildProps() {
    var r = ACS.rng(20240521);
    var props = [];
    var i, x;

    /* background forest bands (parallax 0.55) */
    for (x = -200; x < WORLD_W + 400; x += 26 + r() * 40) {
      props.push({ t: 'bgpine', x: x, s: 0.55, i: (r() * 7) | 0, sc: 0.7 + r() * 0.5 });
    }
    /* foreground pines - dense near the lumber camp, thinner elsewhere */
    for (x = 40; x < WORLD_W; x += 55 + r() * 130) {
      var dense = (x > 380 && x < 800);
      if (!dense && r() < 0.42) continue;
      if (x > 3540 && x < 3920) continue;             // keep the lake clear
      props.push({ t: 'pine', x: x, s: 1, i: (r() * 7) | 0, sc: 0.8 + r() * 0.45 });
      if (dense) x -= 30;
    }
    /* the sugar bush: maples with taps */
    for (i = 0; i < 9; i++) {
      props.push({ t: 'maple', x: 790 + i * 44 + r() * 14, s: 1, i: i % 4, sc: 0.85 + r() * 0.3 });
    }
    for (i = 0; i < 4; i++) props.push({ t: 'maple', x: 4300 + i * 62, s: 1, i: i % 4, sc: 0.9 });
    /* rocks, stumps, snowmen */
    for (i = 0; i < 26; i++) props.push({ t: 'rock', x: 120 + r() * (WORLD_W - 240), s: 1, i: (r() * 4) | 0, sc: 1 });
    for (i = 0; i < 14; i++) props.push({ t: 'stump', x: 420 + r() * 500, s: 1, i: 0, sc: 1 });
    for (i = 0; i < 9; i++) props.push({ t: 'snowman', x: 260 + r() * (WORLD_W - 500), s: 1, i: 0, sc: 1 });
    /* potato rows in front of the spud farm */
    for (i = 0; i < 16; i++) props.push({ t: 'spudrow', x: 1180 + i * 12, s: 1, i: 0, sc: 1 });

    props.sort(function (a, b) { return a.s - b.s || a.x - b.x; });
    return props;
  }
  ACS.buildProps = buildProps;

  /* ---------------------------------------------------------- weather */
  function Weather() {
    this.snow = [];
    this.leaves = [];
    this.gust = 0;
    this.gustT = 0;
    var i;
    for (i = 0; i < 260; i++) {
      this.snow.push({
        x: Math.random() * VW, y: Math.random() * VH,
        z: 0.35 + Math.random() * 1.5,
        p: Math.random() * 6.28, sp: 0.25 + Math.random() * 0.6
      });
    }
    for (i = 0; i < 9; i++) this.leaves.push(this.newLeaf(true));
  }
  Weather.prototype.newLeaf = function (anywhere) {
    return {
      x: Math.random() * VW, y: anywhere ? Math.random() * VH : -12,
      z: 0.6 + Math.random() * 0.9, p: Math.random() * 6.28,
      rot: Math.random() * 4, spin: (Math.random() - 0.5) * 3,
      c: ['#c0392b', '#d6602b', '#e0913a', '#a8241f'][(Math.random() * 4) | 0]
    };
  };
  Weather.prototype.update = function (dt, t) {
    this.gustT -= dt;
    if (this.gustT <= 0) { this.gustT = 3 + Math.random() * 7; this.gust = (Math.random() - 0.35) * 26; }
    var g = this.gust, i, s;
    for (i = 0; i < this.snow.length; i++) {
      s = this.snow[i];
      s.y += (16 + s.z * 30) * s.sp * dt;
      s.x += (Math.sin(t * 0.6 + s.p) * 7 + g) * s.z * dt;
      if (s.y > VH + 4) { s.y = -4; s.x = Math.random() * VW; }
      if (s.x < -6) s.x += VW + 12; else if (s.x > VW + 6) s.x -= VW + 12;
    }
    for (i = 0; i < this.leaves.length; i++) {
      s = this.leaves[i];
      s.y += (11 + s.z * 15) * dt;
      s.x += (Math.sin(t * 1.4 + s.p) * 20 + g * 0.7) * s.z * dt;
      s.rot += s.spin * dt;
      if (s.y > VH + 10) this.leaves[i] = this.newLeaf(false);
      if (s.x < -14) s.x += VW + 28; else if (s.x > VW + 14) s.x -= VW + 28;
    }
  };
  /* snow is drawn in two passes so some falls behind the player */
  Weather.prototype.draw = function (ctx, near) {
    var i, s;
    for (i = 0; i < this.snow.length; i++) {
      s = this.snow[i];
      var isNear = s.z > 1.0;
      if (isNear !== near) continue;
      var sz = s.z > 1.25 ? 2 : 1;
      ctx.fillStyle = s.z > 1.0 ? 'rgba(255,255,255,.95)' : 'rgba(226,238,250,' + (0.32 + s.z * 0.3) + ')';
      ctx.fillRect(s.x | 0, s.y | 0, sz, sz);
    }
  };
  Weather.prototype.drawLeaves = function (ctx) {
    var leaf = ACS.item('leaf');
    for (var i = 0; i < this.leaves.length; i++) {
      var s = this.leaves[i];
      var sq = Math.abs(Math.cos(s.rot));           // fake spin by squashing
      var w = Math.max(1, Math.round(7 * s.z * sq)), h = Math.round(7 * s.z);
      ctx.globalAlpha = 0.82;
      ctx.drawImage(leaf, Math.round(s.x - w / 2), Math.round(s.y - h / 2), w, h);
      ctx.globalAlpha = 1;
    }
  };
  ACS.Weather = Weather;

  /* ---------------------------------------------------------- aurora */
  function drawAurora(ctx, t, strength) {
    if (strength <= 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var bands = [
      { c: '#3cf0a8', y: 34, a: 0.30, f: 0.019, sp: 0.22, h: 44 },
      { c: '#59c8ff', y: 50, a: 0.22, f: 0.013, sp: -0.16, h: 56 },
      { c: '#b06cff', y: 26, a: 0.16, f: 0.026, sp: 0.31, h: 38 }
    ];
    for (var b = 0; b < bands.length; b++) {
      var B = bands[b];
      for (var x = 0; x < VW; x += 2) {
        var y = B.y
          + Math.sin(x * B.f + t * B.sp) * 13
          + Math.sin(x * B.f * 2.6 + t * B.sp * 1.7) * 5;
        var flick = 0.62 + 0.38 * Math.sin(x * 0.05 + t * 1.6 + b);
        var g = ctx.createLinearGradient(0, y, 0, y + B.h);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.32, B.c);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = B.a * strength * flick;
        ctx.fillStyle = g;
        ctx.fillRect(x, y, 2, B.h);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  ACS.drawAurora = drawAurora;

  /* ---------------------------------------------------------- stars */
  var STARS = (function () {
    var r = ACS.rng(777), a = [];
    for (var i = 0; i < 130; i++)
      a.push({ x: r() * VW, y: r() * 130, b: 0.35 + r() * 0.65, p: r() * 6.28 });
    return a;
  })();
  function drawStars(ctx, t, strength) {
    if (strength <= 0.03) return;
    for (var i = 0; i < STARS.length; i++) {
      var s = STARS[i];
      var tw = 0.6 + 0.4 * Math.sin(t * 2.2 + s.p);
      ctx.fillStyle = 'rgba(255,255,255,' + (s.b * tw * strength).toFixed(3) + ')';
      ctx.fillRect(s.x | 0, s.y | 0, 1, 1);
    }
  }
  ACS.drawStars = drawStars;

  /* ---------------------------------------------------------- ground */
  function drawGround(ctx, camX, phase) {
    var dark = darkness(phase);
    var snowTop = ACS.mix('#f6fbff', '#9fb6d8', dark * 0.75);
    var snowMid = ACS.mix('#dae8f6', '#6f88ad', dark * 0.75);
    var snowLow = ACS.mix('#b6c8de', '#48597a', dark * 0.8);
    var dirt = ACS.mix('#8ea6c6', '#33456a', dark * 0.8);

    for (var sx = 0; sx < VW; sx++) {
      var wx = camX + sx;
      var lake = isLake(wx);
      var gy = Math.round(surfaceY(wx));
      if (lake) {
        /* frozen lake seen edge-on: bright surface, pale shelf, then the
           deep green-black of a lake that has not seen the sun since November */
        ctx.fillStyle = ACS.mix('#f2fbff', '#93c4dc', dark * 0.6);
        ctx.fillRect(sx, gy, 1, 2);
        ctx.fillStyle = ACS.mix('#d3edf8', '#5a8daf', dark * 0.7);
        ctx.fillRect(sx, gy + 2, 1, 7);
        var w1 = Math.round(Math.sin(wx * 0.017) * 2), w2 = Math.round(Math.sin(wx * 0.009 + 2) * 3);
        ctx.fillStyle = ACS.mix('#a8cfe2', '#3d6a8c', dark * 0.75);
        ctx.fillRect(sx, gy + 9, 1, 14 + w1);
        ctx.fillStyle = ACS.mix('#6e9db6', '#22415c', dark * 0.8);
        ctx.fillRect(sx, gy + 23 + w1, 1, 20 + w2);
        ctx.fillStyle = ACS.mix('#3f6a84', '#152a3e', dark * 0.85);
        ctx.fillRect(sx, gy + 43 + w1 + w2, 1, VH - gy);
        /* shine band, pressure cracks, trapped bubbles, drifted snow */
        if ((wx * 7) % 53 === 0) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(sx, gy + 3 + (wx % 5), 3, 1); }
        if ((wx * 13) % 61 === 0) { ctx.fillStyle = 'rgba(226,244,255,.45)'; ctx.fillRect(sx, gy + 2, 1, 10 + (wx % 14)); }
        if ((wx * 29) % 43 === 0) { ctx.fillStyle = 'rgba(232,248,255,.28)'; ctx.fillRect(sx, gy + 14 + (wx % 26), 1, 1); }
        if ((wx * 11) % 37 === 0) { ctx.fillStyle = ACS.mix('#ffffff', '#b9cee4', dark * 0.5); ctx.fillRect(sx, gy - 1, 5, 2); }
      } else {
        var drift = Math.round(Math.sin(wx * 0.021) * 2 + Math.sin(wx * 0.006) * 3);
        /* it is snow all the way down - there is no dirt in January */
        ctx.fillStyle = snowTop; ctx.fillRect(sx, gy, 1, 6);
        ctx.fillStyle = snowMid; ctx.fillRect(sx, gy + 6, 1, 14 + drift);
        ctx.fillStyle = snowLow; ctx.fillRect(sx, gy + 20 + drift, 1, VH - gy);
        ctx.fillStyle = dirt; ctx.fillRect(sx, gy + 52 + drift, 1, VH - gy);
        /* sparkle, wind-scour lines and buried rock */
        if ((wx * 31) % 211 === 0) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(sx, gy + 1, 1, 1); }
        if ((wx * 23) % 67 === 0) { ctx.fillStyle = ACS.mix('#c3d6ea', '#5d7396', dark * 0.7); ctx.fillRect(sx, gy + 9 + (wx % 8), 3, 1); }
        if ((wx * 19) % 131 === 0) { ctx.fillStyle = ACS.mix('#cbdcee', '#61789c', dark * 0.7); ctx.fillRect(sx, gy + 26 + (wx % 14), 4, 1); }
        if ((wx * 17) % 149 === 0) { ctx.fillStyle = ACS.mix('#3a3244', '#17121f', dark * 0.6); ctx.fillRect(sx, gy + 58 + (wx % 11), 1, 3); }
      }
    }
    /* lake edges: snowbank lips */
    var e0 = Math.round(LAKE.x0 - camX), e1 = Math.round(LAKE.x1 - camX);
    [e0, e1].forEach(function (ex) {
      if (ex > -12 && ex < VW + 12) {
        ctx.fillStyle = snowTop;
        for (var k = 0; k < 10; k++) {
          var w = 10 - k;
          ctx.fillRect(ex - (ex === e0 ? w : 0), Math.round(LAKE.y) - 4 + k, w, 1);
        }
      }
    });
  }
  ACS.drawGround = drawGround;

  /* ---------------------------------------------------------- parallax */
  function drawParallax(ctx, camX, t, phase) {
    var S = buildScenery();
    var dark = darkness(phase);
    var horizon = 176;

    function band(img, factor, y) {
      if (!img._night) img._night = ACS.tintCopy(img, '#0e142c', 1);
      var w = img.width;
      var off = -(camX * factor) % w;
      if (off > 0) off -= w;
      var x;
      for (x = off; x < VW; x += w) ctx.drawImage(img, Math.round(x), y);
      if (dark > 0.02) {
        ctx.globalAlpha = dark * 0.55;
        for (x = off; x < VW; x += w) ctx.drawImage(img._night, Math.round(x), y);
        ctx.globalAlpha = 1;
      }
    }
    /* terrain dips to ~216, so the near range must reach past that or a
       band of sky shows through between the mountains and the snow */
    band(S.ridgeFar, 0.08, horizon - 116);
    band(S.ridgeMid, 0.16, horizon - 80);
    band(S.ridgeNear, 0.27, horizon - 26);

    /* distant frozen treeline haze - a soft band of blowing snow */
    var hazeCol = ACS.mix('#cee2f4', '#283a60', dark);
    var hg = ctx.createLinearGradient(0, horizon - 16, 0, horizon + 10);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(0.55, hazeCol);
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = hg;
    ctx.fillRect(0, horizon - 16, VW, 26);
    ctx.restore();
  }
  ACS.drawParallax = drawParallax;

  /* ---------------------------------------------------------- moon/sun */
  function drawCelestial(ctx, t, phase) {
    var ang = phase * Math.PI * 2 - Math.PI / 2;
    var cx = VW * 0.5 + Math.cos(ang) * VW * 0.62;
    var cy = 150 + Math.sin(ang) * 130;
    var dark = darkness(phase);
    ctx.save();
    if (dark > 0.4) {
      /* moon */
      var mx = VW * 0.5 - Math.cos(ang) * VW * 0.5, my = 130 - Math.sin(ang) * 100;
      ctx.globalAlpha = Math.min(1, (dark - 0.35) * 2.2);
      ctx.fillStyle = 'rgba(230,240,255,.14)';
      ctx.beginPath(); ctx.arc(mx, my, 22, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#eef4ff';
      ctx.fillRect(mx - 9, my - 11, 18, 22);
      ctx.fillRect(mx - 11, my - 9, 22, 18);
      ctx.fillStyle = '#cfdcf0';
      ctx.fillRect(mx - 5, my - 5, 4, 3); ctx.fillRect(mx + 2, my + 1, 3, 4);
      ctx.fillRect(mx - 7, my + 4, 3, 2);
    }
    if (dark < 0.75 && cy < 190) {
      ctx.globalAlpha = Math.min(1, (0.85 - dark) * 1.6);
      ctx.fillStyle = 'rgba(255,232,180,.16)';
      ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#fff4cf';
      ctx.fillRect(cx - 8, cy - 10, 16, 20);
      ctx.fillRect(cx - 10, cy - 8, 20, 16);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  ACS.drawCelestial = drawCelestial;

  /* ---------------------------------------------------------- foreground bank
     A near snowdrift that slides past faster than the world, which sells
     the depth better than anything else in the scene. */
  function drawForegroundBank(ctx, camX, phase) {
    var dark = darkness(phase);
    var top = ACS.mix('#ffffff', '#a9bcd8', dark * 0.6);
    var body = ACS.mix('#dfeaf7', '#61759a', dark * 0.7);
    var off = camX * 1.18;
    for (var x = 0; x < VW; x++) {
      var wx = x + off;
      var y = VH - 16
        - Math.sin(wx * 0.011) * 7
        - Math.sin(wx * 0.037 + 2) * 3
        - Math.sin(wx * 0.0035) * 5;
      y = Math.round(y);
      ctx.fillStyle = top; ctx.fillRect(x, y, 1, 3);
      ctx.fillStyle = body; ctx.fillRect(x, y + 3, 1, VH - y);
      if ((wx | 0) % 37 === 0) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x, y + 5, 1, 2); }
    }
  }
  ACS.drawForegroundBank = drawForegroundBank;
})();
