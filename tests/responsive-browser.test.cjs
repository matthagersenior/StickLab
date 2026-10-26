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
