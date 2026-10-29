/* StickLab v0.4: deterministic, slow-tick, offline stick-figure decisions.
   No DOM, no timers, no random calls, no direct modification of physics bodies. */
(function(root){'use strict';
var personalities=['curious','cautious','helpful'],modes=['wander','help','rest','go'];
var MAX_HOP_WIDTH=72,MAX_HOP_HEIGHT=82,MAX_CLIMB_HEIGHT=148,JUMP_CLEARANCE=105,FIGURE_HEAD_CLEARANCE=95;
var MAX_PLANNED_BARRIERS=128;
function isGraspable(p){return !!(p&&!p.group&&!p.fixed&&((p.kind==='ball'&&p.r>12&&p.r<=42)||(p.kind==='box'&&p.w>=5&&p.h>=5&&p.w<=72&&p.h<=72&&p.w*p.h<=4200)))}
function finite(n){return typeof n==='number'&&isFinite(n)}
function bounded(n,max){return Math.max(0,Math.min(max,(typeof n==='number'&&isFinite(n))?n:0))}
function memoryOf(g){var m=g.memory||{};return {hazards:bounded(m.hazards,99),lastHazardX:typeof m.lastHazardX==='number'&&isFinite(m.lastHazardX)?m.lastHazardX:null,interactions:bounded(m.interactions,99)}}
function fixedBoxBounds(box){
 if(!box||box.kind!=='box'||!box.fixed||!isFinite(box.x)||!isFinite(box.y)||!(box.w>0)||!(box.h>0))return null;
 var angle=typeof box.angle==='number'&&isFinite(box.angle)?box.angle:0;
 var c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
 var halfW=(c*box.w+s*box.h)/2,halfH=(s*box.w+c*box.h)/2;
 return {left:box.x-halfW,right:box.x+halfW,top:box.y-halfH,bottom:box.y+halfH,angle:angle};
}
function objectBounds(object){
 if(!object)return null;
 if(object.kind==='ball')return {left:object.x-object.r,right:object.x+object.r,top:object.y-object.r,bottom:object.y+object.r};
 if(object.kind==='box'&&object.w>0&&object.h>0){var angle=typeof object.angle==='number'&&isFinite(object.angle)?object.angle:0,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle)),halfW=(c*object.w+s*object.h)/2,halfH=(s*object.w+c*object.h)/2;return {left:object.x-halfW,right:object.x+halfW,top:object.y-halfH,bottom:object.y+halfH}}
 return null;
}
function hasJumpClearance(hip,barrier,direction,nearby){
 var edge=direction>0?barrier.right:barrier.left;
 var pathLeft=Math.min(hip.x,edge)-18,pathRight=Math.max(hip.x,edge)+18;
 var arcTop=hip.y-JUMP_CLEARANCE-FIGURE_HEAD_CLEARANCE,arcBottom=hip.y-FIGURE_HEAD_CLEARANCE;
 for(var i=0;i<nearby.length&&i<MAX_PLANNED_BARRIERS;i++){
  var box=nearby[i],bounds=fixedBoxBounds(box);
  if(!bounds||bounds.bottom<=arcTop||bounds.top>=arcBottom)continue;
  if(bounds.right>=pathLeft&&bounds.left<=pathRight)return false;
 }
 return true;
}
function hasClimbClearance(barrier,nearby,barrierId){
 for(var i=0;i<nearby.length;i++){
  var box=nearby[i];if(!box||box.id===barrier.id||box.id===barrierId)continue;
  var bounds=fixedBoxBounds(box);if(!bounds)continue;
  if(bounds.right>=barrier.left-26&&bounds.left<=barrier.right+26&&bounds.bottom>barrier.top-100&&bounds.top<barrier.top+12)return false;
 }
 return true;
}
function planRoute(group,hip,terrain,targetX,floor,carried){
 if(!hip||!finite(targetX))return {target:targetX,signature:'',barriers:[],blocked:null};
 terrain=terrain||[];floor=finite(floor)?floor:930;
 var direction=targetX>=hip.x?1:-1,travel=Math.abs(targetX-hip.x),items=[],signatureParts=[],carriedBounds=objectBounds(carried);
 for(var i=0;i<terrain.length;i++){
  var box=terrain[i],bounds=fixedBoxBounds(box);if(!bounds)continue;
  var front=direction>0?bounds.left-hip.x:hip.x-bounds.right;
  if(front< -22||front>travel+12)continue;
  var bodyOverlap=bounds.bottom>=hip.y+22&&bounds.top<=floor-10;
  var carriedOverlap=carriedBounds&&bounds.bottom>=carriedBounds.top&&bounds.top<=carriedBounds.bottom&&
   bounds.right>=carriedBounds.left-24&&bounds.left<=carriedBounds.right+24;
  if(!bodyOverlap&&!carriedOverlap)continue;
  signatureParts.push([box.id,bounds.left.toFixed(1),bounds.right.toFixed(1),bounds.top.toFixed(1),bounds.bottom.toFixed(1),bounds.angle.toFixed(3)].join(':'));
  items.push({id:box.id,front:front,bounds:bounds});
 }
 items.sort(function(a,b){return a.front-b.front});
 signatureParts.sort();
 var barriers=[],blocked=null;
 for(i=0;i<items.length&&i<MAX_PLANNED_BARRIERS;i++){
  var item=items[i],b=item.bounds;
  var flat=Math.abs(b.angle)<=.1&&(b.right-b.left)<=MAX_HOP_WIDTH;
  var hop=!carried&&flat&&b.top>=hip.y-6&&floor-b.top<=MAX_HOP_HEIGHT;
  if(hop)hop=hasJumpClearance(hip,b,direction,terrain);
  var climb=!hop&&!carried&&flat&&floor-b.top>MAX_HOP_HEIGHT&&floor-b.top<=MAX_CLIMB_HEIGHT&&hasClimbClearance(b,terrain,item.id);
  if(!hop&&!climb){blocked=item.id;break}
  barriers.push({id:item.id,type:climb?'climb':'hop',distance:item.front,launchX:direction>0?b.left-30:b.right+30});
 }
 if(items.length>MAX_PLANNED_BARRIERS&&!blocked)blocked=items[MAX_PLANNED_BARRIERS].id;
 return {target:targetX,direction:direction,signature:signatureParts.join('|'),barriers:barriers,blocked:blocked,plannedTick:0};
}
// Very small local collision-aware planner. This is not a global pathfinder.
function routeBarrier(hip,nearby,direction,floor,targetX,carried){
 if(!direction)return null;
 var nearest=null;
 var carriedBounds=objectBounds(carried);
 for(var i=0;i<nearby.length&&i<32;i++){
  var box=nearby[i];
  var bounds=fixedBoxBounds(box);if(!bounds)continue;
  // Use the rotated rectangle's conservative AABB for local blocker checks.
  // This recognizes angled fixed structures without pretending the figure
  // can climb them or reason about the exact shape of a route around them.
  var front=(direction>0?bounds.left-hip.x:hip.x-bounds.right);
  var bodyOverlap=bounds.bottom>=hip.y+22&&bounds.top<=floor-10;
  if(carriedBounds){
   var carriedFront=direction>0?bounds.left-carriedBounds.right:carriedBounds.left-bounds.right;
   if(carriedFront<front)front=carriedFront;
  }
  if(front< -22||front>65)continue;
  var carriedOverlap=carriedBounds&&bounds.bottom>=carriedBounds.top&&bounds.top<=carriedBounds.bottom;
  if(!bodyOverlap&&!carriedOverlap)continue;
  // A Go Here destination before this box does not need to cross it.
  if(typeof targetX==='number'&&isFinite(targetX)&&front>Math.abs(targetX-hip.x)+12)continue;
  // A ground-level knee-height box is hopable, not a 150px wall or overhead platform.
  // Restrict hopping to nearly level boxes. An angled body's AABB is safe for
  // detecting a block, but is not enough evidence that a physical hop clears it.
  var flat=Math.abs(bounds.angle)<=.1&&(bounds.right-bounds.left)<=MAX_HOP_WIDTH;
  var hop=!carried&&flat&&bounds.top>=hip.y-6&&floor-bounds.top<=MAX_HOP_HEIGHT;
  if(hop)hop=hasJumpClearance(hip,bounds,direction,nearby);
  var climb=!hop&&!carried&&flat&&floor-bounds.top>MAX_HOP_HEIGHT&&floor-bounds.top<=MAX_CLIMB_HEIGHT&&hasClimbClearance(bounds,nearby,box.id);
  if(!nearest||front<nearest.distance)nearest={id:box.id,distance:front,hop:hop,climb:climb};
 }
 return nearest;
}
function stalledTravel(group,hip,tick){
 var nav=group.navigation,goal=group.targetX;
 if(!nav||nav.target!==goal||tick<nav.tick){
  group.navigation={target:goal,x:hip.x,tick:tick,stalled:0,retries:0,blocked:false};
  return null;
 }
 if(tick-nav.tick<8)return nav.blocked?'blocked':null;
 var progress=Math.abs(hip.x-nav.x);
 nav.x=hip.x;nav.tick=tick;
 if(progress>=6){nav.stalled=0;nav.retries=0;nav.blocked=false;return null}
 nav.stalled++;
 if(nav.blocked)return 'blocked';
 if(nav.stalled>=2){
  nav.stalled=0;
  if(nav.retries<2){nav.retries++;return 'retry'}
  nav.blocked=true;return 'blocked';
 }
 return null;
}
function decide(group,hip,nearby,goal,tick,floor,carried,routeGeometry){
var memory=memoryOf(group),result={intent:'rest',direction:0,jump:false,activateMotorId:null,pushTargetId:null,graspTargetId:null,memory:memory};
 if(!group||!group.ai||group.mode==='rest'||!hip)return result;
 nearby=nearby||[];floor=floor||930;
 var mode=modes.indexOf(group.mode)<0?'wander':group.mode;
 var personality=personalities.indexOf(group.personality)<0?'curious':group.personality;
 var i,p,dx,dy,hazard=null,obstacle=null,interest=null,wheel=null;
 for(i=0;i<nearby.length&&i<32;i++){
  p=nearby[i];if(!p||p.id===hip.id||p.group||p.kind==='joint'||p.kind==='anchor')continue;
  dx=p.x-hip.x;dy=p.y-hip.y;
  if(Math.abs(dx)<95&&dy<15&&dy>-185&&p.py!==undefined&&p.y-p.py>2.5&&(p.kind==='box'||p.kind==='ball'||p.kind==='wheel')){
   if(!hazard||Math.abs(dx)<Math.abs(hazard.x-hip.x))hazard=p;
  }
  if(p.kind==='box'&&p.fixed&&Math.abs(dx)<95&&Math.abs(dy)<130){
   if(!obstacle||Math.abs(dx)<Math.abs(obstacle.x-hip.x))obstacle=p;
  }
  if(p.kind==='ball'&&!p.fixed&&Math.abs(dx)<145&&Math.abs(dy)<105){
   if(!interest||Math.abs(dx)<Math.abs(interest.x-hip.x))interest=p;
  }
  if(p.kind==='wheel'&&!p.motor&&Math.abs(dx)<75&&Math.abs(dy)<125&&!wheel)wheel=p;
 }
 if(hazard){result.intent='avoid';result.direction=hazard.x>=hip.x?-1:1;memory.hazards=Math.min(99,memory.hazards+1);memory.lastHazardX=hazard.x;return result}
 if(mode==='go'&&typeof group.targetX==='number'&&isFinite(group.targetX)){
  var distance=group.targetX-hip.x;result.intent=Math.abs(distance)<=26?'arrived':'go';result.direction=Math.abs(distance)<=26?0:(distance>0?1:-1);
  var route=group.routePlan,geometry=routeGeometry||nearby,routeNow=planRoute(group,hip,geometry,group.targetX,floor,carried);
  if(!route||route.target!==group.targetX||route.signature!==routeNow.signature||((tick||0)-(route.plannedTick||0))>90){
   route=routeNow;route.plannedTick=tick||0;group.routePlan=route;
  }else{route.barriers=routeNow.barriers;route.blocked=routeNow.blocked;route.direction=routeNow.direction}
  if(route.blocked!=null&&result.intent!=='arrived'){
   result.intent='blocked';result.direction=0;result.jump=false;result.blockedBy=route.blocked;
  }else if(route.barriers.length){
   result.routeBarriers=route.barriers.length;
   var nextBarrier=route.barriers[0];
   // Execute the planned sequence in order. The physical jump still occurs
   // only near the measured barrier edge, using the existing grounded impulse.
   if(result.direction&&nextBarrier&&nextBarrier.distance<=65&&nextBarrier.distance>=-22){result.routeBarrierId=nextBarrier.id;if(nextBarrier.type==='climb'){result.climb=true;result.climbTargetId=nextBarrier.id;result.climbDirection=result.direction;result.intent='climb'}else{result.jump=true;result.intent='hop'}}
  }
 }
 else if(mode==='help'&&goal){result.intent='help';var delta=goal.x-hip.x;result.direction=Math.abs(delta)<18?0:(delta>0?1:-1);
   // Help mode can deliberately push a loose ball once it is in physical reach.
   if(isGraspable(goal)&&Math.abs(delta)<95&&Math.abs(goal.y-hip.y)<75)result.graspTargetId=goal.id;
   if(goal.kind==='ball'&&!goal.fixed&&Math.abs(delta)<80&&Math.abs(goal.y-hip.y)<75)result.pushTargetId=goal.id;
   if(wheel&&personality==='helpful'){result.activateMotorId=wheel.id;memory.interactions=Math.min(99,memory.interactions+1)}
 }else if(personality==='curious'&&interest){result.intent='investigate';result.direction=interest.x>hip.x?1:-1}
 else{result.intent='wander';result.direction=Math.floor(((tick||0)+parseInt((group.id||'f0').slice(1),10)*19)/160)%2===0?1:-1}
 // Local decisions are independent of device performance, always bounded to 32 candidate parts.
 if(result.direction&&result.intent!=='blocked'){
  var barrier=routeBarrier(hip,nearby,result.direction,floor,mode==='go'?group.targetX:null,carried);
  if(barrier&&mode==='go'){
   if(barrier.hop){result.jump=true;result.intent='hop'}
   else if(barrier.climb){result.climb=true;result.climbTargetId=barrier.id;result.climbDirection=result.direction;result.intent='climb'}
   else{result.direction=0;result.jump=false;result.climb=false;result.intent='blocked'}
  }else if(barrier&&barrier.hop&&(mode==='help'||mode==='wander')){result.jump=true}
  else if(barrier&&!barrier.hop&&mode==='wander'){result.direction=-result.direction;result.intent='turn'}
 }
 if(mode==='go'&&(result.intent==='go'||result.intent==='hop'||result.intent==='climb')){
  var recovery=stalledTravel(group,hip,tick||0);
  if(recovery==='retry'){result.jump=true;result.intent='retry'}
  if(recovery==='blocked'){result.direction=0;result.jump=false;result.intent='blocked'}
 }else if(mode==='go'&&result.intent==='arrived'){group.navigation=null}
 if(hip.x<85)result.direction=1;else if(hip.x>2080)result.direction=-1;
 return result;
}
var api={decide:decide,modes:modes,personalities:personalities,isGraspable:isGraspable,planRoute:planRoute,fixedBoxBounds:fixedBoxBounds};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.StickLabInhabitants=api;
})(typeof window!=='undefined'?window:null);
