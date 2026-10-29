'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Brain=require('../src/inhabitants.js'),Core=require('../src/core.js');
const actor=(mode='wander',personality='curious')=>({id:'f1',ai:true,name:'Pip',mode,personality,memory:{hazards:0,lastHazardX:null,interactions:0}});
const hip={id:3,kind:'joint',x:500,y:850,px:500,py:850,r:6};
test('inhabitants wander deterministically using capped directional intent',()=>{
 const result=Brain.decide(actor(),hip,[],null,36,930);
 assert.ok(['wander','rest','investigate'].includes(result.intent));
 assert.ok([-1,0,1].includes(result.direction));
 assert.equal(result.jump,false);
 assert.equal(Brain.decide(actor(),hip,[],null,36,930).direction,result.direction);
});
test('cautious character dodges falling hazards and remembers an incident',()=>{
 const hazard={id:9,kind:'box',x:515,y:720,px:515,py:704,w:60,h:35};
 const r=Brain.decide(actor('wander','cautious'),hip,[hazard],null,40,930);
 assert.equal(r.intent,'avoid');assert.equal(r.direction,-1);
 assert.equal(r.memory.hazards,1);
 assert.equal(r.memory.lastHazardX,515);
});
test('inhabitant jumps a grounded obstacle without moving bodies directly',()=>{
 const wall={id:12,kind:'box',x:544,y:884,px:544,py:884,w:35,h:65,fixed:true};
 const r=Brain.decide(actor('help','helpful'),hip,[wall],{x:800,y:880},48,930);
 assert.equal(r.direction,1);assert.equal(r.jump,true);
});
test('assisting an experiment points toward the ball and can activate a nearby wheel',()=>{
 const wheel={id:8,kind:'wheel',x:515,y:895,r:27,motor:false};
 const r=Brain.decide(actor('help','helpful'),hip,[wheel],{x:850,y:880},50,930);
 assert.equal(r.intent,'help');assert.equal(r.direction,1);assert.equal(r.activateMotorId,8);
});
test('a resident on a direct walk tries to physically push a loose prop in its path',()=>{
 const walker={...actor('go','curious'),targetX:800};
 const ball={id:21,kind:'ball',x:548,y:872,px:548,py:872,r:22,fixed:false};
 const r=Brain.decide(walker,hip,[ball],null,50,930);
 assert.equal(r.intent,'go');assert.equal(r.direction,1);assert.equal(r.pushTargetId,ball.id);
});
test('resting or manually controlled inhabitants do not receive AI impulses',()=>{
 const r=Brain.decide(actor('rest','cautious'),hip,[],null,1,930);
 assert.equal(r.direction,0);assert.equal(r.jump,false);
 assert.equal(Brain.decide({...actor(),ai:false},hip,[],null,1,930).direction,0);
});
test('v4 scene saves actor identity and bounded behavior memory',()=>{
 const g={id:'f1',nodes:[1,2],hip:1,head:2,ai:true,name:'Pip',mode:'help',personality:'helpful',memory:{hazards:3,lastHazardX:600,interactions:2}};
 const p=(id,r)=>({id,kind:'joint',x:id*5,y:800,px:id*5,py:800,r,group:'f1'});
 const scene={format:'StickLab',version:4,world:{title:'Living',aiEnabled:true,parts:[p(1,6),p(2,13)],links:[],groups:[g]}};
 const migrated=Core.normalizeScene(scene);assert.equal(migrated.version,4);
 assert.equal(migrated.world.aiEnabled,true);assert.equal(migrated.world.groups[0].name,'Pip');assert.equal(migrated.world.groups[0].memory.hazards,3);
 assert.deepEqual(Core.normalizeScene(migrated),migrated);
});
test('v3 legacy groups remain passive, with no fabricated inhabitants',()=>{
 const scene={format:'StickLab',version:3,world:{parts:[{id:1,kind:'joint',x:100,y:300,r:13,group:'f2'},{id:2,kind:'joint',x:110,y:350,r:6,group:'f2'}],links:[],groups:[{id:'f2',nodes:[1,2],head:1,hip:2}]}};
 const out=Core.normalizeScene(scene);
 assert.equal(out.version,4);assert.equal(out.world.aiEnabled,false);assert.equal(out.world.groups[0].ai,false);
});
test('rejects untrusted behaviors, unreasonable memory and invalid names before import',()=>{
 const base={format:'StickLab',version:4,world:{parts:[{id:1,kind:'joint',x:100,y:300,r:13,group:'f2'},{id:2,kind:'joint',x:110,y:350,r:6,group:'f2'}],links:[],groups:[{id:'f2',nodes:[1,2],head:1,hip:2,ai:true,name:'Pip',mode:'wander',personality:'curious',memory:{hazards:0,lastHazardX:null,interactions:0}}]}};
 const modify=(changes)=>JSON.parse(JSON.stringify(base));
 for(const [k,v] of [['mode','attack'],['name','X'.repeat(100)],['personality','malicious']]){const s=modify();s.world.groups[0][k]=v;assert.throws(()=>Core.normalizeScene(s))}
 const s=modify();s.world.groups[0].memory.hazards=Infinity;assert.throws(()=>Core.normalizeScene(s));
});
