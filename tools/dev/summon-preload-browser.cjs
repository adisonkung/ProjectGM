// Isolated saves, real confirmation/buttons, and the native WebGL library. No user save is touched.
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const root='docs/reviews/summon-preload',base=process.env.SUMMON_URL||'http://127.0.0.1:4200';
async function enter(page){await page.goto(base);await page.locator('#isle-name').fill('Preload review');await page.locator('button[type=submit]').click();await page.waitForURL('**/home');await page.waitForTimeout(600);}
async function state(page){return page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('projectgm-save-v1'));return {gems:s.gems,pity:s.pity,heroes:s.heroes,heroMemory:s.heroMemory,inventory:s.inventory};});}
(async()=>{
 fs.mkdirSync(root,{recursive:true});const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const report=[];
 try{
  for(const [width,height] of (process.env.SUMMON_MOBILE==='1'?[[1280,720],[844,390]]:[[1280,720]])){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/ui/summon-book/'))requests.push({url:r.url(),at:Date.now()});});
   await page.addInitScript(()=>{window.__bookDraws=0;const p=WebGL2RenderingContext.prototype,draw=p.drawElements;p.drawElements=function(...a){window.__bookDraws++;return draw.apply(this,a)};});
   await enter(page);const before=await state(page),entry=Date.now();await page.goto(base+'/gacha');
   await page.waitForFunction(()=>{const e=document.querySelector('app-summon-book');return e&&!ng.getComponent(e).loading()&&!ng.getComponent(e).fallback();},{},{timeout:180000});
   const preparedMs=Date.now()-entry;
   assert.equal(await page.locator('dialog.book[open]').count(),0);
   assert.deepEqual(await state(page),before);
   const draws=await page.evaluate(()=>{window.__preparedBookCanvas=document.querySelector('.book-host canvas');return window.__bookDraws});
   await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.__bookDraws),draws,'hidden prepared scene must not keep drawing');
   await page.screenshot({path:`${root}/idle-${width}.png`});
   const preConfirmRequests=requests.length;await page.locator('.summon-button').first().click();
   const free=await page.evaluate(()=>ng.getComponent(document.querySelector('app-gacha')).freeSummons);
   const price=await page.evaluate(()=>ng.getComponent(document.querySelector('app-gacha')).G.single);
   const confirmed=Date.now();await page.getByRole('button',{name:/^ยืนยันอัญเชิญ/}).click();
   await page.locator('dialog.book[open]').waitFor({timeout:60000});const confirmToOpenMs=Date.now()-confirmed;
   assert(await page.evaluate(()=>document.querySelector('.book-host canvas')===window.__preparedBookCanvas),'confirmation must reuse the prepared canvas');
   await page.locator('dialog.book[open] .summon').waitFor({timeout:60000});const confirmToRoomMs=Date.now()-confirmed;
   assert.equal(requests.length,preConfirmRequests,'confirmation must not request book art again');
   const after=await state(page);assert.equal(after.gems,before.gems-(free?0:price));assert(after.pity===0||after.pity===(before.pity||0)+1);
   await page.screenshot({path:`${root}/wide-${width}.png`}); console.log('ROOM',width,{preparedMs,confirmToOpenMs,confirmToRoomMs});
   await page.waitForTimeout(1500);await page.locator('dialog.book .summon').click({force:true});
   await page.waitForTimeout(1400);await page.screenshot({path:`${root}/close-${width}.png`});
   await page.getByRole('button',{name:/^ข้าม/}).click();await page.locator('.summary .back').waitFor({timeout:60000});
   await page.screenshot({path:`${root}/summary-${width}.png`});assert.deepEqual(await state(page),after);
   await page.locator('.summary .back').click();await page.waitForFunction(()=>!ng.getComponent(document.querySelector('app-gacha')).playing());
   // Returning prepares the next pull without spending again; leaving destroys that scene.
   await page.waitForFunction(()=>!ng.getComponent(document.querySelector('app-summon-book')).loading(),{},{timeout:180000});
   assert.deepEqual(await state(page),after);assert(await page.evaluate(()=>!window.__preparedBookCanvas.isConnected));
   await page.goto(base+'/account');assert.equal(await page.locator('app-summon-book canvas').count(),0);assert.deepEqual(errors,[]);
   report.push({width,height,preparedMs,firstArtRequestMs:requests[0].at-entry,preConfirmRequests,confirmToOpenMs,confirmToRoomMs,bookRequestsAtEnd:requests.length,free,reusedCanvas:true,pausedWhileHidden:true,unchargedBeforeConfirm:true,singleTransaction:true,repreparedAfterReturn:true,cleanupOnExit:true,errors});
   console.log('PASS',width,JSON.stringify(report.at(-1)));await context.close();
  }
  const reducedWidth=process.env.SUMMON_MOBILE==='1'?844:1280,reducedHeight=reducedWidth===844?390:720;
  const context=await browser.newContext({viewport:{width:reducedWidth,height:reducedHeight},reducedMotion:'reduce'}),page=await context.newPage();const requests=[];
  page.on('request',r=>{if(r.url().includes('/ui/summon-book/'))requests.push(r.url())});await enter(page);const before=await state(page);await page.goto(base+'/gacha');await page.waitForTimeout(1400);
  assert.equal(await page.locator('.book-host canvas').count(),0);assert.deepEqual(await state(page),before);assert.deepEqual(requests,[]);
  await page.locator('.summon-button').first().click();await page.getByRole('button',{name:/^ยืนยันอัญเชิญ/}).click();await page.locator('app-summon-scene dialog[open]').waitFor({timeout:30000});
  await page.screenshot({path:`${root}/reduced-${reducedWidth}.png`});assert.deepEqual(requests,[]);report.push({width:reducedWidth,height:reducedHeight,reduced:true,noBookDownloads:true,fallback:true});await context.close();
 }finally{await browser.close()}
 fs.writeFileSync(root+'/browser-report.json',JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exit(1)});
