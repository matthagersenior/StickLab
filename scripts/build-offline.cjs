'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
for(const [needle,replacement] of [
 ['<link rel="stylesheet" href="./style.css">','<style>'+fs.readFileSync(path.join(root,'src/style.css'),'utf8')+'</style>'],
 ['<script src="./core.js"></script>','<script>'+fs.readFileSync(path.join(root,'src/core.js'),'utf8')+'</script>'],
 ['<script src="./levels.js"></script>','<script>'+fs.readFileSync(path.join(root,'src/levels.js'),'utf8')+'</script>'],
 ['<script src="./machines.js"></script>','<script>'+fs.readFileSync(path.join(root,'src/machines.js'),'utf8')+'</script>'],
 ['<script src="./inhabitants.js"></script>','<script>'+fs.readFileSync(path.join(root,'src/inhabitants.js'),'utf8')+'</script>'],
 ['<script src="./locomotion.js"></script>','<script>'+fs.readFileSync(path.join(root,'src/locomotion.js'),'utf8')+'</script>'],
 ['<script src="./game.js"></script>','<script>'+fs.readFileSync(path.join(root,'src/game.js'),'utf8')+'</script>']
]){if(html.split(needle).length!==2)throw Error('Expected exactly one '+needle);html=html.replace(needle,replacement)}
function write(name,content){const dest=path.join(root,name),tmp=dest+'.tmp';fs.writeFileSync(tmp,content);fs.renameSync(tmp,dest)}
write('index.html',html);
const pwa='<link rel="manifest" href="./manifest.webmanifest"><link rel="icon" type="image/svg+xml" href="./icon.svg">';
const sw='<script>if((location.protocol===\'https:\'||location.hostname===\'localhost\')&&\'serviceWorker\' in navigator){navigator.serviceWorker.register(\'./sw.js\').catch(function(){})}</script>';
if(html.split(pwa).length!==2||html.split(sw).length!==2)throw Error('Hosted PWA metadata missing');
write('StickLab-Offline.html',html.replace(pwa,'').replace(sw,''));
console.log('Built Pages index and offline HTML ('+Buffer.byteLength(html)+' bytes hosted)');
