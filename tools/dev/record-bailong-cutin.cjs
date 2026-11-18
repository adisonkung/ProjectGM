// Native browser recording, with no animation freezing or composited game frames.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const root=path.resolve('docs/reviews/bailong-aura-live');
  fs.mkdirSync(root,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const report=[];
  try {
    for(const [width,height] of [[1440,860],[844,390]]) {
      const context=await browser.newContext({viewport:{width,height},recordVideo:{dir:'/tmp/bailong-aura-video',size:{width,height}}});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:4200');
      await page.locator('#isle-name').fill('Bai Long aura');
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/home');
      await page.waitForTimeout(600);
      await page.evaluate(()=>document.fonts.ready);
      await page.goto('http://127.0.0.1:4200/battle?floor=1');
      await page.getByRole('button',{name:'เริ่มต่อสู้',exact:true}).click();
      await page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('app-battle'));return c.running()&&!c.loading();});
      await page.locator('.party-in .ultk').first().click();
      await page.locator('app-themed-cutin .water-ribbons').waitFor();
      const source=await page.locator('app-themed-cutin img').getAttribute('src');
      assert.equal(source,'/ui/cutins/bailong-aura-italic.webp');
      await page.waitForTimeout(1900);
      assert.equal(await page.locator('app-themed-cutin').count(),0);
      const video=page.video();
      await context.close();
      await video.saveAs(`/tmp/bailong-aura-${width}.webm`);
      assert.deepEqual(errors,[]);
      report.push({width,height,source,errors,manualCast:true,normalPlayback:true,cleanedUp:true});
    }
  } finally {await browser.close();}
  fs.writeFileSync(path.join(root,'video-report.json'),JSON.stringify(report,null,2)+'\n');
  process.stdout.write(JSON.stringify(report));
})().catch(e=>{process.stderr.write(String(e.stack||e));process.exit(1);});
