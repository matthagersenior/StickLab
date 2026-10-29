/* StickLab v0.5.2: procedural, physically actuated two-leg locomotion.
   Input is high-level direction/jump; output adjusts Verlet velocities only.
   Never changes positions, bypasses collisions, or freezes ragdolls mid-air. */
(function(root){'use strict';
function clamp(v,limit){return Math.max(-limit,Math.min(limit,v))}
function finite(n){return typeof n==='number'&&isFinite(n)}
function isSupported(foot,terrain,floor){
 if(!foot)return false;
 var bottom=foot.y+(foot.r||0);
 if(bottom>=floor-15&&bottom<=floor+12)return true;
 for(var i=0;i<(terrain||[]).length&&i<80;i++){
  var b=terrain[i];if(!b||b.kind!=='box'||!b.fixed||!finite(b.w)||!finite(b.h))continue;
  if(Math.abs(b.angle||0)>.1)continue; // rotated platform contact is handled by physics, not this motor
  var top=b.y-b.h/2;
  if(bottom>=top-12&&bottom<=top+14&&foot.x>=b.x-b.w/2-5&&foot.x<=b.x+b.w/2+5)return true;
 }
 return false;
}
function nudgeX(p,amount){if(!p||p.fixed)return;p.px-=clamp(amount,1.2)}
function nudgeY(p,amount){if(!p||p.fixed)return;p.py+=clamp(amount,8)}
function step(group,parts,command,terrain,floor,tick){
 command=command||{};parts=parts||{};
 var hip=parts.hip,chest=parts.chest,head=parts.head,feet=[parts.lf,parts.rf],knees=[parts.lk,parts.rk];
 var status={grounded:false,stepping:false,jumped:false,recovering:false,pushed:false,climbing:false};
 if(!hip||hip.fixed||!feet[0]||!feet[1])return status;
 var left=isSupported(feet[0],terrain,floor),right=isSupported(feet[1],terrain,floor);
 // Fallen residents can get back up from knees, hands or head contact too.
 var braced=isSupported(parts.lk,terrain,floor)||isSupported(parts.rk,terrain,floor)||isSupported(parts.lh,terrain,floor)||isSupported(parts.rh,terrain,floor);
 var toppled=!!(chest&&head&&(chest.y>hip.y-13||head.y>hip.y-36));
 status.grounded=left||right;
 var supported=status.grounded||braced||(toppled&&isSupported(head,terrain,floor));
 var direction=command.direction>0?1:command.direction<0?-1:0;
 if(!supported)return status;
 if(toppled){
  status.recovering=true;
  group.motionState='getting-up';
  var recoveryTick=finite(group.lastRecoveryTick)?group.lastRecoveryTick:-1000;
  if((tick||0)-recoveryTick>=8){
   // Joint velocity corrections only; constraints and collisions do the actual lifting.
   nudgeY(chest,4.4);nudgeY(head,3.2);nudgeY(hip,1.2);
   nudgeY(parts.ls,1.5);nudgeY(parts.rs,1.5);
   nudgeX(chest,clamp(hip.x-chest.x,10)*.075);
   nudgeX(head,clamp(hip.x-head.x,13)*.075);
   group.lastRecoveryTick=tick||0;
  }
  return status;
 }
 group.motionState=direction?'walking':'standing';
 if(!status.grounded)return status;
 var forward=hip.x-hip.px,rate=direction===0?0:direction*2.3;
 nudgeX(hip,clamp((rate-forward)*.14,.34));
 if(chest){
  // Keep upper body from folding over while at least one foot is supporting.
  var lean=clamp(hip.x-chest.x,18);
  nudgeX(chest,clamp(lean*.012,.28)+direction*.12);
 }
 if(direction&&!command.climb){
  status.stepping=true;
  var stride=(tick||0)*.16;
  for(var k=0;k<2;k++){
   var foot=feet[k],knee=knees[k],wave=Math.sin(stride+k*Math.PI);
   // Alternate swing/stance. Lift only a swinging leg; planted foot provides traction.
   nudgeX(foot,direction*(.18+wave*.28));
   if(knee)nudgeX(knee,direction*.16+wave*.18);
   if(wave>.1)nudgeY(foot,wave*.9);
  }
 }else{
  // Gradually brake, preserving fall and collision dynamics.
  nudgeX(hip,clamp(-forward*.12,.35));
 }
 var last=finite(group.lastJumpTick)?group.lastJumpTick:-1000;
 if(command.climb&&direction){
  status.climbing=true;group.motionState='climbing';
  var climbTick=finite(group.lastClimbTick)?group.lastClimbTick:-1000;
  if((tick||0)-climbTick>=5){
   // Pull through the existing ragdoll joints. The hand-to-ledge hinge is
   // created by the game layer; these are velocity changes, never teleports.
   nudgeY(parts.hip,2.2);nudgeY(chest,2.8);
   nudgeY(parts.ls,2.4);nudgeY(parts.rs,2.4);
   nudgeY(parts.lh,3.1);nudgeY(parts.rh,3.1);
   nudgeY(parts.lk,1.3);nudgeY(parts.rk,1.3);
   nudgeX(parts.hip,direction*.72);nudgeX(chest,direction*.42);
   group.lastClimbTick=tick||0;
  }
 }
 // A grounded helper nudges a nearby free object, transferring momentum by contact.
 var target=null,near=terrain||[];
 if(direction&&finite(command.pushTargetId)){
  for(var t=0;t<near.length&&t<32;t++){if(near[t]&&near[t].id===command.pushTargetId){target=near[t];break}}
 }
 var lastPush=finite(group.lastPushTick)?group.lastPushTick:-1000;
 if(target&&!target.fixed&&(target.kind==='ball'||target.kind==='wheel'||target.kind==='box')&&
    Math.abs(target.x-hip.x)<=(target.r||Math.max(target.w||0,target.h||0)/2||20)+44&&
    Math.abs(target.y-hip.y)<=(target.r||Math.max(target.w||0,target.h||0)/2||20)+38&&
    (target.x-hip.x)*direction>=-8&&(tick||0)-lastPush>=18){
   nudgeX(target,direction*1.2);nudgeX(hip,-direction*.14);
   nudgeX(chest,-direction*.1);
   status.pushed=true;group.lastPushTick=tick||0;group.motionState='pushing';
 }
 if(command.jump&&tick-last>=48){
  // Reaction is an impulse to body velocities, not a position teleport.
  nudgeY(hip,6.7);nudgeY(chest,5.6);
  feet.forEach(function(foot){nudgeY(foot,3.3)});
  knees.forEach(function(knee){nudgeY(knee,3.8)});
  group.lastJumpTick=tick;status.jumped=true;
 }
 return status;
}
var api={step:step,isSupported:isSupported};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.StickLabLocomotion=api;
})(typeof window!=='undefined'?window:null);
