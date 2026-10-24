importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBsVOWrSKNO42A3vJ_baQNs1QoLhiBt3M0",
  authDomain: "b26mi-academic-reminder.firebaseapp.com",
  projectId: "b26mi-academic-reminder",
  storageBucket: "b26mi-academic-reminder.firebasestorage.app",
  messagingSenderId: "739552881698",
  appId: "1:739552881698:web:c9e5d290e4e4c4a723ee7b"
};

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Menerima pesan latar belakang: ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
