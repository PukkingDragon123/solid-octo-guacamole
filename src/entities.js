/* ============================================================
   ENTITIES - player, crew, townsfolk, caravans, particles
   ============================================================ */
(function () {
  'use strict';
  var ACS = (window.ACS = window.ACS || {});
  var L = ACS.LINES;

  var GRAV = 560, VW = ACS.VW, VH = ACS.VH;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  ACS.clamp = clamp;

  /* ============================================================ PLAYER */
  function Player(x) {
    this.x = x; this.y = ACS.surfaceY(x) - 21;
    this.vx = 0; this.vy = 0;
    this.dir = 1; this.onGround = true;
    this.anim = 0; this.frame = 0;
    this.swing = 0;         // axe swing timer
    this.riding = null;     // moose entity when mounted
    this.w = 16; this.h = 21;
    this.lift = 0;      // raised while sat on a moose
    this.footT = 0;
    this.art = ACS.makeChar({
      head: 'toque', face: 'beard',
      toque: '#c0392b',
      plaid: { a: '#c93b32', b: '#241a20', m: '#7d2119', l: '#e8635a' },
      pants: '#33415e', boots: '#4a2f18'
    });
    this.artFlip = {
      walk: this.art.walk.map(ACS.flip),
      jump: ACS.flip(this.art.jump),
      sit: ACS.flip(this.art.sit)
    };
  }
  Player.prototype.speed = function () { return this.riding ? 148 : 66; };
  Player.prototype.update = function (dt, input, G) {
    var sp = this.speed();
    var ax = 0;
    if (input.left) ax -= 1;
    if (input.right) ax += 1;
    if (ax !== 0) this.dir = ax;
    this.vx += (ax * sp - this.vx) * Math.min(1, dt * 12);
    if (Math.abs(this.vx) < 2) this.vx = 0;

    this.x = clamp(this.x + this.vx * dt, 8, ACS.WORLD_W - 8);

    /* jump */
    var gy = ACS.surfaceY(this.x) - this.h - this.lift;
    if (input.jump && this.onGround) {
      this.vy = this.riding ? -228 : -196;
      this.onGround = false;
      G.puff(this.x, this.y + this.h, 6);
      G.sfx('jump');
    }
    this.vy += GRAV * dt;
    this.y += this.vy * dt;
    if (this.y >= gy) {
      if (!this.onGround && this.vy > 120) { G.puff(this.x, gy + this.h + this.lift, 9); G.shake(1.6); }
      this.y = gy; this.vy = 0; this.onGround = true;
    }

    /* animation */
    if (Math.abs(this.vx) > 6 && this.onGround) {
      this.anim += dt * (this.riding ? 9 : Math.abs(this.vx) * 0.16);
      this.frame = (this.anim | 0) % 4;
      /* footprints in the snow */
      this.footT -= dt;
      if (this.footT <= 0 && !this.riding && !ACS.isLake(this.x)) {
        this.footT = 0.22;
        G.footprint(this.x - this.dir * 3, ACS.surfaceY(this.x));
        if (Math.random() < 0.5) G.sfx('step');
      }
    } else { this.anim = 0; this.frame = 0; }

    if (this.swing > 0) this.swing -= dt;
  };
  Player.prototype.draw = function (ctx, camX, t) {
    var a = this.dir > 0 ? this.art : this.artFlip;
    var img = this.onGround ? a.walk[this.frame] : a.jump;
    var x = Math.round(this.x - camX - 8);
    var y = Math.round(this.y);
    if (this.riding) y -= 1 + Math.round(Math.sin(t * 9) * 1);

    /* the axe, mid-swing */
    if (this.swing > 0) {
      var p = 1 - this.swing / 0.34;
      var ang = (-1.5 + p * 2.6) * this.dir;
      ctx.save();
      ctx.translate(x + 8 + this.dir * 7, y + 12);
      ctx.rotate(ang);
      ctx.drawImage(ACS.scenery().axe, -4, -10);
      ctx.restore();
    }
    ctx.drawImage(img, x, y);
  };

  /* ============================================================ WORKER
     Beavers / ferrets that visibly loiter and work at a building. */
  function Worker(kind, homeX, seed) {
    this.kind = kind;
    this.homeX = homeX;
    this.x = homeX + (Math.random() - 0.5) * 40;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.t = Math.random() * 3;
    this.anim = Math.random() * 4;
    this.state = 'work';
    this.work = 0;
    this.bubble = null; this.bubbleT = 0;
    var fur;
    if (kind === 'beaver') {
      fur = ['#7a4a24', '#6b3f1e', '#8a5730', '#5f3618'][seed % 4];
      this.art = ACS.makeBeaver({ fur: fur });
      this.hat = Math.random() < 0.55;
      this.h = 11; this.w = 14;
    } else {
      fur = ['#ead9b6', '#d8c49a', '#f2e6cc', '#c9b489'][seed % 4];
      this.art = ACS.makeFerret({ fur: fur, mask: ACS.shade(fur, -0.35) });
      this.h = 8; this.w = 16;
    }
    this.artFlip = { walk: this.art.walk.map(ACS.flip) };
    this.y = ACS.surfaceY(this.x) - this.h;
  }
  Worker.prototype.update = function (dt, G) {
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0.8 + Math.random() * 2.6;
      var r = Math.random();
      if (r < 0.45) { this.state = 'work'; }
      else if (r < 0.8) { this.state = 'walk'; this.dir = Math.random() < 0.5 ? -1 : 1; }
      else { this.state = 'idle'; }
      if (Math.random() < 0.10 && G.canTalk(this)) {
        this.bubble = ACS.wrap(L.pick(this.kind === 'beaver' ? L.beaverHire : L.ferretHire), 16);
        this.bubbleT = 2.4;
      }
    }
    if (this.state === 'walk') {
      this.x += this.dir * 17 * dt;
      if (Math.abs(this.x - this.homeX) > 46) this.dir = this.x > this.homeX ? -1 : 1;
      this.anim += dt * 7;
    } else if (this.state === 'work') {
      this.work += dt * 8;
      this.anim += dt * 3;
      if (this.kind === 'beaver' && Math.sin(this.work) > 0.96 && Math.random() < 0.4)
        G.chip(this.x + this.dir * 8, this.y + 4);
    }
    this.y = ACS.surfaceY(this.x) - this.h;
    if (this.bubbleT > 0) this.bubbleT -= dt;
  };
  Worker.prototype.draw = function (ctx, camX, t) {
    var a = this.dir > 0 ? this.art : this.artFlip;
    var f = ((this.anim | 0) % 2);
    var x = Math.round(this.x - camX - this.w / 2);
    var y = Math.round(this.y);
    var bob = 0;
    if (this.state === 'work') bob = Math.round(Math.abs(Math.sin(this.work)) * 2);
    ctx.drawImage(a.walk[f], x, y + bob);
    if (this.kind === 'beaver' && this.hat)
      ctx.drawImage(ACS.HARDHAT, x + 2, y + bob - 3);
    if (this.bubbleT > 0 && this.bubble)
      ACS.speechBubble(ctx, this.bubble, this.x - camX, y - 4, { fill: '#fff6dc' });
  };

  /* ============================================================ NPC
     Townsfolk. Their entire personality is regret. */
  function NPC(x, seed, homeKind) {
    var r = ACS.rng(seed * 31 + 7);
    this.homeX = x;
    this.x = x; this.range = 44 + r() * 70;
    this.dir = r() < 0.5 ? -1 : 1;
    this.homeKind = homeKind;
    this.name = ACS.NAMES[(r() * ACS.NAMES.length) | 0];
    this.state = 'walk'; this.t = r() * 3;
    this.anim = r() * 4; this.frame = 0;
    this.bubble = null; this.bubbleT = 0;
    this.talkCd = 0;
    this.h = 21; this.w = 16;
    var plaidA = ['#c93b32', '#2f6b34', '#3f5f8f', '#9c5b2a', '#7b3a8f'][(r() * 5) | 0];
    var toques = ['#c0392b', '#2f6b34', '#3f5f8f', '#e0913a', '#7b3a8f', '#f4f6fb'];
    var skins = ['#f5c39a', '#e0b083', '#c98d63', '#a16b45', '#7c5033'];
    var heads = ['toque', 'toque', 'toque', 'cap', 'earflap', 'helmet', 'hair'];
    var faces = ['beard', 'clean', 'stache'];
    this.art = ACS.makeChar({
      head: heads[(r() * heads.length) | 0],
      face: faces[(r() * faces.length) | 0],
      toque: toques[(r() * toques.length) | 0],
      skin: skins[(r() * skins.length) | 0],
      hair: ['#8a6842', '#3a2a1c', '#c9a05c', '#6b6f78'][(r() * 4) | 0],
      pants: ['#33415e', '#3a2f2a', '#243447'][(r() * 3) | 0],
      plaid: { a: plaidA, b: '#241a20', m: ACS.shade(plaidA, -0.4), l: ACS.shade(plaidA, 0.2) }
    });
    this.artFlip = { walk: this.art.walk.map(ACS.flip), jump: ACS.flip(this.art.jump) };
    this.y = ACS.surfaceY(this.x) - this.h;
    this.speed = 15 + r() * 13;
  }
  NPC.prototype.say = function (txt, dur) {
    this.bubble = ACS.wrap(L.ehify(txt), 17);
    this.bubbleT = dur || 3.0;
  };
  NPC.prototype.update = function (dt, G) {
    this.t -= dt;
    if (this.talkCd > 0) this.talkCd -= dt;
    if (this.t <= 0) {
      this.t = 1.2 + Math.random() * 3.4;
      var r = Math.random();
      if (r < 0.55) { this.state = 'walk'; this.dir = Math.random() < 0.5 ? -1 : 1; }
      else this.state = 'idle';
      if (Math.random() < 0.30 && G.canTalk(this)) this.say(L.ambient(this.homeKind), 2.8);
    }
    if (this.state === 'walk') {
      this.x += this.dir * this.speed * dt;
      if (Math.abs(this.x - this.homeX) > this.range) this.dir = this.x > this.homeX ? -1 : 1;
      this.anim += dt * this.speed * 0.16;
      this.frame = (this.anim | 0) % 4;
    } else { this.frame = 0; }

    /* the sacred ritual: bump into someone, apologize immediately */
    var p = G.player;
    if (!p.riding && Math.abs(p.x - this.x) < 11 && this.talkCd <= 0) {
      this.talkCd = 4 + Math.random() * 4;
      this.say(L.pick(L.sorry), 2.4);
      G.addPolite(1.2);
      G.sfx('sorry');
      this.dir = p.x > this.x ? -1 : 1;
      this.state = 'walk';
    }
    this.y = ACS.surfaceY(this.x) - this.h;
    if (this.bubbleT > 0) this.bubbleT -= dt;
  };
  NPC.prototype.draw = function (ctx, camX, t) {
    var a = this.dir > 0 ? this.art : this.artFlip;
    var x = Math.round(this.x - camX - 8), y = Math.round(this.y);
    ctx.drawImage(a.walk[this.frame], x, y);
    if (this.bubbleT > 0 && this.bubble)
      ACS.speechBubble(ctx, this.bubble, this.x - camX, y - 3, {});
  };

  /* ============================================================ MOOSE */
  function Moose(x, opts) {
    opts = opts || {};
    this.x = x; this.dir = 1;
    this.anim = 0; this.frame = 0;
    this.w = 38; this.h = 32;
    this.art = ACS.makeMoose({ fur: opts.fur || '#5d3a1f' });
    this.artFlip = { walk: this.art.walk.map(ACS.flip) };
    this.y = ACS.surfaceY(x) - this.h;
    this.mounted = false;
    this.cargo = null;
    this.honk = 0;
  }
  Moose.prototype.draw = function (ctx, camX, t) {
    var a = this.dir > 0 ? this.art : this.artFlip;
    var x = Math.round(this.x - camX - this.w / 2), y = Math.round(this.y);
    ctx.drawImage(a.walk[this.frame], x, y);
    /* saddle */
    ctx.drawImage(ACS.SADDLE, x + (this.dir > 0 ? 15 : 13), y + 8);
    /* crates lashed to the back */
    if (this.cargo && this.cargo.n > 0) {
      var n = Math.min(4, this.cargo.n);
      for (var i = 0; i < n; i++) {
        var cx = x + (this.dir > 0 ? 17 : 11) + (i % 2) * 9;
        var cy = y + 2 - ((i / 2) | 0) * 8;
        ctx.drawImage(ACS.CRATE, cx, cy);
        var ico = ACS.item(this.cargo.icon);
        ctx.drawImage(ico, cx, cy - 1, 10, 10);
      }
    }
  };

  /* ============================================================ CARAVAN
     A moose that walks goods to the trading post and comes home. */
  function Caravan(fromX, toX, cargo, value) {
    this.moose = new Moose(fromX, { fur: ['#5d3a1f', '#4a2f18', '#6b4626'][(Math.random() * 3) | 0] });
    this.fromX = fromX; this.toX = toX;
    this.cargo = cargo; this.value = value;
    this.moose.cargo = cargo;
    this.moose.dir = toX > fromX ? 1 : -1;
    this.phase = 'out';        // out -> unload -> back -> done
    this.timer = 0;
    this.done = false;
    this.driver = new Worker('beaver', fromX, (Math.random() * 4) | 0);
    this.driver.state = 'idle';
    this.speed = 112;   // a moose on syrup does not dawdle
  }
  Caravan.prototype.update = function (dt, G) {
    var m = this.moose;
    if (this.phase === 'out') {
      m.x += m.dir * this.speed * dt;
      m.anim += dt * 7; m.frame = (m.anim | 0) % 4;
      if ((m.dir > 0 && m.x >= this.toX) || (m.dir < 0 && m.x <= this.toX)) {
        m.x = this.toX; this.phase = 'unload'; this.timer = 1.1;
        G.sellCaravan(this);
      }
    } else if (this.phase === 'unload') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = 'back'; m.dir *= -1; m.cargo = null; this.cargo = null;
      }
    } else if (this.phase === 'back') {
      m.x += m.dir * this.speed * dt;
      m.anim += dt * 7; m.frame = (m.anim | 0) % 4;
      if ((m.dir > 0 && m.x >= this.fromX) || (m.dir < 0 && m.x <= this.fromX)) this.done = true;
    }
    m.y = ACS.surfaceY(m.x) - m.h + Math.round(Math.sin(m.anim * 2) * 1);
    this.driver.x = m.x - m.dir * 2;
    this.driver.y = m.y + 2;
    this.driver.dir = m.dir;
  };
  Caravan.prototype.draw = function (ctx, camX, t) {
    this.moose.draw(ctx, camX, t);
    /* a beaver rides shotgun, obviously */
    var a = this.driver.dir > 0 ? this.driver.art : this.driver.artFlip;
    ctx.drawImage(a.walk[(this.moose.anim | 0) % 2],
      Math.round(this.driver.x - camX - 7), Math.round(this.driver.y - 4));
    if (this.phase === 'unload')
      ACS.speechBubble(ctx, [L.pick(['sold!', 'sorry, sold', 'beauty!'])], this.moose.x - camX, this.moose.y - 6, { fill: '#d8f0c8' });
  };

  /* ============================================================ PARTICLES */
  function Particles() { this.a = []; }
  Particles.prototype.add = function (p) { if (this.a.length < 520) this.a.push(p); };
  Particles.prototype.update = function (dt) {
    for (var i = this.a.length - 1; i >= 0; i--) {
      var p = this.a[i];
      p.life -= dt;
      if (p.life <= 0) { this.a.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.g) p.vy += p.g * dt;
      if (p.drag) { p.vx *= (1 - p.drag * dt); p.vy *= (1 - p.drag * dt); }
    }
  };
  Particles.prototype.draw = function (ctx, camX) {
    for (var i = 0; i < this.a.length; i++) {
      var p = this.a[i];
      var x = Math.round(p.x - camX), y = Math.round(p.y);
      var a = p.fade === false ? 1 : clamp(p.life / p.life0, 0, 1);
      if (p.img) {
        ctx.globalAlpha = a;
        var s = p.size || 10;
        ctx.drawImage(p.img, x - (s >> 1), y - (s >> 1), s, s);
        ctx.globalAlpha = 1;
      } else if (p.text) {
        ACS.drawText(ctx, p.text, x, y, { color: p.color || '#fff', align: 'center', shadow: true });
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color || '#fff';
        ctx.fillRect(x, y, p.size || 1, p.size || 1);
        ctx.globalAlpha = 1;
      }
    }
  };
  ACS.Particles = Particles;

  /* ============================================================ TIMBIT */
  function Timbit(x, y, dir) {
    this.x = x; this.y = y;
    this.vx = dir * 130; this.vy = -110;
    this.life = 3; this.dead = false; this.rot = 0;
  }
  Timbit.prototype.update = function (dt, G) {
    this.vy += 420 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.rot += dt * 9;
    this.life -= dt;
    var gy = ACS.surfaceY(this.x);
    if (this.y > gy) { this.dead = true; G.puff(this.x, gy, 4); }
    if (this.life <= 0) this.dead = true;
    /* clonk an unsuspecting townsfolk */
    for (var i = 0; i < G.npcs.length; i++) {
      var n = G.npcs[i];
      if (Math.abs(n.x - this.x) < 10 && Math.abs((n.y + 8) - this.y) < 14) {
        n.say(L.pick(L.timbit), 2.6);
        n.talkCd = 3;
        G.addPolite(2.2);
        G.sfx('bonk');
        G.float(this.x, this.y - 6, 'SORRY!', '#ffd36b');
        if (Math.random() < 0.35) { G.money += 3; G.float(this.x, this.y - 16, '+$3', '#7bd07b'); }
        this.dead = true;
        break;
      }
    }
  };
  Timbit.prototype.draw = function (ctx, camX) {
    var img = ACS.item('timbit');
    var s = 8 + Math.round(Math.abs(Math.sin(this.rot)) * 2);
    ctx.drawImage(img, Math.round(this.x - camX - s / 2), Math.round(this.y - s / 2), s, s);
  };
  ACS.Timbit = Timbit;

  ACS.Player = Player;
  ACS.Worker = Worker;
  ACS.NPC = NPC;
  ACS.Moose = Moose;
  ACS.Caravan = Caravan;
})();
