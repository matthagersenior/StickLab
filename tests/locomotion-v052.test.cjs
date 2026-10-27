'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Locomotion=require('../src/locomotion.js');
const Brain=require('../src/inhabitants.js');
const Core=require('../src/core.js');
function node(id,x,y,r=6){return{id,kind:'joint',x,y,r,px:x,py:y,fixed:false}}
function actor(){
 const hip=node(1,500,850),chest=node(2,500,818),head=node(3,500,772,13);
 const lk=node(4,488,888),rk=node(5,512,888);
 const lf=node(6,483,924),rf=node(7,517,924);
 return {group:{id:'f20',nodes:[1,2,3,4,5,6,7]},parts:{hip,chest,head,lk,rk,lf,rf}};
}
test('grounded walking makes alternating foot intentions without teleports or unbounded velocity',()=>{
 const {group,parts}=actor();let left=[],right=[];
 for(let tick=0;tick<60;tick++){
  const a=Locomotion.step(group,parts,{direction:1,jump:false},[],930,tick);
  if(tick%8===0){left.push(parts.lf.py);right.push(parts.rf.py)}
  assert.equal(a.grounded,true);
  for(const p of Object.values(parts)){
   assert.equal(p.x,({hip:500,chest:500,head:500,lk:488,rk:512,lf:483,rf:517})[Object.keys(parts).find(k=>parts[k]===p)],'controller does not teleport body positions');
   assert.ok(Math.abs(p.x-p.px)<12,'safe capped horizontal impulse per simulated physics step');
   // The physics integrator updates previous-frame positions once each step.
   // Resetting to the initial body pose here isolates actuator behavior from solver movement.
   if(tick<59){p.px=p.x;p.py=p.y}
  }
 }
 assert.ok(parts.hip.px<500,'forward intent acts on pelvis velocity');
 assert.notDeepEqual(left,right,'stride actions should alternate between left and right feet');
});
test('airborne figures do not receive ground traction or repeat jump impulses',()=>{
 const {group,parts}=actor();Object.values(parts).forEach(p=>{p.y-=270;p.py=p.y});
 const result=Locomotion.step(group,parts,{direction:1,jump:true},[],930,1);
 assert.equal(result.grounded,false);assert.equal(result.jumped,false);
 assert.equal(parts.hip.px,500,'no horizontal motor in midair');
 assert.equal(parts.hip.py,parts.hip.y,'no midair jump boost');
});
test('grounded jump is a one-time vertical impulse, limited by simulation ticks',()=>{
 const {group,parts}=actor();
 assert.equal(Locomotion.step(group,parts,{direction:0,jump:true},[],930,60).jumped,true);
 const first=parts.hip.py;
 assert.equal(Locomotion.step(group,parts,{direction:0,jump:true},[],930,61).jumped,false);
 assert.equal(parts.hip.py,first,'cannot double jump before cooldown');
});
test('standing on a fixed platform permits movement, but floating far above it does not',()=>{
 const {group,parts}=actor();Object.values(parts).forEach(p=>{p.y-=130;p.py=p.y});
 const terrain=[{kind:'box',fixed:true,x:500,y:810,w:180,h:20}];
 const grounded=Locomotion.step(group,parts,{direction:1},terrain,930,2);
 assert.equal(grounded.grounded,true);
 Object.values(parts).forEach(p=>{p.y-=100;p.py=p.y;p.px=p.x});
 assert.equal(Locomotion.step(group,parts,{direction:1},terrain,930,3).grounded,false);
});
test('high-level Go Here command approaches destination and stops within arrival radius',()=>{
 const g={id:'f1',ai:true,mode:'go',personality:'curious',targetX:900};
 const hip=node(1,500,850);
 assert.equal(Brain.decide(g,hip,[],null,3,930).direction,1);
 g.targetX=507;
 const cmd=Brain.decide(g,hip,[],null,4,930);
 assert.equal(cmd.direction,0);assert.equal(cmd.intent,'arrived');
});
test('v4 scene serialization keeps valid movement goals and rejects malicious coordinates',()=>{
 const g={id:'f5',nodes:[1,2],hip:1,head:2,ai:true,name:'Dot',mode:'go',targetX:850,personality:'curious',memory:{hazards:0,lastHazardX:null,interactions:0}};
 const p=(id,r)=>({id,kind:'joint',x:500,y:800,px:500,py:800,r,group:'f5'});
 const scene={format:'StickLab',version:4,world:{title:'Walk',parts:[p(1,6),p(2,13)],links:[],groups:[g]}};
 const normal=Core.normalizeScene(scene);
 assert.equal(normal.world.groups[0].targetX,850);
 assert.equal(normal.world.groups[0].mode,'go');
 const invalid=JSON.parse(JSON.stringify(scene));invalid.world.groups[0].targetX=-1;
 assert.throws(()=>Core.normalizeScene(invalid));
});

test('fallen supported figure initiates an upright recovery without teleporting its parts',()=>{
 const {group,parts}=actor();parts.chest.y=parts.hip.y+8;parts.chest.py=parts.chest.y;
 parts.head.y=parts.hip.y+12;parts.head.py=parts.head.y;
 const initial=Object.fromEntries(Object.entries(parts).map(([k,p])=>[k,{x:p.x,y:p.y,py:p.py}]));
 const result=Locomotion.step(group,parts,{direction:1},[],930,60);
 assert.equal(result.recovering,true,'upper body near/below pelvis should trigger getting up');
 assert.equal(result.stepping,false,'do not walk normally during a recovery');
 assert.equal(result.grounded,true,'recovery needs stable contact');
 assert.equal(parts.chest.y,initial.chest.y,'no position teleport');
 assert.ok(parts.chest.py>initial.chest.py,'chest must receive upward physical impulse');
 assert.ok(parts.head.py>initial.head.py,'head must receive upward physical impulse');
 for(const [k,p] of Object.entries(parts))assert.ok(Math.abs(p.py-initial[k].py)<=9,'recovery impulse capped '+k);
});
test('upright and airborne figures do not trigger inappropriate recovery thrust',()=>{
 const {group,parts}=actor();assert.equal(Locomotion.step(group,parts,{direction:1},[],930,1).recovering,false);
 Object.values(parts).forEach(p=>{p.y-=280;p.py=p.y});
 parts.chest.y=parts.hip.y+8;parts.chest.py=parts.chest.y;
 parts.head.y=parts.hip.y+10;parts.head.py=parts.head.y;
 const py=parts.chest.py;
 const status=Locomotion.step(group,parts,{direction:1},[],930,2);
 assert.equal(status.recovering,false,'midair tumbling should not trigger thrust');
 assert.equal(parts.chest.py,py,'no midair recovery engine');
});
test('helping figure pushes an object only when it is physically within reach and supported',()=>{
 const {group,parts}=actor();
 const ball={id:77,kind:'ball',x:527,y:860,px:527,py:860,r:22,fixed:false};
 const result=Locomotion.step(group,parts,{direction:1,pushTargetId:77},[ball],930,8);
 assert.equal(result.pushed,true,'helper applies contact impulse when ball is in reach');
 assert.ok(ball.px<527,'push velocity should act forward on real physics ball');
 assert.equal(ball.x,527,'ball cannot teleport');
 assert.equal(Locomotion.step(group,parts,{direction:1,pushTargetId:77},[ball],930,9).pushed,false,'push has tick cooldown');
 ball.x=900;ball.px=900;
 assert.equal(Locomotion.step(group,parts,{direction:1,pushTargetId:77},[ball],930,80).pushed,false,'no telekinetic push');
});
test('helping cannot push fixed props or push while airborne',()=>{
 const {group,parts}=actor(),ball={id:12,kind:'ball',x:525,y:855,px:525,py:855,r:18,fixed:true};
 assert.equal(Locomotion.step(group,parts,{direction:1,pushTargetId:12},[ball],930,20).pushed,false);
 assert.equal(ball.px,525);
 ball.fixed=false;Object.values(parts).forEach(p=>{p.y-=240;p.py=p.y});
 assert.equal(Locomotion.step(group,parts,{direction:1,pushTargetId:12},[ball],930,22).pushed,false);
});
test('Help mode chooses a nearby ball to push, but never fabricates a target for an absent ball',()=>{
 const g={id:'f10',ai:true,mode:'help',personality:'helpful'};
 const hip=node(1,500,850),ball={id:11,kind:'ball',x:531,y:853,r:21,fixed:false,px:531,py:853};
 assert.equal(Brain.decide(g,hip,[ball],ball,20,930).pushTargetId,11);
 const far={...ball,x:870};
 assert.equal(Brain.decide(g,hip,[far],far,21,930).pushTargetId,null);
 assert.equal(Brain.decide(g,hip,[],null,22,930).pushTargetId,null);
});
