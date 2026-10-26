'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),core=require('../src/core.js');
const box=(id,x,y,w=40,h=20,angle=0)=>({id,kind:'box',x,y,w,h,angle});
test('grid returns touching pair once, omits far bodies, handles negative positions',()=>{
 const pairs=core.collisionPairs([box(1,-10,0),box(2,20,0),box(3,2000,2000)],48);
 assert.deepEqual(pairs,[[0,1]]);
});
test('large and rotated bodies cover multiple grid cells correctly',()=>{
 const parts=[box(1,0,0,250,250,.5),box(2,80,80),box(3,500,500)];
 assert.deepEqual(core.collisionPairs(parts,48),[[0,1]]);
});
test('spatial pairs agree with brute-force bounds over crowded scene',()=>{
 const arr=[];for(let i=0;i<60;i++)arr.push(box(i+1,i*73%600-200,i*47%360-100,25+i%4*14,20+i%3*9,i*.19));
 const expected=[];for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++)if(core.aabbOverlap(arr[i],arr[j]))expected.push([i,j]);
 assert.deepEqual(core.collisionPairs(arr,96),expected);
});
test('v1 ragdoll and rope migrate without breaking node/link IDs',()=>{
 const input={format:'StickLab',version:1,world:{parts:[{id:1,kind:'joint',x:10,y:10,r:5,group:'f2'},{id:3,kind:'joint',x:15,y:10,r:5,group:'f2'},{id:4,kind:'anchor',x:15,y:5,r:9,fixed:true}],links:[{id:6,a:1,b:3,type:'bone',len:5},{id:7,a:3,b:4,type:'rope',len:8}],groups:[{id:'f2',nodes:[1,3],hip:1,head:3}]}};
 const out=core.normalizeScene(input);assert.equal(out.version,4);assert.equal(out.world.links[1].id,7);assert.deepEqual(out.world.groups[0].nodes,[1,3]);assert.equal(out.world.next,8);
});
test('rejects bad versions, duplicate IDs, invalid references and nonfinite motion',()=>{
 const s=(parts,links=[])=>({format:'StickLab',version:2,world:{parts,links,groups:[]}});
 assert.throws(()=>core.normalizeScene({...s([box(1,10,10)]),version:99}));
 assert.throws(()=>core.normalizeScene(s([box(1,10,10),box(1,15,20)])));
 assert.throws(()=>core.normalizeScene(s([box(1,10,10)],[{id:2,a:1,b:3,type:'rope',len:10}])));
 assert.throws(()=>core.normalizeScene(s([box(1,Infinity,10)])));
 assert.throws(()=>core.normalizeScene(s([{...box(1,10,10),pa:Infinity}])));
});
test('hinges preserve body angle and local anchors on v2 round trip',()=>{
 const out=core.normalizeScene({format:'StickLab',version:2,world:{parts:[box(1,0,0),{id:2,kind:'anchor',x:0,y:0,r:9,fixed:true}],links:[{id:3,a:1,b:2,type:'hinge',len:0,k:.9,ax:-20,ay:5,bx:0,by:0}],groups:[]}});
 assert.equal(out.world.links[0].ax,-20);assert.equal(out.world.parts[0].angle,0);
});
