importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// Versão 2 - força limpeza de cache
const CACHE_VERSION = "v2";

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    )
  );
  return self.clients.claim();
});

firebase.initializeApp({
  apiKey: "AIzaSyCUB0t9wvZp2pXhjYmv2G7AeToWNekJRTg",
  authDomain: "odjim-solution.firebaseapp.com",
  projectId: "odjim-solution",
  storageBucket: "odjim-solution.firebasestorage.app",
  messagingSenderId: "165673018775",
  appId: "1:165673018775:web:c8b4cc6345b854763950d2"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "ODJIM Solution", {
    body: body || "Tens uma nova atualização.",
    icon: "/icon-192.png",
    vibrate: [200, 100, 200]
  });
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(function(clientList) {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
