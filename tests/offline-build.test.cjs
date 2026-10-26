'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('each browser runtime script parses and remains dependency-free',()=>{
 const vm=require('node:vm');
 for(const p of ['src/core.js','src/levels.js','src/machines.js','src/inhabitants.js','src/game.js'])assert.doesNotThrow(()=>new vm.Script(read(p)),p);
});
test('Pages file bundles the same source and includes PWA metadata',()=>{
 const html=read('index.html');
 for(const p of ['src/core.js','src/levels.js','src/machines.js','src/inhabitants.js','src/game.js'])assert.ok(html.includes('<script>'+read(p)+'</script>'),'missing '+p);
 assert.ok(html.includes('<style>'+read('src/style.css')+'</style>'));
 assert.match(html,/rel="manifest"/);assert.match(html,/serviceWorker\.register/);
 assert.equal((html.match(/<canvas\b/g)||[]).length,1);
 assert.doesNotMatch(html,/<script[^>]+src=/);
});
test('portable file does not require external resources',()=>{
 const html=read('StickLab-Offline.html');
 assert.match(html,/window\.StickLab=/);
 assert.doesNotMatch(html,/<script[^>]+src=/);
 assert.doesNotMatch(html,/<link[^>]+rel="stylesheet"/);
 assert.doesNotMatch(html,/rel="manifest"/);
 assert.doesNotMatch(html,/serviceWorker\.register/);
});
test('two distributions reproduce exactly from source',()=>{
 const source=read('src/index.html'),css=read('src/style.css'),core=read('src/core.js'),levels=read('src/levels.js'),machines=read('src/machines.js'),inhabitants=read('src/inhabitants.js'),game=read('src/game.js');
 const hosted=source.replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>')
 .replace('<script src="./core.js"></script>','<script>'+core+'</script>')
 .replace('<script src="./levels.js"></script>','<script>'+levels+'</script>')
 .replace('<script src="./machines.js"></script>','<script>'+machines+'</script>')
 .replace('<script src="./inhabitants.js"></script>','<script>'+inhabitants+'</script>')
 .replace('<script src="./game.js"></script>','<script>'+game+'</script>');
 assert.equal(read('index.html'),hosted);
 const stripped=hosted.replace('<link rel="manifest" href="./manifest.webmanifest"><link rel="icon" type="image/svg+xml" href="./icon.svg">','')
 .replace("<script>if((location.protocol==='https:'||location.hostname==='localhost')&&'serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(function(){})}</script>",'');
 assert.equal(read('StickLab-Offline.html'),stripped);
});

test('installable game fetches fresh navigation first and keeps an offline fallback',()=>{
 const worker=read('sw.js');
 assert.match(worker,/CACHE='sticklab-v04-optional-levels-20261026'/,'fix release must invalidate the old app cache');
 assert.match(worker,/e\.request\.mode==='navigate'/,'navigation must use a distinct online-first policy');
 assert.match(worker,/fetch\(e\.request\)/,'navigation should request updated hosted HTML');
 assert.match(worker,/caches\.match\(e\.request\)/,'the game must still open while offline');
});
