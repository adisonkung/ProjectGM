// Native Desktop screenshots and cancel-only interactions in isolated browser saves.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = 'docs/reviews/summon-classic-controls';
const base = process.env.SUMMON_URL || 'http://127.0.0.1:4200';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const report = [];
  try {
    for (const [width,height] of [[1280,720],[1600,900]]) {
      const context = await browser.newContext({viewport:{width,height}});
      const page = await context.newPage(), errors=[], externalFailures=[], navigationAborts=[];
      let gateLoaded=false;
      page.setDefaultTimeout(180000);
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => {if(r.url().startsWith(base) && r.status()>=400) errors.push(r.status()+' '+r.url());});
      page.on('requestfailed', r => {if(r.url().startsWith(base)){if(!gateLoaded && r.failure()?.errorText==='net::ERR_ABORTED') navigationAborts.push(r.url());else errors.push(r.url()+': '+r.failure()?.errorText);}else externalFailures.push(r.url());});
      console.log('Checking Desktop',width);
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.locator('#isle-name').fill('Classic QA');
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/home');
      await page.goto(base+'/gacha',{waitUntil:'domcontentloaded'});
      await page.locator('.acts').waitFor();
      gateLoaded=true;
      console.log('Gate ready',width);
      await page.evaluate(async()=>{
        await document.fonts.ready;
        const video=document.querySelector('.key-art video');
        if(video){video.pause();}
      });
      console.log('Fonts ready',width);
      const geometry=await page.locator('.acts').evaluate(el=>[...el.querySelectorAll('button')].map(button=>{
        const box=button.getBoundingClientRect(),label=button.querySelector('.summon-label'),price=button.querySelector('.amount');
        const range=document.createRange();range.selectNodeContents(price);const amount=range.getBoundingClientRect(),icon=button.querySelector('.gem').getBoundingClientRect();
        return {width:box.width,height:box.height,label:label.textContent,font:getComputedStyle(label).fontFamily,size:getComputedStyle(label).fontSize,price:price.textContent,coinGap:amount.x-icon.right};
      }));
      assert(geometry.every(g=>g.height===76 && Math.abs(g.width-291)<1 && g.coinGap>=8 && g.size==='22px' && g.font.includes('Eldervane Summon Serif')));
      assert(await page.evaluate(()=>document.fonts.check('600 22px "Eldervane Summon Serif"')));
      assert.equal(await page.locator('.summon-footer').getByText(/ทดสอบ|ไม่หักเพชร/).count(),0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && document.querySelector('.gate').scrollHeight<=innerHeight));
      await page.screenshot({path:root+'/game-'+width+'.png'});
      await page.locator('.acts').screenshot({path:root+'/buttons-'+width+'.png'});
      const save=await page.evaluate(()=>localStorage.getItem('projectgm-save-v1'));
      for(const type of ['single','multi']) {
        await page.locator('.summon-button.'+type).click();
        assert(await page.locator('.confirm-dialog[open]').isVisible());
        await page.waitForFunction(amount=>document.querySelector('.confirm-wallet').textContent.includes(amount),type==='single'?'100':'900');
        await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();
        assert.equal(await page.evaluate(()=>localStorage.getItem('projectgm-save-v1')),save);
      }
      for(const name of ['อัตราอัญเชิญ','รายชื่อฮีโร่','ความทรงจำ']) {
        await page.locator('.summon-ui > .pool-tools').getByRole('button',{name,exact:true}).click();
        assert(await page.locator('dialog[open] .modal-body').isVisible());
        await page.getByRole('button',{name:'ปิดข้อมูล',exact:true}).click();
      }
      assert.deepEqual(errors,[]);
      report.push({width,height,geometry,errors,externalFailures,navigationAborts,cancelPreservedSave:true,informationDialogs:true});
      await context.close();
    }
    fs.writeFileSync(root+'/browser-report.json',JSON.stringify(report,null,2)+'\n');
    console.log('PASS Desktop classic controls',JSON.stringify(report));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
