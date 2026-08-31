importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCUB0t9wvZp2pXhjYmv2G7AeToWNekJRTg",
  authDomain: "odjim-solution.firebaseapp.com",
  projectId: "odjim-solution",
  storageBucket: "odjim-solution.firebasestorage.app",
  messagingSenderId: "165673018775",
  appId: "1:165673018775:web:c8b4cc6345b854763950d2"
});

const messaging = firebase.messaging();

// Notificação em background
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message:", payload);
  const title = payload.notification?.title || "ODJIM Solution";
  const body = payload.notification?.body || "Nova notificação.";
  const icon = payload.notification?.icon || "/icon-192.png";

  self.registration.showNotification(title, {
    body,
    icon,
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    data: payload.data || {},
    tag: payload.data?.pedidoId || "odjim-default",
    requireInteraction: false
  });
});

// Clique na notificação
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
