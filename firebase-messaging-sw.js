// B26MI V5.6 — Firebase Messaging + lightweight PWA cache.
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: 'AIzaSyBsVOWrSKNO42A3vJ_baQNs1QoLhiBt3M0',
  authDomain: 'b26mi-academic-reminder.firebaseapp.com',
  projectId: 'b26mi-academic-reminder',
  storageBucket: 'b26mi-academic-reminder.firebasestorage.app',
  messagingSenderId: '739552881698',
  appId: '1:739552881698:web:c9e5d290e4e4c4a723ee7b'
});
const messaging = firebase.messaging();
// Notification payload is displayed by Firebase; avoid showNotification() duplicates.
messaging.onBackgroundMessage(payload => console.log('[B26MI FCM]', payload.messageId || 'background message'));

const CACHE = 'b26mi-static-v5-6-1';
const SHELL = ['./index.html', './manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    // Cache only the essential files. Missing icons must not block installation.
    await Promise.all(SHELL.map(async url => {
      try { const response = await fetch(url, { cache: 'reload' }); if (response.ok) await cache.put(url, response); }
      catch (e) { console.warn('Cache shell:', url, e); }
    }));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith('b26mi-shell-') || k.startsWith('b26mi-static-')) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Never cache Firebase/Auth requests.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        await cache.put('./index.html', response.clone());
      }
      return response;
    }).catch(async () => (await caches.match('./index.html')) || Response.error()));
    return;
  }
  // Only static assets; never cache arbitrary API/data endpoints.
  if (!/\.(?:svg|png|webp|ico|webmanifest|css|js)$/.test(url.pathname)) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  }).catch(() => caches.match(request)));
});
