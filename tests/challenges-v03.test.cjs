'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Levels=require('../src/levels.js'),Machines=require('../src/machines.js'),Core=require('../src/core.js');
test('challenge campaign contains four distinct physics goals',()=>{
 assert.equal(Levels.levels.length,4);
 assert.equal(new Set(Levels.levels.map(l=>l.id)).size,4);
 Levels.levels.forEach(level=>{assert.ok(level.goal.w>50);assert.ok(level.goal.x>level.start.x);assert.ok(level.hint)});
});
test('goal only completes after twelve consecutive simulation frames of a settled ball',()=>{
 const l=Levels.levels[0],p={x:l.goal.x+l.goal.w/2,y:l.goal.y+l.goal.h/2,r:24,px:0,py:0};
 let frames=0;for(let i=0;i<25;i++){frames=Levels.advance(p,l,frames);assert.equal(frames,0)}
 p.px=p.x;p.py=p.y;
 for(let i=0;i<12;i++){frames=Levels.advance(p,l,frames);assert.equal(frames,i+1)}
 p.x=l.goal.x-100;assert.equal(Levels.advance(p,l,frames),0);
});
test('even a center point in the zone does not count unless the entire ball fits',()=>{
 const level=Levels.levels[0];assert.equal(Levels.insideGoal({x:level.goal.x+4,y:level.goal.y+30,r:24},level.goal),false);
});
test('powered wheels apply a bounded physical impulse and spin only when enabled',()=>{
 const w={kind:'wheel',x:200,y:903,r:27,px:200,py:903,angle:0,pa:0,motor:true,motorPower:1,motorDirection:1};
 assert.equal(Machines.motorStep(w,930,1),true);assert.ok(w.px<200);assert.ok(w.angle>0);
 w.motor=false;const old=w.px;assert.equal(Machines.motorStep(w,930,1),false);assert.equal(w.px,old);
});
test('weak links fracture while rigid bones and old unmarked links remain intact',()=>{
 const a={x:0,y:0},b={x:200,y:0};
 assert.equal(Machines.broken({type:'rope',len:80,breakable:true,strength:50},a,b),true);
 assert.equal(Machines.broken({type:'rope',len:80,breakable:false,strength:50},a,b),false);
});
test('material damage tracks impact and steel is stronger than wood',()=>{
 const wood={kind:'box',material:'wood',fixed:false},steel={kind:'box',material:'steel',fixed:false};
 assert.equal(Machines.impact(wood,35),false);assert.ok(wood.hp<90);
 assert.equal(Machines.impact(steel,35),false);assert.ok(steel.hp>wood.hp);
 assert.equal(Machines.impact(wood,35),true);
});
test('v3 saves round trip wheel motor, material health, and breakable hinge strength',()=>{
 const s={format:'StickLab',version:3,world:{title:'Wheels',parts:[
 {id:1,kind:'wheel',x:100,y:200,r:27,px:100,py:200,motor:true,motorPower:1.3,motorDirection:-1,material:'rubber',hp:65},
 {id:2,kind:'box',x:150,y:150,w:70,h:30,material:'steel',hp:180}
 ],links:[{id:3,type:'hinge',a:1,b:2,len:0,k:.9,ax:0,ay:0,bx:-15,by:5,breakable:true,strength:64}],groups:[]}};
 const w=Core.normalizeScene(s);assert.equal(w.version,4);assert.equal(w.world.parts[0].motor,true);assert.equal(w.world.parts[0].motorDirection,-1);assert.equal(w.world.parts[1].material,'steel');assert.equal(w.world.links[0].strength,64);
 const again=Core.normalizeScene(w);assert.deepEqual(again,w);
});
test('malformed v3 motor and fracture state is rejected',()=>{
 const base={format:'StickLab',version:3,world:{parts:[{id:1,kind:'wheel',x:100,y:200,r:25,motorPower:Infinity}],links:[],groups:[]}};
 assert.throws(()=>Core.normalizeScene(base));
});
