/* StickLab v0.2 simulation utilities — dependency-free UMD for browsers and tests. */
(function(root){'use strict';
function finite(n){return typeof n==='number'&&isFinite(n)}
function integer(n){return finite(n)&&Math.floor(n)===n&&n>0&&n<=1000000000}
function bounds(p){
 var angle=p.kind==='box'?(p.angle||0):0,cos=Math.abs(Math.cos(angle)),sin=Math.abs(Math.sin(angle));
 var rx=p.kind==='box'?cos*p.w/2+sin*p.h/2:p.r;
 var ry=p.kind==='box'?sin*p.w/2+cos*p.h/2:p.r;
 return {minX:p.x-rx,maxX:p.x+rx,minY:p.y-ry,maxY:p.y+ry};
}
function aabbOverlap(a,b){var x=bounds(a),y=bounds(b);return x.minX<=y.maxX&&x.maxX>=y.minX&&x.minY<=y.maxY&&x.maxY>=y.minY}
function collisionPairs(parts,size){
 size=size||96;var cells={},pairs={},out=[];
 for(var i=0;i<parts.length;i++){
  var r=bounds(parts[i]),left=Math.floor(r.minX/size),right=Math.floor(r.maxX/size),top=Math.floor(r.minY/size),bottom=Math.floor(r.maxY/size);
  for(var x=left;x<=right;x++)for(var y=top;y<=bottom;y++){
   var key=x+','+y,other=cells[key]||(cells[key]=[]);
   for(var k=0;k<other.length;k++){
    var j=other[k],pk=j+':'+i;
    if(!pairs[pk]&&aabbOverlap(parts[j],parts[i])){pairs[pk]=true;out.push([j,i])}
   }
   other.push(i);
  }
 }
 out.sort(function(a,b){return a[0]-b[0]||a[1]-b[1]});return out;
}
function normalizeScene(input){
 if(!input||typeof input!=='object')throw Error('Missing StickLab scene');
 var wrapper=input.world?input:{format:'StickLab',version:1,world:input};
 if(wrapper.format!=='StickLab'||(wrapper.version!==1&&wrapper.version!==2&&wrapper.version!==3&&wrapper.version!==4))throw Error('Unsupported StickLab version');
 var world=wrapper.world;
 if(!world||!Array.isArray(world.parts)||!Array.isArray(world.links)||!Array.isArray(world.groups)||world.parts.length>350||world.links.length>800||world.groups.length>100)throw Error('Invalid world arrays');
 var ids={},taken={},maxId=0;
 var parts=world.parts.map(function(p){
  if(!p||!integer(p.id)||taken[p.id]||['joint','box','ball','anchor','wheel'].indexOf(p.kind)<0||!finite(p.x)||!finite(p.y)||Math.abs(p.x)>5000||Math.abs(p.y)>5000)throw Error('Invalid body');
  if(p.px!==undefined&&!finite(p.px)||p.py!==undefined&&!finite(p.py)||p.angle!==undefined&&!finite(p.angle)||p.pa!==undefined&&!finite(p.pa))throw Error('Invalid body motion');
  if(p.kind==='box'&&(!finite(p.w)||!finite(p.h)||p.w<5||p.h<5||p.w>300||p.h>300)||p.kind!=='box'&&(!finite(p.r)||p.r<1||p.r>100))throw Error('Invalid body geometry');
  if((p.motorPower!==undefined&&(!finite(p.motorPower)||p.motorPower<.2||p.motorPower>2))||(p.hp!==undefined&&(!finite(p.hp)||p.hp<0||p.hp>10000))|| (p.material!==undefined&&['wood','steel','rubber'].indexOf(p.material)<0))throw Error('Invalid material or wheel state');
  if(p.angle!==undefined&&Math.abs(p.angle)>100000||p.pa!==undefined&&Math.abs(p.pa)>100000)throw Error('Invalid rotation');
  ids[p.id]=p;taken[p.id]=1;maxId=Math.max(maxId,p.id);
  return {id:p.id,kind:p.kind,x:p.x,y:p.y,px:p.px===undefined?p.x:p.px,py:p.py===undefined?p.y:p.py,w:p.kind==='box'?p.w:0,h:p.kind==='box'?p.h:0,r:p.kind==='box'?0:p.r,angle:p.angle||0,pa:p.pa===undefined?(p.angle||0):p.pa,fixed:!!p.fixed,group:p.group||null,color:typeof p.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(p.color)?p.color:'#182a3b',material:p.material||'wood',hp:p.hp===undefined?(p.material==='steel'?240:90):p.hp,motor:p.kind==='wheel'&&!!p.motor,motorDirection:p.motorDirection===-1?-1:1,motorPower:p.motorPower||1};
 });
 var links=world.links.map(function(l){
  if(!l||!integer(l.id)||taken[l.id]||!ids[l.a]||!ids[l.b]||l.a===l.b||['bone','brace','rope','spring','hinge'].indexOf(l.type)<0||!finite(l.len)||l.len<0||l.len>10000)throw Error('Invalid link');
  if(l.k!==undefined&&(!finite(l.k)||l.k<0||l.k>1))throw Error('Invalid stiffness');
  if(l.type==='hinge'&&[l.ax,l.ay,l.bx,l.by].some(function(v){return !finite(v)||Math.abs(v)>500}))throw Error('Invalid hinge offset');
  if(l.strength!==undefined&&(!finite(l.strength)||l.strength<1||l.strength>10000))throw Error('Invalid link strength');
  if(l.graspOwner!==undefined&&(['spring','hinge'].indexOf(l.type)<0||typeof l.graspOwner!=='string'||!/^f[0-9]+$/.test(l.graspOwner)))throw Error('Invalid grasp link');
  taken[l.id]=1;maxId=Math.max(maxId,l.id);
  var normalized={id:l.id,a:l.a,b:l.b,type:l.type,len:l.len,k:l.k===undefined?1:l.k,ax:l.type==='hinge'?l.ax:0,ay:l.type==='hinge'?l.ay:0,bx:l.type==='hinge'?l.bx:0,by:l.type==='hinge'?l.by:0,breakable:!!l.breakable,strength:l.strength===undefined?90:l.strength};
  if(l.graspOwner!==undefined)normalized.graspOwner=l.graspOwner;
  return normalized;
 });
 var groups=world.groups.map(function(g){
  if(!g||typeof g.id!=='string'||!/^f[0-9]+$/.test(g.id)||!Array.isArray(g.nodes)||!g.nodes.length||g.nodes.length>30||!integer(g.hip)||!integer(g.head)||g.nodes.indexOf(g.hip)<0||g.nodes.indexOf(g.head)<0)throw Error('Invalid ragdoll group');
  var visited={};g.nodes.forEach(function(id){if(visited[id]||!ids[id]||ids[id].group!==g.id)throw Error('Invalid ragdoll node');visited[id]=1});
  if(g.ai!==undefined&&typeof g.ai!=='boolean')throw Error('Invalid agent activation');
  if(g.name!==undefined&&(typeof g.name!=='string'||g.name.length>32||!/^[A-Za-z][A-Za-z0-9 _-]*$/.test(g.name)))throw Error('Invalid agent name');
  if(g.mode!==undefined&&['wander','help','rest','go'].indexOf(g.mode)<0)throw Error('Invalid agent behavior');
  if(g.personality!==undefined&&['curious','cautious','helpful'].indexOf(g.personality)<0)throw Error('Invalid personality');
  if(g.targetX!==undefined&&g.targetX!==null&&(!finite(g.targetX)||g.targetX<0||g.targetX>2200))throw Error('Invalid movement target');
  var mem=g.memory||{hazards:0,lastHazardX:null,interactions:0};
  if(typeof mem!=='object'||Array.isArray(mem)||!(finite(mem.hazards)&&Math.floor(mem.hazards)===mem.hazards)||mem.hazards<0||mem.hazards>99||!(finite(mem.interactions)&&Math.floor(mem.interactions)===mem.interactions)||mem.interactions<0||mem.interactions>99||(mem.lastHazardX!==null&&(!finite(mem.lastHazardX)||Math.abs(mem.lastHazardX)>5000)))throw Error('Invalid agent memory');
  var normalized={id:g.id,nodes:g.nodes.slice(),hip:g.hip,head:g.head,alive:true,ai:!!g.ai,name:g.name||('Stick '+g.id.slice(1)),personality:g.personality||'curious',mode:g.mode||'wander',targetX:g.targetX===undefined?null:g.targetX,memory:{hazards:mem.hazards,lastHazardX:mem.lastHazardX,interactions:mem.interactions}};
  if(g.graspIgnoreTargetId!==undefined&&g.graspIgnoreTargetId!==null){var ignored=ids[g.graspIgnoreTargetId];var eligible=ignored&&!ignored.group&&!ignored.fixed&&((ignored.kind==='ball'&&ignored.r>12&&ignored.r<=42)||(ignored.kind==='box'&&ignored.w<=72&&ignored.h<=72&&ignored.w*ignored.h<=4200));if(!integer(g.graspIgnoreTargetId)||!eligible)throw Error('Invalid ignored grasp target');normalized.graspIgnoreTargetId=g.graspIgnoreTargetId}
  return normalized;

 });
 var graspOwners={},graspTargets={};
 links.forEach(function(l){if(l.graspOwner){
  var owner=groups.filter(function(g){return g.id===l.graspOwner})[0],a=ids[l.a],b=ids[l.b];
  var targetId=a.group===l.graspOwner?b.id:a.id;
  var hand=a.group===l.graspOwner?a:b,target=a.group===l.graspOwner?b:a;
  var validTarget=target&&!target.group&&!target.fixed&&((target.kind==='ball'&&target.r>12&&target.r<=42&&l.type==='spring')||(target.kind==='box'&&target.w<=72&&target.h<=72&&target.w*target.h<=4200&&l.type==='hinge'));
  var targetCount=graspTargets[targetId]||0;
  var valid=owner&&owner.ai&&['help','go','rest'].indexOf(owner.mode)>=0&&hand.kind==='joint'&&owner.nodes.indexOf(hand.id)>=0&&validTarget&&!graspOwners[l.graspOwner]&&targetCount<2;
  if(!valid)throw Error('Invalid grasp ownership');
  graspOwners[l.graspOwner]=true;graspTargets[targetId]=targetCount+1;
 }});
 parts.forEach(function(p){if(p.group&&!groups.some(function(g){return g.id===p.group&&g.nodes.indexOf(p.id)>=0}))throw Error('Orphan ragdoll body')});
 if(world.aiEnabled!==undefined&&typeof world.aiEnabled!=='boolean')throw Error('Invalid AI setting');
 var next=integer(world.next)&&world.next>maxId?world.next:maxId+1;
 return {format:'StickLab',version:4,world:{parts:parts,links:links,groups:groups,aiEnabled:!!world.aiEnabled,next:next,title:typeof world.title==='string'?world.title.slice(0,50):'Imported World'}};
}
var api={bounds:bounds,aabbOverlap:aabbOverlap,collisionPairs:collisionPairs,normalizeScene:normalizeScene};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.StickLabCore=api;
})(typeof window!=='undefined'?window:null);
