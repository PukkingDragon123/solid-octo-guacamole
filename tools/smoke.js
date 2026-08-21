/* Headless smoke test: boot the game, play it a bit, capture errors + screenshots. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const OUT = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-solid-octo-guacamole/fbad8ca2-65df-5695-be55-dd7190084dbc/scratchpad';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '01-title.png') });

  // start the game
  await page.click('#btnPlay');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, '02-start.png') });

  // drive the economy hard via the public game object
  const setup = await page.evaluate(() => {
    const G = window.ACS_GAME;
    G.money = 500000;
    ['sugar','spud','dairy','boiler','pancake','poutinerie','stable','timmys','rink'].forEach(k => G.tryBuild(k));
    G.tryHire('beaver', 20); G.tryHire('ferret', 14); G.tryHire('moose', 6);
    G.autoAssign();
    G.res.sap = 400; G.res.lumber = 400; G.res.potato = 300; G.res.curds = 200; G.res.syrup = 120;
    return { built: G.buildings.filter(b=>b.built).length, crew: G.crew, idleB: G.idle('beaver') };
  });
  console.log('SETUP:', JSON.stringify(setup));

  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, '03-town.png') });

  // walk right for a while to sweep the whole world and hit every renderer
  const probe = [];
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => { window.ACS_GAME.player.x += 480; });
    await page.waitForTimeout(320);
    probe.push(await page.evaluate(() => Math.round(window.ACS_GAME.player.x)));
  }
  await page.screenshot({ path: path.join(OUT, '04-far.png') });

  // exercise every input
  for (const k of ['q','e','Escape','r','t','f','Tab','Escape','d','w']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(160);
  }
  await page.keyboard.down('d'); await page.waitForTimeout(1400); await page.keyboard.up('d');
  await page.screenshot({ path: path.join(OUT, '05-ride.png') });

  // open the empire panel
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '06-panel.png') });
  await page.keyboard.press('Escape');

  // let the caravans run and confirm money actually moves
  const before = await page.evaluate(() => window.ACS_GAME.earned);
  await page.waitForTimeout(14000);
  const after = await page.evaluate(() => ({
    earned: window.ACS_GAME.earned,
    hauled: window.ACS_GAME.hauled,
    caravans: window.ACS_GAME.caravans.length,
    res: Object.fromEntries(Object.entries(window.ACS_GAME.res).map(([k,v])=>[k,Math.round(v)])),
    fps: window.ACS_GAME.t
  }));
  console.log('EARN before/after:', before, JSON.stringify(after));
  await page.screenshot({ path: path.join(OUT, '07-caravan.png') });

  // tour the landmarks
  const spots = [[560,'lumber'],[900,'sugarbush'],[1980,'boilery'],[2700,'poutinerie'],
                 [3080,'stable'],[3720,'rink'],[4120,'market'],[4470,'lodge'],[5060,'corral']];
  for (const [x, name] of spots) {
    await page.evaluate((x) => {
      const G = window.ACS_GAME;
      G.player.x = x; G.camX = Math.max(0, Math.min(x - 240, window.ACS.WORLD_W - 480));
    }, x);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, 'spot-' + name + '.png') });
  }

  // night check - jump the clock to midnight for the aurora
  await page.evaluate(() => { window.ACS_GAME.skyPhase = 0.02; });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, '08-night.png') });

  // day check
  await page.evaluate(() => { window.ACS_GAME.skyPhase = 0.45; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '09-day.png') });

  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
