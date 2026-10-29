/* StickLab v0.3 physics challenges: goals are measured by simulated body positions. */
(function(root){'use strict';
var levels=[
 {id:'first-push',title:'01 · First Push',brief:'Move the blue target ball into the green goal. Any physical solution counts.',hint:'Drop another ball behind the target, use a box as a pusher, or build a motor cart.',start:{x:600,y:905},goal:{x:1080,y:848,w:125,h:86},blocks:[]},
 {id:'bridge-the-gap',title:'02 · Bridge the Gap',brief:'Get the target ball from the raised platform into the goal.',hint:'Place more beams and use falling objects to launch or guide the ball.',start:{x:615,y:700},goal:{x:1260,y:846,w:120,h:88},blocks:[{x:615,y:790,w:240,h:20,fixed:true}]},
 {id:'over-the-wall',title:'03 · Over the Wall',brief:'Move the ball into the goal beyond an immovable wall.',hint:'Lift, redirect or launch it. A ramp and a falling weight can work.',start:{x:620,y:905},goal:{x:1420,y:846,w:125,h:88},blocks:[{x:1030,y:855,w:30,h:150,fixed:true}]},
 {id:'double-gate',title:'04 · Double Gate',brief:'Get the target ball past two fixed gates and into the goal.',hint:'Build a launcher or powered pusher with enough reach to clear both gates. Any physical solution counts.',start:{x:520,y:905},goal:{x:1690,y:846,w:135,h:88},blocks:[{x:920,y:895,w:48,h:70,fixed:true},{x:1320,y:895,w:48,h:70,fixed:true}]}
];
function insideGoal(part,goal){
 if(!part||!goal||!isFinite(part.x)||!isFinite(part.y))return false;
 var r=part.r||0;
 return part.x-r>=goal.x&&part.x+r<=goal.x+goal.w&&part.y-r>=goal.y&&part.y+r<=goal.y+goal.h;
}
function advance(part,level,frames){
 if(!level||!insideGoal(part,level.goal))return 0;
 var vx=part.x-part.px,vy=part.y-part.py;
 return Math.hypot(vx,vy)<4?Math.min(12,(frames||0)+1):0;
}
var api={levels:levels,insideGoal:insideGoal,advance:advance,requiredFrames:12};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.StickLabLevels=api;
})(typeof window!=='undefined'?window:null);
