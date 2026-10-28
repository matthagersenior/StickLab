/* StickLab v0.4: deterministic, slow-tick, offline stick-figure decisions.
   No DOM, no timers, no random calls, no direct modification of physics bodies. */
(function(root){'use strict';
var personalities=['curious','cautious','helpful'],modes=['wander','help','rest','go'];
function bounded(n,max){return Math.max(0,Math.min(max,(typeof n==='number'&&isFinite(n))?n:0))}
function memoryOf(g){var m=g.memory||{};return {hazards:bounded(m.hazards,99),lastHazardX:typeof m.lastHazardX==='number'&&isFinite(m.lastHazardX)?m.lastHazardX:null,interactions:bounded(m.interactions,99)}}
// Very small local collision-aware planner. This is not a global pathfinder.
function routeBarrier(hip,nearby,direction,floor){
 if(!direction)return null;
 var nearest=null;
 for(var i=0;i<nearby.length&&i<32;i++){
  var box=nearby[i];
  if(!box||box.kind!=='box'||!box.fixed||!(box.w>0)||!(box.h>0)||Math.abs(box.angle||0)>.1)continue;
  var front=(direction>0?box.x-box.w/2-hip.x:hip.x-(box.x+box.w/2));
  var top=box.y-box.h/2,bottom=box.y+box.h/2;
  if(front< -22||front>65||bottom<hip.y+22||top>floor-10)continue;
  // A ground-level knee-height box is hopable, not a 150px wall or overhead platform.
  var hop=top>=hip.y+8&&floor-top<=72;
  if(!nearest||front<nearest.distance)nearest={distance:front,hop:hop};
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
function decide(group,hip,nearby,goal,tick,floor){
 var memory=memoryOf(group),result={intent:'rest',direction:0,jump:false,activateMotorId:null,pushTargetId:null,memory:memory};
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
 if(mode==='go'&&typeof group.targetX==='number'&&isFinite(group.targetX)){var distance=group.targetX-hip.x;result.intent=Math.abs(distance)<=26?'arrived':'go';result.direction=Math.abs(distance)<=26?0:(distance>0?1:-1)}
 else if(mode==='help'&&goal){result.intent='help';var delta=goal.x-hip.x;result.direction=Math.abs(delta)<18?0:(delta>0?1:-1);
   // Help mode can deliberately push a loose ball once it is in physical reach.
   if(goal.kind==='ball'&&!goal.fixed&&Math.abs(delta)<80&&Math.abs(goal.y-hip.y)<75)result.pushTargetId=goal.id;
   if(wheel&&personality==='helpful'){result.activateMotorId=wheel.id;memory.interactions=Math.min(99,memory.interactions+1)}
 }else if(personality==='curious'&&interest){result.intent='investigate';result.direction=interest.x>hip.x?1:-1}
 else{result.intent='wander';result.direction=Math.floor(((tick||0)+parseInt((group.id||'f0').slice(1),10)*19)/160)%2===0?1:-1}
 // Local decisions are independent of device performance, always bounded to 32 candidate parts.
 if(result.direction){
  var barrier=routeBarrier(hip,nearby,result.direction,floor);
  if(barrier&&mode==='go'){
   if(barrier.hop){result.jump=true;result.intent='hop'}
   else{result.direction=0;result.jump=false;result.intent='blocked'}
  }else if(barrier&&(barrier.hop||mode==='help')){result.jump=true}
  else if(barrier&&!barrier.hop&&mode==='wander'){result.direction=-result.direction;result.intent='turn'}
 }
 if(mode==='go'&&(result.intent==='go'||result.intent==='hop')){
  var recovery=stalledTravel(group,hip,tick||0);
  if(recovery==='retry'){result.jump=true;result.intent='retry'}
  if(recovery==='blocked'){result.direction=0;result.jump=false;result.intent='blocked'}
 }else if(mode==='go'&&result.intent==='arrived'){group.navigation=null}
 if(hip.x<85)result.direction=1;else if(hip.x>2080)result.direction=-1;
 return result;
}
var api={decide:decide,modes:modes,personalities:personalities};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.StickLabInhabitants=api;
})(typeof window!=='undefined'?window:null);
