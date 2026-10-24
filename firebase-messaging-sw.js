// Import script Firebase
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Masukkan konfigurasi Firebase Anda di sini
const firebaseConfig = {
  apiKey: "AIzaSyBsVOWrSKNO42A3vJ_baQNs1QoLhiBt3M0",
  authDomain: "b26mi-academic-reminder.firebaseapp.com",
  projectId: "b26mi-academic-reminder",
  storageBucket: "b26mi-academic-reminder.firebasestorage.app",
  messagingSenderId: "739552881698",
  appId: "1:739552881698:web:c9e5d290e4e4c4a723ee7b"
};

// Inisialisasi Firebase di dalam Service Worker
firebase.initializeApp(firebaseConfig);

// Inisialisasi Messaging agar bisa menerima notifikasi di background
const messaging = firebase.messaging();
