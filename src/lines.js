/* ============================================================
   DIALOGUE BANK
   Roughly 87% apology by volume. This is by design.
   ============================================================ */
(function () {
  'use strict';
  var ACS = (window.ACS = window.ACS || {});

  var L = {};

  /* ---- the bread and butter: unprompted apologies ---- */
  L.sorry = [
    "sorry", "sorry aboot that", "oh geez, sorry", "sorry, eh",
    "sorry sorry sorry", "so sorry, bud", "sorry, my fault",
    "sorry for existing here", "sorry, i was in yer way",
    "sorry aboot the weather", "sorry, didn't mean to breathe near ya",
    "sorry! oh no. sorry for saying sorry", "sorry, that was on me",
    "beg yer pardon, sorry", "sorry, i'll just squeeze past, sorry",
    "sorry aboot the snow, eh", "sorry, is this yer snow?",
    "sorry, i apologize for apologizing", "oh jeez sorry there bud",
    "sorry, i bumped into yer aura", "terribly sorry, eh",
    "sorry aboot the hydro bill", "sorry, i thought aboot walking here"
  ];

  /* ---- ambient chatter ---- */
  L.chat = [
    "beauty day, eh?", "cold enough for ya, eh?",
    "gonna be a two-four kinda night, eh",
    "just gonna rip to the timmy's, eh",
    "double-double, please and thank you",
    "give'r, bud", "that's a beauty, eh",
    "sorry, but the leafs lost again", "she's a real snow-eater out there",
    "put yer toque on, eh", "it's only minus thirty, eh",
    "keep yer stick on the ice", "i left my mitts in the chesterfield",
    "gonna grab a mickey, eh", "the washroom's oot back, eh",
    "took the skidoo to work, eh", "how's she goin, eh?",
    "not bad, not bad, eh", "you're a keener, eh",
    "gonna shovel the driveway again, eh", "hydro's oot, sorry",
    "gonna head oot for a rip", "she's a beaut of a snowbank",
    "found a loonie in the snow, eh", "canadian tire money is real money, bud",
    "sorry, i only had eleven butter tarts", "milk comes in bags here, bud",
    "the poutine's better with squeaky curds, eh",
    "eh? eh. eh!", "eh eh eh, eh?",
    "i said sorry to a mailbox today", "apologized to a goose, twice",
    "gonna get a bag of milk, eh", "it's pop, not soda, bud",
    "toque, mitts, sorry. that's the trinity",
    "spent all day in line at the beer store, eh",
    "gotta get the winter tires on, eh",
    "sorry, my snowblower's louder than yer opinions"
  ];

  /* ---- said when the player apologizes to them ---- */
  L.reply = [
    "no no, sorry, that was me", "oh geez, i'M sorry",
    "sorry for accepting yer sorry", "no worries bud, sorry",
    "sorry, i should've been sorry first",
    "you're too polite, sorry", "we're both sorry, eh?",
    "sorry aboot that, friend", "don't be sorry, i'm sorry",
    "beauty apology, eh", "that's the politest thing i've heard all winter",
    "sorry, take a loonie for yer troubles", "aw, sorry, thanks bud",
    "sorry, now i gotta apologize back", "we could do this all day, sorry"
  ];

  /* ---- said when hit by a flying timbit ---- */
  L.timbit = [
    "sorry, i ate that", "oh, sorry, that hit my toque",
    "sorry! free timbit! sorry!", "mmm, sorry, that's a honey cruller",
    "sorry i caught it with my face", "you shouldn't have, sorry",
    "sorry, that's assault with a delicious weapon",
    "sorry! sorry! thank you! sorry!"
  ];

  /* ---- workers, when hired ---- */
  L.beaverHire = [
    "chomp chomp, eh", "sorry, i'll get right to the tree",
    "dam right, bud", "beaver tail's in the water, eh",
    "sorry aboot the wood chips", "lumber's on its way, sorry"
  ];
  L.ferretHire = [
    "sorry, i'll crawl into the fryer", "squeak! sorry!",
    "sorry, i'm long and employable", "poutine's my passion, eh",
    "sorry, i'll craft twice as fast"
  ];
  L.mooseHire = [
    "snort. sorry.", "sorry, i run on syrup",
    "moose approves, eh", "sorry aboot the antlers in the doorway",
    "honk. sorry, that was the moose horn"
  ];

  /* ---- flavour by building ---- */
  L.byBuilding = {
    lumber: ["timmmberrr, sorry!", "sorry aboot that tree, eh", "beavers work cheap, eh"],
    sugar: ["forty litres of sap for one of syrup, sorry", "the sap's runnin, eh", "sorry, it's sticky in here"],
    spud: ["prince edward island's finest, eh", "sorry, dirt on my mitts", "spuds don't grow themselves, bud"],
    dairy: ["squeaky curds only, sorry", "sorry, the cow's on break", "fresh curds squeak, eh"],
    boiler: ["boil'er down, eh", "sorry aboot the steam", "grade a amber, bud"],
    pancake: ["short stack, eh?", "sorry, we're oot of forks", "flapjacks flippin, eh"],
    poutinerie: ["gravy's hot, sorry", "curds, fries, gravy. that's it, that's the list", "sorry, no ketchup on poutine"],
    stable: ["moose gassed up, eh", "sorry, he only takes premium syrup", "watch the antlers, sorry"],
    timmys: ["double-double?", "sorry, roll up the rim is over", "ten timbits, eh?"],
    rink: ["he shoots, he sorries!", "sorry, i got the puck in yer shin", "shinny at dawn, eh"],
    market: ["sold! sorry.", "americans pay double for syrup, eh", "sorry, the loonie's weak today"],
    lodge: ["beavers sleepin, sorry", "dam's lookin good, eh"],
    burrow: ["ferrets are noodlin aboot, sorry", "sorry, they're all sleeping in a pile"],
    corral: ["moose are grazin, eh", "sorry, don't spook 'em"],
    hq: ["order! order! sorry.", "the motion carries, sorry", "sorry, we've formed a committee aboot it"],
    cabin: ["home sweet home, eh", "sorry, take yer boots off"]
  };

  /* ---- rank up ---- */
  L.rank = [
    "sorry, you're kind of a big deal now",
    "the whole town apologizes for doubting ya",
    "they put yer face on the canadian tire money, eh",
    "sorry, a goose has been named after you",
    "the mounties sent a polite letter, eh"
  ];

  /* ---- toasts ---- */
  L.sell = [
    "sold to a guy in vermont, eh", "shipped it oot, sorry",
    "americans bought the whole batch, eh", "sold at the trading post, beauty",
    "hauled by moose, sorry aboot the smell"
  ];

  /* ---- tips shown on the hint bar ---- */
  L.tips = [
    "beavers gather. ferrets craft. moose haul. that's the whole country, eh",
    "moose burn syrup as fuel. keep a jug in the tank, bud",
    "press R near a townsfolk to apologize. politeness pays, literally",
    "standing next to a building supervises it: +40% output, eh",
    "press Q at a maple to tap sap, or at a pine for lumber",
    "poutine sells for more than syrup. gravy is money, bud",
    "tim bortons and the backyard rink raise crew morale, eh",
    "press F to whistle for a moose, then give'r",
    "press T to toss a timbit at somebody. they'll apologize",
    "upgrade a building to raise its cap AND its rate, sorry",
    "the trading post buys everything, but haggling costs ya 15%",
    "sorry, but you should probably hire more beavers"
  ];

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  L.pick = pick;

  /* Random line generator with a heavy apology bias, which is
     scientifically accurate. */
  L.ambient = function (kind) {
    var r = Math.random();
    if (kind && L.byBuilding[kind] && r < 0.34) return pick(L.byBuilding[kind]);
    if (r < 0.62) return pick(L.sorry);
    return pick(L.chat);
  };

  /* Sprinkle "eh" onto anything that doesn't have it yet. */
  L.ehify = function (s) {
    if (/\beh\b/i.test(s)) return s;
    if (Math.random() < 0.45) return s.replace(/[.!?]*$/, '') + ', eh';
    return s;
  };

  ACS.LINES = L;

  /* ---- names for the townsfolk ---- */
  ACS.NAMES = [
    'gord', 'doug', 'shania', 'wayne', 'cheryl', 'brett', 'marie-claude',
    'terry', 'hank', 'darlene', 'stompin tom', 'jean-guy', 'bobby',
    'lorraine', 'chad', 'moira', 'randy', 'lachlan', 'bev', 'trevor',
    'sylvie', 'dale', 'nan', 'ferg', 'pam', 'yvon', 'stu', 'roberta'
  ];
})();
