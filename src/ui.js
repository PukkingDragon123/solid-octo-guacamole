/* ============================================================
   UI - DOM heads-up display, panels, toasts
   ============================================================ */
(function () {
  'use strict';
  var ACS = (window.ACS = window.ACS || {});
  var L = ACS.LINES;
  var $ = function (id) { return document.getElementById(id); };

  var UI = {};
  var G = null;
  var lastHint = 0, hintIdx = 0;
  var resEls = {}, crewEls = {};

  /* -------- helper: put a pixel sprite into a DOM canvas -------- */
  function spriteEl(sprite, w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    var s = Math.min(w / sprite.width, h / sprite.height);
    var dw = Math.max(1, Math.round(sprite.width * s)), dh = Math.max(1, Math.round(sprite.height * s));
    x.drawImage(sprite, ((w - dw) / 2) | 0, ((h - dh) / 2) | 0, dw, dh);
    return c;
  }
  UI.spriteEl = spriteEl;

  function money(n) {
    n = Math.floor(n);
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
    if (n >= 100000) return '$' + (n / 1000).toFixed(0) + 'K';
    return '$' + n.toLocaleString('en-US');
  }
  UI.money = money;
  function short(n) {
    n = Math.floor(n);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 10000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }
  UI.short = short;

  /* ============================================================ init */
  UI.init = function (game) {
    G = game;
    /* resource chips */
    var rl = $('resList');
    rl.innerHTML = '';
    ACS.RES_ORDER.forEach(function (k) {
      var d = document.createElement('div');
      d.className = 'res';
      d.appendChild(spriteEl(ACS.item(k), 18, 18));
      var s = document.createElement('span'); s.textContent = ACS.RES_LABEL[k];
      var b = document.createElement('b'); b.textContent = '0';
      d.appendChild(s); d.appendChild(b);
      rl.appendChild(d);
      resEls[k] = { el: d, val: b, last: 0 };
    });
    /* crew chips */
    var cl = $('crewList');
    cl.innerHTML = '';
    var crewSprites = {
      beaver: ACS.makeBeaver({}).walk[0],
      ferret: ACS.makeFerret({}).walk[0],
      moose: ACS.makeMoose({}).walk[0]
    };
    ['beaver', 'ferret', 'moose'].forEach(function (k) {
      var d = document.createElement('div');
      d.className = 'crew';
      d.appendChild(spriteEl(crewSprites[k], 30, 24));
      var b = document.createElement('b'); b.textContent = '0';
      var i = document.createElement('i'); i.textContent = k === 'moose' ? 'MOOSE' : k + 'S';
      d.appendChild(b); d.appendChild(i);
      cl.appendChild(d);
      crewEls[k] = { el: d, val: b, sub: i };
    });

    $('panel').addEventListener('click', function (e) {
      if (e.target === $('panel')) UI.closePanel();
    });
    $('panelBox').addEventListener('click', onPanelClick);
  };

  /* ============================================================ HUD */
  UI.refresh = function () {
    if (!G || G.state !== 'play') return;
    $('money').textContent = money(G.money);
    $('rate').textContent = '+' + money(G.incomeRate) + '/S';
    var rk = G.rankInfo();
    $('rankName').textContent = rk.name;
    $('rankNext').textContent = rk.next ? 'NEXT: ' + money(rk.next.at) : 'MAXED, EH';
    var pb = $('politeBar');
    pb.style.width = Math.round(G.politeness) + '%';
    $('politeMult').textContent = 'x' + G.politeMult().toFixed(2);

    ACS.RES_ORDER.forEach(function (k) {
      var r = resEls[k], v = Math.floor(G.res[k]);
      if (v !== r.last) {
        r.val.textContent = short(v);
        if (v > r.last) {
          r.el.classList.add('pulse');
          clearTimeout(r.tm);
          r.tm = setTimeout(function () { r.el.classList.remove('pulse'); }, 260);
        }
        r.last = v;
      }
    });
    ['beaver', 'ferret', 'moose'].forEach(function (k) {
      var c = crewEls[k];
      c.val.textContent = G.crew[k];
      var idle = G.idle(k);
      c.sub.textContent = idle > 0 ? idle + ' IDLE' : (k === 'moose' ? 'MOOSE' : k + 'S');
      c.sub.style.color = idle > 0 ? '#ffc93c' : '';
    });

    /* rotating tip */
    if (performance.now() - lastHint > 11000) {
      lastHint = performance.now();
      hintIdx = (hintIdx + 1) % L.tips.length;
      $('hint').innerHTML = L.tips[hintIdx].replace(/\b([A-Z])\b/g, '<u>$1</u>');
    }
    if (G.panelOpen) UI.renderPanel();
  };

  UI.setHint = function (txt) {
    $('hint').textContent = txt;
    lastHint = performance.now();
  };

  /* ============================================================ toasts */
  var toastQ = [];
  UI.toast = function (msg, cls) {
    var wrap = $('toasts');
    if (wrap.children.length > 5) wrap.removeChild(wrap.firstChild);
    var d = document.createElement('div');
    d.className = 'toast ' + (cls || '');
    d.textContent = msg;
    wrap.appendChild(d);
    setTimeout(function () {
      d.classList.add('out');
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 400);
    }, cls === 'rank' ? 5200 : 3000);
  };

  /* ============================================================ panel */
  var view = { tab: 'crew', bkey: null };

  UI.openPanel = function (tab, bkey) {
    view.tab = tab || 'crew';
    view.bkey = bkey || null;
    G.panelOpen = true;
    $('panel').classList.remove('hidden');
    UI.renderPanel();
  };
  UI.closePanel = function () {
    G.panelOpen = false;
    view.bkey = null;
    $('panel').classList.add('hidden');
  };
  UI.isOpen = function () { return G && G.panelOpen; };

  function tag(t) { return '<span class="tag">' + t + '</span>'; }
  function flowOf(b) {
    var s = [], k;
    if (b.inp) { for (k in b.inp) s.push(tag(b.inp[k] + ' ' + ACS.RES_LABEL[k])); s.push('<span class="arw">&#9654;</span>'); }
    if (b.outp) { for (k in b.outp) s.push(tag(b.outp[k] + ' ' + ACS.RES_LABEL[k])); }
    else if (b.out) s.push('<span class="arw">&#9654;</span>' + tag(ACS.RES_LABEL[b.out]));
    return s.join(' ');
  }

  function buildingCard(b) {
    var canBuild = !b.built && b.cost > 0;
    var afford = G.money >= G.buildCost(b);
    var wk = b.worker;
    var h = '<div class="card' + (b.built ? '' : ' locked') + '" data-b="' + b.key + '">';
    h += '<div class="ct">' + '<div><b>' + b.name + '</b><i>' +
      (b.built ? 'LEVEL ' + b.level : 'NOT BUILT') + '</i></div></div>';
    h += '<div class="desc">' + b.desc + '</div>';
    if (b.inp || b.out) h += '<div class="flow">' + flowOf(b) + '</div>';
    if (b.type === 'morale') h += '<div class="flow">' + tag('+' + Math.round(b.morale * 100 * (b.level || 1)) + '% CREW OUTPUT') + '</div>';

    if (canBuild) {
      h += '<div class="row sp"><span>COST ' + money(G.buildCost(b)) + '</span>' +
        '<button class="buy" data-act="build" data-b="' + b.key + '"' + (afford ? '' : ' disabled') + '>BUILD IT, EH</button></div>';
    } else if (b.built) {
      if (wk) {
        var cap = G.capOf(b);
        h += '<div class="row sp"><span>' + wk.toUpperCase() + 'S ' + b.assigned + '/' + cap + '</span>' +
          '<div class="stepper">' +
          '<button class="sm" data-act="unassign" data-b="' + b.key + '"' + (b.assigned > 0 ? '' : ' disabled') + '>-</button>' +
          '<b>' + b.assigned + '</b>' +
          '<button class="sm" data-act="assign" data-b="' + b.key + '"' +
          (G.idle(wk) > 0 && b.assigned < cap ? '' : ' disabled') + '>+</button>' +
          '</div></div>';
        h += '<div class="row"><span style="font-size:9px;opacity:.6">OUTPUT ' + G.rateText(b) + '</span></div>';
      }
      var uc = G.upgradeCost(b);
      h += '<div class="row sp"><span>LVL ' + b.level + ' &#9654; ' + (b.level + 1) + '</span>' +
        '<button class="gold" data-act="upgrade" data-b="' + b.key + '"' +
        (G.money >= uc ? '' : ' disabled') + '>UPGRADE ' + money(uc) + '</button></div>';
    } else {
      h += '<div class="row"><span style="opacity:.6">ALWAYS OPEN, EH</span></div>';
    }
    h += '</div>';
    return h;
  }

  function crewCard(kind, label, blurb) {
    var cost = G.hireCost(kind);
    var h = '<div class="card">';
    h += '<div class="ct"><div><b>' + label + '</b><i>' + G.crew[kind] + ' EMPLOYED &middot; ' + G.idle(kind) + ' IDLE</i></div></div>';
    h += '<div class="desc">' + blurb + '</div>';
    h += '<div class="row sp"><span>HIRE ' + money(cost) + '</span>' +
      '<div class="row">' +
      '<button class="buy" data-act="hire" data-k="' + kind + '"' + (G.money >= cost ? '' : ' disabled') + '>HIRE 1</button>' +
      '<button data-act="hire10" data-k="' + kind + '"' + (G.money >= G.hireCostN(kind, 10) ? '' : ' disabled') + '>x10 ' + money(G.hireCostN(kind, 10)) + '</button>' +
      '</div></div>';
    h += '</div>';
    return h;
  }

  UI.renderPanel = function () {
    var box = $('panelBox');
    var h = '';
    var b = view.bkey ? G.byKey(view.bkey) : null;

    h += '<div class="ph"><div><h2>' + (b ? b.name : 'YER EMPIRE') + '</h2>' +
      '<div class="sub">' + (b ? (b.built ? 'LEVEL ' + b.level : 'AWAITING CONSTRUCTION') : money(G.money) + ' &middot; ' + G.rankInfo().name) + '</div></div>' +
      '<button class="x red" data-act="close">CLOSE (ESC)</button></div>';

    if (b) {
      h += '<div class="pb">';
      h += '<div class="sect"><div class="grid">' + buildingCard(b) + '</div></div>';
      if (b.type === 'market') {
        h += '<div class="sect"><h3>HAGGLE HERE (85% OF LIST, SORRY)</h3><div class="grid">';
        ACS.RES_ORDER.forEach(function (k) {
          var have = Math.floor(G.res[k]);
          h += '<div class="card"><div class="row sp"><span>' + ACS.RES_LABEL[k] + ' x' + short(have) + '</span>' +
            '<span style="color:#ffc93c">' + money(ACS.PRICES[k] * 0.85) + ' EA</span></div>' +
            '<button class="buy" data-act="sell" data-k="' + k + '"' + (have > 0 ? '' : ' disabled') + '>SELL ALL &#9654; ' + money(have * ACS.PRICES[k] * 0.85) + '</button></div>';
        });
        h += '</div></div>';
      }
      if (b.type === 'hire') {
        h += '<div class="sect"><h3>SIGN SOMEBODY UP</h3><div class="grid">' +
          crewCardFor(b.hires) + '</div></div>';
      }
      if (b.type === 'hq') h += statsBlock();
      h += '</div>';
    } else {
      h += '<div class="tabs">' +
        tabBtn('crew', 'CREW') + tabBtn('build', 'BUILDINGS') + tabBtn('stats', 'STATS') +
        '</div><div class="pb">';
      if (view.tab === 'crew') {
        h += '<div class="sect"><h3>PAYROLL &middot; PAID ENTIRELY IN TIMBITS &amp; RESPECT</h3><div class="grid">' +
          crewCardFor('beaver') + crewCardFor('ferret') + crewCardFor('moose') +
          '</div></div>';
        h += '<div class="sect"><h3>QUICK POSTING</h3><div class="row">' +
          '<button data-act="autoassign">AUTO-ASSIGN IDLE CREW</button>' +
          '<button data-act="clearassign">RECALL EVERYBODY</button>' +
          '</div></div>';
      } else if (view.tab === 'build') {
        h += '<div class="sect"><h3>THE OPERATION</h3><div class="grid">';
        G.buildings.forEach(function (bb) {
          if (bb.type === 'home') return;
          h += buildingCard(bb);
        });
        h += '</div></div>';
      } else {
        h += statsBlock();
      }
      h += '</div>';
    }
    box.innerHTML = h;
  };

  function crewCardFor(kind) {
    if (kind === 'beaver') return crewCard('beaver', 'BEAVERS', 'Gatherers. They chew lumber, tap sap, dig spuds and milk the curds. Union is very apologetic.');
    if (kind === 'ferret') return crewCard('ferret', 'FERRETS', 'Crafters. Long enough to reach the back of the fryer. Boil syrup, flip pancakes, assemble poutine.');
    return crewCard('moose', 'MOOSE', 'Transport. Each moose hauls a load to the trading post for full price. Burns maple syrup as fuel.');
  }

  function tabBtn(id, label) {
    return '<button data-act="tab" data-t="' + id + '" class="' + (view.tab === id ? 'on' : '') + '">' + label + '</button>';
  }

  function statsBlock() {
    var s = G.stats();
    var h = '<div class="sect"><h3>THE LEDGER</h3>';
    s.forEach(function (row) {
      h += '<div class="stat"><span>' + row[0] + '</span><b>' + row[1] + '</b></div>';
    });
    h += '</div>';
    h += '<div class="sect"><h3>RANKS OF THE REALM</h3>';
    var cur = G.rankInfo();
    ACS.RANKS.forEach(function (r, i) {
      var got = G.earned >= r.at;
      h += '<div class="stat" style="opacity:' + (got ? 1 : 0.4) + '"><span>' +
        (got ? '&#10004; ' : '') + (i + 1) + '. ' + r.name + (r.name === cur.name ? ' &#9664;' : '') +
        '</span><b>' + money(r.at) + '</b></div>';
    });
    h += '</div>';
    return h;
  }

  function onPanelClick(e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (!act) return;
    var bk = t.getAttribute('data-b'), k = t.getAttribute('data-k');
    if (act === 'close') return UI.closePanel();
    if (act === 'tab') { view.tab = t.getAttribute('data-t'); return UI.renderPanel(); }
    if (act === 'build') G.tryBuild(bk);
    else if (act === 'upgrade') G.tryUpgrade(bk);
    else if (act === 'assign') G.assign(bk, 1);
    else if (act === 'unassign') G.assign(bk, -1);
    else if (act === 'hire') G.tryHire(k, 1);
    else if (act === 'hire10') G.tryHire(k, 10);
    else if (act === 'sell') G.sellRes(k);
    else if (act === 'autoassign') G.autoAssign();
    else if (act === 'clearassign') G.clearAssign();
    UI.renderPanel();
    UI.refresh();
  }

  ACS.UI = UI;
})();
