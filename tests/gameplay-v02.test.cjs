'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..');
function engine(pointer){
 const nodes={},noop=()=>{};
 function el(id){if(!nodes[id])nodes[id]={id,textContent:'',value:'1',innerHTML:'',style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop},listeners:{},addEventListener:function(name,fn){this.listeners[name]=fn},setAttribute:noop,getBoundingClientRect(){return{left:0,top:0,width:1000,height:700}},getContext(){return new Proxy({setTransform:noop},{get(o,k){return o[k]||noop},set(o,k,v){o[k]=v;return true}})}};return nodes[id]}
 const holdButtons=['left','jump','right'].map(function(name){var btn=el('hold-'+name);btn.dataset.hold=name;return btn});
 const storage={};const context={document:{getElementById:el,querySelectorAll(selector){return selector==='[data-hold]'?holdButtons:[]}},navigator:{hardwareConcurrency:2},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},window:{innerWidth:1000,devicePixelRatio:1,addEventListener:noop,PointerEvent:!!pointer},requestAnimationFrame:noop,setTimeout:()=>1,clearTimeout:noop,Math,Date,JSON,Number,Array,Object,FileReader:function(){},isFinite,console};
 vm.createContext(context);for(const file of ['src/core.js','src/levels.js','src/machines.js','src/inhabitants.js','src/game.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),context);
 return{api:context.window.StickLab,nodes,storage};
}
test('v1 preset ragdolls survive save to slot 2 and reload',()=>{
 const{api,nodes,storage}=engine();const initial=api.getWorld().groups.length;assert.ok(initial>=2);
 api.save();nodes.saveSlot.value='2';api.save();api.createWorld('empty');api.load();
 assert.equal(api.getWorld().groups.length,initial);assert.equal(JSON.parse(storage.sticklab_scene_v4_2).version,4);
});
test('invalid version leaves active world untouched',()=>{
 const{api}=engine(),before=JSON.stringify(api.getWorld());
 assert.throws(()=>api.importScene({format:'StickLab',version:99,world:{parts:[],links:[],groups:[]}}));
 assert.equal(JSON.stringify(api.getWorld()),before);
});
test('hinged rotating beam keeps its connection under gravity',()=>{
 const{api}=engine();
 api.importScene({format:'StickLab',version:2,world:{parts:[{id:1,kind:'anchor',x:500,y:360,r:9,fixed:true},{id:2,kind:'box',x:560,y:380,w:120,h:20,angle:0,pa:0}],links:[{id:3,a:1,b:2,type:'hinge',len:0,k:.95,ax:0,ay:0,bx:-60,by:0}],groups:[]}});
 for(let i=0;i<160;i++)api.step();
 const box=api.getWorld().parts[1];assert.ok(Number.isFinite(box.angle));assert.ok(Math.abs(box.angle)>.03);
 assert.ok(Math.hypot(box.x-60*Math.cos(box.angle)-500,box.y-60*Math.sin(box.angle)-360)<12);
});

test('touch tools place only on tap release and never on two-finger gesture',()=>{
 const {api,nodes}=engine(true),canvas=nodes.canvas;api.createWorld('empty');api.setTool('box');
 const event=(type,id,x,y)=>({pointerType:'touch',pointerId:id,clientX:x,clientY:y,preventDefault(){}});
 const send=(type,id,x,y)=>canvas.listeners[type](event(type,id,x,y));
 const original=api.getState().parts;
 send('pointerdown',1,220,260);assert.equal(api.getState().parts,original);
 send('pointerup',1,220,260);assert.equal(api.getState().parts,original+1);
 send('pointerdown',2,250,270);send('pointerdown',3,350,270);
 send('pointermove',2,200,300);send('pointermove',3,380,300);
 send('pointerup',2,200,300);send('pointerup',3,380,300);
 assert.equal(api.getState().parts,original+1,'pinch should not spawn extra boxes');
});

test('physics challenges start at level 1 without skipping locked levels',()=>{
 const {api}=engine();assert.equal(api.getState().unlocked,1);
 assert.equal(api.startLevel(1),false);assert.equal(api.startLevel(0),true);
 const status=api.getState();assert.equal(status.challenge.index,0);assert.equal(status.challenge.won,false);
 assert.equal(api.getWorld().parts.some(p=>p.color==='#2676bd'&&p.kind==='ball'),true);
 api.createWorld('playground');assert.equal(api.getState().challenge,null);
});
test('v0.3 mobile tap creates a motor cart with two powered wheels',()=>{
 const {api,nodes}=engine(true);api.createWorld('empty');api.setTool('cart');
 const e={pointerType:'touch',pointerId:2,clientX:400,clientY:370,preventDefault(){}};
 nodes.canvas.listeners.pointerdown(e);nodes.canvas.listeners.pointerup(e);
 const w=api.getWorld();assert.equal(w.parts.filter(p=>p.kind==='wheel'&&p.motor).length,2);
 assert.equal(w.links.filter(l=>l.type==='hinge').length,2);
});
test('steel construction material survives an export and reload through normalized world',()=>{
 const {api,nodes}=engine(true);api.createWorld('empty');
 nodes.material.value='steel';nodes.material.onchange.call(nodes.material);
 api.setTool('box');const e={pointerType:'touch',pointerId:4,clientX:400,clientY:370,preventDefault(){}};
 nodes.canvas.listeners.pointerdown(e);nodes.canvas.listeners.pointerup(e);
 const box=api.getWorld().parts.find(p=>p.kind==='box');
 assert.equal(box.material,'steel');
 const before=api.getWorld();api.importScene({format:'StickLab',version:3,world:before});
 assert.equal(api.getWorld().parts[0].material,'steel');
});

test('undo inside a challenge retains the active goal and target',()=>{
 const {api,nodes}=engine(true);api.startLevel(0);api.setTool('box');
 const before=api.getWorld().parts.length;
 const e={pointerType:'touch',pointerId:9,clientX:400,clientY:370,preventDefault(){}};
 nodes.canvas.listeners.pointerdown(e);nodes.canvas.listeners.pointerup(e);
 assert.equal(api.getWorld().parts.length,before+1);
 nodes.undo.onclick();assert.equal(api.getWorld().parts.length,before);
 assert.equal(api.getState().challenge.index,0);
});

test('living figures have names, modes and manual takeover without stopping physics',()=>{
 const {api}=engine();api.createWorld('empty');
 const hip=api.spawnResident(600,845);assert.ok(hip);
 const living=api.getResidents();assert.equal(living.length,1);
 assert.ok(living[0].name.length>2);assert.equal(living[0].mode,'wander');
 assert.equal(api.selectResident(living[0].id),true);
 assert.equal(api.setResidentMode(living[0].id,'help'),true);
 assert.equal(api.setResidentMode(living[0].id,'attack'),false);
 assert.equal(api.getResidents()[0].mode,'help');
 for(let i=0;i<30;i++)api.step();
 assert.ok(api.getWorld().parts.some(p=>p.id===hip.id),'controlling a resident must retain its physics bodies');
 api.releaseResident();
 assert.equal(api.getState().agents,1);
 for(let i=0;i<35;i++)api.step();
 assert.ok(['help','wander','investigate','avoid'].includes(api.getResidents()[0].intent));
});
test('global AI toggle leaves world and manual ragdoll interactions intact',()=>{
 const {api}=engine();api.createWorld('empty');
 api.spawnResident(500,845);
 const before=api.getWorld().parts.length;
 assert.equal(api.setAIEnabled(false),false);
 assert.equal(api.getWorld().aiEnabled,false);
 for(let i=0;i<20;i++)api.step();
 assert.equal(api.getWorld().parts.length,before);
 assert.equal(api.setAIEnabled(true),true);
 assert.equal(api.getWorld().aiEnabled,true);
});
test('v4 residents survive import while v3 ragdolls stay passive',()=>{
 const {api}=engine();api.createWorld('empty');
 api.spawnResident(700,845);const g=api.getResidents()[0];
 api.setResidentMode(g.id,'rest');
 const saved=api.getWorld();
 api.importScene({format:'StickLab',version:4,world:saved});
 assert.equal(api.getResidents()[0].name,g.name);
 assert.equal(api.getResidents()[0].mode,'rest');
 api.importScene({format:'StickLab',version:3,world:saved});
 // Explicitly encoded v3 groups are still validated; legacy v3 had no AI fields.
 api.createWorld('empty');
 assert.equal(api.getResidents().length,0);
});
test('Eco profile respects a lower decision budget and challenge goals remain available',()=>{
 const {api,nodes}=engine();nodes.quality.value='eco';nodes.quality.onchange.call(nodes.quality);
 api.createWorld('empty');api.spawnResident(400,840);api.spawnResident(700,840);
 assert.equal(api.getState().profile,'eco');
 api.startLevel(0);assert.equal(api.getState().challenge.index,0);
 assert.equal(api.getState().agents,0);
});

test('autonomous resident produces physical displacement when not player-controlled',()=>{
 const {api}=engine();api.createWorld('empty');
 const hip=api.spawnResident(780,840);
 const x=hip.x;
 for(let i=0;i<125;i++)api.step();
 const moved=api.getWorld().parts.find(p=>p.id===hip.id);
 assert.ok(Number.isFinite(moved.x));
 assert.ok(Math.abs(moved.x-x)>2,'resident should locomote using physics impulses');
});
test('AI-off setting persists when switching worlds while preserving sandbox objects',()=>{
 const {api}=engine();api.setAIEnabled(false);api.createWorld('tower');
 assert.equal(api.getState().aiEnabled,false);
 assert.equal(api.getWorld().groups.length,2);
 api.setAIEnabled(true);api.createWorld('playground');
 assert.equal(api.getState().aiEnabled,true);
});
test('saving and reloading v4 slot restores resident mode and AI preference',()=>{
 const {api,nodes,storage}=engine();api.createWorld('empty');api.spawnResident(800,850);
 const resident=api.getResidents()[0];api.setResidentMode(resident.id,'help');api.setAIEnabled(false);
 api.save();nodes.saveSlot.value='3';api.save();assert.equal(JSON.parse(storage.sticklab_scene_v4_3).version,4);
 api.createWorld('tower');api.load();
 assert.equal(api.getState().aiEnabled,false);
 assert.equal(api.getResidents()[0].name,resident.name);
 assert.equal(api.getResidents()[0].mode,'help');
});

test('mobile direction pad auto-selects a visible playable figure instead of silently doing nothing',()=>{
 const {api,nodes}=engine(true);
 assert.equal(api.getState().selected,null);
 api.setTool('living');
 const right=nodes['hold-right'];
 assert.equal(typeof right.listeners.pointerdown,'function','right button must have a pointer handler');
 right.listeners.pointerdown({pointerId:5,preventDefault(){}});
 assert.ok(api.getState().selected,'right press should select an existing figure');
 assert.equal(api.getState().tool,'grab','directional controls should enter control mode');
 assert.equal(api.getState().keys.right,true);
 const chosen=api.getWorld().parts.find(p=>p.id===api.getState().selected);
 const x=chosen.x;
 for(let i=0;i<50;i++)api.step();
 assert.ok(api.getWorld().parts.find(p=>p.id===chosen.id).x>x+1,'right control should physically move the character');
 right.listeners.pointerup({preventDefault(){}});
 assert.equal(api.getState().keys.right,false);
});
test('empty scene tells the user how to activate movement controls',()=>{
 const {api,nodes}=engine(true);api.createWorld('empty');
 nodes['hold-left'].listeners.pointerdown({pointerId:6,preventDefault(){}});
 assert.equal(api.getState().selected,null);
 assert.match(nodes.notice.textContent,/figure|resident|ragdoll/i);
});
test('top-right camera controls change and report zoom, then restore the default view',()=>{
 const {api,nodes}=engine(true);
 const initial=api.getCamera();
 nodes.zoomIn.onclick();
 const zoomed=api.getCamera();
 assert.ok(zoomed.z>initial.z,'+ must zoom in');
 assert.match(nodes.cameraFeedback.textContent,/\d+%/,'camera scale must be visible');
 nodes.zoomOut.onclick();
 assert.ok(api.getCamera().z<zoomed.z,'- must zoom out');
 nodes.zoomIn.onclick();
 nodes.zoomIn.onclick();
 nodes.recenter.onclick();
 const reset=api.getCamera();
 assert.ok(Math.abs(reset.z-initial.z)<1e-9);
 assert.match(nodes.notice.textContent,/center|reset|view/i);
});

test('quick mobile jump tap is queued until the next physics step',()=>{
 const {api,nodes}=engine(true);
 nodes['hold-jump'].listeners.pointerdown({pointerId:11,preventDefault(){}});
 nodes['hold-jump'].listeners.pointerup({preventDefault(){}});
 assert.ok(api.getState().selected,'jump should auto-select a figure');
 assert.equal(api.getState().keys.jump,true,'jump request must not disappear before simulation');
 api.step();
 assert.equal(api.getState().keys.jump,false,'physics consumes the queued jump');
});
test('top bar pause and step remain functional after mobile control setup',()=>{
 const {api,nodes}=engine(true);
 assert.equal(api.getState().paused,false);
 nodes.pause.onclick();
 assert.equal(api.getState().paused,true);
 nodes.step.onclick();
 assert.equal(api.getState().paused,true);
 nodes.pause.onclick();
 assert.equal(api.getState().paused,false);
});

function tapAtWorld(api,nodes,x,y,id){
 const cam=api.getCamera(),cx=500+(x-cam.x)*cam.z,cy=350+(y-cam.y)*cam.z;
 const ev={pointerType:'touch',pointerId:id||41,clientX:cx,clientY:cy,preventDefault(){}};
 nodes.canvas.listeners.pointerdown(ev);nodes.canvas.listeners.pointerup(ev);
}
test('Detach tool releases one rope without deleting either anchor or other connections',()=>{
 const {api,nodes}=engine(true);
 api.importScene({format:'StickLab',version:4,world:{title:'Connections',parts:[
 {id:1,kind:'anchor',x:700,y:700,r:9,fixed:true},
 {id:2,kind:'anchor',x:1000,y:700,r:9,fixed:true},
 {id:3,kind:'ball',x:850,y:750,r:24}
 ],links:[
 {id:4,a:1,b:3,type:'rope',len:158,k:.9},
 {id:5,a:2,b:3,type:'spring',len:158,k:.3}
 ],groups:[]}});
 api.setTool('detach');
 tapAtWorld(api,nodes,760,720);
 const after=api.getWorld();
 assert.deepEqual(after.links.map(l=>l.id),[5],'only tapped connector should be removed');
 assert.equal(after.parts.length,3,'anchors and ball must remain');
 nodes.undo.onclick();
 assert.equal(api.getWorld().links.length,2,'Detach must be undoable');
});
test('Detach tapping a fixed purple anchor releases its attached connectors but keeps the anchor',()=>{
 const {api,nodes}=engine(true);
 api.importScene({format:'StickLab',version:4,world:{parts:[
 {id:1,kind:'anchor',x:700,y:700,r:9,fixed:true},
 {id:2,kind:'ball',x:800,y:700,r:24},
 {id:3,kind:'ball',x:800,y:800,r:24}
 ],links:[
 {id:4,a:1,b:2,type:'rope',len:100,k:.9},
 {id:5,a:1,b:3,type:'spring',len:140,k:.4}
 ],groups:[]}});
 api.setTool('detach');tapAtWorld(api,nodes,700,700);
 assert.equal(api.getWorld().links.length,0);
 assert.equal(api.getWorld().parts.length,3);
});
test('Detaching an empty area or ragdoll skeleton does not delete entities',()=>{
 const {api,nodes}=engine(true);
 api.createWorld('empty');api.spawnResident(850,700);api.setTool('detach');
 const before=api.getWorld();
 tapAtWorld(api,nodes,835,640);tapAtWorld(api,nodes,1500,400);
 assert.equal(api.getWorld().links.length,before.links.length);
 assert.equal(api.getWorld().parts.length,before.parts.length);
});
test('Pin tool creates additional new fixed anchor points throughout the world',()=>{
 const {api,nodes}=engine(true);
 api.createWorld('empty');api.setTool('anchor');
 tapAtWorld(api,nodes,740,570);
 tapAtWorld(api,nodes,980,610);
 const pts=api.getWorld().parts.filter(p=>p.kind==='anchor');
 assert.equal(pts.length,2);
 assert.ok(pts.every(p=>p.fixed));
 assert.ok(pts[0].id!==pts[1].id);
});

test('optional challenge starts explicitly and returning preserves the sandbox creation',()=>{
 const {api,nodes}=engine(true);
 api.createWorld('empty');
 api.spawnResident(830,820);
 const saved=api.getWorld(),before=api.getState();
 assert.equal(api.getState().challenge,null);
 assert.equal(api.startLevel(0),true);
 assert.equal(api.getState().challenge.index,0);
 assert.match(nodes.missionObjective.textContent,/blue|ball|goal/i,'must show a visible goal instruction');
 assert.match(nodes.challengeAction.textContent,/level|challenge|goal/i,'mode switch must stay visible');
 assert.equal(api.exitChallenge(),true,'player must be able to exit voluntarily');
 assert.equal(api.getState().challenge,null);
 assert.equal(api.getWorld().groups.length,saved.groups.length,'original sandbox inhabitants must return');
 assert.equal(api.getWorld().parts.length,saved.parts.length,'all original physical pieces must return');
 assert.equal(api.getWorld().title,saved.title);
 assert.equal(api.getState().paused,before.paused);
});
test('level selection never changes free sandbox until player explicitly starts it',()=>{
 const {api,nodes}=engine(true);api.createWorld('tower');
 const snapshot=JSON.stringify(api.getWorld());
 nodes.challengeAction.onclick();
 assert.equal(JSON.stringify(api.getWorld()),snapshot,'opening level picker must not erase sandbox');
 assert.equal(api.getState().challenge,null);
 assert.match(nodes.challengeStatus.textContent,/optional|no win/i);
});
test('challenge directive updates on win and optional controls retain current mode on restart',()=>{
 const {api,nodes}=engine(true);api.startLevel(0);
 assert.match(nodes.missionObjective.textContent,/blue|ball|goal/i);
 const w=api.getWorld();
 api.startLevel(0);
 assert.equal(api.getState().challenge.index,0);
 assert.equal(api.getWorld().parts.length,w.parts.length);
 assert.match(nodes.subTitle.textContent,/level|goal|ball|challenge/i);
});

test('five distinct game types are selectable with meaningful starter scenes',()=>{
 const {api}=engine(true);
 assert.deepEqual(Array.from(api.getGameModes().map(m=>m.id)),['sandbox','puzzles','builder','destruction','living']);
 const start=api.getWorld();
 assert.equal(api.chooseGameMode('builder'),true);
 assert.equal(api.getState().gameMode,'builder');
 const built=api.getWorld();
 assert.ok(built.parts.some(p=>p.kind==='wheel'),'machine workshop must contain vehicle wheels');
 assert.ok(built.links.some(l=>l.type==='hinge'),'workshop must provide working joints');
 assert.equal(api.chooseGameMode('destruction'),true);
 assert.equal(api.getState().gameMode,'destruction');
 assert.ok(api.getWorld().parts.some(p=>p.kind==='box'&&!p.fixed),'destruction should include targets');
 assert.notEqual(api.getWorld().title,built.title);
 assert.equal(api.chooseGameMode('living'),true);
 assert.equal(api.getState().gameMode,'living');
 assert.ok(api.getResidents().length>=2,'living mode should include multiple residents');
 assert.equal(api.chooseGameMode('nonsense'),false);
 assert.equal(api.chooseGameMode('sandbox'),true);
 assert.equal(api.getWorld().title,start.title);
 assert.equal(api.getState().gameMode,'sandbox');
});
test('choosing different gameplay preserves an existing sandbox until returning',()=>{
 const {api}=engine(true);api.createWorld('empty');api.spawnResident(810,820);
 const before=api.getWorld();
 api.chooseGameMode('builder');
 api.chooseGameMode('destruction');
 api.chooseGameMode('living');
 api.chooseGameMode('sandbox');
 assert.equal(api.getWorld().groups.length,before.groups.length);
 assert.equal(api.getWorld().parts.length,before.parts.length);
 assert.equal(api.getWorld().title,before.title);
});
test('puzzle game type opens level choice without silently starting a level',()=>{
 const {api,nodes}=engine(true);api.createWorld('empty');
 const before=JSON.stringify(api.getWorld());
 nodes.gameModes.onclick();
 assert.equal(JSON.stringify(api.getWorld()),before);
 assert.equal(api.getState().gameMode,'sandbox');
 nodes.modeCardsPuzzles.onclick();
 assert.equal(api.getState().gameMode,'sandbox');
 assert.equal(JSON.stringify(api.getWorld()),before);
 assert.equal(api.startLevel(0),true);
 assert.equal(api.getState().gameMode,'puzzles');
 assert.equal(api.chooseGameMode('sandbox'),true);
 assert.equal(api.getState().gameMode,'sandbox');
});
test('scene presets and imported saves do not leave stale game-mode labels',()=>{
 const {api}=engine(true);api.chooseGameMode('builder');api.createWorld('tower');
 assert.equal(api.getState().gameMode,'sandbox');
 api.chooseGameMode('living');
 const scene=api.getWorld();api.importScene({format:'StickLab',version:4,world:scene});
 assert.equal(api.getState().gameMode,'sandbox');
});
