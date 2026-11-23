// Actual Desktop summon UI with an isolated save. Paused native WebGL frames, not composited mockups.
// Advance the scene's RAF in 100 ms steps; render only the final frame (software WebGL is slow).
// The intercepted development module changes only QA render scheduling, never shaders or card transforms.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = 'docs/reviews/summon-card-layout';
const cases = [{label:'after',count:1}, {label:'after',count:10}, {label:'roster-a',count:10,roster:[0,1,2,3,4,5,6,7,8,9]}, {label:'roster-b',count:10,roster:[10,11,12,13,14,7,8,9,10,11]}];
const base = process.env.SUMMON_URL || 'http://127.0.0.1:4200';

async function advance(page, frames) {
  await page.evaluate(async n => {
    window.__auraSetRendering(false);
    for (let i = 0; i < n; i++) {
      const pending = [...window.__auraRAF.callbacks.values()];
      window.__auraRAF.callbacks.clear();
      window.__auraRAF.time += 100;
      for (const cb of pending) cb(window.__auraRAF.time);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    window.__auraSetRendering(true);
    window.__auraRender();
  }, frames);
}

(async () => {
  fs.mkdirSync(root, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const report = [];
  try {
    for (const {count,label,roster} of cases) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await context.newPage();
      page.setDefaultTimeout(180000);
      const errors = [], externalFailures = [];
      let instrumented = false;
      await page.route('**/chunk-*.js*', async route => {
        const response = await route.fetch();
        let body = await response.text();
        const marker = 'function frame(now) {';
        if (body.includes('function mountBookScene(') && body.includes(marker)) {
          assert.equal(instrumented, false);
          instrumented = true;
          body = body.replace(marker, `const auraQARender = composer.render.bind(composer);
            window.__auraSetRendering = enabled => { composer.render = enabled ? auraQARender : () => {}; };
            window.__auraRender = () => step(0);
            window.__cardPose = () => { cardBody.computeBoundingBox(); return { body: cardBody.boundingBox.getSize(new THREE.Vector3()).toArray(), cards:cards.slice(0,S.n).map(c=>({matrix:c.m.matrixWorld.toArray(),auraTime:c.aura.material.uniforms.time.value})), heroes:S.cards.map(c=>c.hero.id) }; };
            window.__auraInspect = () => cards.filter(c => c.aura.visible).map(c => ({
              depthExcluded: fxHide.includes(c.aura) || c.aura.parent !== fg, depthWrite: c.aura.material.depthWrite,
              widthRatio: c.aura.scale.x / c.m.scale.x,
              heightRatio: c.aura.scale.y / (c.m.scale.y * 1.5),
              poseAligned: c.aura.quaternion.angleTo(c.m.quaternion) < 0.00001
            }));
            ${marker}`);
        }
        await route.fulfill({ response, body });
      });
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource:')) errors.push(msg.text());
      });
      page.on('requestfailed', req => {
        if (req.url().startsWith(base)) errors.push(req.url() + ': ' + req.failure()?.errorText);
        else externalFailures.push({ url: req.url(), error: req.failure()?.errorText });
      });
      await page.addInitScript(() => { Math.random = () => .42; const fill = CanvasRenderingContext2D.prototype.fillText; window.__cardText=[]; CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){if(this.canvas.width===800 && this.canvas.height===1200){const m=this.measureText(text);window.__cardText.push({text,x,y,font:this.font,align:this.textAlign,width:m.width,left:m.actualBoundingBoxLeft,right:m.actualBoundingBoxRight});}return fill.call(this,text,x,y,...rest);}; });
      await page.goto(base);
      await page.locator('#isle-name').fill('Aura review');
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/home');
      await page.waitForTimeout(600);
      await page.goto(base + '/gacha');
      await page.waitForFunction(() => {
        const e = document.querySelector('app-summon-book');
        return e && !ng.getComponent(e).loading() && !ng.getComponent(e).fallback();
      }, {}, { timeout: 180000 });
      console.log(label, count, 'prepared');
      assert(instrumented, 'development scene scheduling hook must be installed');
      await page.evaluate(() => {
        const state = window.__auraRAF = { callbacks: new Map(), id: 0, time: 1000 };
        window.requestAnimationFrame = cb => { const id = ++state.id; state.callbacks.set(id, cb); return id; };
        window.cancelAnimationFrame = id => state.callbacks.delete(id);
      });
      if(roster) await page.evaluate(indices=>{const page=ng.getComponent(document.querySelector('app-gacha')),service=page.gacha,original=service.summon.bind(service),owned=new Set(service.save.state().heroes.map(h=>h.templateId));let step='rarity',i=0;service.summon=n=>original(n,()=>{if(step==='rarity'){step='hero';return .999;}if(step==='hero'){const index=indices[i++],id=page.pool[index].id;step=owned.has(id)?'rarity':'potential';owned.add(id);return (index+.5)/page.pool.length;}step='rarity';return .5;});},roster);
      await page.locator('.summon-button').nth(count === 1 ? 0 : 1).click({ force: true });
      await page.getByRole('button', { name: /^ยืนยันอัญเชิญ/ }).click({ force: true });
      await page.locator('dialog.book[open]').waitFor();
      console.log(label, count, 'confirmed');
      const committed = await page.evaluate(() => localStorage.getItem('projectgm-save-v1'));
      await advance(page, 15);
      await page.locator('dialog.book .summon').click({ force: true });
      await advance(page, count === 1 ? 67 : 70);
      await page.screenshot({ path: `${root}/${label}-${count}-moving.png` });
      console.log(label, count, 'moving');
      await advance(page, 22);
      await page.screenshot({ path: `${root}/${label}-${count}-waiting.png` });
      const waitingAuras = await page.evaluate(() => window.__auraInspect());
      assert.equal(waitingAuras.length, count, 'every waiting gold card must retain its aura');
      if (label === 'after') assert(waitingAuras.every(a => a.depthExcluded && !a.depthWrite && a.poseAligned));
      let nativeGoldOpen = false;
      if (count === 1 && label === 'after') {
        await page.locator('.book-host canvas').click({ force: true });
        await advance(page, 50);
        await page.locator('.cine').click({ force: true });
        await advance(page, 10);
        await page.locator('.summary .back').waitFor();
        await page.screenshot({ path: `${root}/${label}-${count}-opened.png` });
        nativeGoldOpen = true;
      }
      if (!nativeGoldOpen) {
        await page.getByRole('button', { name: /^ข้าม/ }).click({ force: true });
        await advance(page, 2);
      }
      await page.locator('.summary .back').waitFor();
      await page.screenshot({ path: `${root}/${label}-${count}-summary.png` });
      assert.equal(await page.evaluate(() => localStorage.getItem('projectgm-save-v1')), committed,
        'presentation and skip must not change the committed pull');
      const text=await page.evaluate(()=>window.__cardText), names=text.filter(t=>t.y>800);
      assert(names.length>=count*2);
      assert(names.every(t=>Math.abs(t.x+(t.right-t.left)/2-400)<.01 && t.x-t.left>=63 && t.x+t.right<=737),'both names must fit and have the same visible centre');
      assert(names.filter(t=>t.y===1030).every(t=>t.font.includes('Eldervane Summon Serif')));
      const pose=await page.evaluate(()=>window.__cardPose());
      assert(Math.abs(pose.body[0]-1.012)<.001 && Math.abs(pose.body[2]-.014)<.001);
      await advance(page,50);
      const later=await page.evaluate(()=>window.__cardPose());
      assert.deepEqual(later.cards.map(c=>c.matrix),pose.cards.map(c=>c.matrix),'opened card transforms must stay fixed across five seconds');
      assert(later.cards.every((c,i)=>c.auraTime>pose.cards[i].auraTime),'surrounding auras remain animated');
      fs.writeFileSync(`${root}/${label}-${count}-text.json`,JSON.stringify(text,null,2)+'\n');
      assert.deepEqual(errors, []);
      report.push({ label, count, roster:pose.heroes, namesCenteredAndFitted:true, stationaryForFiveSeconds:true, body:pose.body, viewport: '1280x720', pausedSceneFrames: true,
        movingAfterTapMs: count === 1 ? 6700 : 7000, waitingAdditionalMs: 2200,
        summaryViaNativeSkip: !nativeGoldOpen, nativeGoldOpen, noAdditionalTransaction: true, waitingAuras, errors, externalFailures });
      console.log(label, count, 'PASS');
      await context.close();
    }
  } finally { await browser.close(); }
  assert.equal(new Set(report.flatMap(r=>r.roster)).size,15,'review must cover the full shipped roster');
  fs.writeFileSync(`${root}/after-report.json`, JSON.stringify(report, null, 2) + '\n');
})().catch(e => { console.error(e); process.exit(1); });
