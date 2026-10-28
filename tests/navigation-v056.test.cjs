'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Brain=require('../src/inhabitants.js');
const hip=(x=500,y=850)=>({id:1,x,y,px:x,py:y,kind:'joint'});
const walker=(targetX=900)=>({id:'f8',ai:true,mode:'go',targetX,personality:'cautious'});
const obstacle=(x,y,h,w=38)=>({id:55,kind:'box',fixed:true,x,y,w,h,px:x,py:y,angle:0});
test('Go Here asks for a grounded jump over a short box that actually blocks the route',()=>{
 const actor=walker(),short=obstacle(555,906,48);
 const result=Brain.decide(actor,hip(),[short],null,10,930);
 assert.equal(result.direction,1);
 assert.equal(result.jump,true,'a low barrier within jumping range should prompt a hop');
 assert.equal(result.intent,'hop');
});
test('Go Here reports a tall wall as blocked, without repeatedly jumping into it',()=>{
 const actor=walker(),wall=obstacle(555,855,150);
 const result=Brain.decide(actor,hip(),[wall],null,10,930);
 assert.equal(result.direction,0,'stop driving ragdoll against tall immovable wall');
 assert.equal(result.jump,false);
 assert.equal(result.intent,'blocked');
 assert.equal(actor.targetX,900,'must retain goal for repair or a new route');
});
test('Obstacles behind a figure, overhead and outside its travel corridor do not cause spurious hops',()=>{
 const actor=walker();
 const behind=obstacle(430,906,48),overhead=obstacle(553,560,38),distant=obstacle(900,906,48);
 const cmd=Brain.decide(actor,hip(),[behind,overhead,distant],null,20,930);
 assert.equal(cmd.direction,1);
 assert.equal(cmd.jump,false);
 assert.equal(cmd.intent,'go');
});
test('Destination travel backtracks correctly when facing left and can resume once wall disappears',()=>{
 const actor=walker(120),wall=obstacle(442,855,150);
 const stopped=Brain.decide(actor,hip(),[wall],null,20,930);
 assert.equal(stopped.intent,'blocked');
 const free=Brain.decide(actor,hip(),[],null,21,930);
 assert.equal(free.direction,-1);
 assert.equal(free.intent,'go');
});
test('Stuck destination gets a bounded retry hop, then a visible blocked state rather than endless running',()=>{
 const actor=walker();
 let last;
 for(let tick=0;tick<=80;tick+=10)last=Brain.decide(actor,hip(),[],null,tick,930);
 assert.equal(last.intent,'blocked','must report inability to progress after failed recovery attempts');
 assert.equal(last.direction,0);
 assert.equal(last.jump,false);
 assert.equal(actor.targetX,900,'blocked intent does not destroy navigation goal');
});
test('Stuck monitor resets when the figure makes forward progress or receives a new target',()=>{
 const actor=walker();
 for(let tick=0;tick<=20;tick+=10)Brain.decide(actor,hip(),[],null,tick,930);
 const moving=Brain.decide(actor,hip(550),[],null,30,930);
 assert.equal(moving.direction,1);
 assert.equal(moving.intent,'go');
 assert.equal(moving.jump,false);
 actor.targetX=250;
 const reversed=Brain.decide(actor,hip(550),[],null,40,930);
 assert.equal(reversed.direction,-1);
 assert.equal(reversed.intent,'go');
});
