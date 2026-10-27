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
 var hip=parts.hip,chest=parts.chest,feet=[parts.lf,parts.rf],knees=[parts.lk,parts.rk];
 var status={grounded:false,stepping:false,jumped:false};
 if(!hip||hip.fixed||!feet[0]||!feet[1])return status;
 var left=isSupported(feet[0],terrain,floor),right=isSupported(feet[1],terrain,floor);
 status.grounded=left||right;
 var direction=command.direction>0?1:command.direction<0?-1:0;
 if(!status.grounded)return status;
 var forward=hip.x-hip.px,rate=direction===0?0:direction*2.3;
 nudgeX(hip,clamp((rate-forward)*.14,.34));
 if(chest){
  // Keep upper body from folding over while at least one foot is supporting.
  var lean=clamp(hip.x-chest.x,18);
  nudgeX(chest,clamp(lean*.012,.28)+direction*.12);
 }
 if(direction){
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
