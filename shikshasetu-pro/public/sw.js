// Shell is cached at install; pack files are NOT precached (they are downloaded by the user into IndexedDB).
var C="shikshasetu-v13",F=["./","./index.html","./styles.css","./app.js","./manifest.json","./faq.json","./packs/index.json","./learning-illustration.svg","./brand-logo.png","./shikshasetu-brand.png","./login-study-scene.jpg"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(F)}));self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(n){return n!==C}).map(function(n){return caches.delete(n)}))}));self.clients.claim()});
self.addEventListener("fetch",function(e){var u=new URL(e.request.url);
 if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.indexOf("/api/")===0)return;
 e.respondWith(caches.match(e.request).then(function(c){
  var n=fetch(e.request).then(function(r){if(r.ok&&!/\/packs\/(?!index\.json)/.test(u.pathname)){var k=r.clone();caches.open(C).then(function(x){x.put(e.request,k)})}return r}).catch(function(){return c||caches.match("./index.html")});
  return c||n}))});
