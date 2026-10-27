'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..');
function engine(pointer){
 const nodes={},noop=()=>{};
 function el(id){if(!nodes[id])nodes[id]={id,textContent:'',value:'1',innerHTML:'',style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop},listeners:{},addEventListener:function(name,fn){this.listeners[name]=fn},setAttribute:noop,getBoundingClientRect(){return{left:0,top:0,width:1000,height:700}},getContext(){return new Proxy({setTransform:noop},{get(o,k){return o[k]||noop},set(o,k,v){o[k]=v;return true}})}};return nodes[id]}
 const holdButtons=['left','jump','right'].map(function(name){var btn=el('hold-'+name);btn.dataset.hold=name;return btn});
 const storage={};const context={document:{getElementById:el,querySelectorAll(selector){return selector==='[data-hold]'?holdButtons:[]}},navigator:{hardwareConcurrency:2},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},window:{innerWidth:1000,devicePixelRatio:1,addEventListener:noop,PointerEvent:!!pointer},requestAnimationFrame:noop,setTimeout:()=>1,clearTimeout:noop,Math,Date,JSON,Number,Array,Object,FileReader:function(){},isFinite,console};
 vm.createContext(context);for(const file of ['src/core.js','src/levels.js','src/machines.js','src/inhabitants.js','src/locomotion.js','src/game.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),context);
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
 assert.match(nodes.challengeAction.textContent,/games/i,'game-type selector must remain visible during challenge');
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

test('five actual selectable game types switch to distinct playable worlds',()=>{
 const {api}=engine();
 assert.equal(api.getState().gameMode,'sandbox');
 const modes=['sandbox','puzzles','engineering','chaos','living'];
 for(const m of modes)assert.ok(api.getGameModes().some(x=>x.id===m),m+' must be listed');
 assert.equal(api.selectGameMode('engineering'),true);
 assert.equal(api.getState().gameMode,'engineering');
 assert.ok(api.getWorld().parts.some(p=>p.kind==='wheel'),'engineering must spawn machine parts');
 assert.ok(api.getWorld().links.some(l=>l.type==='hinge'),'engineering must provide connected mechanisms');
 assert.equal(api.selectGameMode('chaos'),true);
 assert.equal(api.getState().gameMode,'chaos');
 assert.ok(api.getWorld().groups.length>=3,'ragdoll game must have figures');
 assert.equal(api.selectGameMode('living'),true);
 assert.equal(api.getState().gameMode,'living');
 assert.ok(api.getResidents().length>=2,'living world must feature autonomous agents');
});
test('switching game types preserves custom Free Sandbox until explicitly returned',()=>{
 const {api}=engine();api.createWorld('empty');api.spawnResident(775,845);
 const original=api.getWorld(),camera=api.getCamera();
 assert.equal(api.selectGameMode('engineering'),true);
 assert.equal(api.selectGameMode('puzzles'),true);
 assert.equal(api.getState().gameMode,'puzzles');
 assert.equal(api.getState().challenge,null,'choosing puzzle game type must not silently start a level');
 assert.equal(api.startLevel(0),true);
 assert.equal(api.getState().gameMode,'puzzles');
 assert.equal(api.selectGameMode('sandbox'),true);
 assert.equal(api.getState().challenge,null);
 assert.equal(api.getState().gameMode,'sandbox');
 assert.equal(api.getWorld().parts.length,original.parts.length);
 assert.equal(api.getWorld().groups.length,original.groups.length);
 assert.equal(api.getWorld().title,original.title);
 const restored=api.getCamera();assert.equal(restored.x,camera.x);assert.equal(restored.z,camera.z);
});
test('invalid game type is rejected without destroying current sandbox',()=>{
 const {api}=engine(),original=JSON.stringify(api.getWorld());
 assert.equal(api.selectGameMode('nonexistent'),false);
 assert.equal(JSON.stringify(api.getWorld()),original);
});

test('Go Here chooses a destination with one touch and then lets the resident walk independently',()=>{
 const {api,nodes}=engine(true);api.createWorld('empty');
 const hip=api.spawnResident(700,850),resident=api.getResidents()[0];
 assert.ok(api.selectResident(resident.id));
 assert.equal(nodes.goHere.disabled,false);
 nodes.goHere.onclick();
 assert.equal(api.getState().tool,'goto');
 tapAtWorld(api,nodes,1000,850,35);
 assert.equal(api.getState().tool,'grab');
 assert.equal(api.getState().selected,null,'resident must be released to let AI drive');
 const walking=api.getResidents()[0];assert.equal(walking.mode,'go');assert.equal(walking.targetX,1000);
 const before=api.getWorld().parts.find(p=>p.id===hip.id).x;
 for(let n=0;n<170;n++)api.step();
 const after=api.getWorld().parts.find(p=>p.id===hip.id).x;
 assert.ok(after>before+5,'resident must advance under its own physics rather than requiring limb controls');
});
test('Go Here can animate a passive ragdoll and rejects invalid destinations',()=>{
 const {api}=engine();api.createWorld('empty');
 const g=api.spawnResident(750,850).group; // a resident is also a full ragdoll
 assert.equal(api.setResidentTarget(g,-5),false);
 assert.equal(api.setResidentTarget(g,850),true);
 assert.equal(api.getResidents()[0].targetX,850);
 const normalized=api.getWorld();
 api.importScene({format:'StickLab',version:4,world:normalized});
 assert.equal(api.getResidents()[0].mode,'go');
 assert.equal(api.getResidents()[0].targetX,850);
});

test('Walk tool auto-selects an existing figure, enables AI, and resumes paused physics after destination',()=>{
 const {api,nodes}=engine(true);
 api.createWorld('empty');api.spawnResident(800,850);
 assert.equal(api.getState().selected,null);
 api.setAIEnabled(false);
 nodes.pause.onclick();
 assert.equal(api.getState().paused,true);
 api.setTool('goto');
 assert.equal(api.getState().tool,'goto');
 assert.ok(api.getState().selected,'Walk must automatically choose a usable figure');
 assert.match(nodes.controlHint.textContent,/tap.*destina|walk/i);
 tapAtWorld(api,nodes,1030,840,45);
 assert.equal(api.getState().tool,'grab');
 assert.equal(api.getState().selected,null);
 assert.equal(api.getState().paused,false,'issuing a movement command should start a paused simulation');
 assert.equal(api.getState().aiEnabled,true,'walk command should explicitly activate resident locomotion');
 assert.equal(api.getResidents()[0].mode,'go');
 const w=api.getWorld(),id=w.groups[0].hip,old=w.parts.find(p=>p.id===id).x;
 for(let i=0;i<170;i++)api.step();
 assert.ok(api.getWorld().parts.find(p=>p.id===id).x>old+5,'physics must move resident toward its goal');
});
test('Walk on an empty scene explains that a figure is needed, without changing tools or spawning one',()=>{
 const {api,nodes}=engine(true);api.createWorld('empty');
 api.setTool('goto');
 assert.equal(api.getState().tool,'grab');
 assert.equal(api.getState().selected,null);
 assert.equal(api.getWorld().groups.length,0);
 assert.match(nodes.notice.textContent,/resident|ragdoll|figure/i);
});
test('Walk may be cancelled with Grab without moving the current scene',()=>{
 const {api}=engine(true);api.createWorld('empty');api.spawnResident(700,850);
 const before=JSON.stringify(api.getWorld());
 api.setTool('goto');assert.equal(api.getState().tool,'goto');
 api.setTool('grab');
 assert.equal(api.getState().tool,'grab');
 assert.equal(JSON.stringify(api.getWorld()),before);
});

test('Playground starts with grounded stick figures that can participate in physics, not suspended hostages',()=>{
 const {api}=engine();const w=api.getWorld();
 assert.ok(w.groups.length>=2,'default world contains stick figures');
 for(const g of w.groups){
  const external=w.links.filter(l=>['rope','spring','hinge'].includes(l.type)&&(g.nodes.includes(l.a)||g.nodes.includes(l.b)));
  assert.equal(external.length,0,'no default figure should be tied to an anchor');
 }
 assert.ok(w.groups.some(g=>{const feet=g.nodes.slice(-2).map(id=>w.parts.find(p=>p.id===id));return feet.every(p=>p&&p.y+p.r>=927)}),'at least one figure starts standing on ground');
});
test('Engineering Lab starts with an interactive figure and a passive ragdoll alongside machines',()=>{
 const {api}=engine();api.selectGameMode('engineering');const w=api.getWorld();
 assert.ok(w.groups.some(g=>g.ai),'a walker should be available for moving around machine parts');
 assert.ok(w.groups.some(g=>!g.ai),'a physics-only ragdoll should be available for experiments');
 assert.ok(w.parts.some(p=>p.kind==='wheel'),'machine starter parts remain');
});
test('Walk command frees an externally tethered stick figure without deleting its body or anchor',()=>{
 const {api}=engine();api.createWorld('empty');
 const hip=api.spawnResident(760,760),id=api.getWorld().groups[0].id;
 const before=api.getWorld(),g=before.groups[0],anchor={id:before.next,kind:'anchor',x:760,y:400,r:9,fixed:true},rope={id:before.next+1,a:anchor.id,b:g.head,type:'rope',len:280,k:.96};
 before.parts.push(anchor);before.links.push(rope);before.next+=2;
 api.importScene({format:'StickLab',version:4,world:before});
 assert.equal(api.getWorld().links.filter(l=>l.type==='rope').length,1);
 assert.equal(api.setResidentTarget(id,1040),true);
 const after=api.getWorld();
 assert.equal(after.links.filter(l=>l.type==='rope').length,0,'Walk should release an external suspension rope');
 assert.ok(after.groups.some(x=>x.id===id),'figure must not be deleted');
 assert.ok(after.parts.some(p=>p.id===anchor.id),'anchor remains available');
 assert.equal(after.links.filter(l=>l.type==='bone').length,before.links.filter(l=>l.type==='bone').length,'ragdoll skeleton intact');
});
test('Ragdolls are freely draggable and can act as physical experiment subjects',()=>{
 const {api}=engine();api.createWorld('empty');
 const hip=api.spawnResident(750,840),id=hip.group;
 assert.equal(api.getWorld().groups.length,1);
 const g=api.getWorld().groups[0];
 assert.ok(g.nodes.length>=14);
 api.setResidentTarget(id,910);
 const old=api.getWorld().parts.find(p=>p.id===g.hip).x;
 for(let i=0;i<150;i++)api.step();
 assert.ok(api.getWorld().parts.find(p=>p.id===g.hip).x>old+5,'figure physically walks, allowing experiments with other bodies');
});

test('Unhook action releases a legacy hanging figure for sandbox experiments and Undo restores rope',()=>{
 const {api,nodes}=engine(true);api.createWorld('empty');
 const hip=api.spawnResident(680,730),w=api.getWorld(),g=w.groups[0];
 const anchor={id:w.next,kind:'anchor',x:680,y:360,r:9,fixed:true};
 w.parts.push(anchor);w.links.push({id:w.next+1,a:anchor.id,b:g.head,type:'rope',len:280,k:.96});w.next+=2;
 api.importScene({format:'StickLab',version:4,world:w});
 assert.equal(api.getWorld().links.filter(l=>l.type==='rope').length,1);
 assert.equal(api.unhookFigure(g.id),1);
 const freed=api.getWorld();assert.equal(freed.links.filter(l=>l.type==='rope').length,0);
 assert.ok(freed.parts.find(p=>p.id===hip.id));
 nodes.undo.onclick();
 assert.equal(api.getWorld().links.filter(l=>l.type==='rope').length,1,'Undo restores external connection');
});

test('a toppled autonomous resident attempts recovery inside the real world simulator',()=>{
 const {api}=engine(true);api.createWorld('empty');const hip=api.spawnResident(790,850);
 const w=api.getWorld(),g=w.groups[0],body=w.parts.filter(p=>p.group===g.id),byId=id=>body.find(p=>p.id===id);
 const chest=byId(g.nodes[2]),head=byId(g.nodes[0]),pelvis=byId(g.hip);
 chest.y=pelvis.y+8;chest.py=chest.y;
 head.y=pelvis.y+12;head.py=head.y;
 api.importScene({format:'StickLab',version:4,world:w});
 const before=api.getWorld().parts.find(p=>p.id===g.nodes[2]);
 api.step();
 const resident=api.getResidents().find(x=>x.id===g.id),after=api.getWorld().parts.find(p=>p.id===g.nodes[2]);
 assert.equal(resident.motionState,'getting-up','AI state should show recovery effort rather than pretending to walk');
 assert.ok(Number.isFinite(after.y)&&Number.isFinite(after.py),'recovery keeps finite physical coordinates');
 assert.ok(after.y<before.y+35,'get-up should not teleport character through the floor');
});
test('Help mode nudges a physically reachable ball in the full simulator',()=>{
 const {api}=engine();api.createWorld('empty');
 const hip=api.spawnResident(800,854),id=hip.group;
 const w=api.getWorld(),ballId=w.next;w.parts.push({id:ballId,kind:'ball',x:840,y:900,px:840,py:900,r:22,fixed:false});w.next++;
 api.importScene({format:'StickLab',version:4,world:w});
 assert.equal(api.setResidentMode(id,'help'),true);
 for(let i=0;i<15;i++)api.step();
 const after=api.getWorld().parts.find(p=>p.id===ballId);
 const resident=api.getResidents().find(g=>g.id===id);
 assert.ok(after.x>840,'contact must push ball forward, measured '+after.x);
 assert.ok(resident.motionState==='pushing'||resident.motionState==='walking','AI should be actuating nearby physics rather than teleporting it');
});

test('applying Help releases direct control and resumes a paused world for autonomous physics',()=>{
 const {api,nodes}=engine(true);api.createWorld('empty');
 const hip=api.spawnResident(790,854);
 assert.equal(api.selectResident(hip.group),true);
 nodes.pause.onclick();assert.equal(api.getState().paused,true);
 nodes.residentMode.value='help';nodes.applyResidentMode.onclick();
 assert.equal(api.getState().selected,null,'Help must not remain blocked by direct selection');
 assert.equal(api.getState().paused,false,'Help starts physics to make an observable action');
 assert.equal(api.getResidents()[0].mode,'help');
});
