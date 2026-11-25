// Native Desktop verification of every class-icon consumer; disposable QA save.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = process.env.HERO_COLLECTION_URL || 'http://127.0.0.1:4300';
const root = 'docs/reviews/class-icons-b';
const heroes = [...fs.readFileSync('src/app/core/data/heroes.ts', 'utf8').matchAll(/\{\s*id:\s*'([^']+)'[^}]*?cls:\s*'([^']+)'/g)].map((m,i) => ({ id:m[1], cls:m[2], uid:i+1 }));
const classes = ['fighter','tank','assassin','archer','mage','healer'];
(async () => {
  const browser = await chromium.launch({ executablePath:'/usr/bin/chromium', headless:true, args:['--no-sandbox'] });
  const context = await browser.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:1 });
  const page = await context.newPage();
  const errors = [], report = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if(r.url().startsWith(base) && r.status()>=400) errors.push(r.status()+' '+r.url()); });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('projectgm-save-v1')));
  const inspect = async name => {
    const images = await page.locator('img[src*="/ui/generated/class/"]').evaluateAll(async elements => {
      elements=elements.filter(e=>e.getBoundingClientRect().width>0 && e.getBoundingClientRect().height>0);
      await Promise.all(elements.map(e=>e.decode()));
      return elements.map(e=>({src:e.getAttribute('src'),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,natural:e.naturalWidth,transform:getComputedStyle(e).transform}));
    });
    assert(images.length>0, 'class images exist: '+name);
    assert(images.every(i=>i.natural===256 && i.width>0 && i.height>0),'class images loaded: '+name);
    assert(images.every(i=>classes.some(c=>i.src.endsWith('/'+c+'.webp'))),'shared class assets: '+name);
    report.push({name,images});
    await page.screenshot({path:root+'/'+name+'.png'});
    return images;
  };
  try {
    await page.goto(base);
    await page.locator('#isle-name').fill('ทดสอบ');
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/home');
    await page.goto(base+'/heroes');
    await page.locator('.hero-card').first().waitFor();
    await page.evaluate(heroes => {
      const c = ng.getComponent(document.querySelector('app-heroes'));
      c.save.update(s=>({...s,heroes:heroes.map(h=>({uid:h.uid,templateId:h.id,level:5,potential:'B',star:3,exp:0,breakthroughTier:0})),nextUid:16}));
    }, heroes);
    await page.waitForFunction(()=>document.querySelectorAll('.hero-card').length===15);
    const before = await snapshot();
    for(const cls of classes) {
      const h=heroes.find(h=>h.cls===cls);
      await page.goto(base+'/heroes/'+h.uid);
      await page.locator('.class-badge img').waitFor();
      const images=await inspect('detail-'+cls);
      assert(images.some(i=>i.src.endsWith('/'+cls+'.webp')),'detail class mapping '+cls);
    }
    await page.goto(base+'/team');
    await page.locator('.class-filters').waitFor();
    const team=await inspect('formation');
    assert(classes.every(c=>team.some(i=>i.src.endsWith('/'+c+'.webp'))),'all six formation filters');
    assert(team.every(i=>i.transform==='none'),'class images have no legacy scale');
    await page.getByRole('button',{name:'นักเวท',exact:true}).click();
    await inspect('formation-mage');
    await page.goto(base+'/island');
    await page.locator('.party-card').first().waitFor();
    await inspect('island-party');
    await page.locator('.party-card').first().click();
    await page.locator('.hero-dialog').waitFor();
    const dialog=await inspect('island-hero-dialog');
    assert(dialog.some(i=>i.src.endsWith('/fighter.webp')),'hero dialog uses actual fighter class');
    await page.getByRole('button',{name:'ปิด',exact:true}).click();
    await page.goto(base+'/gacha');
    await page.getByRole('button',{name:'รายชื่อฮีโร่',exact:true}).click();
    await page.locator('.pool-grid').waitFor();
    const pool=await inspect('summon-pool');
    assert(classes.every(c=>pool.some(i=>i.src.endsWith('/'+c+'.webp'))),'all six summon classes');
    await page.getByRole('button',{name:'ปิดข้อมูล',exact:true}).click();
    for(const route of ['battle','lab']) {
      await page.goto(base+'/'+route);
      await page.locator('app-placement').waitFor();
      await inspect(route+'-preparation');
    }
    const after=await snapshot();
    for(const key of ['gems','gold','heroes','inventory','equipment','team']) assert.deepEqual(after[key],before[key],key+' unchanged');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(root+'/consumer-report.json',JSON.stringify({pages:report,saveUnchanged:true,errors},null,2)+'\n');
    console.log('PASS all six detail classes, formation/filter, island/dialog, summon pool and battle/lab preparation.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
