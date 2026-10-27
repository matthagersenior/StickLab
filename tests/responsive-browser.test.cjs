'use strict';
/* Browser-driven layout regression tests, run by CI with Playwright and Chrome. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const chromium=process.env.STICKLAB_BROWSER_TEST?require('playwright').chromium:null;
const root=path.resolve(__dirname,'..');
const scenarios=[
 {width:320,height:480,mobile:true,name:'small portrait'},
 {width:320,height:568,mobile:true,name:'compact portrait'},
 {width:360,height:800,mobile:true,name:'Android portrait'},
 {width:390,height:844,mobile:true,name:'large portrait'},
 {width:568,height:320,mobile:true,name:'small landscape'},
 {width:667,height:375,mobile:true,name:'phone landscape'},
 {width:844,height:390,mobile:true,name:'wide landscape'},
 {width:800,height:360,mobile:true,name:'large phone landscape'},
 {width:768,height:1024,mobile:true,name:'tablet portrait'},
 {width:1024,height:768,mobile:true,name:'tablet landscape'},
 {width:900,height:600,mobile:false,name:'small desktop'},
 {width:1440,height:900,mobile:false,name:'desktop'}
];
function server(){
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
 return http.createServer((req,res)=>{
  const u=decodeURIComponent((req.url||'/').split('?')[0]),name=u==='/'?'index.html':u.slice(1),file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep)&&file!==path.resolve(root,'index.html')){res.writeHead(403).end();return}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data)});
 });
}
test('essential gameplay controls remain inside the viewport and do not overlap across orientations',{skip:!process.env.STICKLAB_BROWSER_TEST},async()=>{
 const srv=server();await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL||'chrome',args:['--no-sandbox']});
 try{
  const url='http://127.0.0.1:'+srv.address().port+'/';
  for(const v of scenarios){
   const context=await browser.newContext({viewport:{width:v.width,height:v.height},isMobile:v.mobile,hasTouch:v.mobile,deviceScaleFactor:v.mobile?2:1});
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForTimeout(80);
   const data=await page.evaluate(()=>{
    function rect(selector){
     const node=document.querySelector(selector);if(!node)return null;
     const c=getComputedStyle(node),r=node.getBoundingClientRect();
     if(c.display==='none'||c.visibility==='hidden'||r.width<1||r.height<1)return null;
     return{x:r.x,y:r.y,w:r.width,h:r.height,name:selector};
    }
    return {
     w:innerWidth,h:innerHeight,scrollW:document.documentElement.scrollWidth,
     chip:rect('.world-chip'),actions:rect('.top-actions'),top:rect('.topbar'),
     zoom:rect('.zoom'),pad:rect('.controlpad'),tools:rect('.mobiletools'),
     status:rect('.status'),menu:rect('#openMenu'),
     buttons:['#openMenu','#snapshot','#step','#pause','#zoomIn','#zoomOut','#recenter','[data-hold="left"]','[data-hold="jump"]','[data-hold="right"]'].map(rect).filter(Boolean)
    };
   });
   const inside=r=>r.x>=-1&&r.y>=-1&&r.x+r.w<=data.w+1&&r.y+r.h<=data.h+1;
   const overlaps=(a,b)=>a&&b&&Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>2&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>2;
   const bad=[];
   if(data.scrollW>data.w+1)bad.push('horizontal scrolling');
   for(const p of data.buttons){if(!inside(p))bad.push(p.name+' outside viewport: '+JSON.stringify(p))}
   for(const [a,b] of [['chip','actions'],['top','zoom'],['zoom','pad'],['zoom','tools'],['pad','tools'],['status','pad']])if(overlaps(data[a],data[b]))bad.push(a+' overlaps '+b);
   if(v.mobile&&v.height<=560&&!data.tools)bad.push('short touch landscape lost tool strip');
   if(v.mobile&&v.height<=560&&!data.menu)bad.push('short touch landscape lost menu');
   assert.deepEqual({scenario:v.name,bad,errors},{scenario:v.name,bad:[],errors:[]},JSON.stringify(data));
   await context.close();
  }
 }finally{await browser.close();await new Promise(r=>srv.close(r))}
});

test('same running touch session survives portrait-landscape-portrait rotation', {skip:!process.env.STICKLAB_BROWSER_TEST},async()=>{
 const srv=server();await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL||'chrome',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('#zoomIn').click();assert.match(await page.locator('#cameraFeedback').textContent(),/\d+%/);
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(80);
  assert.equal(await page.locator('.mobiletools').isVisible(),true,'tools must remain available in landscape');
  assert.equal(await page.locator('#openMenu').isVisible(),true,'menu must remain available in landscape');
  await page.locator('#openMenu').click();
  assert.equal(await page.locator('#sidebar').evaluate(el=>el.classList.contains('open')),true);
  await page.locator('#sidebar [data-tool="ball"]').click();
  assert.equal(await page.locator('#sidebar').evaluate(el=>el.classList.contains('open')),false);
  assert.equal(await page.locator('.mobiletools [data-tool="ball"]').evaluate(el=>el.classList.contains('active')),true);
  await page.setViewportSize({width:360,height:800});await page.waitForTimeout(80);
  assert.equal(await page.locator('#zoomOut').isVisible(),true);
  await page.locator('#zoomOut').click();
  assert.deepEqual(errors,[]);
  await context.close();
 }finally{await browser.close();await new Promise(r=>srv.close(r))}
});

test('real Android-sized touch toolbar places new Pins and detaches their rope without erasing anchors',{skip:!process.env.STICKLAB_BROWSER_TEST},async()=>{
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL||'chrome',args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>window.StickLab.createWorld('empty'));
  const touchWorld=async(x,y)=>{
   const pt=await page.evaluate(({x,y})=>{const c=window.StickLab.getCamera(),r=document.querySelector('#canvas').getBoundingClientRect();return {x:r.left+r.width/2+(x-c.x)*c.z,y:r.top+r.height/2+(y-c.y)*c.z}},{x,y});
   await page.touchscreen.tap(pt.x,pt.y);
  };
  await page.locator('.mobiletools [data-tool="anchor"]').click();
  await touchWorld(760,590);await touchWorld(990,590);
  assert.equal(await page.evaluate(()=>window.StickLab.getWorld().parts.filter(p=>p.kind==='anchor').length),2);
  await page.locator('.mobiletools [data-tool="rope"]').click();
  await touchWorld(760,590);await touchWorld(990,590);
  assert.equal(await page.evaluate(()=>window.StickLab.getWorld().links.length),1,'new anchors should connect');
  await page.locator('.mobiletools [data-tool="detach"]').click();
  await touchWorld(875,590);
  const state=await page.evaluate(()=>window.StickLab.getWorld());
  assert.equal(state.links.length,0,'tap on rope should detach');
  assert.equal(state.parts.length,2,'both anchors survive');
  assert.deepEqual(errors,[]);
  await ctx.close();
 }finally{await browser.close();await new Promise(r=>srv.close(r))}
});

test('optional physics levels are discoverable and sandbox resumes after a portrait-landscape challenge', {skip:!process.env.STICKLAB_BROWSER_TEST},async()=>{
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL||'chrome',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#challengeAction').isVisible(),true,'Levels must be visible without opening tools');
  await page.evaluate(()=>{window.StickLab.createWorld('empty');window.StickLab.spawnResident(770,840)});
  const before=await page.evaluate(()=>window.StickLab.getWorld());
  await page.locator('#challengeAction').click();
  assert.equal(await page.locator('#sidebar').evaluate(el=>el.classList.contains('open')),true);
  assert.match(await page.locator('#challengeStatus').textContent(),/optional|no win/i);
  assert.equal(await page.locator('#worldTitle').textContent(),before.title);
  await page.locator('#sidebar [data-level="0"]').click();
  assert.equal(await page.locator('#sidebar').evaluate(el=>el.classList.contains('open')),false);
  assert.match(await page.locator('#missionObjective').textContent(),/blue.+green.+goal/i);
  assert.match(await page.locator('#subTitle').textContent(),/level|ball.*goal/i);
  assert.equal(await page.locator('#missionObjective').isVisible(),true);
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(70);
  assert.match(await page.locator('#subTitle').textContent(),/level|ball.*goal/i,'landscape still needs readable compact objective');
  await page.locator('#challengeAction').click();
  await page.locator('#freeSandbox').click();
  const restored=await page.evaluate(()=>window.StickLab.getWorld());
  assert.equal(restored.title,before.title);
  assert.equal(restored.groups.length,before.groups.length);
  assert.equal(restored.parts.length,before.parts.length);
  assert.equal(await page.locator('#missionObjective').isVisible(),false);
  assert.match(await page.locator('#subTitle').textContent(),/Free Sandbox/i);
  assert.deepEqual(errors,[]);
  await context.close();
 }finally{await browser.close();await new Promise(r=>srv.close(r))}
});

test('Game Types selector works in Android portrait and landscape and restores the original Sandbox',{skip:!process.env.STICKLAB_BROWSER_TEST},async()=>{
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL||'chrome',args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'domcontentloaded'});
  const world=await page.evaluate(()=>window.StickLab.getWorld());
  await page.locator('#challengeAction').click();
  assert.equal(await page.locator('#sidebar').evaluate(el=>el.classList.contains('open')),true);
  assert.equal(await page.locator('[data-game]').count(),5);
  assert.equal(await page.locator('#gameModeSection').isVisible(),true);
  await page.locator('[data-game="engineering"]').click();
  assert.equal(await page.evaluate(()=>window.StickLab.getState().gameMode),'engineering');
  assert.ok(await page.evaluate(()=>window.StickLab.getWorld().parts.some(p=>p.kind==='wheel')));
  assert.equal(await page.locator('#sidebar').evaluate(el=>el.classList.contains('open')),false);
  await page.setViewportSize({width:844,height:390});
  await page.locator('#challengeAction').click();
  await page.locator('[data-game="chaos"]').click();
  assert.equal(await page.evaluate(()=>window.StickLab.getState().gameMode),'chaos');
  assert.ok(await page.evaluate(()=>window.StickLab.getWorld().groups.length>=3));
  await page.locator('#challengeAction').click();
  await page.locator('[data-game="living"]').click();
  assert.ok(await page.evaluate(()=>window.StickLab.getResidents().length>=2));
  await page.locator('#challengeAction').click();
  await page.locator('[data-game="puzzles"]').click();
  assert.equal(await page.evaluate(()=>window.StickLab.getState().gameMode),'puzzles');
  assert.equal(await page.locator('#puzzlePicker').isVisible(),true,'open an obvious level chooser instead of relying on menu scroll');
  assert.equal(await page.evaluate(()=>window.StickLab.getState().challenge),null);
  await page.locator('[data-picker-level="0"]').click();
  assert.equal(await page.evaluate(()=>window.StickLab.getState().challenge.index),0);
  await page.locator('#challengeAction').click();
  await page.locator('[data-game="sandbox"]').click();
  const restored=await page.evaluate(()=>window.StickLab.getWorld());
  assert.equal(await page.evaluate(()=>window.StickLab.getState().gameMode),'sandbox');
  assert.equal(restored.parts.length,world.parts.length);
  assert.equal(restored.groups.length,world.groups.length);
  assert.deepEqual(errors,[]);
  await ctx.close();
 }finally{await browser.close();await new Promise(r=>srv.close(r))}
});

test('physics puzzle selection shows a usable level chooser even when sidebar is scrolled to the very bottom', {skip:!process.env.STICKLAB_BROWSER_TEST},async()=>{
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL||'chrome',args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('#challengeAction').click();
  await page.locator('.side-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight});
  const scrolled=await page.locator('.side-scroll').evaluate(el=>el.scrollTop);
  assert.ok(scrolled>400,'reproduce a menu opened down at World Management');
  // Clicking the mode is deliberate, even when it is above the current scroll position.
  await page.locator('[data-game="puzzles"]').click();
  assert.equal(await page.locator('#puzzlePicker').isVisible(),true,'level picker must be visible regardless of sidebar scroll');
  assert.match(await page.locator('#puzzlePicker').textContent(),/Choose.*level|Physics.*level/i);
  const first=page.locator('[data-picker-level="0"]');
  assert.equal(await first.isEnabled(),true);
  assert.equal(await page.locator('[data-picker-level="1"]').isDisabled(),true);
  const r=await first.boundingBox();
  assert.ok(r&&r.y>=0&&r.y+r.height<=800,'level 1 must be reachable without more scrolling: '+JSON.stringify(r));
  assert.equal(await page.evaluate(()=>window.StickLab.getState().challenge),null,'selection alone must not start a level');
  await first.click();
  assert.equal(await page.locator('#puzzlePicker').isVisible(),false);
  assert.equal(await page.evaluate(()=>window.StickLab.getState().challenge.index),0);
  assert.match(await page.locator('#missionObjective').textContent(),/blue.*green.*goal/i);
  assert.deepEqual(errors,[]);
  await ctx.close();
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
});

test('Android touch Go Here command walks a figure without dragging its individual joints',{skip:!process.env.STICKLAB_BROWSER_TEST},async()=>{
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL||'chrome',args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{window.StickLab.createWorld('empty');const hip=window.StickLab.spawnResident(760,850);window.StickLab.selectResident(hip.group)});
  await page.locator('#openMenu').click();
  assert.equal(await page.locator('#goHere').isEnabled(),true);
  await page.locator('#goHere').click();
  assert.equal(await page.evaluate(()=>window.StickLab.getState().tool),'goto');
  const target=await page.evaluate(()=>{
   const c=window.StickLab.getCamera(),r=document.querySelector('#canvas').getBoundingClientRect();
   return{x:r.left+r.width/2+(990-c.x)*c.z,y:r.top+r.height/2+(850-c.y)*c.z};
  });
  const hit=await page.evaluate(p=>{var n=document.elementFromPoint(p.x,p.y);return {node:n&&n.tagName,id:n&&n.id,klass:n&&n.className,x:p.x,y:p.y,tool:window.StickLab.getState().tool}},target);
  await page.touchscreen.tap(target.x,target.y);
  assert.equal(await page.evaluate(()=>window.StickLab.getState().selected),null,'Tap should issue destination command: '+JSON.stringify(hit));
  assert.equal(await page.evaluate(()=>window.StickLab.getResidents()[0].mode),'go');
  assert.ok(Math.abs((await page.evaluate(()=>window.StickLab.getResidents()[0].targetX))-990)<.5,'camera transform should resolve a screen tap to the requested point');
  const delta=await page.evaluate(()=>{
   const w=window.StickLab.getWorld(),hip=w.parts.find(p=>p.id===w.groups[0].hip),before=hip.x;
   for(let n=0;n<130;n++)window.StickLab.step();
   return window.StickLab.getWorld().parts.find(p=>p.id===w.groups[0].hip).x-before;
  });
  assert.ok(delta>4,'Go Here must propel the simulated ragdoll using physics, measured '+delta);
  assert.deepEqual(errors,[]);
  await ctx.close();
 }finally{await browser.close();await new Promise(r=>srv.close(r))}
});

test('phone screenshot scenario: Walk is visible despite paused Physics Puzzles and unselected resident',{skip:!process.env.STICKLAB_BROWSER_TEST},async()=>{
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL||'chrome',args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.locator('#pause').click();
  await page.locator('#challengeAction').click();
  await page.locator('[data-game="puzzles"]').click();
  await page.locator('#closePuzzlePicker').click();
  assert.equal(await page.evaluate(()=>window.StickLab.getState().challenge),null);
  await page.evaluate(()=>window.StickLab.setAIEnabled(false));
  const button=page.locator('.mobiletools [data-tool="goto"]');
  assert.equal(await button.isVisible(),true,'Walk must be available directly in the mobile toolbar');
  await page.locator('#openMenu').click();
  await page.locator('.side-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);
  await page.locator('.side-scroll [data-tool="goto"]').click();
  assert.equal(await page.locator('#sidebar').evaluate(el=>el.classList.contains('open')),false,'Walk should dismiss the scrolled menu');
  await page.locator('.mobiletools [data-tool="grab"]').click();
  await button.click();
  assert.equal(await page.evaluate(()=>window.StickLab.getState().tool),'goto');
  assert.ok(await page.evaluate(()=>window.StickLab.getState().selected!==null),'automatically choose an existing resident');
  assert.match(await page.locator('#controlHint').textContent(),/tap.*walk/i);
  const target=await page.evaluate(()=>{
   const c=window.StickLab.getCamera(),r=document.querySelector('#canvas').getBoundingClientRect();
   return {x:r.left+r.width/2+(1040-c.x)*c.z,y:r.top+r.height/2+(845-c.y)*c.z};
  });
  await page.touchscreen.tap(target.x,target.y);
  assert.equal(await page.evaluate(()=>window.StickLab.getState().selected),null);
  assert.equal(await page.evaluate(()=>window.StickLab.getState().paused),false,'Walk must resume paused game');
  assert.equal(await page.evaluate(()=>window.StickLab.getState().aiEnabled),true,'Walk must enable locomotion');
  assert.equal(await page.evaluate(()=>window.StickLab.getResidents()[0].mode),'go');
  assert.deepEqual(errors,[]);
  await ctx.close();
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
});

test('Physics figures appear in Engineering and Playground, with visible Unhook on phones', {skip:!process.env.STICKLAB_BROWSER_TEST},async()=>{
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL||'chrome',args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'domcontentloaded'});
  const playground=await page.evaluate(()=>window.StickLab.getWorld());
  assert.ok(playground.groups.length>=2);
  assert.equal(playground.links.filter(l=>['rope','spring','hinge'].includes(l.type)&&playground.groups.some(g=>g.nodes.includes(l.a)||g.nodes.includes(l.b))).length,0);
  assert.equal(await page.locator('.mobiletools [data-tool="figure"]').isVisible(),true);
  assert.equal(await page.locator('#unhookMobile').isVisible(),true);
  await page.locator('#challengeAction').click();await page.locator('[data-game="engineering"]').click();
  const engineering=await page.evaluate(()=>window.StickLab.getWorld());
  assert.ok(engineering.groups.some(g=>g.ai),'Engineering must have a walker');
  assert.ok(engineering.groups.some(g=>!g.ai),'Engineering must include a free ragdoll');
  await page.locator('.mobiletools [data-tool="goto"]').click();
  const target=await page.evaluate(()=>{
    const c=window.StickLab.getCamera(),r=document.querySelector('#canvas').getBoundingClientRect();
    return{x:r.left+r.width/2+(950-c.x)*c.z,y:r.top+r.height/2+(800-c.y)*c.z};
  });
  await page.touchscreen.tap(target.x,target.y);
  assert.ok(await page.evaluate(()=>window.StickLab.getResidents().some(g=>g.mode==='go')),'a prebuilt figure can receive a physics Walk goal');
  assert.deepEqual(errors,[]);
  await ctx.close();
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
});
