// Desktop gate layout/motion review in an isolated save; no summon is committed.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = 'docs/reviews/summon-banner-layout';
const label = process.env.BANNER_CAPTURE || 'after';
const base = process.env.SUMMON_URL || 'http://127.0.0.1:4200';

async function bounds(page) {
  return page.evaluate(() => {
    const sels = ['.gate', '.banner-tab.active', '.banner-tab.soon', '.banner-heading', '.pool-tools', '.summon-footer', '.key-art', '.key-art > video, .key-art > img'];
    return Object.fromEntries(sels.map(sel => {
      const e = document.querySelector(sel), r = e.getBoundingClientRect(), css = getComputedStyle(e);
      return [sel, { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom,
        animation: css.animationName, scale: css.scale, translate: css.translate }];
    }));
  });
}

(async () => {
  fs.mkdirSync(root, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const report = [];
  try {
    for (const [width, height] of [[1280,720], [1600,900]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage(), errors = [], externalFailures = [];
      page.setDefaultTimeout(180000);
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', res => { if (res.url().startsWith(base) && res.status() >= 400) errors.push(`${res.status()} ${res.url()}`); });
      page.on('requestfailed', req => {
        if (req.url().startsWith(base)) errors.push(req.url() + ': ' + req.failure()?.errorText);
        else externalFailures.push({url:req.url(), error:req.failure()?.errorText});
      });
      await page.goto(base);
      await page.locator('#isle-name').fill('Banner review');
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/home');
      await page.waitForTimeout(600);
      await page.goto(base + '/gacha');
      await page.waitForFunction(() => {
        const e = document.querySelector('app-summon-book');
        return e && (!ng.getComponent(e).loading() || ng.getComponent(e).fallback());
      }, {}, { timeout: 180000 });
      // Match video/art composition between before and after while inspecting the existing CSS motion separately.
      await page.locator('.key-art video').evaluate(async video => {
        video.pause(); video.currentTime = 1;
        await new Promise(resolve => video.addEventListener('seeked', resolve, {once:true}));
      });
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const img of document.querySelectorAll('.banner-rail img')) await img.decode();
        for (const a of document.querySelector('.key-art').getAnimations({subtree:true})) { a.pause(); a.currentTime = 0; }
      });
      const start = await bounds(page);
      await page.screenshot({path:`${root}/${label}-${width}.png`});
      await page.evaluate(() => { for (const a of document.querySelector('.key-art').getAnimations({subtree:true})) a.currentTime = 16000; });
      const end = await bounds(page);
      const saved = await page.evaluate(() => localStorage.getItem('projectgm-save-v1'));
      await page.locator('.banner-tab.active').click();
      await page.locator('#summon-info-title').filter({hasText:'รายละเอียดตู้อัญเชิญ'}).waitFor();
      await page.getByRole('button',{name:'ปิดข้อมูล',exact:true}).click();
      assert(await page.locator('.banner-tab.soon').isDisabled());
      for (const name of ['อัตราอัญเชิญ','รายชื่อฮีโร่','ความทรงจำ']) {
        await page.locator('.summon-ui > .pool-tools').getByRole('button',{name,exact:true}).click();
        await page.locator('dialog[open] .modal-body').waitFor();
        await page.getByRole('button',{name:'ปิดข้อมูล',exact:true}).click();
      }
      await page.locator('.summon-button.single').click();
      await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();
      assert.equal(await page.evaluate(() => localStorage.getItem('projectgm-save-v1')), saved);
      assert.deepEqual(errors, []);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.gate').scrollHeight <= innerHeight));
      if (label === 'after') {
        assert.deepEqual(start, end, 'the banner must not translate/scale over its former animation cycle');
        const before = JSON.parse(fs.readFileSync(`${root}/before-report.json`)).find(r => r.width === width).start;
        assert(start['.banner-tab.active'].width > before['.banner-tab.active'].width);
        assert(start['.banner-tab.active'].height > before['.banner-tab.active'].height);
        assert(start['.banner-heading'].y > before['.banner-heading'].y);
        assert(start['.banner-heading'].bottom < start['.pool-tools'].y);
        assert(start['.banner-tab.soon'].bottom < height);
      }
      report.push({width,height,start,end,dialogsAndCancel:true,noTransaction:true,errors,externalFailures});
      console.log('PASS',label,width);
      await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${root}/${label}-report.json`,JSON.stringify(report,null,2)+'\n');
})().catch(e => {console.error(e);process.exit(1)});
