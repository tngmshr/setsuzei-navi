'use strict';
const CACHE='setsuzei-navi-v14';
const ROOT = new URL('./', self.location).href;
const ASSETS = ['img/entry-start.svg','img/entry-tools.svg','img/entry-guide.svg','img/entry-asset.svg','img/hero-tools.svg','img/hero-guide.svg','./','index.html','params.js','calc.js','tools.js','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png'].map(path=>new URL(path,ROOT).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('setsuzei-navi-') && key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(ROOT)) return;
  const path = new URL(url.pathname, url.origin).href;
  const cacheKey = event.request.mode === 'navigate' ? ROOT : path;
  if (event.request.mode !== 'navigate' && !ASSETS.includes(path)) return;
  // ネット優先。入力データや外部サイトはキャッシュしない。
  event.respondWith((async()=>{
    try {
      const response = await fetch(event.request);
      if (!response.ok) throw new Error('取得できませんでした');
      const cache = await caches.open(CACHE);
      await cache.put(cacheKey,response.clone());
      return response;
    } catch {
      return await caches.match(cacheKey) || new Response('オフライン用データがありません。接続して開き直してください。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
    }
  })());
});
