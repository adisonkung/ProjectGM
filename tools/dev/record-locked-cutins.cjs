// Native manual-cast recordings. Isolated contexts; no frozen/composited frames or user save.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const root=path.resolve(process.env.CUTIN_OUTPUT_DIR || 'docs/reviews/locked-first-five');
  const ids=process.env.CUTIN_IDS?.split(',') || ['yuezheng','moye','tangxun','linxue'];
  const widths=process.env.CUTIN_WIDTHS?.split(',').map(Number) || [1440,844];
  const url=process.env.CUTIN_TEST_URL || 'http://127.0.0.1:4200';
  fs.mkdirSync(root,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const report=[];
  try {
    for(const [width,height] of [[1440,860],[844,390]].filter(([w])=>widths.includes(w))) for(const id of ids) {
      const context=await browser.newContext({viewport:{width,height},recordVideo:{dir:'/tmp/locked-cutin-video',size:{width,height}}});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url);
      await page.locator('#isle-name').fill('Locked cutins');
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/home');
      await page.waitForTimeout(600);
      await page.evaluate(id=>{
        const seed=JSON.parse(localStorage.getItem('projectgm-save-v1')),s=structuredClone(seed);
        const starters=['bailong','yuezheng','moye','tangxun','linxue'];
        const team=[id,...starters.filter(i=>i!==id)];
        s.heroes=team.map((templateId,i)=>({...seed.heroes[0],uid:100+i,templateId,level:7}));
        s.team=seed.team.map((slot,i)=>({...slot,uid:100+i}));
        s.cleared=10;
        localStorage.setItem('projectgm-save-v1',JSON.stringify(s));
      },id);
      await page.evaluate(()=>document.fonts.ready);
      await page.goto(`${url}/battle?floor=1`);
      await page.getByRole('button',{name:'เริ่มต่อสู้',exact:true}).click();
      await page.waitForFunction(()=>{const c=ng.getComponent(document.querySelector('app-battle'));return c.running()&&!c.loading();});
      await page.locator('.party-in .ultk').first().click();
      await page.locator('app-themed-cutin .water-vfx').waitFor();
      const source=await page.locator('app-themed-cutin .plate').getAttribute('src');
      const group=['vaelric','draeven','mordrienne','sylas','lucien'].includes(id)?'locked-final-five'
        :['garrick','kael','mirelle','sylvara','elira'].includes(id)?'locked-next-five':'locked-five';
      assert.equal(source,id==='bailong'?'/ui/cutins/bailong-aura-italic.webp':`/ui/cutins/${group}/${id}.webp`);
      await page.waitForTimeout(1900);
      assert.equal(await page.locator('app-themed-cutin').count(),0);
      const video=page.video();
      await context.close();
      await video.saveAs(`/tmp/locked-${id}-${width}.webm`);
      assert.deepEqual(errors,[]);
      report.push({id,width,height,source,errors,manualCast:true,normalPlayback:true,cleanedUp:true});
      process.stdout.write(`PASS ${id} ${width} native playback\n`);
    }
  } finally {await browser.close();}
  fs.writeFileSync(path.join(root,process.env.CUTIN_VIDEO_REPORT || 'video-report.json'),JSON.stringify(report,null,2)+'\n');
})().catch(e=>{process.stderr.write(String(e.stack||e));process.exit(1);});
