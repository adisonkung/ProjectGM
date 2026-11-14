// Development-browser audit: fixtures only touch this isolated browser's save.
// Run with Playwright available via NODE_PATH; defaults to the local Angular dev server.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const baseUrl = process.env.ECHO_TEST_URL || 'http://127.0.0.1:4200';
const output = path.resolve('docs/reviews/echo-trial/end-to-end');
const report = { scenarios: [], javascriptErrors: [] };
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => report.javascriptErrors.push(error.message));
    await page.goto(baseUrl);
    await page.locator('#isle-name').waitFor();
    await page.locator('#isle-name').fill('Echo audit');
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/home');
    await page.waitForTimeout(600);
    const seed = await page.evaluate(() => JSON.parse(localStorage.getItem('projectgm-save-v1')));
    async function fixture(level, selected, star = 3) {
      await page.evaluate(({ seed, level, selected, star }) => {
        const save = structuredClone(seed);
        save.cleared = 10;
        save.heroes.forEach(h => { h.level = level; h.star = star; h.breakthroughTier = 3; });
        if (selected) save.team = save.team.filter(slot => selected.includes(save.heroes.find(h => h.uid === slot.uid).templateId));
        localStorage.setItem('projectgm-save-v1', JSON.stringify(save));
      }, { seed, level, selected, star });
    }
    async function enter(tier, size) {
      await page.goto(`${baseUrl}/battle?farm=trial_${tier}&render=dom`);
      await page.getByRole('button', { name: 'เริ่มต่อสู้', exact: true }).waitFor();
      await page.evaluate(() => {
        const c = window.ng.getComponent(document.querySelector('app-battle'));
        window.echoAudit = { engine: c.engine, events: [], initial: c.engine.units.map(u => ({
          id: u.id, heroId: u.heroId, cls: u.cls, side: u.side, pos: { ...u.pos }, hp: u.maxHp,
          atk: u.atk, def: u.def, echo: !!u.echo, mana: u.mana, maxMana: u.maxMana,
        })) };
        c.engine.subscribe(e => window.echoAudit.events.push(e));
      });
      const initial = await page.evaluate(() => window.echoAudit.initial);
      const players = initial.filter(u => !u.echo), echoes = initial.filter(u => u.echo);
      assert.equal(players.length, size); assert.equal(echoes.length, size);
      players.forEach((u, i) => {
        assert.equal(echoes[i].heroId, u.heroId);
        assert.deepEqual(echoes[i].pos, { r: u.pos.r, c: 15 - u.pos.c });
        assert.equal(echoes[i].maxMana, 0); assert.equal(echoes[i].mana, 0);
      });
      assert.equal(await page.evaluate(() => window.echoAudit.engine.totalWaves), 1);
      await page.getByRole('button', { name: 'เริ่มต่อสู้', exact: true }).click();
      await page.locator('app-board .unit.echo').last().waitFor();
      await page.locator('button.spd').click(); await page.locator('button.spd').click();
      return { initial, players, echoes };
    }
    async function finish() {
      await page.waitForFunction(() => window.echoAudit.engine.result != null, null, { timeout: 90000 });
      await page.waitForFunction(() => window.ng.getComponent(document.querySelector('app-battle')).result() != null);
      return page.evaluate(() => ({ result: window.echoAudit.engine.result,
        events: window.echoAudit.events, save: JSON.parse(localStorage.getItem('projectgm-save-v1')),
        waveCount: window.echoAudit.engine.totalWaves,
        outcome: window.ng.getComponent(document.querySelector('app-battle')).outcome() }));
    }
    // Actual menu entry and full 5-hero playable run.
    await fixture(7);
    await page.goto(`${baseUrl}/dungeons/trial`);
    await page.locator('a[href*="trial_1"]').first().waitFor();
    await page.locator('a[href*="trial_1"]').first().click();
    await page.getByRole('button', { name: 'เริ่มต่อสู้', exact: true }).waitFor();
    // Re-enter helper initializes observation only; no runtime skill/stat overrides.
    const full = await enter(1, 5);
    await page.screenshot({ path: `${output}/full-team-live.png`, fullPage: true });
    const result = await finish();
    assert.equal(result.result, 'win');
    assert(!(await page.locator('body').innerText()).includes('0.30000000000000004'));
    await page.waitForFunction(() => { const images = [...document.querySelectorAll('.loot-item img')]; return images.length > 0 && images.every(img => img.complete && img.naturalWidth > 0); });
    await page.waitForTimeout(350);
    assert.equal(result.save.farm.trial_1.firstClearDone, true);
    const echoIds = full.echoes.map(u => u.id), playerIds = full.players.map(u => u.id);
    const casts = result.events.filter(e => e.type === 'cast' && echoIds.includes(e.src));
    assert(casts.some(e => e.kind === 'skill')); assert(casts.some(e => e.kind === 'skill2'));
    assert(!casts.some(e => e.kind === 'ult'));
    const heals = result.events.filter(e => e.type === 'heal' && echoIds.includes(e.src));
    assert(heals.length > 0, 'Echo healer must actually heal in combat');
    assert(heals.every(e => echoIds.includes(e.dst)));
    const attacks = result.events.filter(e => e.type === 'attack' && full.echoes.some(u => u.id === e.src && u.cls !== 'healer'));
    assert(attacks.length > 0); assert(attacks.every(e => playerIds.includes(e.dst)));
    assert.equal(await page.evaluate(() => window.echoAudit.engine.units.some(u => u.echo && u.mana !== 0)), false);
    await page.screenshot({ path: `${output}/victory-skill-materials.png`, fullPage: true });
    report.scenarios.push({ name: 'full-five-menu-to-victory', result: result.result, waves: result.waveCount,
      echoes: full.echoes.length, skill1: casts.filter(e => e.kind === 'skill').length,
      skill2: casts.filter(e => e.kind === 'skill2').length, echoHeals: heals.length,
      echoAttacks: attacks.length, firstClearReward: result.save.farm.trial_1.firstClearDone });
    process.stdout.write('PASS full team, relative targeting, S1/S2, no ultimate, material rewards' + '\n');
    // Real retry button replaces the old session; retain the old reference to detect stale instances.
    await page.evaluate(() => window.retiredEchoEngine = window.echoAudit.engine);
    await page.getByRole('button', { name: 'เล่นอีกครั้ง', exact: true }).click();
    assert.equal(await page.evaluate(() => window.retiredEchoEngine.disposed), true);
    assert.equal(await page.evaluate(() => window.retiredEchoEngine.units.length), 0);
    assert.equal(await page.evaluate(() => window.ng.getComponent(document.querySelector('app-battle')).engine.units.filter(u => u.echo).length), 5);
    // SPA navigation must invoke component destruction, not just replace the browser document.
    await page.evaluate(() => {
      const c = window.ng.getComponent(document.querySelector('app-battle'));
      window.retiredEchoEngine = c.engine;
      return c.router.navigateByUrl('/dungeons/trial');
    });
    await page.waitForURL('**/dungeons/trial');
    assert.equal(await page.evaluate(() => window.retiredEchoEngine.disposed), true);
    assert.equal(await page.evaluate(() => window.retiredEchoEngine.units.length), 0);
    await page.locator('a[href*="trial_1"]').first().click();
    await page.getByRole('button', { name: 'เริ่มต่อสู้', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.ng.getComponent(document.querySelector('app-battle')).engine.units.filter(u => u.echo).length), 5);
    report.scenarios.push({ name: 'retry-leave-reenter', disposedOnRetry: true, disposedOnLeave: true, reenteredEchoes: 5 });
    process.stdout.write('PASS retry, dispose, SPA leave and re-entry' + '\n');
    await fixture(7, ['yuezheng', 'bailong', 'linxue']);
    const small = await enter(1, 3), smallResult = await finish();
    assert.equal(smallResult.result, 'win');
    report.scenarios.push({ name: 'three-hero-tank-dps-healer', echoes: small.echoes.length, result: smallResult.result });
    await page.screenshot({ path: `${output}/three-hero-victory.png`, fullPage: true });
    process.stdout.write('PASS smaller tank/DPS/healer team' + '\n');
    await fixture(1, ['bailong'], 1);
    const hard = await enter(4, 1), loss = await finish();
    assert.equal(loss.result, 'lose');
    assert.equal(loss.save.farm.trial_4?.firstClearDone ?? false, false);
    report.scenarios.push({ name: 'tier-four-one-hero-defeat', result: loss.result, rewardNotGranted: true });
    await page.screenshot({ path: `${output}/defeat-no-reward.png`, fullPage: true });
    // The same selected heroes yield identical tier stats despite player level changes.
    await fixture(10, ['bailong']); const maxLevel = await enter(4, 1);
    const stats = list => list.map(u => ({ heroId: u.heroId, hp: u.hp, atk: u.atk, def: u.def }));
    assert.deepEqual(stats(hard.echoes), stats(maxLevel.echoes));
    report.scenarios.push({ name: 'level-independent-normalization', sameEchoStatsAtPlayerLevel1And10: true });
    for (const [name, query] of [['training', 'farm=training_1'], ['equipment-hunt', 'farm=hunt_1'], ['normal-tower', 'floor=1&mode=tower']]) {
      await fixture(7);
      await page.goto(`${baseUrl}/battle?${query}&render=dom`);
      await page.getByRole('button', { name: 'เริ่มต่อสู้', exact: true }).click();
      await page.waitForTimeout(2500);
      const state = await page.evaluate(() => {
        const e = window.ng.getComponent(document.querySelector('app-battle')).engine;
        return { echoes: e.units.filter(u => u.echo).length, enemies: e.units.filter(u => u.side === 'enemy').length, fightTime: e.fightTime };
      });
      assert.equal(state.echoes, 0); assert(state.enemies > 0); assert(state.fightTime > 0);
      report.scenarios.push({ name: `regression-${name}`, ...state });
      if (name === 'normal-tower') {
        await page.evaluate(() => {
          window.playerUltEvents = [];
          const e = window.ng.getComponent(document.querySelector('app-battle')).engine;
          const players = e.units.filter(u => u.side === 'ally').map(u => u.id);
          e.subscribe(event => { if (event.type === 'cast' && event.kind === 'ult' && players.includes(event.src)) window.playerUltEvents.push(event); });
        });
        await page.locator('button.auto').click();
        await page.waitForFunction(() => window.playerUltEvents.length > 0);
        report.scenarios.push({ name: 'regression-player-ultimate', playerUltCasts: await page.evaluate(() => window.playerUltEvents.length) });
      }

    }
    assert.equal(report.javascriptErrors.length, 0);
    process.stdout.write('PASS defeat, no reward, normalized stats, no JavaScript errors' + '\n');
  } finally {
    fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
    await browser.close();
  }
})().catch(error => { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; });
