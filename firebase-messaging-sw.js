// Import SDK Firebase khusus untuk Service Worker (versi compat)
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

// 1. Masukkan konfigurasi Firebase Anda di sini (SAMA PERSIS dengan yang ada di index.html)
const firebaseConfig = {
  apiKey: "AIzaSyBsVOWrSKNO42A3vJ_baQNs1QoLhiBt3M0",
  authDomain: "b26mi-academic-reminder.firebaseapp.com",
  projectId: "b26mi-academic-reminder",
  storageBucket: "b26mi-academic-reminder.firebasestorage.app",
  messagingSenderId: "739552881698",
  appId: "1:739552881698:web:c9e5d290e4e4c4a723ee7b"
};

// 2. Inisialisasi Firebase di dalam Service Worker
firebase.initializeApp(firebaseConfig);

// 3. Inisialisasi Messaging
const messaging = firebase.messaging();

// Pesan FCM dengan field `notification` ditampilkan otomatis oleh Firebase
// ketika website di background. Jangan panggil showNotification() lagi,
// karena bisa membuat notifikasi muncul dua kali.
// Handler ini hanya mencatat pesan untuk diagnostik.
messaging.onBackgroundMessage(function(payload) {
  console.log('[Service Worker] Pesan background diterima:', payload?.messageId || 'tanpa ID');
});

// ============================================================
// PWA: cache app shell + fetch handler (agar website bisa di-install)
// Ditambahkan di bawah kode Firebase Messaging di atas. Jangan dihapus.
// ============================================================

const APP_CACHE = 'b26mi-shell-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('b26mi-shell-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Firebase, Firestore, Google Fonts, dll: langsung ke jaringan, tidak di-cache.
  if (url.origin !== self.location.origin) return;

  // Halaman utama: network dulu, cache sebagai cadangan offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Aset statis: cache dulu, lalu jaringan.
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
