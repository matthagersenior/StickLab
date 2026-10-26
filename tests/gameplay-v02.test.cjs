'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..');
function engine(pointer){
 const nodes={},noop=()=>{};
 function el(id){if(!nodes[id])nodes[id]={id,textContent:'',value:'1',innerHTML:'',style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop},listeners:{},addEventListener:function(name,fn){this.listeners[name]=fn},setAttribute:noop,getBoundingClientRect(){return{left:0,top:0,width:1000,height:700}},getContext(){return new Proxy({setTransform:noop},{get(o,k){return o[k]||noop},set(o,k,v){o[k]=v;return true}})}};return nodes[id]}
 const storage={};const context={document:{getElementById:el,querySelectorAll(){return[]}},navigator:{hardwareConcurrency:2},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},window:{innerWidth:1000,devicePixelRatio:1,addEventListener:noop,PointerEvent:!!pointer},requestAnimationFrame:noop,setTimeout:()=>1,clearTimeout:noop,Math,Date,JSON,Number,Array,Object,FileReader:function(){},isFinite,console};
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
 nodes.saveSlot.value='3';api.save();assert.equal(JSON.parse(storage.sticklab_scene_v4_3).version,4);
 api.createWorld('tower');api.load();
 assert.equal(api.getState().aiEnabled,false);
 assert.equal(api.getResidents()[0].name,resident.name);
 assert.equal(api.getResidents()[0].mode,'help');
});
