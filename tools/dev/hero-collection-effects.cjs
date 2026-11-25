// Native animation evidence in a new disposable browser save; no player data.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const base = process.env.HERO_COLLECTION_URL || 'http://127.0.0.1:4300';
const root = 'docs/reviews/hero-generated-art';
const ids = [...fs.readFileSync('src/app/core/data/heroes.ts', 'utf8').matchAll(/id: '([^']+)'/g)].map(m => m[1]);
const glint = page => page.locator('app-awakened-star .glint').first().evaluate(e => {
  const s = getComputedStyle(e);
  return { name: s.animationName, duration: s.animationDuration, opacity: s.opacity, display: s.display };
});
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 860 }, recordVideo: { dir: '/tmp/hero-generated-video', size: { width: 1440, height: 860 } } });
    await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await context.newPage();
    await page.goto(base);
    await page.locator('#isle-name').fill('ทดสอบ');
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/home');
    await page.goto(base + '/heroes');
    await page.locator('.hero-card').first().waitFor();
    await page.evaluate(ids => {
      const c = ng.getComponent(document.querySelector('app-heroes'));
      c.save.update(s => ({ ...s, heroes: ids.map((id,i) => ({ uid:i+1, templateId:id, level:i===0?10:5, potential:'B', star:[6,5,4,3,5,5,3,5,5,6,3,4,5,3,6][i], exp:0, breakthroughTier:i===0?3:0 })), nextUid:16 }));
    }, ids);
    await page.waitForFunction(() => document.querySelectorAll('app-awakened-star').length === 18);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('.hero-art')].map(im => im.decode())); });
    const roster = await glint(page);
    assert(roster.name.includes('awakened-glint'));
    // Record a full natural shimmer cycle, without changing animation timing/styles.
    await page.waitForTimeout(6100);
    await page.screenshot({ path: root + '/six-stars-native.png' });
    const state = await context.storageState();
    const video = await page.video().path();
    await context.close();
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-sseof', '-6', '-i', video, '-an', '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', root + '/six-stars-native.webm']);
    const detailContext = await browser.newContext({ viewport: { width: 1440, height: 860 }, storageState: state });
    await detailContext.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const detail = await detailContext.newPage();
    await detail.goto(base + '/heroes/1');
    await detail.locator('app-awakened-star .glint').first().waitFor();
    const detailEffect = await glint(detail);
    assert.equal(roster.name, detailEffect.name);
    assert.equal(roster.duration, detailEffect.duration);
    await detailContext.close();
    const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 860 }, storageState: state, reducedMotion: 'reduce' });
    await reducedContext.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const reduced = await reducedContext.newPage();
    await reduced.goto(base + '/heroes');
    await reduced.locator('app-awakened-star').first().waitFor();
    const reducedEffect = await glint(reduced);
    assert.equal(reducedEffect.display, 'none');
    await reducedContext.close();
    fs.writeFileSync(root + '/effects-report.json', JSON.stringify({ roster, detail: detailEffect, reducedMotion: reducedEffect, sameSharedEffect: true }, null, 2) + '\n');
    console.log('PASS shared collection/detail shimmer and reduced-motion behavior.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
