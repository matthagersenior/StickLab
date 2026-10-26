'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..');
function engine(pointer){
 const nodes={},noop=()=>{};
 function el(id){if(!nodes[id])nodes[id]={id,textContent:'',value:'1',innerHTML:'',style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop},listeners:{},addEventListener:function(name,fn){this.listeners[name]=fn},setAttribute:noop,getBoundingClientRect(){return{left:0,top:0,width:1000,height:700}},getContext(){return new Proxy({setTransform:noop},{get(o,k){return o[k]||noop},set(o,k,v){o[k]=v;return true}})}};return nodes[id]}
 const storage={};const context={document:{getElementById:el,querySelectorAll(){return[]}},navigator:{hardwareConcurrency:2},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},window:{innerWidth:1000,devicePixelRatio:1,addEventListener:noop,PointerEvent:!!pointer},requestAnimationFrame:noop,setTimeout:()=>1,clearTimeout:noop,Math,Date,JSON,Number,Array,Object,FileReader:function(){},isFinite,console};
 vm.createContext(context);for(const file of ['src/core.js','src/game.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),context);
 return{api:context.window.StickLab,nodes,storage};
}
test('v1 preset ragdolls survive save to slot 2 and reload',()=>{
 const{api,nodes,storage}=engine();const initial=api.getWorld().groups.length;assert.ok(initial>=2);
 api.save();nodes.saveSlot.value='2';api.save();api.createWorld('empty');api.load();
 assert.equal(api.getWorld().groups.length,initial);assert.equal(JSON.parse(storage.sticklab_scene_v2_2).version,2);
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
