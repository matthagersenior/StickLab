/* StickLab v0.3 machine mechanics - tiny, deterministic, dependency-free. */
(function(root){'use strict';
function dist(a,b){var dx=b.x-a.x,dy=b.y-a.y;return Math.sqrt(dx*dx+dy*dy)}
function anchorPoint(p,x,y){var a=p.angle||0,c=Math.cos(a),s=Math.sin(a);return{x:p.x+x*c-y*s,y:p.y+x*s+y*c}}
function broken(link,a,b){
 if(!link||!link.breakable||!(link.strength>0)||!a||!b)return false;
 var tension;
 if(link.type==='hinge'){
  var x=anchorPoint(a,link.ax||0,link.ay||0),y=anchorPoint(b,link.bx||0,link.by||0);
  tension=dist(x,y);
 }else{
  tension=Math.max(0,dist(a,b)-link.len);
 }
 return tension>link.strength;
}
function materialHealth(name){return name==='steel'?240:name==='rubber'?160:90}
function impact(body,relativeSpeed){
 if(!body||body.fixed||body.kind!=='box'||!(relativeSpeed>10))return false;
 if(!isFinite(body.hp))body.hp=materialHealth(body.material);
 body.hp-=Math.min(80,(relativeSpeed-10)*3);
 return body.hp<=0;
}
function motorStep(wheel,floor,throttle){
 if(!wheel||wheel.kind!=='wheel'||!wheel.motor||wheel.fixed)return false;
 throttle=throttle===undefined?1:throttle;
 // A powered wheel accelerates near the ground. Angular movement stays visual/physical;
 // the motion model deliberately avoids expensive rigid-body contact impulses.
 var grounded=wheel.y+(wheel.r||0)>=floor-14;
 var speed=(wheel.motorDirection===-1?-1:1)*Math.max(.2,Math.min(2,wheel.motorPower||1))*throttle;
 wheel.pa=wheel.angle||0;wheel.angle=(wheel.angle||0)+speed*.075;
 if(grounded)wheel.px-=speed*.25;
 return grounded;
}
var api={broken:broken,materialHealth:materialHealth,impact:impact,motorStep:motorStep};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.StickLabMachines=api;
})(typeof window!=='undefined'?window:null);
