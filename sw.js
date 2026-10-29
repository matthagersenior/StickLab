/* StickLab cache policy: refresh online pages, retain a complete offline fallback. */
var CACHE='sticklab-v0513-ledge-climb-20261029',ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',function(e){
 e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS)}).then(function(){return self.skipWaiting()}))
});
self.addEventListener('activate',function(e){
 e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))
});
self.addEventListener('fetch',function(e){
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
 if(e.request.mode==='navigate'){
  e.respondWith(fetch(e.request).then(function(response){
   if(response&&response.ok){var copy=response.clone();caches.open(CACHE).then(function(c){return c.put(e.request,copy)}).catch(function(){})}
   return response
  }).catch(function(){return caches.match(e.request).then(function(cached){return cached||caches.match('./index.html')})}));
  return
 }
 e.respondWith(caches.match(e.request).then(function(cached){return cached||fetch(e.request)}))
});
