/* StickLab v0.4: deterministic, slow-tick, offline stick-figure decisions.
   No DOM, no timers, no random calls, no direct modification of physics bodies. */
(function(root){'use strict';
var personalities=['curious','cautious','helpful'],modes=['wander','help','rest'];
function bounded(n,max){return Math.max(0,Math.min(max,Number.isFinite(n)?n:0))}
function memoryOf(g){var m=g.memory||{};return {hazards:bounded(m.hazards,99),lastHazardX:typeof m.lastHazardX==='number'&&isFinite(m.lastHazardX)?m.lastHazardX:null,interactions:bounded(m.interactions,99)}}
function decide(group,hip,nearby,goal,tick,floor){
 var memory=memoryOf(group),result={intent:'rest',direction:0,jump:false,activateMotorId:null,memory:memory};
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
 if(mode==='help'&&goal){result.intent='help';var delta=goal.x-hip.x;result.direction=Math.abs(delta)<28?0:(delta>0?1:-1);
   if(wheel&&personality==='helpful'){result.activateMotorId=wheel.id;memory.interactions=Math.min(99,memory.interactions+1)}
 }else if(personality==='curious'&&interest){result.intent='investigate';result.direction=interest.x>hip.x?1:-1}
 else{result.intent='wander';result.direction=Math.floor(((tick||0)+parseInt((group.id||'f0').slice(1),10)*19)/160)%2===0?1:-1}
 if(obstacle&&result.direction&&Math.sign(obstacle.x-hip.x)===result.direction&&hip.y>floor-140)result.jump=true;
 if(hip.x<85)result.direction=1;else if(hip.x>2080)result.direction=-1;
 return result;
}
var api={decide:decide,modes:modes,personalities:personalities};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.StickLabInhabitants=api;
})(typeof window!=='undefined'?window:null);
