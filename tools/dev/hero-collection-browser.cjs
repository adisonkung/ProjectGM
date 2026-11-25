// Native Desktop screenshots; isolated review saves only. Never retouches game images.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = process.env.HERO_COLLECTION_URL || 'http://127.0.0.1:4300';
const root = process.env.HERO_COLLECTION_REVIEW || 'docs/reviews/hero-collection-charcoal';
const ids = [...fs.readFileSync('src/app/core/data/heroes.ts', 'utf8').matchAll(/id: '([^']+)'/g)].map(m => m[1]);
const expectedColors = ['#ff2345','#ffce24','#c954ff','#ff9a25','#49ef69','#ffce24','#ff2345','#48e4ff','#ff9a25','#49ef69','#c954ff','#ffce24','#48e4ff','#ff9a25','#49ef69'];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1670, height: 942 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  // External Google Fonts may be denied in Cloud. The roster uses checked-in fonts.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  try {
    await page.goto(base);
    await page.locator('#isle-name').fill('ทดสอบ');
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/home');
    await page.goto(base + '/heroes');
    await page.locator('.hero-card').first().waitFor();
    await page.evaluate(ids => {
      const c = ng.getComponent(document.querySelector('app-heroes'));
      const stars = [6,5,4,3,5,5,3,5,5,6,3,4,5,3,6];
      c.save.update(s => ({ ...s, heroes: ids.map((id,i) => ({ uid:i+1, templateId:id, level:i===0?10:5, potential:'B', star:stars[i], exp:0, breakthroughTier:i===0?3:0 })), nextUid:16 }));
    }, ids);
    await page.waitForFunction(() => document.querySelectorAll('.hero-card').length === 15);
    await page.evaluate(async () => { await document.fonts.load('600 20px "Collection Thai"'); await document.fonts.ready; await Promise.all([...document.querySelectorAll('.hero-art')].map(im => im.decode())); });
    const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('projectgm-save-v1')));
    const before = await snapshot();
    const report = [];
    for (const [width,height] of [[1670,942],[1440,860],[1280,720],[1920,1080]]) {
      await page.setViewportSize({width,height});
      await page.locator('.roster-scroll').evaluate(e => e.scrollTop = 0);
      const geometry = await page.evaluate(() => {
        const rect = e => e.getBoundingClientRect().toJSON();
        const cards = [...document.querySelectorAll('.hero-card')];
        const rows = cards.map(e => ({
          box:rect(e), shadow:getComputedStyle(e).boxShadow, afterContent:getComputedStyle(e,'::after').content, color:e.style.getPropertyValue('--class-color'), line:rect(e.querySelector('.class-line')), lineGlow:getComputedStyle(e.querySelector('.class-line')).boxShadow,
          name:rect(e.querySelector('.hero-name')), nameFits:e.querySelector('.hero-name').scrollWidth <= e.querySelector('.hero-name').clientWidth+1,
          stars:rect(e.querySelector('.card-stars')), level:rect(e.querySelector('.hero-level')),
        }));
        const selected = document.querySelector('.filters [aria-pressed=true]');
        return { cards:rows, scroll:rect(document.querySelector('.roster-scroll')), pageOverflow:document.documentElement.scrollWidth>innerWidth,
          zoom:getComputedStyle(document.documentElement).zoom, selectedText:getComputedStyle(selected).color,
          selectedIcon:getComputedStyle(selected.querySelector('app-collection-icon')).color,
          searchBackground:getComputedStyle(document.querySelector('.search input')).backgroundColor,
          wallet:rect(document.querySelector('.collection-wallet')), title:rect(document.querySelector('.page-heading')),
          toolbarControls:[...document.querySelectorAll('.toolbar > label')].map(rect), classGlyphs:[...document.querySelectorAll('.filters app-collection-icon svg')].slice(1).map(e=>({viewBox:e.getAttribute('viewBox'),paths:e.querySelectorAll('path').length,box:rect(e)})), background:getComputedStyle(document.querySelector('app-heroes'),'::after').backgroundImage, header:rect(document.querySelector('.collection-header')), body:rect(document.querySelector('.collection-body')), sidebar:rect(document.querySelector('.collection-sidebar')), bodyZoom:getComputedStyle(document.querySelector('.collection-body')).zoom, sidebarZoom:getComputedStyle(document.querySelector('.collection-sidebar')).zoom, columns:getComputedStyle(document.querySelector('.hero-grid')).gridTemplateColumns.split(' ').length, oldHeader:!!document.querySelector('header.bar'), fonts:document.fonts.check('600 20px "Collection Thai"') };
      });
      assert(geometry.cards.every(c=>Math.abs(c.box.width-geometry.cards[0].box.width)<.02 && Math.abs(c.box.height-geometry.cards[0].box.height)<.02), 'all cards have exactly equal width/height '+width+' '+JSON.stringify(geometry.cards.map(c=>[c.box.width,c.box.height])));
      assert(geometry.cards.every(c=>c.shadow===geometry.cards[0].shadow && c.afterContent==='none'), 'no special selection frame '+width);
      assert(!geometry.pageOverflow && !geometry.oldHeader && geometry.fonts, JSON.stringify({width,pageOverflow:geometry.pageOverflow,oldHeader:geometry.oldHeader,fonts:geometry.fonts}));
      assert.equal(geometry.zoom,'1');
      assert(geometry.toolbarControls.every(c=>c.height>=32),'toolbar control targets enlarged');
      assert(geometry.classGlyphs.length===6 && geometry.classGlyphs.every(g=>g.viewBox==='0 0 64 64' && g.paths===2),'six line class seals');
      assert(geometry.background.includes('archive-light.svg'),'archive light background loaded');
      assert.equal(geometry.bodyZoom,'0.8'); assert.equal(geometry.sidebarZoom,'0.8'); assert.equal(geometry.columns,6);
      assert(geometry.sidebar.left<=33 && width-geometry.body.right<=33, 'roster fills viewport edges');
      assert(Math.abs(geometry.cards[0].box.y-geometry.cards[5].box.y)<.02 && geometry.cards[6].box.y>geometry.cards[0].box.y, 'six cards per row');
      assert.equal(geometry.selectedText,'rgb(37, 37, 37)');
      assert.equal(geometry.selectedIcon,'rgb(37, 37, 37)');
      assert.equal(geometry.searchBackground,'rgba(0, 0, 0, 0)');
      assert(geometry.wallet.x > geometry.title.right+20);
      geometry.cards.forEach((c,i) => {
        assert.equal(c.color,expectedColors[i]); assert(Math.abs(c.line.height-2.4)<.02);
        assert(c.lineGlow.includes('12px 3px') && c.lineGlow.includes('24px 4px'), 'layered class glow '+i);
        assert(c.box.height/c.box.width>1.4 && c.box.width<280);
        assert(c.nameFits, 'name fits '+width+' '+i);
        assert(c.stars.right<c.level.left, 'stars avoid Lv '+width+' '+i);
        assert(c.name.right<=c.level.left, 'name avoids Lv '+width+' '+i);
      });
      assert(geometry.cards[11].box.bottom <= geometry.scroll.bottom, 'two complete rows '+width);
      const prior = JSON.parse(fs.readFileSync('docs/reviews/hero-class-glow/browser-report.json','utf8')).viewports.find(v=>v.width===width);
      for(const key of ['wallet','title']) for(const axis of ['x','y','width','height']) assert(Math.abs(geometry[key][axis]-prior[key][axis])<.1,'top header unchanged '+key+' '+axis+' '+width);
      await page.screenshot({path:root+'/actual-'+width+'.png'});
      report.push({width,height,...geometry});
    }
    await page.setViewportSize({width:1670,height:942});
    await page.getByRole('button',{name:'นักเวท',exact:true}).click();
    await page.waitForFunction(() => document.querySelectorAll('.hero-card').length===2);
    await page.screenshot({path:root+'/filter-mage.png'});
    await page.getByRole('button',{name:'ทั้งหมด',exact:true}).click();
    await page.getByRole('searchbox',{name:'ค้นหาฮีโร่'}).fill('ดอว์นเมียร์');
    await page.waitForFunction(() => document.querySelectorAll('.hero-card').length===1);
    await page.getByRole('searchbox',{name:'ค้นหาฮีโร่'}).fill('no-such-hero');
    await page.getByRole('heading',{name:'ไม่พบฮีโร่ที่ค้นหา'}).waitFor();
    await page.screenshot({path:root+'/empty.png'});
    await page.getByRole('button',{name:'ดูฮีโร่ทั้งหมด',exact:true}).click();
    await page.waitForFunction(() => document.querySelectorAll('.hero-card').length===15);
    await page.getByRole('combobox',{name:'เรียงตาม',exact:true}).selectOption('level');
    await page.waitForFunction(() => document.querySelector('.hero-level b')?.textContent==='10');
    await page.getByRole('combobox',{name:'กรองตามสาย',exact:true}).selectOption('healer');
    await page.waitForFunction(() => document.querySelectorAll('.hero-card').length===3);
    await page.getByRole('button',{name:'ทั้งหมด',exact:true}).click();
    await page.getByRole('combobox',{name:'เรียงตาม',exact:true}).selectOption('roster');
    await page.locator('.roster-scroll').evaluate(e => e.scrollTop=e.scrollHeight);
    await page.screenshot({path:root+'/last-row.png'});
    await page.locator('.hero-card').last().click();
    await page.waitForURL('**/heroes/15');
    await page.locator('header.bar').waitFor();
    assert(await page.locator('header.bar').count()===1,'detail retains existing chrome');
    await page.goto(base+'/heroes'); await page.locator('.hero-card').first().waitFor();
    await page.getByRole('button',{name:'กระเป๋า',exact:true}).click();
    await page.getByRole('dialog').waitFor(); await page.screenshot({path:root+'/bag.png'});
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'เมนู',exact:true}).click();
    await page.getByRole('dialog',{name:'เมนู',exact:true}).waitFor();
    await page.screenshot({path:root+'/menu.png'});
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'เติมเพชร',exact:true}).click();
    await page.locator('.collection-notice').waitFor();
    await page.getByRole('button',{name:'ปิดข้อความ'}).click();
    const after = await snapshot();
    // Navigation and all roster controls must not grant levels/currency or mutate inventory/ownership.
    for (const key of ['gems','gold','heroes','inventory','equipment','team']) assert.deepEqual(after[key],before[key],key+' unchanged');
    await page.getByRole('link',{name:'กลับหน้าหลัก',exact:true}).click();
    await page.waitForURL('**/home');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(root+'/browser-report.json',JSON.stringify({viewports:report,flows:['class filter','full-name search','empty recovery','level sort','dropdown filter','last row scroll','hero detail','bag + Escape','menu + Escape','wallet placeholder','back'],saveUnchanged:true,errors},null,2)+'\n');
    console.log('PASS Desktop roster at four sizes; filters, routes, dialogs, save preservation.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
