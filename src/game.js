/* StickLab 0.4 — dependency-free, offline-capable 2D physics sandbox.
   All positions and physics are expressed in world pixels. */
(function(){'use strict';
var $=function(id){return document.getElementById(id)};
// Small polyfills help on older browsers with Canvas but incomplete ES2015 support.
if(!Math.hypot)Math.hypot=function(){var s=0;for(var i=0;i<arguments.length;i++)s+=arguments[i]*arguments[i];return Math.sqrt(s)};
if(!Number.isFinite)Number.isFinite=function(n){return typeof n==='number'&&isFinite(n)};
if(!Number.isSafeInteger)Number.isSafeInteger=function(n){return Number.isFinite(n)&&Math.floor(n)===n&&Math.abs(n)<=9007199254740991};
if(!Array.prototype.includes)Array.prototype.includes=function(x){return this.indexOf(x)!==-1};
if(typeof NodeList!=='undefined'&&!NodeList.prototype.forEach)NodeList.prototype.forEach=Array.prototype.forEach;
var Core=window.StickLabCore,Machines=window.StickLabMachines,Levels=window.StickLabLevels,Brain=window.StickLabInhabitants,Locomotion=window.StickLabLocomotion;if(!Core||!Machines||!Levels||!Brain||!Locomotion)throw Error('StickLab simulation modules were not loaded');
var canvas=$('canvas'),ctx=canvas.getContext('2d'),stage=$('stage');
var W=2200,H=1150,FLOOR=930,STEP=1/60;
var world={parts:[],links:[],groups:[],next:1,title:'The Playground',aiEnabled:true};var partIndex={};
var options={gravity:780,speed:1,bounce:.35,quality:'auto',material:'wood'};
var limits={eco:{objects:85,iterations:3,dpr:1,agents:2,think:30},standard:{objects:180,iterations:5,dpr:1.5,agents:5,think:18},high:{objects:320,iterations:7,dpr:2,agents:8,think:12}};
var profile='standard',lowFpsSec=0,challenge=null,sandboxResume=null,unlocked=1,gameMode='sandbox',gameReturn=null;
var GAME_MODES=[
 {id:'sandbox',name:'Free Sandbox',summary:'No required objective'},
 {id:'puzzles',name:'Physics Puzzles',summary:'Choose an optional physics challenge'},
 {id:'engineering',name:'Engineering Lab',summary:'Build wheels, motors and machines'},
 {id:'chaos',name:'Ragdoll Chaos',summary:'Explore ragdoll impact and destruction'},
 {id:'living',name:'Living World',summary:'Explore a world of autonomous stick figures'}
];
try{unlocked=Math.max(1,Math.min(Levels.levels.length,parseInt(localStorage.getItem('sticklab_challenge_unlocks_v03'),10)||1))}catch(e){}
var cam={x:900,y:660,z:1};var width=700,height=500,dpr=1;
var state={linkPoint:null,collisionCandidates:0,tick:0,tool:'grab',paused:false,selected:null,linkStart:null,drag:null,pan:null,keys:{left:false,right:false,jump:false},lastJump:0,lastFrame:0,acc:0,fps:60,frames:0,fpsTime:0,noticeTimer:0,undo:[],pointerCoords:null};
var COLORS={ink:'#182a3b',aqua:'#209f94',pink:'#e7887c',orange:'#e9a466',violet:'#8576b9',gray:'#8396a3'};
var toolHints={grab:'<b>Grab & play.</b> Drag objects to move them. Drag empty space to pan.',figure:'<b>Figure.</b> Tap anywhere to drop a passive physics ragdoll.',goto:'<b>Walk.</b> Tap a destination on the playfield to send the nearest figure there. Held objects travel with the resident; shared holders travel together. Press Grab to cancel.',living:'<b>Living figure.</b> Place an independent resident that wanders, notices danger, and can help experiments.',box:'<b>Box.</b> Tap to place a solid, stackable crate.',ball:'<b>Ball.</b> Tap to create a bouncy physics ball.',anchor:'<b>Anchor.</b> Tap to place a fixed connection point.',rope:'<b>Rope.</b> Tap one object, then another to connect them.',spring:'<b>Spring.</b> Tap two objects to make a stretchy link.',hinge:'<b>Hinge.</b> Tap two bodies to attach a rotating joint.',detach:'<b>Detach.</b> Tap any rope, spring or hinge to remove just that connection. Tap a purple anchor to release all its ropes, springs and hinges without deleting it.',wheel:'<b>Wheel.</b> Place a rolling circular wheel.',cart:'<b>Motor Cart.</b> Spawn a two-wheel powered vehicle.',motor:'<b>Motor.</b> Tap a wheel to cycle forward, reverse, or off.',erase:'<b>Erase.</b> Tap an object to remove it.'};
function toast(s){var n=$('notice');n.textContent=s;n.classList.add('show');clearTimeout(state.noticeTimer);state.noticeTimer=setTimeout(function(){n.classList.remove('show')},1900)}
function uid(){return world.next++}
function part(kind,x,y,opts){opts=opts||{};var p={id:uid(),kind:kind,x:x,y:y,px:x,py:y,w:opts.w||0,h:opts.h||0,r:opts.r||0,angle:0,pa:0,fixed:!!opts.fixed,group:opts.group||null,color:opts.color||COLORS.ink,material:opts.material||'wood',hp:opts.hp||Machines.materialHealth(opts.material||'wood'),motor:!!opts.motor,motorDirection:1,motorPower:1};setMass(p);world.parts.push(p);partIndex[p.id]=p;return p}
function setMass(p){p.inv=p.fixed?0:1/(p.kind==='box'?Math.max(8,(p.w*p.h)/125):Math.max(3,p.r*p.r/50));p.iin=p.kind==='box'&&!p.fixed?12*p.inv/(p.w*p.w+p.h*p.h):0}
function link(a,b,type,length,stiffness){if(!a||!b||a.id===b.id)return null;var l={id:uid(),a:a.id,b:b.id,type:type,len:length==null?Math.hypot(a.x-b.x,a.y-b.y):length,k:stiffness==null?1:stiffness,breakable:type==='rope'||type==='spring',strength:type==='rope'?85:110};world.links.push(l);return l}
function figure(x,y,living){if(!room(14))return null;var group='f'+uid();var defs={head:[0,-79,13],neck:[0,-55,4],chest:[0,-33,6],hip:[0,2,6],ls:[-16,-47,5],rs:[16,-47,5],le:[-27,-22,4],re:[27,-22,4],lh:[-30,5,5],rh:[30,5,5],lk:[-13,38,5],rk:[13,38,5],lf:[-17,76,6],rf:[17,76,6]};var nodes={};Object.keys(defs).forEach(function(k){var v=defs[k];nodes[k]=part('joint',x+v[0],y+v[1],{r:v[2],group:group,color:COLORS.ink})});
 var bones=[['head','neck'],['neck','chest'],['chest','hip'],['chest','ls'],['chest','rs'],['ls','le'],['rs','re'],['le','lh'],['re','rh'],['hip','lk'],['hip','rk'],['lk','lf'],['rk','rf'],['ls','rs'],['chest','lk'],['chest','rk'],['ls','hip'],['rs','hip']];bones.forEach(function(pair,i){link(nodes[pair[0]],nodes[pair[1]],i<13?'bone':'brace',null,.88)});var serial=parseInt(group.slice(1),10)||0,names=['Pip','Nova','Rook','Echo','Dot','Moss','June','Spar'],traits=['curious','cautious','helpful'];
 world.groups.push({id:group,nodes:Object.keys(nodes).map(function(k){return nodes[k].id}),hip:nodes.hip.id,head:nodes.head.id,alive:true,ai:!!living,name:names[serial%names.length]+' '+serial,personality:traits[serial%3],mode:living?'wander':'rest',memory:{hazards:0,lastHazardX:null,interactions:0}});return nodes.hip}
function resident(x,y){return figure(x,y,true)}
function countEntities(){return world.parts.filter(function(p){return !p.group}).length+world.groups.length}
function room(n){if(world.parts.length+n<=limits[profile].objects)return true;toast('Object limit reached · choose a higher performance profile');return false}
function block(x,y,w,h,fixed,color){if(!room(1))return null;return part('box',x,y,{w:w||68,h:h||48,fixed:fixed,color:color||COLORS.orange,material:options.material})}
function ball(x,y,r,color){if(!room(1))return null;return part('ball',x,y,{r:r||25,color:color||COLORS.aqua})}
function anchor(x,y){if(!room(1))return null;return part('anchor',x,y,{r:9,fixed:true,color:COLORS.violet})}
function wheel(x,y,powered){if(!room(1))return null;return part('wheel',x,y,{r:27,color:COLORS.ink,material:'rubber',motor:!!powered})}
function cart(x,y){if(!room(3))return null;var chassis=block(x,y-25,135,26,false,'#657c91'),left=wheel(x-47,y+6,true),right=wheel(x+47,y+6,true);if(!chassis||!left||!right)return null;[left,right].forEach(function(w){world.links.push({id:uid(),a:chassis.id,b:w.id,type:'hinge',len:0,k:.92,ax:w.x-chassis.x,ay:w.y-chassis.y,bx:0,by:0,breakable:false,strength:90})});return chassis}
function forgetHistory(){state.undo=[]}
function pushHistory(){try{state.undo.push(JSON.stringify(world));if(state.undo.length>18)state.undo.shift()}catch(e){}}
function undo(){if(!state.undo.length){toast('Nothing to undo yet');return}try{var restoreChallenge=challenge?{index:challenge.index,targetId:challenge.targetId,frames:0,won:false}:null;assignWorld(JSON.parse(state.undo.pop()),false);if(restoreChallenge&&findPart(restoreChallenge.targetId)){challenge=restoreChallenge;updateChallenges()}toast('Last change undone')}catch(e){toast('Undo unavailable')}}
function findPart(id){return partIndex[id]||null}
function rebuildIndex(){partIndex={};for(var i=0;i<world.parts.length;i++)partIndex[world.parts[i].id]=world.parts[i]}
function findGroup(id){for(var i=0;i<world.groups.length;i++)if(world.groups[i].id===id)return world.groups[i];return null}
function erase(p){if(!p)return;pushHistory();var group=p.group,remove={};if(group){var g=findGroup(group);if(g){g.nodes.forEach(function(n){remove[n]=1});world.groups=world.groups.filter(function(v){return v.id!==group})}}else remove[p.id]=1;world.parts=world.parts.filter(function(v){return !remove[v.id]});world.groups.forEach(function(v){if(remove[v.graspIgnoreTargetId])v.graspIgnoreTargetId=null});rebuildIndex();world.links=world.links.filter(function(v){return !remove[v.a]&&!remove[v.b]});state.selected=null;state.linkStart=null;updateCounts();updateResidents()}
function updateCounts(){$('objectCount').textContent=countEntities();$('fps').textContent=Math.round(state.fps);updateResidents()}
function selectedResident(){var p=findPart(state.selected);return p&&p.group?findGroup(p.group):null}
function updateControlHint(){
 var label=$('controlHint');if(!label)return;
 var selected=selectedResident(),walker=null;
 for(var i=0;i<world.groups.length;i++){
  if(world.groups[i].ai&&world.groups[i].mode==='go'){walker=world.groups[i];break}
 }
 if(state.tool==='goto')label.textContent='📍 Tap where '+(selected?selected.name:'the figure')+' should walk';
 else if(selected)label.textContent='Controlling: '+(selected.name||'Figure');
 else if(walker){
  var name=walker.name||'Figure';
  label.textContent=walker.intent==='waiting'?'🤝 '+name+' waiting for the carrying partner':
   walker.intent==='blocked'?'⚠ '+name+(helpingGraspTargetId(walker)?' carrying object':'')+' route blocked · move the wall or choose another destination':
   walker.intent==='hop'?'↑ '+name+' hopping over a low obstacle':
   walker.intent==='retry'?'↻ '+name+' retrying movement':
   helpingGraspTargetId(walker)?'📍 '+name+' carrying an object to destination':'📍 '+name+' walking to destination';
  if(walker.routePlan&&walker.routePlan.barriers&&walker.routePlan.barriers.length&&!/hopping|retrying|blocked|waiting/.test(label.textContent))label.textContent+=' · '+walker.routePlan.barriers.length+' hop'+(walker.routePlan.barriers.length===1?'':'s')+' planned';
 }else label.textContent='Arrows select a figure';
 var pad=$('controlpad');if(pad)pad.classList.toggle('hidden',!selected&&!walker);
}
function updateResidents(){
 var panel=$('residentStatus'),g=selectedResident(),active=world.groups.filter(function(a){return a.ai}).length;
 $('aiEnabled').checked=world.aiEnabled;
 if(g&&g.ai){panel.textContent=g.name+' · '+g.personality+' · '+(g.dropNoticeUntil>state.tick?'Just dropped an object':g.motionState==='getting-up'?'Getting up':g.motionState==='pushing'?'Pushing nearby object':g.motionState==='sharing'?'Sharing an object':g.motionState==='carrying'?'Carrying an object':g.motionState==='grasping'?'Holding an object':g.intent||g.mode)+(world.aiEnabled?'':' · AI paused');$('residentMode').value=g.mode}
 else panel.textContent=active+' living figure'+(active===1?'':'s')+(world.aiEnabled?' · '+Math.min(active,limits[profile].agents)+' thinking ('+profile+')':' · AI off')+(g?' · passive ragdoll selected':'');
 $('releaseResident').disabled=!g;
 $('dropObject').disabled=!g||!helpingGraspLink(g);
 $('residentMode').disabled=!g||!g.ai;
 $('applyResidentMode').disabled=!g||!g.ai;
 $('goHere').disabled=false;
 updateControlHint();
}
function setLivingAI(on){world.aiEnabled=!!on;if(!world.aiEnabled)world.groups.forEach(function(g){releaseHelpingGrasp(g);g.brain=null});updateResidents();return world.aiEnabled}
function releaseResident(){var g=selectedResident();if(g)g.brain=null;state.selected=null;state.drag=null;updateResidents()}
function chooseResident(id){var g=findGroup(id);if(!g)return false;g.brain=null;state.selected=g.hip;state.drag=null;updateResidents();return true}
function changeResidentMode(id,mode){var g=findGroup(id);if(!g||!g.ai||Brain.modes.indexOf(mode)<0||(mode==='go'&&typeof g.targetX!=='number'))return false;if(mode!=='help')releaseHelpingGrasp(g);if(mode==='help')g.graspIgnoreTargetId=null;g.mode=mode;g.intent=mode;if(mode!=='go')g.targetX=null;g.navigation=null;g.brain=null;updateResidents();return true}
function releaseFigureConnections(g,preserveGrasp){
 if(!g)return 0;
 var ids=g.nodes;
 var removable=world.links.filter(function(l){
  if(['rope','spring','hinge'].indexOf(l.type)<0)return false;
  if(preserveGrasp&&l.graspOwner===g.id)return false;
  var a=ids.indexOf(l.a)>=0,b=ids.indexOf(l.b)>=0;
  return a!==b; // Only outside connectors, never the skeleton or internal joints.
 });
 if(!removable.length)return 0;
 if(removable.some(function(l){return l.graspOwner===g.id})){if(g.intent==='grasp')g.intent=g.mode;g.motionState='standing';g.brain=null}
 pushHistory();
 var remove={};removable.forEach(function(l){remove[l.id]=true});
 world.links=world.links.filter(function(l){return !remove[l.id]});
 updateCounts();return removable.length;
}
function helpingGraspLink(g){
 if(!g)return null;
 for(var i=0;i<world.links.length;i++)if(world.links[i].graspOwner===g.id)return world.links[i];
 return null;
}
function helpingGraspTargetId(g){
 var l=helpingGraspLink(g);if(!l)return null;
 return g.nodes.indexOf(l.a)>=0?l.b:l.a;
}
function helpingGraspCount(targetId){
 if(targetId==null)return 0;
 var count=0;for(var i=0;i<world.links.length;i++){var l=world.links[i];if(l.graspOwner&&(l.a===targetId||l.b===targetId))count++}
 return count;
}
function releaseHelpingGrasp(g,preserveBrain){
 if(!g)return false;
 var releasedTarget=helpingGraspTargetId(g);
 var before=world.links.length;
 world.links=world.links.filter(function(l){return l.graspOwner!==g.id});
 if(world.links.length!==before){if(g.intent==='grasp')g.intent=g.mode;g.motionState='standing';if(!preserveBrain)g.brain=null;
  for(var i=0;i<world.links.length;i++)if(world.links[i].graspOwner&&(world.links[i].a===releasedTarget||world.links[i].b===releasedTarget)){var teammate=findGroup(world.links[i].graspOwner);if(teammate&&teammate.motionState==='sharing')teammate.motionState='grasping'}
  updateCounts()}
 return world.links.length!==before;
}
function dropHelpingObject(g){
 if(!g)return false;
 var targetId=helpingGraspTargetId(g);if(targetId==null)return false;
 g.graspIgnoreTargetId=targetId;g.dropNoticeUntil=state.tick+120;releaseHelpingGrasp(g);g.brain=null;
 toast(g.name+' dropped the object');updateResidents();return true;
}
function maintainHelpingGrasp(g,command){
 if(!g||!command)return false;
 var existing=helpingGraspLink(g),targetId=existing?helpingGraspTargetId(g):null;
 if(existing){
  var held=findPart(targetId);
  if(world.aiEnabled&&g.ai&&held&&Brain.isGraspable(held)){
   if(g.mode==='go'){command.pushTargetId=null;command.graspTargetId=targetId;return true}
   if(g.mode==='rest'){command.direction=0;command.jump=false;command.pushTargetId=null;command.intent='grasp';command.graspTargetId=targetId;return true}
   if(g.mode==='help'&&command.graspTargetId===targetId){command.direction=0;command.jump=false;command.pushTargetId=null;command.intent='grasp';return true}
  }
  releaseHelpingGrasp(g,true);
 }
 if(g.graspIgnoreTargetId!=null){
  var ignored=findPart(g.graspIgnoreTargetId),partsNear=motionParts(g),distance=ignored&&partsNear?Math.hypot(ignored.x-partsNear.hip.x,ignored.y-partsNear.hip.y):Infinity;
  if(!ignored||distance>145)g.graspIgnoreTargetId=null;
  else if(command.graspTargetId===g.graspIgnoreTargetId)command.graspTargetId=null;
 }
 if(g.graspCooldownUntil>state.tick)return false;
 if(!world.aiEnabled||!g.ai||g.mode!=='help'||!command.graspTargetId)return false;
 var target=findPart(command.graspTargetId),parts=motionParts(g);
 if(!target||!Brain.isGraspable(target)||!parts||world.links.length>=800)return false;
 // At most two distinct residents can share a hold on one light object.
 if(helpingGraspCount(target.id)>=2)return false;
 var hands=[parts.lh,parts.rh],hand=null,best=Infinity,contact=null;
 for(var i=0;i<hands.length;i++)if(hands[i]){
  var distance,point=null;
  if(target.kind==='ball')distance=Math.hypot(hands[i].x-target.x,hands[i].y-target.y)-target.r;
  else{var local=toLocal(target,hands[i].x,hands[i].y),bx=Math.max(-target.w/2,Math.min(target.w/2,local.x)),by=Math.max(-target.h/2,Math.min(target.h/2,local.y));distance=Math.hypot(local.x-bx,local.y-by);point={x:bx,y:by}}
  if(distance<best){best=distance;hand=hands[i];contact=point}
 }
 if(!hand||best>hand.r+12)return false;
 // Balls use a soft center tether; boxes use a local surface hinge. Both remain physical.
 if(target.kind==='ball')world.links.push({id:uid(),a:hand.id,b:target.id,type:'spring',len:Math.max(8,hand.r+target.r-2),k:.12,breakable:true,strength:130,graspOwner:g.id});
 else world.links.push({id:uid(),a:hand.id,b:target.id,type:'hinge',len:0,k:.18,ax:0,ay:0,bx:contact.x,by:contact.y,breakable:true,strength:95,graspOwner:g.id});
 command.direction=0;command.jump=false;command.pushTargetId=null;command.intent='grasp';
 return true;
}
function unhookFigure(id){
 var g=id?findGroup(id):selectedResident();
 if(!g){if(!prepareWalking())return 0;g=selectedResident()}
 var count=releaseFigureConnections(g);
 toast(count?'Unhooked '+g.name+' · '+count+' connection'+(count===1?'':'s')+' released. Undo to restore.':g.name+' is already free · use Walk or Grab');
 updateResidents();return count;
}
function setResidentTarget(id,x){
 var g=findGroup(id);
 if(!g||typeof x!=='number'||!isFinite(x)||x<0||x>W)return false;
 // Shared holders receive one coordinated destination and keep their physical grip.
 var heldTarget=helpingGraspTargetId(g),team=[g];
 if(heldTarget!=null&&helpingGraspCount(heldTarget)>1){
  world.links.forEach(function(l){if(l.graspOwner&&team.every(function(member){return member.id!==l.graspOwner})){var member=findGroup(l.graspOwner);if(member&&helpingGraspTargetId(member)===heldTarget)team.push(member)}});
 }
 // Keep the shared object near the requested point, with its holders on either side.
 team.sort(function(a,b){var pa=findPart(a.hip),pb=findPart(b.hip);return (pa?pa.x:0)-(pb?pb.x:0)});
 for(var i=0;i<team.length;i++){
  var member=team[i];releaseFigureConnections(member,true);
  var offset=team.length>1?(i-(team.length-1)/2)*44:0;
  member.ai=true;member.mode='go';member.targetX=Math.max(30,Math.min(W-30,x+offset));member.teamCarryTargetId=team.length>1?heldTarget:null;member.brain=null;member.navigation=null;member.routePlan=null;member.intent='go';
 }
 // Choosing Walk is an explicit request to animate; never leave it silently paused.
 world.aiEnabled=true;state.paused=false;updatePause();
 state.selected=null;state.drag=null;updateResidents();
 if(heldTarget!=null)toast(team.length>1?'Team carrying object to destination':g.name+' walking with held object');
 return true;
}
function motionParts(g){
 var ids=g.nodes,at=function(i){return findPart(ids[i])};
 // Stored v1–v4 figure nodes retain this canonical head/torso/hip/knee/foot order.
 if(ids.length<14)return null;
 return {head:at(0),chest:at(2),hip:findPart(g.hip)||at(3),ls:at(4),rs:at(5),lh:at(8),rh:at(9),lk:at(10),rk:at(11),lf:at(12),rf:at(13)};
}
function driveFigure(g,command){
 var parts=motionParts(g);if(!parts)return;
 var nearby=[];
 for(var i=0;i<world.parts.length&&nearby.length<20;i++){
  var p=world.parts[i];if(!p.group&&Math.abs(p.x-parts.hip.x)<180&&Math.abs(p.y-parts.hip.y)<190&&
    (p.kind==='box'||p.kind==='ball'||p.kind==='wheel'))nearby.push(p);
 }
 return Locomotion.step(g,parts,command,nearby,FLOOR,state.tick);
}
function ensureControlledFigure(){
 var selected=selectedResident();if(selected)return selected;
 var best=null,bestScore=Infinity;
 for(var i=0;i<world.groups.length;i++){var g=world.groups[i],hip=findPart(g.hip);if(!hip||hip.fixed)continue;
  var visible=Math.abs(hip.x-cam.x)<width/(2*cam.z)&&Math.abs(hip.y-cam.y)<height/(2*cam.z);
  var score=(visible?0:600)+(g.ai?0:160)+Math.hypot(hip.x-cam.x,hip.y-cam.y)*.25;
  if(score<bestScore){best=g;bestScore=score}
 }
 if(!best){toast('Place a Resident or Ragdoll to use the arrows');return null}
 releaseHelpingGrasp(best);state.selected=best.hip;state.drag=null;state.pan=null;setTool('grab');
 var controlled=findPart(best.hip);cam.x=controlled.x;cam.y=controlled.y-80;
 updateResidents();toast('Controlling '+(best.name||'Figure')+' · hold arrows to move');
 return best;
}
function isCompactLayout(){return window.matchMedia?window.matchMedia('(max-width: 690px), (max-width: 1180px) and (pointer: coarse)').matches:window.innerWidth<=690}
function prepareWalking(){
 if(selectedResident())return true;
 var nearest=null,score=Infinity;
 for(var i=0;i<world.groups.length;i++){
  var group=world.groups[i],hip=findPart(group.hip);
  if(!hip||hip.fixed)continue;
  var onScreen=Math.abs(hip.x-cam.x)<=width/(2*cam.z)&&Math.abs(hip.y-cam.y)<=height/(2*cam.z);
  var d=(onScreen?0:2000)+Math.hypot(hip.x-cam.x,hip.y-cam.y);
  if(d<score){nearest=group;score=d}
 }
 if(!nearest){toast('Place a Resident or Ragdoll first, then tap Walk');return false}
 state.selected=nearest.hip;state.drag=null;state.pan=null;
 updateResidents();return true;
}
function setTool(name){if(!toolHints[name])return;if(name==='goto'&&!prepareWalking())return;state.tool=name;state.linkStart=null;state.linkPoint=null;document.querySelectorAll('[data-tool]').forEach(function(b){var active=b.dataset.tool===name;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false')});updateToolHint();updateControlHint();if(isCompactLayout())$('sidebar').classList.remove('open');if(name==='goto')toast('Tap your destination · press Grab to cancel')}
function updatePause(){
 $('pause').textContent=state.paused?'▶ Play':'Ⅱ Pause';
 var mode=GAME_MODES.filter(function(g){return g.id===gameMode})[0]||GAME_MODES[0];
 $('subTitle').textContent=challenge?('🎯 Level '+(challenge.index+1)+' · Ball → goal'+(state.paused?' · Paused':'')):(mode.name+(state.paused?' · Paused':' · '+mode.summary));
 var objective=$('missionObjective');if(objective&&challenge&&!challenge.won)objective.textContent='🎯 Level '+(challenge.index+1)+'/'+Levels.levels.length+': '+Levels.levels[challenge.index].brief+' Keep the blue ball inside the green goal to finish.'+(state.paused?' Simulation paused — press ▶ Play to test your setup.':'');
}
function setProfile(){profile=options.quality==='auto'?((navigator.hardwareConcurrency||2)<4?'eco':'standard'):options.quality;resize()}
function syncLayout(){resize();var compact=isCompactLayout();$('openMenu').classList.toggle('hidden',!compact);if(!compact)$('sidebar').classList.remove('open')}
function resize(){var r=stage.getBoundingClientRect();width=Math.max(100,r.width);height=Math.max(100,r.height);dpr=Math.min(window.devicePixelRatio||1,limits[profile].dpr);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
function defaultCamera(){cam.x=900;cam.y=660;cam.z=Math.max(.38,Math.min(1.25,width/(width<700?850:1080),height/680));updateCameraFeedback()}
function updateCameraFeedback(){var label=$('cameraFeedback');if(label)label.textContent=Math.round(cam.z*100)+'%'}
function worldPoint(cx,cy){var r=canvas.getBoundingClientRect();return {x:cam.x+((cx-r.left)-width/2)/cam.z,y:cam.y+((cy-r.top)-height/2)/cam.z}}
function zoom(factor,atX,atY){var before=worldPoint(atX==null?width/2+canvas.getBoundingClientRect().left:atX,atY==null?height/2+canvas.getBoundingClientRect().top:atY);cam.z=Math.max(.24,Math.min(2.5,cam.z*factor));var after=worldPoint(atX==null?width/2+canvas.getBoundingClientRect().left:atX,atY==null?height/2+canvas.getBoundingClientRect().top:atY);cam.x+=before.x-after.x;cam.y+=before.y-after.y;updateCameraFeedback()}
function newWorld(which){var keepAI=world.aiEnabled!==false;if(which!=='empty')sandboxResume=null;challenge=null;world={parts:[],links:[],groups:[],next:1,aiEnabled:keepAI,title:which==='tower'?'Tower Test':which==='chaos'?'Chaos Chamber':which==='empty'?'Blank Canvas':'The Playground'};state.selected=null;state.linkStart=null;state.linkPoint=null;state.drag=null;partIndex={};forgetHistory();
 if(which==='playground'){
 block(770,FLOOR-32,102,64,true,'#aebbb7');block(880,FLOOR-29,60,58,false,COLORS.orange);block(880,FLOOR-91,60,58,false,COLORS.orange);block(954,FLOOR-25,50,50,false,COLORS.orange);figure(670,FLOOR-76);resident(1100,FLOOR-76);
 ball(990,450,32,COLORS.aqua);ball(1090,FLOOR-28,28,COLORS.pink);var a=anchor(1210,248),b=ball(1250,440,29,COLORS.violet);link(a,b,'rope',205,.95);
 block(1415,FLOOR-110,145,18,true,'#aebbb7');
 }else if(which==='tower'){
 for(var i=0;i<8;i++)block(865,FLOOR-25-i*51,102,50,false,i%2?COLORS.orange:COLORS.aqua);
 resident(570,FLOOR-76);resident(1170,FLOOR-76);ball(1170,335,50,COLORS.pink);anchor(1350,280);
 }else if(which==='chaos'){
 for(var j=0;j<4;j++)figure(600+j*145,400-j*35,j<2);
 for(var k=0;k<10;k++)ball(620+k*65,240+(k%3)*62,16+(k%4)*6,k%2?COLORS.pink:COLORS.aqua);
 for(var n=0;n<7;n++)block(700+n*85,680-(n%3)*80,62,48,false,COLORS.orange);
 }else if(which==='engineering'){
 world.title='Engineering Lab';
 block(690,FLOOR-22,215,44,true,'#aebbb7');
 cart(865,FLOOR-55);
 wheel(1110,FLOOR-33,false);
 block(1260,FLOOR-110,170,22,true,'#aebbb7');
 anchor(1270,FLOOR-240);
 block(1435,FLOOR-44,66,88,false,COLORS.orange);
 resident(495,FLOOR-76);figure(1570,FLOOR-76);
 }else if(which==='living'){
 world.title='Living World';world.aiEnabled=true;
 block(690,FLOOR-22,130,44,true,'#aebbb7');
 block(1250,FLOOR-24,160,48,true,'#aebbb7');
 ball(950,FLOOR-29,30,COLORS.aqua);
 ball(1130,FLOOR-25,25,COLORS.pink);
 wheel(1430,FLOOR-28,false);
 resident(610,FLOOR-90);resident(780,FLOOR-90);resident(1170,FLOOR-90);resident(1470,FLOOR-90);
 if(world.groups[0])world.groups[0].mode='help';
 }
 $('worldTitle').textContent=world.title;defaultCamera();updateCounts();updateChallenges();updateResidents();toast(world.title+' loaded')}
function updateToolHint(){var hint=$('hint');if(!hint)return;
 if(challenge){var level=Levels.levels[challenge.index];hint.innerHTML='<b>🎯 LEVEL '+(challenge.index+1)+'/'+Levels.levels.length+': '+(challenge.won?'COMPLETE!': 'Move blue ball to green goal.')+'</b> '+(challenge.won?'Open Levels for the next challenge or return to Free Sandbox.':'Keep the ball completely inside the goal until it settles.')+' <span class="hint-tool">'+(toolHints[state.tool]||'')+'</span>'}
 else hint.innerHTML=toolHints[state.tool]||'';
}
function updateGameModes(){
 var mode=GAME_MODES.filter(function(g){return g.id===gameMode})[0]||GAME_MODES[0];
 document.querySelectorAll('[data-game]').forEach(function(b){
  var active=b.dataset.game===gameMode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false');
 });
 var status=$('gameModeStatus');if(status)status.textContent='Now playing: '+mode.name+' · '+mode.summary;
 updatePause();
}
function refreshPuzzlePicker(){
 document.querySelectorAll('[data-picker-level]').forEach(function(button){
  var index=+button.dataset.pickerLevel,locked=index>=unlocked;
  button.disabled=locked;
  var status=button.querySelector('.level-state');
  if(status)status.textContent=locked?'LOCKED':(challenge&&challenge.index===index&&challenge.won?'SOLVED':'PLAY');
 });
 var label=$('puzzlePickerStatus');
 if(label)label.textContent=unlocked>=Levels.levels.length?'All '+Levels.levels.length+' physics levels are unlocked. Choose any level.':'Level '+unlocked+' is available. Complete it to unlock Level '+(unlocked+1)+'.';
}
function openPuzzlePicker(){
 refreshPuzzlePicker();
 var dialog=$('puzzlePicker');dialog.classList.remove('hidden');dialog.setAttribute('aria-hidden','false');
 $('sidebar').classList.remove('open');
}
function closePuzzlePicker(){
 var dialog=$('puzzlePicker');dialog.classList.add('hidden');dialog.setAttribute('aria-hidden','true');
}
function selectGameMode(which){
 var valid=GAME_MODES.some(function(mode){return mode.id===which});if(!valid)return false;
 if(which==='sandbox'){
  if(challenge)exitChallenge();
  var snapshot=gameReturn;gameReturn=null;
  if(snapshot){
   assignWorld({format:'StickLab',version:4,world:snapshot.world},true);
   state.paused=snapshot.paused;cam.x=snapshot.camera.x;cam.y=snapshot.camera.y;cam.z=snapshot.camera.z;
   updateCameraFeedback();$('worldTitle').textContent=world.title;
  }
  gameMode='sandbox';updateGameModes();updateChallenges();toast('Free Sandbox · your creation is available');return true;
 }
 if(gameMode==='sandbox'&&!gameReturn)gameReturn={world:JSON.parse(JSON.stringify(world)),paused:state.paused,camera:{x:cam.x,y:cam.y,z:cam.z}};
 if(challenge&&which!=='puzzles')exitChallenge();
 if(which==='puzzles'){
  gameMode='puzzles';updateGameModes();updateChallenges();openPuzzlePicker();
  toast('Choose an unlocked physics level to start');
 }else{
  if(which==='engineering')newWorld('engineering');
  else if(which==='chaos')newWorld('chaos');
  else if(which==='living')newWorld('living');
  gameMode=which;state.paused=false;updatePause();updateGameModes();updateChallenges();
  toast(GAME_MODES.filter(function(mode){return mode.id===which})[0].name+' · experiment freely');
 }
 if(isCompactLayout())$('sidebar').classList.remove('open');
 return true;
}
function updateChallenges(){
 var buttons=document.querySelectorAll('[data-level]');buttons.forEach(function(b){var index=+b.dataset.level;b.disabled=index>=unlocked;b.classList.toggle('active',!!challenge&&challenge.index===index)});
 var label=$('challengeStatus');if(label)label.textContent=challenge?(challenge.won?'✓ Level completed! Choose the next or return to your saved sandbox.':Levels.levels[challenge.index].brief+' Keep the blue ball fully inside the green goal until it settles.'):((GAME_MODES.filter(function(m){return m.id===gameMode})[0]||GAME_MODES[0]).name+' · No required win condition. Physics Challenges are optional.');
 var next=$('nextLevel');if(next)next.disabled=!challenge||!challenge.won||challenge.index>=Levels.levels.length-1;
 var objective=$('missionObjective');
 if(objective){objective.classList.toggle('hidden',!challenge);objective.textContent=challenge?(challenge.won?'✓ Level '+(challenge.index+1)+' complete! Choose the next level or return to Free Sandbox.':'🎯 Level '+(challenge.index+1)+'/'+Levels.levels.length+': '+Levels.levels[challenge.index].brief+' Keep the blue ball inside the green goal to finish.') :''}
 var action=$('challengeAction');if(action){action.textContent='🎮 Games';action.setAttribute('aria-label','Choose a game type')}
 updateGameModes();updateToolHint();
}
function loadLevel(index){if(index<0||index>=unlocked||index>=Levels.levels.length)return false;gameMode='puzzles';if(!challenge&&!sandboxResume)sandboxResume={world:JSON.parse(JSON.stringify(world)),paused:state.paused,camera:{x:cam.x,y:cam.y,z:cam.z}};var level=Levels.levels[index];newWorld('empty');state.selected=null;state.drag=null;state.pan=null;state.keys.left=false;state.keys.right=false;state.keys.jump=false;setTool('grab');world.title=level.title;var p=ball(level.start.x,level.start.y,24,'#2676bd');if(!p)throw Error('Not enough room for challenge ball');level.blocks.forEach(function(b){block(b.x,b.y,b.w,b.h,!!b.fixed,'#aebbb7')});challenge={index:index,targetId:p.id,frames:0,won:false};$('worldTitle').textContent=world.title;state.paused=false;updatePause();updateChallenges();updateResidents();toast(level.brief);return true}
function exitChallenge(){if(!challenge)return false;var restore=sandboxResume;sandboxResume=null;if(restore){assignWorld({format:'StickLab',version:4,world:restore.world},true);state.paused=restore.paused;cam.x=restore.camera.x;cam.y=restore.camera.y;cam.z=restore.camera.z;updateCameraFeedback()}else newWorld('playground');challenge=null;gameMode='sandbox';updateGameModes();updateChallenges();toast('Back in Free Sandbox · your world restored');return true}
function completeLevel(){if(!challenge||challenge.won)return;challenge.won=true;unlocked=Math.max(unlocked,Math.min(Levels.levels.length,challenge.index+2));try{localStorage.setItem('sticklab_challenge_unlocks_v03',String(unlocked))}catch(e){}refreshPuzzlePicker();state.paused=true;updatePause();updateChallenges();toast('Physics solved! Level complete 🎉')}
function rotatedOffset(p,x,y){var c=Math.cos(p.angle||0),s=Math.sin(p.angle||0);return{x:x*c-y*s,y:x*s+y*c}}
function toLocal(p,x,y){var c=Math.cos(p.angle||0),s=Math.sin(p.angle||0),dx=x-p.x,dy=y-p.y;return{x:dx*c+dy*s,y:-dx*s+dy*c}}
function hingePoint(p,x,y){var r=rotatedOffset(p,x,y);return{x:p.x+r.x,y:p.y+r.y,rx:r.x,ry:r.y}}
function solveHinge(l,a,b){
 var pa=hingePoint(a,l.ax,l.ay),pb=hingePoint(b,l.bx,l.by),dx=pb.x-pa.x,dy=pb.y-pa.y,dist=Math.hypot(dx,dy);
 if(dist<.00001)return;
 var nx=dx/dist,ny=dy/dist,ra=pa.rx*ny-pa.ry*nx,rb=pb.rx*ny-pb.ry*nx;
 var den=a.inv+b.inv+ra*ra*a.iin+rb*rb*b.iin;if(!den)return;
 var shift=Math.min(45,dist)*Math.min(1,l.k)/den;
 a.x+=nx*shift*a.inv;a.y+=ny*shift*a.inv;a.angle+=ra*shift*a.iin;
 b.x-=nx*shift*b.inv;b.y-=ny*shift*b.inv;b.angle-=rb*shift*b.iin;
}
function solveLink(l){var a=findPart(l.a),b=findPart(l.b);if(!a||!b)return;if(l.type==='hinge'){solveHinge(l,a,b);return;}var dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||.001;if(l.type==='rope'&&dist<=l.len)return;var sum=a.inv+b.inv;if(!sum)return;var magnitude=(dist-l.len)/dist*l.k;var mx=dx*magnitude,my=dy*magnitude;a.x+=mx*a.inv/sum;a.y+=my*a.inv/sum;b.x-=mx*b.inv/sum;b.y-=my*b.inv/sum}
function reach(p){var b=Core.bounds(p);return{x:(b.maxX-b.minX)/2,y:(b.maxY-b.minY)/2}}
function boxContact(a,b){
 var diffX=b.x-a.x,diffY=b.y-a.y,ac=Math.cos(a.angle||0),as=Math.sin(a.angle||0),bc=Math.cos(b.angle||0),bs=Math.sin(b.angle||0);
 var axes=[[ac,as],[-as,ac],[bc,bs],[-bs,bc]],pen=Infinity,nx=0,ny=0;
 for(var i=0;i<4;i++){var x=axes[i][0],y=axes[i][1],dot=diffX*x+diffY*y;
  var ra=(Math.abs(x*ac+y*as)*a.w+Math.abs(-x*as+y*ac)*a.h)/2;
  var rb=(Math.abs(x*bc+y*bs)*b.w+Math.abs(-x*bs+y*bc)*b.h)/2;
  var overlap=ra+rb-Math.abs(dot);if(overlap<=0)return null;
  if(overlap<pen){pen=overlap;nx=dot>=0?x:-x;ny=dot>=0?y:-y}
 }
 return{x:nx,y:ny,pen:pen};
}
function circleBox(box,circle){
 var relative=toLocal(box,circle.x,circle.y),cx=Math.max(-box.w/2,Math.min(relative.x,box.w/2)),cy=Math.max(-box.h/2,Math.min(relative.y,box.h/2));
 var dx=relative.x-cx,dy=relative.y-cy,dist=Math.hypot(dx,dy),nx,ny,pen;
 if(dist>.000001){if(dist>=circle.r)return null;nx=dx/dist;ny=dy/dist;pen=circle.r-dist}
 else{var ex=box.w/2-Math.abs(relative.x),ey=box.h/2-Math.abs(relative.y);if(ex<ey){nx=relative.x>=0?1:-1;ny=0;pen=circle.r+ex}else{nx=0;ny=relative.y>=0?1:-1;pen=circle.r+ey}}
 var r=rotatedOffset(box,nx,ny);return{x:r.x,y:r.y,pen:pen};
}
function collision(a,b){if(a.fixed&&b.fixed||a.group&&a.group===b.group||!Core.aabbOverlap(a,b))return;
 var c;if(a.kind==='box'&&b.kind==='box')c=boxContact(a,b);
 else if(a.kind==='box'||b.kind==='box'){c=a.kind==='box'?circleBox(a,b):circleBox(b,a);if(c&&a.kind!=='box'){c.x=-c.x;c.y=-c.y}}
 else{var dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),total=a.r+b.r;if(d>=total)return;c={x:d?dx/d:1,y:d?dy/d:0,pen:total-d}}
 if(!c||c.pen<=0)return;
 var nx=c.x,ny=c.y,pen=c.pen,wa=a.inv,wb=b.inv,sum=wa+wb;if(!sum)return;
 var avx=a.x-a.px,avy=a.y-a.py,bvx=b.x-b.px,bvy=b.y-b.py;
 var vn=(avx-bvx)*nx+(avy-bvy)*ny;
 var push=pen+0.05;a.x-=nx*push*wa/sum;a.y-=ny*push*wa/sum;b.x+=nx*push*wb/sum;b.y+=ny*push*wb/sum;
 if(vn>10){Machines.impact(a,vn);Machines.impact(b,vn)}
 if(vn>0){var impulse=(1+options.bounce)*vn;avx-=impulse*nx*wa/sum;avy-=impulse*ny*wa/sum;bvx+=impulse*nx*wb/sum;bvy+=impulse*ny*wb/sum}
 a.px=a.x-avx*.991;a.py=a.y-avy*.991;b.px=b.x-bvx*.991;b.py=b.y-bvy*.991;
}
function boundary(p){if(p.fixed)return;var r=reach(p),rx=r.x,ry=r.y;
 var vx=p.x-p.px,vy=p.y-p.py,hit=false;
 if(p.y+ry>FLOOR){p.y=FLOOR-ry;if(vy>0){p.py=p.y+vy*options.bounce;p.px=p.x-vx*.88}hit=true}
 if(p.x-rx<0){p.x=rx;if(vx<0)p.px=p.x+vx*options.bounce;hit=true}
 if(p.x+rx>W){p.x=W-rx;if(vx>0)p.px=p.x+vx*options.bounce;hit=true}
 if(p.y-ry<15){p.y=15+ry;if(vy<0)p.py=p.y+vy*options.bounce;hit=true}
 if(hit&&Math.abs(vy)<.6&&Math.abs(vx)<.3){p.px=p.x;p.py=p.y}
}
function playerInput(){
 var p=findPart(state.selected),g=p&&p.group?findGroup(p.group):null;if(!g)return;
 driveFigure(g,{direction:state.keys.left?-1:state.keys.right?1:0,jump:state.keys.jump});
 state.keys.jump=false;
}
function residentInput(){
 if(!world.aiEnabled)return;
 var cap=limits[profile].agents,rate=limits[profile].think,used=0,chosen=selectedResident();
 for(var n=0;n<world.groups.length&&used<cap;n++){
  var g=world.groups[n];if(!g.ai)continue;used++;
  if(chosen&&chosen.id===g.id)continue;
  var hip=findPart(g.hip);if(!hip||hip.fixed)continue;
  if(!g.brain||state.tick%rate===n%rate){
   var nearby=[],nearbyDistance=[],goal=null;
   // Keep the nearest local geometry, not the first 32 parts in scene order.
   // This preserves a fixed 32-item brain budget while avoiding missed walls
   // in busy scenes where many distant props were created earlier.
   for(var p=0;p<world.parts.length;p++){
    var item=world.parts[p],dx=item.x-hip.x,dy=item.y-hip.y;
    if(item.group||item.kind==='joint'||Math.abs(dx)>270||Math.abs(dy)>210)continue;
    var distance=dx*dx+dy*dy;
    if(nearby.length===32&&distance>=nearbyDistance[31])continue;
    var at=nearby.length;
    if(at===32){nearby.pop();nearbyDistance.pop();at=31}
    while(at>0&&distance<nearbyDistance[at-1])at--;
    nearby.splice(at,0,item);nearbyDistance.splice(at,0,distance);
   }
   if(g.mode==='help'){
    var heldTargetId=helpingGraspTargetId(g);
    if(heldTargetId)goal=findPart(heldTargetId);
    else if(challenge&&!challenge.won)goal=findPart(challenge.targetId);
    else{
     var freeGoal=null;
     for(var b=0;b<nearby.length;b++)if(Brain.isGraspable(nearby[b])){
      var holders=helpingGraspCount(nearby[b].id),near=Math.hypot(nearby[b].x-hip.x,nearby[b].y-hip.y);
      // Invite one nearby helper to a resident's existing grip before assigning a new object.
      if(holders===1&&near<240){goal=nearby[b];break}
      if(holders===0&&!freeGoal)freeGoal=nearby[b];
     }
     if(!goal)goal=freeGoal;
    }
   }
   var previousIntent=g.intent;
   g.brain=Brain.decide(g,hip,nearby,goal,state.tick,FLOOR,findPart(helpingGraspTargetId(g)),world.parts);
   maintainHelpingGrasp(g,g.brain);g.intent=g.brain.intent;
   var carriedId=helpingGraspTargetId(g);
   if(g.mode==='go'&&g.brain.intent==='arrived'&&carriedId!=null&&helpingGraspCount(carriedId)>1){
    var partnerStillMoving=world.groups.some(function(other){if(other.id===g.id||helpingGraspTargetId(other)!==carriedId||other.mode!=='go')return false;var otherHip=findPart(other.hip);return !otherHip||Math.abs((other.targetX||0)-otherHip.x)>26});
    if(partnerStillMoving){g.brain.intent='waiting';g.brain.direction=0;g.intent='waiting'}
   }
   var graspTarget=helpingGraspTargetId(g);
   if(graspTarget)g.motionState=helpingGraspCount(graspTarget)>1?'sharing':g.mode==='go'?'carrying':'grasping';
   if(previousIntent!==g.intent&&(previousIntent==='grasp'||g.intent==='grasp'))updateResidents();
   if(g.mode==='go'&&g.intent!==previousIntent){
    updateControlHint();
    if(g.intent==='blocked')toast((g.name||'Figure')+' is blocked · try a new route or move the obstacle');
   }
   if(g.mode==='go')updateControlHint();
   g.memory=g.brain.memory;
   if(g.brain.activateMotorId){var motor=findPart(g.brain.activateMotorId);if(motor&&motor.kind==='wheel'&&!motor.motor){motor.motor=true;motor.motorDirection=g.brain.direction||1}}
  }
  driveFigure(g,g.brain||{direction:0});
  var heldTarget=helpingGraspTargetId(g);
  if(heldTarget)g.motionState=helpingGraspCount(heldTarget)>1?'sharing':g.mode==='go'?'carrying':'grasping';
  if(g.mode==='go'&&g.brain&&g.brain.intent==='arrived'){
   var held=helpingGraspTargetId(g),team=held!=null&&helpingGraspCount(held)>1?world.groups.filter(function(other){return helpingGraspTargetId(other)===held&&other.mode==='go'}):[g];
   var allArrived=team.every(function(other){var memberHip=findPart(other.hip);return !!memberHip&&Math.abs((other.targetX||0)-memberHip.x)<=26});
   if(allArrived)team.forEach(function(other){other.mode='rest';other.targetX=null;other.navigation=null;other.routePlan=null;other.brain=null;other.intent='arrived';other.teamCarryTargetId=null});
   updateResidents();
  }

 }
}
function simulate(){state.tick++;residentInput();playerInput();
 var i,j,p,iter=limits[profile].iterations;
 for(i=0;i<world.parts.length;i++){p=world.parts[i];if(p.fixed)continue;if(p.kind==='wheel')Machines.motorStep(p,FLOOR,1);var vx=Math.max(-32,Math.min(32,(p.x-p.px)*.997));var vy=Math.max(-32,Math.min(32,(p.y-p.py)*.997));p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy+options.gravity*STEP*STEP;if(p.kind==='box'){var av=Math.max(-.12,Math.min(.12,(p.angle-p.pa)*.995));p.pa=p.angle;p.angle+=av;}if(!Number.isFinite(p.x)||!Number.isFinite(p.y)){p.x=900;p.y=400;p.px=p.x;p.py=p.y}}
 for(j=0;j<iter;j++){
  for(i=0;i<world.links.length;i++)solveLink(world.links[i]);
  if(state.drag&&state.drag.part){var d=state.drag.part;if(!d.fixed){var target=state.drag.target;d.x+=(target.x-d.x)*.44;d.y+=(target.y-d.y)*.44;d.px+=(target.x-d.px)*.15;d.py+=(target.y-d.py)*.15}}
  for(i=0;i<world.parts.length;i++)boundary(world.parts[i]);
  // Spatial grid: test only intersecting AABBs; stable pairs, no duplicate checks.
  var pairs=Core.collisionPairs(world.parts,96);state.collisionCandidates=pairs.length;for(i=0;i<pairs.length;i++)collision(world.parts[pairs[i][0]],world.parts[pairs[i][1]]);
 }
 // Fracture is applied after constraints, never while iterating link/body arrays.
 var brokenOwners=[];
 world.links=world.links.filter(function(l){var broken=Machines.broken(l,findPart(l.a),findPart(l.b));if(broken&&l.graspOwner&&brokenOwners.indexOf(l.graspOwner)<0)brokenOwners.push(l.graspOwner);return !broken});
 brokenOwners.forEach(function(id){var owner=findGroup(id);if(owner){owner.graspCooldownUntil=state.tick+30;owner.dropNoticeUntil=state.tick+120;owner.brain=null;if(owner.intent==='grasp')owner.intent=owner.mode;owner.motionState='standing'}});
 if(brokenOwners.length===1){var dropped=findGroup(brokenOwners[0]);toast((dropped?dropped.name:'A resident')+' lost its grip after a hard pull')}
 else if(brokenOwners.length>1)toast('Residents lost their grip after a hard pull');
 var damaged={},shards=[];world.parts.forEach(function(p){if(p.hp<=0&&p.kind==='box'&&!p.fixed){damaged[p.id]=1;shards.push({x:p.x,y:p.y,color:p.color})}});
 if(shards.length){var lostGrips=[];world.links.forEach(function(l){if(l.graspOwner&&(damaged[l.a]||damaged[l.b])&&lostGrips.indexOf(l.graspOwner)<0)lostGrips.push(l.graspOwner)});world.parts=world.parts.filter(function(p){return !damaged[p.id]});world.links=world.links.filter(function(l){return !damaged[l.a]&&!damaged[l.b]});world.groups.forEach(function(g){if(damaged[g.graspIgnoreTargetId])g.graspIgnoreTargetId=null});lostGrips.forEach(function(id){var owner=findGroup(id);if(owner){owner.graspCooldownUntil=state.tick+30;owner.dropNoticeUntil=state.tick+120;owner.brain=null;if(owner.intent==='grasp')owner.intent=owner.mode;owner.motionState='standing'}});if(lostGrips.length)toast('A held box broke apart');rebuildIndex();shards.slice(0,4).forEach(function(v){for(var d=0;d<2;d++)if(world.parts.length<limits[profile].objects){var bit=part('ball',v.x+(d?10:-10),v.y,{r:7,color:v.color,material:'wood'});bit.px=bit.x+(d?3:-3);bit.py=bit.y+3}})}
 if(challenge&&!challenge.won){var target=findPart(challenge.targetId);challenge.frames=Levels.advance(target,Levels.levels[challenge.index],challenge.frames);if(challenge.frames>=Levels.requiredFrames)completeLevel()}
}
function roundedRect(x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}
function backdrop(){var grad=ctx.createLinearGradient(0,0,0,height);grad.addColorStop(0,'#f8f9f4');grad.addColorStop(1,'#eaf2ee');ctx.fillStyle=grad;ctx.fillRect(0,0,width,height);
 ctx.save();ctx.translate(width/2-cam.x*cam.z,height/2-cam.y*cam.z);ctx.scale(cam.z,cam.z);
 var left=Math.max(0,cam.x-width/(2*cam.z)-80),right=Math.min(W,cam.x+width/(2*cam.z)+80),top=Math.max(0,cam.y-height/(2*cam.z)-80),bottom=Math.min(H,cam.y+height/(2*cam.z)+80);
 ctx.fillStyle='#d5dfd9';for(var x=Math.floor(left/50)*50;x<right;x+=50)for(var y=Math.floor(top/50)*50;y<bottom;y+=50){ctx.beginPath();ctx.arc(x,y,1.25,0,Math.PI*2);ctx.fill()}
 ctx.fillStyle='#dce8df';ctx.fillRect(0,FLOOR,W,H-FLOOR);ctx.strokeStyle='#a3b3aa';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,FLOOR);ctx.lineTo(W,FLOOR);ctx.stroke();
 ctx.strokeStyle='#c2d1c7';ctx.lineWidth=1;for(var xx=Math.floor(left/50)*50;xx<right;xx+=50){ctx.beginPath();ctx.moveTo(xx,FLOOR+12);ctx.lineTo(xx-13,FLOOR+25);ctx.stroke()}
 ctx.fillStyle='#9db3a9';ctx.font='700 12px system-ui';ctx.fillText('GRAVITY TEST FLOOR  /  01',Math.max(35,left+15),FLOOR+47);
 ctx.strokeStyle='#d1ddd4';ctx.lineWidth=2;ctx.strokeRect(0,0,W,H);
 ctx.restore()}
function drawLink(l){if(l.type==='brace')return;var a=findPart(l.a),b=findPart(l.b);if(!a||!b)return;
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';if(l.graspOwner){var start=a,end=b;if(l.type==='hinge'){var hand=a.group===l.graspOwner?a:b,object=hand===a?b:a;start=hand===a?hingePoint(hand,l.ax,l.ay):hingePoint(hand,l.bx,l.by);end=hand===a?hingePoint(object,l.bx,l.by):hingePoint(object,l.ax,l.ay)}ctx.strokeStyle=COLORS.aqua;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.beginPath();ctx.arc((start.x+end.x)/2,(start.y+end.y)/2,4,0,Math.PI*2);ctx.fillStyle='#fffefa';ctx.fill();ctx.restore();return;}if(l.type==='hinge'){var pa=hingePoint(a,l.ax,l.ay),pb=hingePoint(b,l.bx,l.by);ctx.beginPath();ctx.arc((pa.x+pb.x)/2,(pa.y+pb.y)/2,8,0,Math.PI*2);ctx.fillStyle='#fffefa';ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=COLORS.violet;ctx.stroke();ctx.restore();return;}if(l.type==='bone'){ctx.strokeStyle='#273749';ctx.lineWidth=5.6;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
 else if(l.type==='rope'){ctx.strokeStyle='#947f6a';ctx.lineWidth=3;ctx.setLineDash([8,5]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([])}
 else if(l.type==='spring'){var dx=b.x-a.x,dy=b.y-a.y,n=Math.hypot(dx,dy)||1,nx=-dy/n,ny=dx/n;ctx.strokeStyle='#af7cbe';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y);for(var i=1;i<12;i++){var t=i/12,off=(i%2?-1:1)*10;ctx.lineTo(a.x+dx*t+nx*off,a.y+dy*t+ny*off)}ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.restore()}
function drawPart(p){ctx.save();if(p.kind==='box'){ctx.translate(p.x,p.y);ctx.rotate(p.angle||0);var x=-p.w/2,y=-p.h/2;ctx.fillStyle='#d2d7cf';roundedRect(x+4,y+7,p.w,p.h,5);ctx.fill();ctx.fillStyle=p.color;roundedRect(x,y,p.w,p.h,5);ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle='#273749';ctx.stroke();ctx.strokeStyle='#fef9ef66';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+11,y+10);ctx.lineTo(x+p.w-11,y+10);ctx.stroke();ctx.strokeStyle='#27374955';ctx.beginPath();ctx.moveTo(x+12,y+14);ctx.lineTo(x+p.w-12,y+p.h-12);ctx.moveTo(x+p.w-12,y+14);ctx.lineTo(x+12,y+p.h-12);ctx.stroke()}
 else if(p.kind==='ball'||p.kind==='wheel'){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,2*Math.PI);ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#273749';ctx.stroke();ctx.beginPath();ctx.strokeStyle='#ffffff9a';ctx.lineWidth=3;ctx.arc(p.x-3,p.y-3,Math.max(2,p.r-8),3.3,4.5);ctx.stroke();if(p.kind==='wheel'){ctx.strokeStyle='#d9eee9';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.cos(p.angle||0)*(p.r-4),p.y+Math.sin(p.angle||0)*(p.r-4));ctx.stroke();if(p.motor){ctx.fillStyle='#83e0cb';ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill()}}}
 else if(p.kind==='anchor'){ctx.fillStyle='#fffef9';ctx.strokeStyle=COLORS.violet;ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,p.r+5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(p.x-6,p.y);ctx.lineTo(p.x+6,p.y);ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x,p.y+6);ctx.stroke()}
 else if(p.kind==='joint'){if(p.r>=12){ctx.beginPath();ctx.fillStyle='#fffefa';ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.lineWidth=3.5;ctx.strokeStyle='#273749';ctx.stroke();ctx.fillStyle='#273749';ctx.beginPath();ctx.arc(p.x-3,p.y-1,1.7,0,2*Math.PI);ctx.arc(p.x+3,p.y-1,1.7,0,2*Math.PI);ctx.fill()}}
 ctx.restore()}
function drawSelection(){var p=findPart(state.selected);if(p){ctx.beginPath();ctx.arc(p.x,p.y,p.kind==='box'?Math.max(p.w,p.h)*.7:p.r+17,0,Math.PI*2);ctx.strokeStyle='#1cae9b';ctx.lineWidth=2;ctx.setLineDash([6,6]);ctx.stroke();ctx.setLineDash([])}
 if(state.linkStart){var s=findPart(state.linkStart);if(s){ctx.beginPath();ctx.arc(s.x,s.y,20,0,2*Math.PI);ctx.strokeStyle='#a475b1';ctx.lineWidth=3;ctx.stroke();if(state.pointerCoords){ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(state.pointerCoords.x,state.pointerCoords.y);ctx.stroke();ctx.setLineDash([])}}}}
function draw(){ctx.clearRect(0,0,width,height);backdrop();ctx.save();ctx.translate(width/2-cam.x*cam.z,height/2-cam.y*cam.z);ctx.scale(cam.z,cam.z);
 if(challenge){var goal=Levels.levels[challenge.index].goal;ctx.fillStyle=challenge.won?'#70d6a8aa':'#84e8b577';ctx.strokeStyle='#239e71';ctx.lineWidth=4;ctx.fillRect(goal.x,goal.y,goal.w,goal.h);ctx.strokeRect(goal.x,goal.y,goal.w,goal.h);ctx.fillStyle='#146747';ctx.font='bold 18px system-ui';ctx.fillText('GOAL',goal.x+19,goal.y+30)}
 world.links.forEach(drawLink);world.parts.forEach(drawPart);
 // Small optional destination markers cost no sprites or navigation mesh.
 var shown=0;
 world.groups.forEach(function(g){if(g.mode!=='go'||typeof g.targetX!=='number'||shown>=limits[profile].agents)return;shown++;
  var dest=g.targetX,y=FLOOR-7;ctx.strokeStyle='#168675';ctx.fillStyle='#168675';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.arc(dest,y-14,11,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(dest,y-11);ctx.lineTo(dest,y+1);ctx.moveTo(dest-5,y-3);ctx.lineTo(dest,y+2);ctx.lineTo(dest+5,y-3);ctx.stroke();
 });
 // Names are painted on Canvas (never HTML), limited by the active performance profile.
 if(world.aiEnabled){var names=0;for(var i=0;i<world.groups.length&&names<limits[profile].agents;i++){var g=world.groups[i],head=g.ai?findPart(g.head):null;if(!head)continue;names++;ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillStyle='#152c36';ctx.fillText(g.name,head.x,head.y-26);ctx.fillStyle=g.intent==='avoid'?'#bf574f':'#277d70';ctx.font='10px system-ui';ctx.fillText(g.intent||g.mode,head.x,head.y-14)}ctx.textAlign='start'}
 drawSelection();ctx.restore();/* Pause state is already shown in the toolbar and world chip. No canvas badge may cover controls. */}
function loop(now){if(!state.lastFrame)state.lastFrame=now;var dt=Math.min(.06,(now-state.lastFrame)/1000);state.lastFrame=now;if(!state.paused){state.acc+=dt*options.speed;var steps=0;while(state.acc>=STEP&&steps<4){simulate();state.acc-=STEP;steps++}if(steps===4)state.acc=0}else state.acc=0;
 draw();state.frames++;state.fpsTime+=dt;if(state.fpsTime>.75){state.fps=state.frames/state.fpsTime;state.fpsTime=0;state.frames=0;updateCounts();if(options.quality==='auto'&&profile==='standard'){lowFpsSec=state.fps<27?lowFpsSec+.75:Math.max(0,lowFpsSec-.75);if(lowFpsSec>6){profile='eco';resize();toast('Eco physics enabled for smoother play')}}}requestAnimationFrame(loop)}
function hitTest(x,y){for(var i=world.parts.length-1;i>=0;i--){var p=world.parts[i],r=reach(p);if(p.kind==='box'){var loc=toLocal(p,x,y);if(Math.abs(loc.x)<p.w/2+11&&Math.abs(loc.y)<p.h/2+11)return p}else if(Math.hypot(p.x-x,p.y-y)<Math.max(15,p.r+12))return p}return null}
function hitDetachableLink(x,y){
 var nearest=null,best=18/Math.max(.24,cam.z);
 for(var i=0;i<world.links.length;i++){
  var l=world.links[i];if(['rope','spring','hinge'].indexOf(l.type)<0)continue;
  var a=findPart(l.a),b=findPart(l.b);if(!a||!b)continue;
  var dist;
  if(l.type==='hinge'){
   var pa=hingePoint(a,l.ax||0,l.ay||0),pb=hingePoint(b,l.bx||0,l.by||0);
   dist=Math.hypot(x-(pa.x+pb.x)/2,y-(pa.y+pb.y)/2);
  }else{
   var dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
   var t=den?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/den)):0;
   dist=Math.hypot(x-(a.x+dx*t),y-(a.y+dy*t));
  }
  if(dist<best){best=dist;nearest=l}
 }
 return nearest;
}
function detachAt(x,y,p){
 var links=[];
 if(p&&p.kind==='anchor'){
  links=world.links.filter(function(l){return ['rope','spring','hinge'].indexOf(l.type)>=0&&(l.a===p.id||l.b===p.id)})
 }else{
  var l=hitDetachableLink(x,y);if(l)links=[l];
 }
 if(!links.length){toast('Tap a rope, spring, hinge, or purple anchor to release it');return false}
 pushHistory();
 var ids={};links.forEach(function(l){ids[l.id]=true});
 world.links=world.links.filter(function(l){return !ids[l.id]});
 state.linkStart=null;state.linkPoint=null;
 toast('Detached '+links.length+' connection'+(links.length===1?'':'s')+' · objects preserved');
 updateCounts();return true;
}
function pointerStart(id,cx,cy){var pos=worldPoint(cx,cy),p=hitTest(pos.x,pos.y);state.pointerCoords=pos;
 if(state.tool==='grab'){if(p){if(challenge&&!challenge.won&&p.id===challenge.targetId){toast('Solve the puzzle using physics tools');return}state.selected=p.id;state.drag={id:id,part:p,target:pos};if(p.group){toast('Figure selected · arrows to move · ↑ to jump · release to restore AI');updateResidents()}}else{state.pan={id:id,cx:cx,cy:cy,x:cam.x,y:cam.y};state.selected=null;updateResidents()}}
 else if(state.tool==='goto'){var chosen=selectedResident();if(chosen&&setResidentTarget(chosen.id,pos.x)){setTool('grab');toast(chosen.name+' · walking to destination')}else toast('Select a figure with Grab, then choose Go Here')}
 else if(state.tool==='erase'){if(p)erase(p)}
 else if(state.tool==='detach'){detachAt(pos.x,pos.y,p)}
 else if(state.tool==='rope'||state.tool==='spring'||state.tool==='hinge'){if(!p){toast('Tap an object to connect');return}if(!state.linkStart){state.linkStart=p.id;state.linkPoint=pos;toast('Now tap the second object')}else{var a=findPart(state.linkStart);if(a&&p.id!==a.id){pushHistory();if(state.tool==='hinge'){var aPt=toLocal(a,state.linkPoint.x,state.linkPoint.y),bPt=toLocal(p,pos.x,pos.y);world.links.push({id:uid(),a:a.id,b:p.id,type:'hinge',len:0,k:.88,ax:aPt.x,ay:aPt.y,bx:bPt.x,by:bPt.y,breakable:true,strength:90});toast('Hinge connected — bodies rotate')}else{link(a,p,state.tool,null,state.tool==='spring'?.16:.94);toast(state.tool==='rope'?'Rope connected':'Spring connected')}}else toast('Choose a different object');state.linkStart=null;state.linkPoint=null}}
 else if(state.tool==='figure'||state.tool==='living'){pushHistory();figure(pos.x,Math.min(pos.y,FLOOR-88),state.tool==='living');updateCounts();updateResidents()}
 else if(state.tool==='wheel'){pushHistory();wheel(pos.x,Math.min(pos.y,FLOOR-27),false);updateCounts()}
 else if(state.tool==='cart'){pushHistory();cart(pos.x,Math.min(pos.y,FLOOR-55));updateCounts()}
 else if(state.tool==='motor'){if(p&&p.kind==='wheel'){pushHistory();if(!p.motor){p.motor=true;p.motorDirection=1;toast('Motor forward')}else if(p.motorDirection!==-1){p.motorDirection=-1;toast('Motor reverse')}else{p.motor=false;toast('Motor off')}}else toast('Tap a wheel to cycle forward, reverse and off')}
 else if(state.tool==='box'){pushHistory();block(pos.x,Math.min(pos.y,FLOOR-28),70,56,false,options.material==='steel'?'#7e9ca5':options.material==='rubber'?'#51a99f':COLORS.orange);updateCounts()}
 else if(state.tool==='ball'){pushHistory();ball(pos.x,Math.min(pos.y,FLOOR-25),25,COLORS.aqua);updateCounts()}
 else if(state.tool==='anchor'){pushHistory();anchor(pos.x,pos.y);updateCounts()}
}
function pointerMove(id,cx,cy){var pos=worldPoint(cx,cy);state.pointerCoords=pos;if(state.drag&&state.drag.id===id){state.drag.target=pos;if(state.paused&&!state.drag.part.fixed){var p=state.drag.part,dx=pos.x-p.x,dy=pos.y-p.y;p.x+=dx;p.px+=dx;p.y+=dy;p.py+=dy}}else if(state.pan&&state.pan.id===id){cam.x=state.pan.x-(cx-state.pan.cx)/cam.z;cam.y=state.pan.y-(cy-state.pan.cy)/cam.z}}
function pointerEnd(id){if(state.drag&&state.drag.id===id)state.drag=null;if(state.pan&&state.pan.id===id)state.pan=null}
// Pointer events: touch tools commit only on release, preventing accidental builds during pinch.
var touches={},pinch=null,touchGesture=false;
if(window.PointerEvent){
 canvas.addEventListener('pointerdown',function(e){
  e.preventDefault();try{canvas.setPointerCapture(e.pointerId)}catch(_){}
  if(e.pointerType==='touch'){
   touches[e.pointerId]={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false};
   if(Object.keys(touches).length>=2){touchGesture=true;pinch=null;state.drag=null;state.pan=null;return}
   if(state.tool!=='grab')return;
  }
  pointerStart(e.pointerId,e.clientX,e.clientY);
 });
 canvas.addEventListener('pointermove',function(e){
  var t=touches[e.pointerId];if(!t){if(e.pointerType!=='touch')pointerMove(e.pointerId,e.clientX,e.clientY);return}
  if(Math.hypot(e.clientX-t.sx,e.clientY-t.sy)>9)t.moved=true;
  t.x=e.clientX;t.y=e.clientY;
  var ids=Object.keys(touches);
  if(ids.length>=2){
   touchGesture=true;state.drag=null;state.pan=null;
   var a=touches[ids[0]],b=touches[ids[1]],mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dist=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));
   if(pinch){cam.x-=(mx-pinch.x)/cam.z;cam.y-=(my-pinch.y)/cam.z;zoom(Math.max(.8,Math.min(1.25,dist/pinch.dist)),mx,my)}
   pinch={x:mx,y:my,dist:dist};return;
  }
  if(!touchGesture&&state.tool==='grab')pointerMove(e.pointerId,e.clientX,e.clientY);
 });
 function pointerFinish(e,cancel){
  var t=touches[e.pointerId];if(t){
   if(!cancel&&!touchGesture&&!t.moved&&state.tool!=='grab')pointerStart(e.pointerId,e.clientX,e.clientY);
   delete touches[e.pointerId];if(!Object.keys(touches).length){touchGesture=false;pinch=null}
  }
  pointerEnd(e.pointerId);
 }
 canvas.addEventListener('pointerup',function(e){pointerFinish(e,false)});
 canvas.addEventListener('pointercancel',function(e){pointerFinish(e,true)});
}else{
 var mouseDown=false;
 canvas.addEventListener('mousedown',function(e){mouseDown=true;pointerStart('mouse',e.clientX,e.clientY)});
 window.addEventListener('mousemove',function(e){if(mouseDown)pointerMove('mouse',e.clientX,e.clientY)});
 window.addEventListener('mouseup',function(){mouseDown=false;pointerEnd('mouse')});
 canvas.addEventListener('touchstart',function(e){e.preventDefault();var t=e.changedTouches[0];pointerStart(t.identifier,t.clientX,t.clientY)},{passive:false});
 canvas.addEventListener('touchmove',function(e){e.preventDefault();var t=e.changedTouches[0];pointerMove(t.identifier,t.clientX,t.clientY)},{passive:false});
 canvas.addEventListener('touchend',function(e){pointerEnd(e.changedTouches[0].identifier)});
}
canvas.addEventListener('wheel',function(e){e.preventDefault();zoom(e.deltaY<0?1.12:.89,e.clientX,e.clientY)},{passive:false});
function assignWorld(input,clearUndo){
 // Validation and migration MUST finish before replacing the active simulation.
 var migrated=Core.normalizeScene(input),candidate=migrated.world;
 candidate.parts.forEach(setMass);
 world=candidate;if(!world.aiEnabled)world.links=world.links.filter(function(l){return !l.graspOwner});challenge=null;updateChallenges();state.selected=null;state.linkStart=null;state.linkPoint=null;state.drag=null;
 rebuildIndex();if(clearUndo)forgetHistory();$('worldTitle').textContent=world.title;updateCounts();updateResidents();
}
function slotKey(){return 'sticklab_scene_v4_'+$('saveSlot').value}
function saveLocal(){try{localStorage.setItem(slotKey(),JSON.stringify({format:'StickLab',version:4,world:world}));toast('Scene saved to slot '+$('saveSlot').value)}catch(e){toast('Storage unavailable — use Export instead')}}
function loadLocal(){try{var txt=localStorage.getItem(slotKey());var legacy=false;if(!txt){txt=localStorage.getItem('sticklab_scene_v3_'+$('saveSlot').value);legacy=!!txt}if(!txt){txt=localStorage.getItem('sticklab_scene_v2_'+$('saveSlot').value);legacy=!!txt}if(!txt&&$('saveSlot').value==='1'){txt=localStorage.getItem('sticklab_scene_v1');legacy=!!txt}if(!txt){toast('No scene in this slot');return}assignWorld(JSON.parse(txt),true);sandboxResume=null;gameReturn=null;gameMode='sandbox';updateGameModes();toast(legacy?'Older saved scene loaded safely':'Saved scene loaded')}catch(e){toast('Could not load saved scene')}}
function download(name,mime,data){var a=document.createElement('a');if(typeof Blob!=='undefined'&&URL.createObjectURL){var blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(url)},1000)}else{a.href='data:'+mime+','+encodeURIComponent(data);a.download=name;a.click()}}
function exportWorld(){download('StickLab-world.json','application/json',JSON.stringify({format:'StickLab',version:4,world:world},null,2));toast('Scene JSON exported')}
function screenshot(){try{var a=document.createElement('a');a.download='StickLab-scene.png';a.href=canvas.toDataURL('image/png');a.click();toast('Scene image saved')}catch(e){toast('Could not save image on this device')}}
function importFile(file){if(!file)return;if(file.size>1500000){toast('Scene file is too large');return}var reader=new FileReader();reader.onload=function(){try{var d=JSON.parse(reader.result);assignWorld(d,true);toast('Scene imported successfully')}catch(e){toast('Invalid StickLab scene file')}};reader.onerror=function(){toast('File could not be read')};reader.readAsText(file)}
function modal(open){$('modalWrap').classList.toggle('open',open)}
function controls(){
 $('closePuzzlePicker').onclick=closePuzzlePicker;
 $('backFromPuzzlePicker').onclick=function(){closePuzzlePicker();if(isCompactLayout())$('sidebar').classList.add('open');var section=$('gameModeSection');if(section&&section.scrollIntoView)section.scrollIntoView({block:'start'})};
 $('puzzlePicker').addEventListener('click',function(e){if(e.target===this)closePuzzlePicker()});
 document.querySelectorAll('[data-picker-level]').forEach(function(b){b.addEventListener('click',function(){
  var index=+b.dataset.pickerLevel;if(index>=unlocked)return;
  if(loadLevel(index)){closePuzzlePicker();$('sidebar').classList.remove('open')}
 })});
 $('challengeAction').onclick=function(){var section=$('gameModeSection');if(isCompactLayout())$('sidebar').classList.add('open');if(section&&section.scrollIntoView)section.scrollIntoView({block:'start'});toast('Choose a game type · your sandbox can be restored')};
 document.querySelectorAll('[data-game]').forEach(function(b){b.addEventListener('click',function(){selectGameMode(b.dataset.game)})});$('snapshotMenu').onclick=screenshot;document.querySelectorAll('[data-level]').forEach(function(b){b.addEventListener('click',function(){loadLevel(+b.dataset.level);$('sidebar').classList.remove('open')})});$('freeSandbox').onclick=function(){selectGameMode('sandbox');$('sidebar').classList.remove('open')};$('hintLevel').onclick=function(){if(challenge)toast(Levels.levels[challenge.index].hint);else toast('Choose a challenge to see its hint')};$('restartLevel').onclick=function(){if(challenge)loadLevel(challenge.index);else toast('Select a challenge first')};$('nextLevel').onclick=function(){if(challenge&&challenge.won)loadLevel(challenge.index+1)};document.querySelectorAll('[data-tool]').forEach(function(b){b.addEventListener('click',function(){setTool(b.dataset.tool)})});document.querySelectorAll('[data-scene]').forEach(function(b){b.addEventListener('click',function(){gameReturn=null;newWorld(b.dataset.scene);gameMode='sandbox';updateGameModes();updateChallenges();$('sidebar').classList.remove('open')})});
 $('pause').onclick=function(){state.paused=!state.paused;updatePause()};$('step').onclick=function(){state.paused=true;simulate();updatePause()};$('zoomIn').onclick=function(){zoom(1.25);toast('Zoom '+Math.round(cam.z*100)+'%')};$('zoomOut').onclick=function(){zoom(.8);toast('Zoom '+Math.round(cam.z*100)+'%')};$('recenter').onclick=function(){defaultCamera();toast('View centered · '+Math.round(cam.z*100)+'%')};
 $('material').onchange=function(){options.material=this.value;toast('Building with '+this.value)};
 $('aiEnabled').onchange=function(){setLivingAI(this.checked);toast(this.checked?'Living AI enabled':'Living AI paused')};
 $('releaseResident').onclick=releaseResident;
 $('dropObject').onclick=function(){var g=selectedResident();if(!dropHelpingObject(g))toast('Select a resident holding an object first')};
 $('applyResidentMode').onclick=function(){var g=selectedResident();if(g&&g.ai){var name=g.name;if(changeResidentMode(g.id,$('residentMode').value)){releaseResident();state.paused=false;world.aiEnabled=true;updatePause();toast(name+' now '+g.mode+' · autonomous physics running')}}else toast('Select a living figure in Grab mode first')};
 $('goHere').onclick=function(){setTool('goto')};
 $('unhookFigure').onclick=function(){unhookFigure()};
 $('unhookMobile').onclick=function(){unhookFigure()};
 $('gravity').oninput=function(){options.gravity=+this.value;$('gravNum').textContent=this.value};$('speed').oninput=function(){options.speed=+this.value;$('speedNum').textContent=options.speed.toFixed(2)+'×'};$('bouncy').oninput=function(){options.bounce=+this.value/100;$('bounceNum').textContent=this.value+'%'};$('quality').onchange=function(){options.quality=this.value;setProfile();toast('Performance: '+profile)};
 $('save').onclick=saveLocal;$('load').onclick=loadLocal;$('export').onclick=exportWorld;$('import').onclick=function(){$('fileInput').click()};$('fileInput').onchange=function(){importFile(this.files[0]);this.value=''};$('undo').onclick=undo;$('reset').onclick=function(){newWorld('empty');toast('Blank world ready')};$('snapshot').onclick=screenshot;
 $('help').onclick=function(){modal(true)};$('closeModal').onclick=function(){modal(false)};$('startGame').onclick=function(){modal(false)};$('helpClose').onclick=function(){modal(false)};$('modalWrap').onclick=function(e){if(e.target===this)modal(false)};
 $('openMenu').onclick=function(){$('sidebar').classList.toggle('open')};
 window.addEventListener('keydown',function(e){var tag=e.target.tagName;if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return;var k=e.key.toLowerCase();if(k>='1'&&k<='9'&&k.length===1){var ts=['grab','figure','box','ball','anchor','rope','spring','erase','hinge'];setTool(ts[+k-1]);return}if(k==='arrowleft'||k==='a'){state.keys.left=true;e.preventDefault()}else if(k==='arrowright'||k==='d'){state.keys.right=true;e.preventDefault()}else if(k==='arrowup'||k==='w'){state.keys.jump=true;e.preventDefault()}else if(k===' '){e.preventDefault();var p=findPart(state.selected);if(p&&p.group){state.keys.jump=true}else{state.paused=!state.paused;updatePause()}}else if(k==='p'){state.paused=!state.paused;updatePause()}else if(k==='.'){state.paused=true;simulate();updatePause()}else if(k==='delete'||k==='backspace'){erase(findPart(state.selected));e.preventDefault()}else if(k==='escape'){state.linkStart=null;state.linkPoint=null;closePuzzlePicker();modal(false);$('sidebar').classList.remove('open')}else if(k==='z'&&(e.ctrlKey||e.metaKey)){undo();e.preventDefault()}});
 window.addEventListener('keyup',function(e){var k=e.key.toLowerCase();if(k==='arrowleft'||k==='a')state.keys.left=false;if(k==='arrowright'||k==='d')state.keys.right=false;if(k==='arrowup'||k==='w')state.keys.jump=false});
 document.querySelectorAll('[data-hold]').forEach(function(b){
 function press(e){if(e&&e.preventDefault)e.preventDefault();if(!ensureControlledFigure())return;
  if(state.paused){state.paused=false;updatePause()}
  state.keys[b.dataset.hold]=true;
 }
 function up(e){if(e&&e.preventDefault)e.preventDefault();
  // A quick tap on Jump must survive until the next simulation tick.
  if(b.dataset.hold!=='jump')state.keys[b.dataset.hold]=false;
 }
 function cancel(e){if(e&&e.preventDefault)e.preventDefault();state.keys[b.dataset.hold]=false}
 b.addEventListener('pointerdown',function(e){press(e);try{b.setPointerCapture(e.pointerId)}catch(_){}});
 b.addEventListener('pointerup',up);b.addEventListener('pointercancel',cancel);
 b.addEventListener('touchstart',press,{passive:false});b.addEventListener('touchend',up);b.addEventListener('touchcancel',cancel);
});
 window.addEventListener('resize',syncLayout);if(window.visualViewport&&window.visualViewport.addEventListener)window.visualViewport.addEventListener('resize',syncLayout);window.addEventListener('orientationchange',syncLayout)
}
// Initialize with no prompts or login; animation starts immediately.
controls();setProfile();defaultCamera();newWorld('playground');setTool('grab');updateGameModes();syncLayout();requestAnimationFrame(loop);
window.StickLab={exitChallenge:exitChallenge,selectGameMode:selectGameMode,getGameModes:function(){return GAME_MODES.map(function(x){return{id:x.id,name:x.name,summary:x.summary}})},getState:function(){return{gameMode:gameMode,entities:countEntities(),parts:world.parts.length,links:world.links.length,profile:profile,paused:state.paused,tool:state.tool,fps:state.fps,collisionCandidates:state.collisionCandidates,version:4,selected:state.selected,keys:{left:state.keys.left,right:state.keys.right,jump:state.keys.jump},agents:world.groups.filter(function(g){return g.ai}).length,aiEnabled:world.aiEnabled,challenge:challenge?{index:challenge.index,won:challenge.won,frames:challenge.frames}:null,unlocked:unlocked}},getWorld:function(){return JSON.parse(JSON.stringify(world))},getCamera:function(){return{x:cam.x,y:cam.y,z:cam.z}},createWorld:newWorld,startLevel:loadLevel,spawnResident:resident,setResidentMode:changeResidentMode,setResidentTarget:setResidentTarget,unhookFigure:unhookFigure,selectResident:chooseResident,releaseResident:releaseResident,setAIEnabled:setLivingAI,getResidents:function(){return world.groups.filter(function(g){return g.ai}).map(function(g){return{id:g.id,name:g.name,mode:g.mode,personality:g.personality,memory:g.memory,intent:g.intent||g.mode,motionState:g.motionState||'idle',targetX:g.targetX==null?null:g.targetX}})},setTool:setTool,save:saveLocal,load:loadLocal,exportScene:exportWorld,importScene:function(obj){assignWorld(obj,true);sandboxResume=null;gameReturn=null;gameMode='sandbox';updateGameModes()},step:simulate};
})();
