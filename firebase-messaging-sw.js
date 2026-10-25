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

// 4. Tangkap pesan saat aplikasi di latar belakang (background)
messaging.onBackgroundMessage(function(payload) {
  console.log('[Service Worker] Menerima pesan di latar belakang: ', payload);

  const notificationTitle = payload.notification.title || 'Pengingat Akademik B26MI';
  const notificationOptions = {
    body: payload.notification.body || 'Ada pembaruan tugas baru.',
    // icon: '/path/to/icon.png' // (Opsional) jika Anda punya logo web
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
