importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:"AIzaSyCUB0t9wvZp2pXhjYmv2G7AeToWNekJRTg",
  authDomain:"odjim-solution.firebaseapp.com",
  projectId:"odjim-solution",
  storageBucket:"odjim-solution.firebasestorage.app",
  messagingSenderId:"165673018775",
  appId:"1:165673018775:web:c8b4cc6345b854763950d2"
});

const messaging = firebase.messaging();

// Notificação em background
messaging.onBackgroundMessage(function(payload) {
  console.log("[SW] Mensagem em background:", payload);
  const title = payload.notification?.title || "ODJIM Solution";
  const body = payload.notification?.body || "Tens uma nova notificação.";
  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200,100,200],
    data: payload.data || {}
  });
});

// Ao clicar na notificação
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({type:"window",includeUncontrolled:true}).then(function(clientList) {
      for(const client of clientList){
        if(client.url.includes(self.location.origin) && "focus" in client){
          return client.focus();
        }
      }
      if(clients.openWindow) return clients.openWindow("/");
    })
  );
});

// Limpar cache antigo
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))));
  return self.clients.claim();
});

self.addEventListener("install", e=>{self.skipWaiting();});
