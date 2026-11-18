// Isolated browser fixtures only. Requires Playwright via NODE_PATH; never touches a user save.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ids = ['bailong', 'yuezheng', 'moye', 'tangxun', 'linxue', 'garrick', 'kael', 'mirelle', 'sylvara', 'elira'];
(async () => {
    const b = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
    const root = require('node:path').resolve('docs/reviews/themed-cutins');
    const report = [];
    try {
        const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
        const errors = [];
        p.on('pageerror', e => errors.push(e.message));
        await p.goto((process.env.CUTIN_TEST_URL || 'http://127.0.0.1:4200'));
        await p.locator('#isle-name').fill('Themed cutins');
        await p.locator('button[type=submit]').click();
        await p.waitForURL('**/home');
        await p.waitForTimeout(600);
        const seed = await p.evaluate(() => JSON.parse(localStorage.getItem('projectgm-save-v1')));
        for (const [w, h, reduced] of [[1440, 860, false], [844, 390, false], [844, 390, true]]) {
            await p.setViewportSize({ width: w, height: h });
            await p.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
            for (const id of reduced ? ['bailong', 'mirelle', 'elira'] : ids) {
                await p.evaluate(({ seed, id }) => { const s = structuredClone(seed), starters = ['bailong', 'yuezheng', 'moye', 'tangxun', 'linxue']; const team = [id, ...starters.filter(i => i !== id)].slice(0, 5); s.heroes = [...new Set([...team, ...starters])].map((templateId, i) => ({ ...seed.heroes[0], uid: 100 + i, templateId, level: 7 })); s.team = seed.team.map((slot, i) => ({ ...slot, uid: 100 + i })); s.cleared = 10; localStorage.setItem('projectgm-save-v1', JSON.stringify(s)); }, { seed, id });
                await p.goto(`${process.env.CUTIN_TEST_URL || 'http://127.0.0.1:4200'}/battle?floor=1`);
                await p.locator('app-battle').waitFor();
                await p.getByRole('button', { name: 'เริ่มต่อสู้', exact: true }).click();
                await p.waitForFunction(() => ng.getComponent(document.querySelector('app-battle')).running());
                await p.waitForFunction(() => !ng.getComponent(document.querySelector('app-battle')).loading());
                await p.locator('.party-in .ultk').first().click();
                await p.locator('app-themed-cutin .stage').waitFor({ timeout: 15000 });
                await p.evaluate(() => { const c = ng.getComponent(document.querySelector('app-battle')); clearTimeout(c.cutInTimer); c.paused.set(true); document.querySelector('.ult-cutin').getAnimations({ subtree: true }).forEach(a => { a.currentTime = 400; a.pause(); }); });
                await p.waitForFunction(() => { const img = document.querySelector('app-themed-cutin img'); return img?.complete && img.naturalWidth > 0; });
                await p.screenshot({ path: `${root}/${id}-${w}${reduced ? '-reduced' : ''}.png`, timeout: 5000 });
                const bounds = await p.evaluate(() => { const r = document.querySelector('app-themed-cutin .stage').getBoundingClientRect(), l = document.querySelector('app-themed-cutin .label').getBoundingClientRect(); const img = document.querySelector('app-themed-cutin img'); return { x: r.x, y: r.y, width: r.width, height: r.height, label: { x: l.x, y: l.y, width: l.width, height: l.height }, src: img.getAttribute('src'), text: document.querySelector('app-themed-cutin .label').textContent, overflow: document.documentElement.scrollWidth > innerWidth, animation: getComputedStyle(document.querySelector('app-themed-cutin .stage')).animationName }; });
                assert.equal(bounds.src, `/ui/cutins/${id}.webp`);
                assert(Math.abs(bounds.width - w * .7 * .9) < 2);
                assert(Math.abs(bounds.x) < 1 && Math.abs(bounds.y) < 1);
                assert.equal(bounds.overflow, false);
                assert(bounds.label.x >= 0 && bounds.label.x + bounds.label.width <= bounds.width + 2);
                assert(bounds.label.y + bounds.label.height <= bounds.height + 2);
                if (reduced)
                    assert.equal(bounds.animation, 'none');
                report.push({ id, w, h, reduced, bounds });
                process.stdout.write(`PASS ${id} ${w} ${reduced ? 'reduced' : 'normal'}\n`);
            }
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(`${root}/browser-report.json`, JSON.stringify({ report, errors }, null, 2));
    }
    finally {
        await b.close();
    }
})().catch(e => { process.stderr.write(String(e.stack || e)); process.exit(1); });
