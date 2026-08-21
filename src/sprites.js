/* ============================================================
   AVERAGE CANADIAN SIMULATOR - pixel art foundry
   Everything here draws at 1 device pixel = 1 art pixel onto
   small offscreen canvases which are later blitted with
   imageSmoothingEnabled = false. Real chunky pixel art, eh.
   ============================================================ */
(function () {
  'use strict';
  var ACS = (window.ACS = window.ACS || {});

  /* ---------------------------------------------------------- utils */
  function pc(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return { c: c, x: x };
  }
  ACS.pc = pc;

  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hex(r, g, b) {
    var f = function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); };
    return '#' + f(r) + f(g) + f(b);
  }
  function shade(col, amt) {
    var c = hex2rgb(col);
    if (amt >= 0) return rgb2hex(c[0] + (255 - c[0]) * amt, c[1] + (255 - c[1]) * amt, c[2] + (255 - c[2]) * amt);
    return rgb2hex(c[0] * (1 + amt), c[1] * (1 + amt), c[2] * (1 + amt));
  }
  ACS.shade = shade;
  function mix(a, b, t) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  ACS.mix = mix;

  /* deterministic rng */
  function rng(seed) {
    var s = (seed | 0) || 1;
    return function () {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0;
      return ((s >>> 0) % 100000) / 100000;
    };
  }
  ACS.rng = rng;

  /* ---------------------------------------------------------- palette */
  var PAL = {
    '.': null, ' ': null,
    '0': '#16101c',            // outline
    'k': '#0a070e',            // deep outline
    '3': '#f5c39a', '4': '#d3966c',   // skin / shade
    '5': '#c0392b', '6': '#f4f6fb',   // toque / white
    '7': '#33415e', '8': '#5c3b1f',   // denim / boots
    '9': '#8a6842',                    // hair-beard
    'M': '#b8332a',                    // mitten
    'w': '#ffffff', 'W': '#d7e3ef',
    'y': '#ffc93c', 'Y': '#d99b18',
    'o': '#e8792b', 'O': '#a94d13',
    'g': '#8d99a6', 'G': '#5b6672',
    'r': '#e04a3f', 'R': '#8f1a18',
    'n': '#1d2740', 'c': '#7ad1e8', 'C': '#3d8fae',
    'p': '#f2a0c0', 'l': '#7bc46c', 'L': '#3f7f3d',
    'd': '#3b2a1c', 'e': '#c8a06a',
    'b': '#7a4a24', 'B': '#4a2b12', 'm': '#2e1c0e',
    'f': '#ead9b6', 'F': '#b58c58', 'a': '#d9c49a',
    's': '#a8dff0', 'S': '#5aa8c8',
    't': '#e8b46a', 'T': '#8a5a20',
    'x': '#6b3f8f', 'z': '#2b2033'
  };
  ACS.PAL = PAL;

  /* ---------------------------------------------------------- plaid
     Classic buffalo check: red squares, black squares, and the
     dark overlap where the two threads cross. The most Canadian
     texture known to science. */
  var PLAID_DEF = { a: '#c93b32', b: '#241a20', m: '#7d2119', l: '#e8635a' };
  function tartan(i, j, p, dark) {
    var cx = (i >> 1) & 1, cy = (j >> 1) & 1, col;
    if (cx === 0 && cy === 0) col = p.a;
    else if (cx === 1 && cy === 1) col = p.b;
    else col = p.m;
    if (((i + j * 3) % 11) === 0) col = shade(col, 0.14);   // woolly threads
    return dark ? shade(col, -0.3) : col;
  }

  /* ---------------------------------------------------------- sprite maker */
  function makeSprite(rows, opts) {
    opts = opts || {};
    var pal = opts.pal ? Object.assign({}, PAL, opts.pal) : PAL;
    var plaid = opts.plaid || PLAID_DEF;
    var w = 0, i, j;
    for (j = 0; j < rows.length; j++) if (rows[j].length > w) w = rows[j].length;
    var o = pc(w, rows.length);
    for (j = 0; j < rows.length; j++) {
      var row = rows[j];
      for (i = 0; i < row.length; i++) {
        var ch = row.charAt(i), col;
        if (ch === '.' || ch === ' ') continue;
        if (ch === '1') col = tartan(i, j, plaid, false);
        else if (ch === '2') col = tartan(i, j, plaid, true);
        else col = pal[ch];
        if (!col) continue;
        o.x.fillStyle = col;
        o.x.fillRect(i, j, 1, 1);
      }
    }
    return o.c;
  }
  ACS.makeSprite = makeSprite;

  /* A tinted duplicate of a sprite. Compositing with source-atop is only
     correct on a canvas whose sole opaque pixels are the sprite itself -
     doing it over the live frame stains everything behind it too. */
  function tintCopy(cv, color, alpha) {
    var o = pc(cv.width, cv.height);
    o.x.drawImage(cv, 0, 0);
    o.x.globalCompositeOperation = 'source-atop';
    o.x.globalAlpha = alpha === undefined ? 1 : alpha;
    o.x.fillStyle = color;
    o.x.fillRect(0, 0, cv.width, cv.height);
    return o.c;
  }
  ACS.tintCopy = tintCopy;

  function flip(cv) {
    var o = pc(cv.width, cv.height);
    o.x.translate(cv.width, 0); o.x.scale(-1, 1); o.x.drawImage(cv, 0, 0);
    return o.c;
  }
  ACS.flip = flip;

  /* ============================================================
     5x7 BITMAP FONT
     ============================================================ */
  var F = {
    'A': '01110,10001,10001,11111,10001,10001,10001',
    'B': '11110,10001,10001,11110,10001,10001,11110',
    'C': '01110,10001,10000,10000,10000,10001,01110',
    'D': '11110,10001,10001,10001,10001,10001,11110',
    'E': '11111,10000,10000,11110,10000,10000,11111',
    'F': '11111,10000,10000,11110,10000,10000,10000',
    'G': '01110,10001,10000,10111,10001,10001,01111',
    'H': '10001,10001,10001,11111,10001,10001,10001',
    'I': '11111,00100,00100,00100,00100,00100,11111',
    'J': '00111,00010,00010,00010,00010,10010,01100',
    'K': '10001,10010,10100,11000,10100,10010,10001',
    'L': '10000,10000,10000,10000,10000,10000,11111',
    'M': '10001,11011,10101,10101,10001,10001,10001',
    'N': '10001,11001,10101,10011,10001,10001,10001',
    'O': '01110,10001,10001,10001,10001,10001,01110',
    'P': '11110,10001,10001,11110,10000,10000,10000',
    'Q': '01110,10001,10001,10001,10101,10010,01101',
    'R': '11110,10001,10001,11110,10100,10010,10001',
    'S': '01111,10000,10000,01110,00001,00001,11110',
    'T': '11111,00100,00100,00100,00100,00100,00100',
    'U': '10001,10001,10001,10001,10001,10001,01110',
    'V': '10001,10001,10001,10001,10001,01010,00100',
    'W': '10001,10001,10001,10101,10101,11011,10001',
    'X': '10001,10001,01010,00100,01010,10001,10001',
    'Y': '10001,10001,01010,00100,00100,00100,00100',
    'Z': '11111,00001,00010,00100,01000,10000,11111',
    '0': '01110,10001,10011,10101,11001,10001,01110',
    '1': '00100,01100,00100,00100,00100,00100,01110',
    '2': '01110,10001,00001,00010,00100,01000,11111',
    '3': '11111,00010,00100,00010,00001,10001,01110',
    '4': '00010,00110,01010,10010,11111,00010,00010',
    '5': '11111,10000,11110,00001,00001,10001,01110',
    '6': '00110,01000,10000,11110,10001,10001,01110',
    '7': '11111,00001,00010,00100,01000,01000,01000',
    '8': '01110,10001,10001,01110,10001,10001,01110',
    '9': '01110,10001,10001,01111,00001,00010,01100',
    ' ': '00000,00000,00000,00000,00000,00000,00000',
    '.': '00000,00000,00000,00000,00000,01100,01100',
    ',': '00000,00000,00000,00000,00110,00110,01100',
    '!': '00100,00100,00100,00100,00100,00000,00100',
    '?': '01110,10001,00001,00010,00100,00000,00100',
    "'": '00100,00100,01000,00000,00000,00000,00000',
    '"': '01010,01010,01010,00000,00000,00000,00000',
    '-': '00000,00000,00000,11111,00000,00000,00000',
    ':': '00000,00110,00110,00000,00110,00110,00000',
    ';': '00000,00110,00110,00000,00110,00110,01100',
    '$': '00100,01111,10100,01110,00101,11110,00100',
    '%': '11001,11010,00010,00100,01000,01011,10011',
    '(': '00010,00100,01000,01000,01000,00100,00010',
    ')': '01000,00100,00010,00010,00010,00100,01000',
    '/': '00001,00010,00010,00100,01000,01000,10000',
    '+': '00000,00100,00100,11111,00100,00100,00000',
    '=': '00000,00000,11111,00000,11111,00000,00000',
    '<': '00010,00100,01000,10000,01000,00100,00010',
    '>': '01000,00100,00010,00001,00010,00100,01000',
    '*': '00000,10101,01110,11111,01110,10101,00000',
    '&': '01100,10010,10100,01000,10101,10010,01101',
    '#': '01010,11111,01010,01010,01010,11111,01010',
    '@': '01110,10001,10111,10101,10111,10000,01110',
    '[': '01110,01000,01000,01000,01000,01000,01110',
    ']': '01110,00010,00010,00010,00010,00010,01110',
    '_': '00000,00000,00000,00000,00000,00000,11111',
    '^': '00100,01010,10001,00000,00000,00000,00000',
    '~': '00000,00000,01001,10110,00000,00000,00000'
  };
  var FW = 5, FH = 7, gcache = {};
  function glyph(ch, color) {
    var key = ch + color;
    if (gcache[key]) return gcache[key];
    var pat = F[ch] || F['?'];
    var rows = pat.split(',');
    var o = pc(FW, FH);
    o.x.fillStyle = color;
    for (var j = 0; j < FH; j++)
      for (var i = 0; i < FW; i++)
        if (rows[j].charAt(i) === '1') o.x.fillRect(i, j, 1, 1);
    return (gcache[key] = o.c);
  }
  function textWidth(s, sc) {
    sc = sc || 1;
    return s.length ? (s.length * (FW + 1) - 1) * sc : 0;
  }
  ACS.textWidth = textWidth;
  ACS.FH = FH;

  /* drawText(ctx, str, x, y, opts) - y is the TOP of the glyphs */
  function drawText(ctx, s, x, y, opts) {
    opts = opts || {};
    var sc = opts.scale || 1;
    var col = opts.color || '#ffffff';
    s = String(s).toUpperCase();
    var w = textWidth(s, sc);
    if (opts.align === 'center') x -= (w / 2) | 0;
    else if (opts.align === 'right') x -= w;
    x = Math.round(x); y = Math.round(y);
    var i, cx;
    if (opts.shadow) {
      var sh = opts.shadow === true ? '#0a070e' : opts.shadow;
      for (i = 0, cx = x; i < s.length; i++, cx += (FW + 1) * sc)
        ctx.drawImage(glyph(s.charAt(i), sh), cx, y + sc, FW * sc, FH * sc);
    }
    if (opts.outline) {
      var ol = opts.outline === true ? '#0a070e' : opts.outline;
      var d = [[-sc, 0], [sc, 0], [0, -sc], [0, sc]];
      for (var k = 0; k < 4; k++)
        for (i = 0, cx = x; i < s.length; i++, cx += (FW + 1) * sc)
          ctx.drawImage(glyph(s.charAt(i), ol), cx + d[k][0], y + d[k][1], FW * sc, FH * sc);
    }
    for (i = 0, cx = x; i < s.length; i++, cx += (FW + 1) * sc)
      ctx.drawImage(glyph(s.charAt(i), col), cx, y, FW * sc, FH * sc);
    return w;
  }
  ACS.drawText = drawText;

  function wrap(s, maxChars) {
    var words = String(s).toUpperCase().split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (t.length > maxChars && cur) { lines.push(cur); cur = words[i]; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  ACS.wrap = wrap;

  /* ============================================================
     CHARACTERS  (16 wide x 21 tall)
     ============================================================ */
  var HEAD = {
    toque: [
      '.......66.......',
      '......5555......',
      '.....555555.....',
      '.....555555.....',
      '....66666666....'
    ],
    cap: [
      '................',
      '.....555555.....',
      '....55555555....',
      '....5555555555..',
      '....33333333....'
    ],
    helmet: [
      '................',
      '.....666666.....',
      '....66666666....',
      '....6666666666..',
      '....33333333....'
    ],
    hair: [
      '................',
      '................',
      '.....999999.....',
      '....99999999....',
      '....99999999....'
    ],
    earflap: [
      '................',
      '.....555555.....',
      '....55555555....',
      '..9955555555 99.',
      '..9966666666.99.'
    ]
  };
  var FACE = {
    beard: [
      '....33333333....',
      '....30333033....',
      '....33333333....',
      '....39999993....',
      '.....999999.....'
    ],
    clean: [
      '....33333333....',
      '....30333033....',
      '....33333333....',
      '....33344333....',
      '.....333333.....'
    ],
    stache: [
      '....33333333....',
      '....30333033....',
      '....33333333....',
      '....39999993....',
      '.....333333.....'
    ]
  };
  var TORSO = [
    '...1111111111...',
    '..111111111111..',
    '..111111111111..',
    '.M111111111111M.',
    '.M111111111111M.',
    '...1111111111...'
  ];
  var LEGS = {
    stand: [
      '.....77..77.....',
      '.....77..77.....',
      '.....77..77.....',
      '....888..888....',
      '....888..888....'
    ],
    stride: [
      '.....77..77.....',
      '....77...77.....',
      '...77....77.....',
      '..888....888....',
      '..888....888....'
    ],
    jump: [
      '.....77..77.....',
      '....77....77....',
      '....7......7....',
      '...888....888...',
      '....8......8....'
    ],
    sit: [
      '...7777..7777...',
      '...77........7..',
      '...77........7..',
      '..888......888..',
      '..888......888..'
    ]
  };
  function mirrorRows(rows) {
    return rows.map(function (r) { return r.split('').reverse().join(''); });
  }

  /* makeChar returns {walk:[4], jump, sit, w, h} facing right */
  function makeChar(cfg) {
    cfg = cfg || {};
    var head = HEAD[cfg.head || 'toque'];
    var face = FACE[cfg.face || 'beard'];
    var opts = {
      plaid: cfg.plaid || PLAID_DEF,
      pal: Object.assign({}, cfg.pal || {}, {
        '5': cfg.toque || PAL['5'],
        '3': cfg.skin || PAL['3'],
        '4': cfg.skin ? shade(cfg.skin, -0.2) : PAL['4'],
        '9': cfg.hair || PAL['9'],
        '7': cfg.pants || PAL['7'],
        '8': cfg.boots || PAL['8'],
        'M': cfg.mitten || (cfg.plaid ? cfg.plaid.a : PAL['M'])
      })
    };
    var top = head.concat(face).concat(TORSO);
    function build(legs) { return makeSprite(top.concat(legs), opts); }
    var stand = build(LEGS.stand);
    var strideA = build(LEGS.stride);
    var strideB = build(mirrorRows(LEGS.stride));
    return {
      walk: [stand, strideA, stand, strideB],
      jump: build(LEGS.jump),
      sit: build(LEGS.sit),
      w: 16, h: 21
    };
  }
  ACS.makeChar = makeChar;

  /* ============================================================
     BEAVER  - the backbone of the Canadian workforce
     ============================================================ */
  var BEAVER_TOP = [
    '.....0000.....',
    '....0bbbb0....',
    '...0bbbbbb0...',
    '...0b0bb0b0...',
    '...0bbbbbb0...',
    '...0bwwwwb0...',
    '..0bbbbbbbb0..',
    '.0bbbbbbbbbb0.',
    '.0bbbbbbbbbb0.'
  ];
  var BEAVER_FEET = {
    a: ['0mmbbbbbbbbmm0', '..00......00..'],
    b: ['0mmbbbbbbbbmm0', '...00....00...']
  };
  function makeBeaver(cfg) {
    cfg = cfg || {};
    var opts = { pal: { 'b': cfg.fur || '#7a4a24', 'm': cfg.tail || '#2e1c0e' } };
    return {
      walk: [
        makeSprite(BEAVER_TOP.concat(BEAVER_FEET.a), opts),
        makeSprite(BEAVER_TOP.concat(BEAVER_FEET.b), opts)
      ],
      w: 14, h: 11
    };
  }
  ACS.makeBeaver = makeBeaver;

  var HARDHAT = makeSprite([
    '..000000..',
    '.0yyyyyy0.',
    '0yyyyyyyy0',
    '0000000000'
  ]);
  ACS.HARDHAT = HARDHAT;

  /* ============================================================
     FERRET  - long, nimble, extremely employable
     ============================================================ */
  function makeFerret(cfg) {
    cfg = cfg || {};
    var opts = { pal: { 'f': cfg.fur || '#ead9b6', 'F': cfg.mask || '#b58c58' } };
    var A = [
      '..0000..........',
      '.0ffff0.........',
      '.0f00f0.........',
      '.0Fffff000000...',
      '..0ffffffffff0..',
      '..0ffffffffffF0.',
      '...0FFFFFFFFF0F0',
      '....0.0...0.0...'
    ];
    var B = [
      '..0000..........',
      '.0ffff0.........',
      '.0f00f0.........',
      '.0Fffff000000...',
      '..0fffffffffff0.',
      '..0ffffffffffF0.',
      '...0FFFFFFFFF0F0',
      '...0.0.....0.0..'
    ];
    return { walk: [makeSprite(A, opts), makeSprite(B, opts)], w: 16, h: 8 };
  }
  ACS.makeFerret = makeFerret;

  /* ============================================================
     MOOSE  - the national pickup truck. Runs on syrup.
     Drawn procedurally: silhouette pass then fill pass.
     ============================================================ */
  function blocks(o, list, col) {
    o.x.fillStyle = col;
    for (var i = 0; i < list.length; i++) o.x.fillRect(list[i][0], list[i][1], list[i][2], list[i][3]);
  }
  function outlinePass(o, list, col) {
    o.x.fillStyle = col;
    for (var i = 0; i < list.length; i++)
      o.x.fillRect(list[i][0] - 1, list[i][1] - 1, list[i][2] + 2, list[i][3] + 2);
  }
  function makeMoose(cfg) {
    cfg = cfg || {};
    var body = cfg.fur || '#5d3a1f',
      dark = shade(body, -0.35),
      light = shade(body, 0.16),
      antler = cfg.antler || '#cdb68d',
      hoof = '#241608';
    var W = 38, H = 32;
    function frame(ph) {
      var o = pc(W, H);
      /* leg phase offsets */
      var fl = [0, 2, 0, -2][ph], bl = [0, -2, 0, 2][ph];
      var core = [
        [12, 12, 21, 12],      // barrel
        [11, 14, 4, 9],        // chest
        [8, 8, 8, 10],         // neck
        [3, 4, 10, 9],         // head
        [0, 8, 6, 6]           // muzzle
      ];
      var legs = [
        [13 + fl, 23, 3, 8], [17 - fl, 23, 3, 8],
        [26 + bl, 23, 3, 8], [30 - bl, 23, 3, 8]
      ];
      var antlers = [
        [3, 0, 2, 5], [1, 0, 4, 2], [0, 2, 3, 2], [5, 1, 3, 2],
        [10, 0, 2, 5], [10, 0, 4, 2], [13, 2, 3, 2], [8, 1, 3, 2]
      ];
      /* silhouette */
      outlinePass(o, core.concat(legs), '#140d08');
      outlinePass(o, antlers, '#140d08');
      /* fill */
      blocks(o, antlers, antler);
      blocks(o, legs, body);
      blocks(o, core, body);
      /* shading + details */
      blocks(o, [[12, 12, 21, 3]], light);            // back highlight
      blocks(o, [[12, 21, 21, 3]], dark);             // belly shadow
      blocks(o, [[8, 8, 3, 10]], light);              // neck highlight
      blocks(o, [[0, 8, 6, 6]], shade(body, -0.28));  // muzzle
      blocks(o, [[0, 12, 5, 2]], '#1a1008');          // mouth
      blocks(o, [[1, 9, 2, 2]], '#0f0a06');           // nostril
      blocks(o, [[6, 6, 2, 2]], '#f6f2ea');           // eye white
      blocks(o, [[7, 7, 1, 1]], '#100a06');           // pupil
      blocks(o, [[4, 13, 4, 7]], shade(body, -0.2));  // dewlap / bell
      blocks(o, [[33, 13, 2, 4]], dark);              // tail
      blocks(o, [[13 + fl, 29, 3, 2]], hoof);
      blocks(o, [[17 - fl, 29, 3, 2]], hoof);
      blocks(o, [[26 + bl, 29, 3, 2]], hoof);
      blocks(o, [[30 - bl, 29, 3, 2]], hoof);
      /* dusting of snow on the back, because of course */
      blocks(o, [[14, 11, 17, 1]], 'rgba(244,247,251,.75)');
      return o.c;
    }
    return { walk: [frame(0), frame(1), frame(2), frame(3)], w: W, h: H };
  }
  ACS.makeMoose = makeMoose;

  /* saddle + crates that ride on the moose */
  ACS.SADDLE = makeSprite([
    '.RRRRRRRR.',
    'RrrrrrrrrR',
    'RrwwwwwwrR',
    'RrrrrrrrrR',
    '.R000000R.'
  ]);
  ACS.CRATE = makeSprite([
    '0bbbbbbbb0',
    'b0bbbbbb0b',
    'bb0bbbb0bb',
    'bbb0bb0bbb',
    'bbb0bb0bbb',
    'bb0bbbb0bb',
    'b0bbbbbb0b',
    '0bbbbbbbb0'
  ]);

  /* ============================================================
     ITEM ICONS
     ============================================================ */
  var ITEM_DEF = {
    syrup: [
      '...000....',
      '..0yy0....',
      '.00yy00...',
      '.0YYYY0...',
      '0yyyyyy0..',
      '0yYyyYy0..',
      '0yyyyyy0..',
      '0yYyyYy0..',
      '0yyyyyy0..',
      '.000000...'
    ],
    sap: [
      '..000000..',
      '.0gggggg0.',
      '.0g0000g0.',
      '.0gyyyyg0.',
      '.0gyyyyg0.',
      '.0gyyyyg0.',
      '.0gyyyyg0.',
      '.0gyyyyg0.',
      '.0gggggg0.',
      '..000000..'
    ],
    lumber: [
      '..........',
      '.00000000.',
      '0eTTTTTTe0',
      '0TeTTTTeT0',
      '0TTeTTeTT0',
      '0TTTeeTTT0',
      '0TeTTTTeT0',
      '0eTTTTTTe0',
      '.00000000.',
      '..........'
    ],
    potato: [
      '..0000....',
      '.0eeee00..',
      '0eeeTeee0.',
      '0eeeeeeee0',
      '0eTeeeeTe0',
      '0eeeeeeee0',
      '0eeeTeee0.',
      '.0eeeee0..',
      '..00000...',
      '..........'
    ],
    curds: [
      '..........',
      '.0y000y0..',
      '0yyy0yyy0.',
      '0yYy0yYy0.',
      '.000.000..',
      '..0yyy0...',
      '.0yyyyy0..',
      '.0yYyYy0..',
      '..00000...',
      '..........'
    ],
    pancakes: [
      '..........',
      '...0yy0...',
      '..0yYYy0..',
      '.0oooooo0.',
      '0tttttttt0',
      '0TtttttT0.',
      '0tttttttt0',
      '0TttttttT0',
      '.00000000.',
      '..........'
    ],
    poutine: [
      '..0000000.',
      '.0yyyyyyy0',
      '0yTyTyTyy0',
      '0yyyTyyTy0',
      '0TyyyyTyy0',
      '.0rrrrrr0.',
      '.0Rwwww R0',
      '..0RRRR0..',
      '..0wwww0..',
      '...0000...'
    ],
    money: [
      '..........',
      '.00000000.',
      '0lllllllll',
      '0l0llll0l0',
      '0ll0yy0ll0',
      '0ll0yy0ll0',
      '0l0llll0l0',
      '0lllllllll',
      '.00000000.',
      '..........'
    ],
    leaf: [
      '....00....',
      '..0.rr.0..',
      '.0rrrrrr0.',
      '0rrrrrrrr0',
      'rrrrrrrrrr',
      '0rrrrrrrr0',
      '..rrrrrr..',
      '..0.rr.0..',
      '....rr....',
      '....00....'
    ],
    timbit: [
      '..........',
      '...0000...',
      '..0TTTT0..',
      '.0TeTTTT0.',
      '.0TTTTeT0.',
      '.0TeTTTT0.',
      '..0TTTT0..',
      '...0000...',
      '..........',
      '..........'
    ],
    coffee: [
      '..........',
      '.00000000.',
      '0wwwwwwww0',
      '0wRRRRRRw0',
      '0wRwwwwRw0',
      '0wRRRRRRw0',
      '0wwwwwwww0',
      '.0wwwwww0.',
      '..000000..',
      '..........'
    ],
    puck: [
      '..........',
      '..........',
      '.00000000.',
      '0zzzzzzzz0',
      '0z000000z0',
      '0zzzzzzzz0',
      '.00000000.',
      '..........',
      '..........',
      '..........'
    ]
  };
  var itemCache = {};
  function item(name) {
    if (itemCache[name]) return itemCache[name];
    var d = ITEM_DEF[name] || ITEM_DEF.leaf;
    return (itemCache[name] = makeSprite(d));
  }
  ACS.item = item;
  ACS.ITEM_NAMES = Object.keys(ITEM_DEF);

  /* ============================================================
     TREES / PROPS
     ============================================================ */
  function makePine(seed) {
    var r = rng(seed);
    var tiers = 4 + ((r() * 3) | 0);
    var W = 30, H = 22 + tiers * 9;
    var o = pc(W, H);
    var cx = W >> 1;
    var trunkH = 14;
    /* trunk */
    o.x.fillStyle = '#2a1a0e'; o.x.fillRect(cx - 3, H - trunkH, 6, trunkH);
    o.x.fillStyle = '#3f2814'; o.x.fillRect(cx - 2, H - trunkH, 3, trunkH);
    var green = ['#1f4a2c', '#245431', '#1a3f25'][(r() * 3) | 0];
    var glow = shade(green, 0.18), drk = shade(green, -0.3);
    for (var t = 0; t < tiers; t++) {
      var y = H - trunkH - 4 - t * 9;
      var half = 2 + (tiers - t) * 2;
      o.x.fillStyle = drk;
      o.x.fillRect(cx - half - 1, y - 1, half * 2 + 2, 11);
      o.x.fillStyle = green;
      o.x.fillRect(cx - half, y, half * 2, 10);
      o.x.fillStyle = glow;
      o.x.fillRect(cx - half, y, half * 2, 2);
      /* snow load on the boughs */
      o.x.fillStyle = 'rgba(244,247,251,.92)';
      o.x.fillRect(cx - half, y, half * 2, 2);
      o.x.fillStyle = 'rgba(214,229,244,.8)';
      o.x.fillRect(cx - half, y + 2, (half * 2) | 0, 1);
    }
    /* tip */
    o.x.fillStyle = '#f4f7fb';
    o.x.fillRect(cx - 1, H - trunkH - 4 - tiers * 9 - 3, 2, 4);
    return o.c;
  }
  ACS.makePine = makePine;

  function makeMaple(seed, tapped) {
    var r = rng(seed);
    var W = 46, H = 62;
    var o = pc(W, H);
    var cx = W >> 1;
    /* trunk + branches */
    o.x.fillStyle = '#2b1d12'; o.x.fillRect(cx - 4, 24, 8, H - 24);
    o.x.fillStyle = '#412c1a'; o.x.fillRect(cx - 3, 24, 4, H - 24);
    o.x.fillStyle = '#2b1d12';
    o.x.fillRect(cx - 12, 26, 8, 3); o.x.fillRect(cx - 13, 20, 3, 8);
    o.x.fillRect(cx + 4, 30, 9, 3); o.x.fillRect(cx + 11, 22, 3, 10);
    /* bare winter canopy = clusters of twigs + clinging leaves */
    var cols = ['#b8332a', '#d6602b', '#e0913a'];
    for (var i = 0; i < 46; i++) {
      var a = r() * Math.PI * 2, rad = r() * 17;
      var x = cx + Math.cos(a) * rad * 1.25, y = 18 + Math.sin(a) * rad * 0.72;
      o.x.fillStyle = cols[(r() * 3) | 0];
      o.x.fillRect(x | 0, y | 0, 2 + ((r() * 2) | 0), 2);
    }
    /* snow cap on the crown */
    o.x.fillStyle = 'rgba(244,247,251,.85)';
    for (var j = 0; j < 16; j++) o.x.fillRect((cx - 18 + r() * 36) | 0, (4 + r() * 8) | 0, 3, 2);
    /* tap + bucket */
    if (tapped) {
      o.x.fillStyle = '#6b6f78'; o.x.fillRect(cx + 4, 40, 5, 2);
      o.x.fillStyle = '#8d99a6'; o.x.fillRect(cx + 7, 41, 8, 9);
      o.x.fillStyle = '#c8cfd8'; o.x.fillRect(cx + 8, 42, 6, 2);
      o.x.fillStyle = '#ffc93c'; o.x.fillRect(cx + 8, 45, 6, 4);
      o.x.fillStyle = '#16101c'; o.x.strokeStyle = '#16101c';
      o.x.fillRect(cx + 7, 50, 8, 1);
    }
    return o.c;
  }
  ACS.makeMaple = makeMaple;

  function makeRock(seed) {
    var r = rng(seed);
    var W = 18 + ((r() * 12) | 0), H = 10 + ((r() * 6) | 0);
    var o = pc(W, H);
    o.x.fillStyle = '#4b5560'; o.x.fillRect(1, 2, W - 2, H - 2);
    o.x.fillStyle = '#5d6874'; o.x.fillRect(2, 3, W - 6, H - 6);
    o.x.fillStyle = '#f4f7fb'; o.x.fillRect(1, 0, W - 3, 3);
    return o.c;
  }
  ACS.makeRock = makeRock;

  function makeStump() {
    return makeSprite([
      '..0000000...',
      '.0eeeeeee0..',
      '0eTTTTTTTe0.',
      '0eTeeeeeTe0.',
      '0TTTTTTTTT0.',
      '0TTTTTTTTT0.',
      '0TTTTTTTTT0.',
      '.000000000..'
    ]);
  }
  ACS.makeStump = makeStump;

  ACS.makeSnowman = function () {
    return makeSprite([
      '....555555....',
      '...55555555...',
      '....666666....',
      '...0wwwwww0...',
      '..0w0wwww0w0..',
      '..0wwwoowww0..',
      '..0w0wwww0w0..',
      '...0wwwwww0...',
      '..0wwwwwwww0..',
      '.0wwwwwwwwww0.',
      '80wwww00wwww08',
      '.0wwww00wwww0.',
      '.0wwwwwwwwww0.',
      '..0wwwwwwww0..',
      '...00000000...'
    ]);
  };

  ACS.makeFlag = function () {
    /* the maple leaf, flapping is done at draw time */
    return makeSprite([
      '000000000000',
      '0rr0wwww0rr0',
      '0rr0w00w0rr0',
      '0rr0wrrw0rr0',
      '0rr0rrrr0rr0',
      '0rr0wrrw0rr0',
      '0rr0w00w0rr0',
      '0rr0wwww0rr0',
      '000000000000'
    ]);
  };

  ACS.makeHockeyNet = function () {
    return makeSprite([
      '.0000000000.',
      '0gwgwgwgwgw0',
      '0wgwgwgwgwg0',
      '0gwgwgwgwgw0',
      '0wgwgwgwgwg0',
      '0gwgwgwgwgw0',
      '0wgwgwgwgwg0',
      '000000000000'
    ]);
  };

  ACS.makeAxe = function () {
    return makeSprite([
      '..gggg..',
      '.gwwwwg.',
      'gwwwwwwg',
      'gwwwwwwg',
      '.gwww8g.',
      '...888..',
      '...888..',
      '...888..',
      '...888..',
      '...888..',
      '...888..',
      '....8...'
    ]);
  };

  /* ============================================================
     BUILDINGS
     Generic cabin generator + per-kind decoration.
     Returns {c, windows:[[x,y,w,h]], chimney:[x,y], door:[x,y,w,h]}
     ============================================================ */
  function plank(o, x, y, w, h, col, dcol) {
    o.x.fillStyle = col; o.x.fillRect(x, y, w, h);
    o.x.fillStyle = dcol;
    for (var j = y + 3; j < y + h; j += 4) o.x.fillRect(x, j, w, 1);
  }
  function logs(o, x, y, w, h, col, dcol) {
    for (var j = y; j < y + h; j += 5) {
      o.x.fillStyle = col; o.x.fillRect(x, j, w, 4);
      o.x.fillStyle = dcol; o.x.fillRect(x, j + 4, w, 1);
      o.x.fillStyle = shade(col, 0.16); o.x.fillRect(x, j, w, 1);
    }
  }

  function makeBuilding(cfg) {
    cfg = cfg || {};
    var W = cfg.w || 92, H = cfg.h || 86;
    var o = pc(W, H);
    var wall = cfg.wall || '#7a4a24', wallD = shade(wall, -0.32);
    var roof = cfg.roof || '#8f1a18', roofD = shade(roof, -0.34);
    var bodyTop = cfg.bodyTop || 26;
    var meta = { windows: [], chimney: null, door: null, sign: null, w: W, h: H };

    /* ---- ground shadow / foundation ---- */
    o.x.fillStyle = '#241a2c';
    o.x.fillRect(2, H - 6, W - 4, 6);

    /* ---- walls ---- */
    o.x.fillStyle = '#100a12';
    o.x.fillRect(4, bodyTop - 1, W - 8, H - bodyTop - 4);
    if (cfg.style === 'log') logs(o, 5, bodyTop, W - 10, H - bodyTop - 5, wall, wallD);
    else plank(o, 5, bodyTop, W - 10, H - bodyTop - 5, wall, wallD);

    /* ---- gable roof ---- */
    var rh = cfg.roofH || 22, peakY = bodyTop - rh;
    var i, halfW = W / 2;
    for (i = 0; i < rh; i++) {
      var t = i / rh;
      var half = (halfW - 2) * t + 4;
      o.x.fillStyle = i < 3 ? roofD : roof;
      o.x.fillRect(Math.round(halfW - half) - 2, peakY + i, Math.round(half * 2) + 4, 1);
    }
    /* eaves */
    o.x.fillStyle = roofD;
    o.x.fillRect(0, bodyTop - 2, W, 3);
    /* SNOW ON THE ROOF - the whole point of a Canadian roof */
    for (i = 0; i < rh; i++) {
      var t2 = i / rh, half2 = (halfW - 2) * t2 + 4;
      var thick = i < rh * 0.62 ? 1 : 0;
      if (thick) {
        o.x.fillStyle = 'rgba(244,247,251,.94)';
        o.x.fillRect(Math.round(halfW - half2) - 2, peakY + i, Math.round(half2 * 2) + 4, 1);
      }
    }
    o.x.fillStyle = '#f4f7fb';
    o.x.fillRect(0, bodyTop - 3, W, 3);
    /* icicles */
    o.x.fillStyle = '#cfe6f5';
    for (i = 5; i < W - 5; i += 7 + ((i * 13) % 5)) o.x.fillRect(i, bodyTop, 1, 2 + ((i * 7) % 4));

    /* ---- door ---- */
    var dw = cfg.doorW || 16, dh = 24, dx = ((W - dw) / 2) | 0, dy = H - 5 - dh;
    o.x.fillStyle = '#16101c'; o.x.fillRect(dx - 1, dy - 1, dw + 2, dh + 2);
    plank(o, dx, dy, dw, dh, cfg.door || '#4a2b12', shade(cfg.door || '#4a2b12', -0.4));
    o.x.fillStyle = '#ffc93c'; o.x.fillRect(dx + dw - 4, dy + 13, 2, 2);
    meta.door = [dx, dy, dw, dh];

    /* ---- windows ---- */
    var wy = bodyTop + 8, ww = 14, wh = 13;
    var slots = cfg.windows === undefined ? 2 : cfg.windows;
    for (i = 0; i < slots; i++) {
      var wx = i === 0 ? 10 : W - 10 - ww;
      if (slots > 2) wx = 8 + i * ((W - 16 - ww) / (slots - 1));
      wx = wx | 0;
      o.x.fillStyle = '#16101c'; o.x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      /* glass: cold sky reflection with a diagonal shine */
      o.x.fillStyle = '#46587c'; o.x.fillRect(wx, wy, ww, wh);
      o.x.fillStyle = '#5f7599';
      for (var q = 0; q < wh; q++) o.x.fillRect(wx, wy + q, Math.max(0, ww - q - 2), 1);
      o.x.fillStyle = 'rgba(220,238,255,.4)';
      o.x.fillRect(wx + 1, wy + 1, 3, wh - 2);
      /* sash bars, baked in so daytime windows read as windows */
      o.x.fillStyle = '#33241a';
      o.x.fillRect(wx + (ww >> 1) - 1, wy, 1, wh);
      o.x.fillRect(wx, wy + (wh >> 1), ww, 1);
      /* sill + snow on the ledge */
      o.x.fillStyle = '#3a2a1c'; o.x.fillRect(wx - 2, wy + wh, ww + 4, 2);
      o.x.fillStyle = '#f4f7fb'; o.x.fillRect(wx - 2, wy + wh - 1, ww + 4, 1);
      meta.windows.push([wx, wy, ww, wh]);
    }

    /* ---- chimney + smoke anchor ---- */
    if (cfg.chimney !== false) {
      var cxp = cfg.chimneyX !== undefined ? cfg.chimneyX : (W * 0.72) | 0;
      var cyp = peakY + 4;
      o.x.fillStyle = '#3a3038'; o.x.fillRect(cxp, cyp, 10, 18);
      o.x.fillStyle = '#4d4048';
      for (var b = 0; b < 4; b++) o.x.fillRect(cxp + ((b % 2) ? 1 : 3), cyp + 2 + b * 4, 6, 3);
      o.x.fillStyle = '#f4f7fb'; o.x.fillRect(cxp - 1, cyp - 2, 12, 3);
      meta.chimney = [cxp + 5, cyp - 2];
    }
    return { c: o.c, meta: meta };
  }
  ACS.makeBuilding = makeBuilding;

  /* --- sign board hung above the door --- */
  function makeSign(text, accent) {
    var label = String(text).toUpperCase();
    var W = Math.max(30, textWidth(label, 1) + 10), H = 15;
    var o = pc(W, H);
    o.x.fillStyle = '#16101c'; o.x.fillRect(0, 0, W, H);
    o.x.fillStyle = accent || '#5c3b1f'; o.x.fillRect(1, 1, W - 2, H - 2);
    o.x.fillStyle = shade(accent || '#5c3b1f', 0.18); o.x.fillRect(1, 1, W - 2, 2);
    drawText(o.x, label, W / 2, 4, { color: '#ffe9b8', align: 'center', shadow: '#2a1608' });
    return o.c;
  }
  ACS.makeSign = makeSign;

  /* ============================================================
     PARALLAX MOUNTAIN RANGE
     ============================================================ */
  function makeRidge(w, h, seed, cfg) {
    cfg = cfg || {};
    var r = rng(seed);
    var o = pc(w, h);
    var base = cfg.base || '#2c3a5c', snow = cfg.snow || '#c9dcf0';
    var peaks = cfg.peaks || 9, amp = cfg.amp || h * 0.7;
    var pts = [], i;
    for (i = 0; i <= peaks; i++) pts.push(h - amp * (0.35 + r() * 0.65));
    /* sample a smooth-ish ridge line */
    var line = new Array(w);
    for (i = 0; i < w; i++) {
      var f = (i / w) * peaks, k = f | 0, t = f - k;
      t = t * t * (3 - 2 * t);
      var a = pts[k], b = pts[Math.min(peaks, k + 1)];
      line[i] = a + (b - a) * t + Math.sin(i * 0.13 + seed) * 2.2;
    }
    var hi = Infinity, lo = -Infinity;
    for (i = 0; i < w; i++) { if (line[i] < hi) hi = line[i]; if (line[i] > lo) lo = line[i]; }
    var snowY = hi + (lo - hi) * 0.45;
    for (i = 0; i < w; i++) {
      var y = Math.round(line[i]);
      o.x.fillStyle = base;
      o.x.fillRect(i, y, 1, h - y);
      /* snow caps on the upper slopes */
      /* Snow sits above a snowline, not at a random depth per column - that
         is what makes real ranges read as capped peaks instead of a sawtooth. */
      var snowLine = snowY + Math.sin(i * 0.021 + seed) * 4;
      if (y < snowLine) {
        o.x.fillStyle = snow;
        o.x.fillRect(i, y, 1, Math.min(snowLine - y, cfg.capDepth || 12));
      }
      o.x.fillStyle = shade(base, 0.1);
      o.x.fillRect(i, y, 1, 1);
    }
    return o.c;
  }
  ACS.makeRidge = makeRidge;

  /* ============================================================
     SPEECH BUBBLE (drawn live, sized to text)
     ============================================================ */
  ACS.speechBubble = function (ctx, lines, x, y, opts) {
    opts = opts || {};
    var pad = 3, lh = FH + 2;
    var w = 0, i;
    for (i = 0; i < lines.length; i++) w = Math.max(w, textWidth(lines[i], 1));
    var bw = w + pad * 2 + 2, bh = lines.length * lh + pad * 2 - 2;
    var bx = Math.round(x - bw / 2), by = Math.round(y - bh);
    var fill = opts.fill || '#f6f8fc', ink = opts.color || '#231a2b';
    ctx.fillStyle = '#16101c';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = fill;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#16101c';
    ctx.fillRect(Math.round(x) - 3, by + bh, 6, 1);
    ctx.fillRect(Math.round(x) - 2, by + bh + 1, 4, 1);
    ctx.fillRect(Math.round(x) - 1, by + bh + 2, 2, 1);
    ctx.fillStyle = fill;
    ctx.fillRect(Math.round(x) - 2, by + bh, 4, 1);
    ctx.fillRect(Math.round(x) - 1, by + bh + 1, 2, 1);
    for (i = 0; i < lines.length; i++)
      drawText(ctx, lines[i], x, by + pad + i * lh - 1, { color: ink, align: 'center' });
    return { x: bx, y: by, w: bw, h: bh };
  };
})();
