importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD7UAOu3NYI8NwQtzwyv_EdSzp2CnxghHM",
  authDomain: "locked-inn.firebaseapp.com",
  projectId: "locked-inn",
  storageBucket: "locked-inn.firebasestorage.app",
  messagingSenderId: "228735115843",
  appId: "1:228735115843:web:dbf50e000c1804c90ceaf6"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Locked Inn";
  const options = {
    body: payload.notification?.body || "",
    icon: "icons/icon-192.png",
    badge: "icons/icon-96.png"
  };
  self.registration.showNotification(title, options);
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("lockedinn.co.za") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("https://lockedinn.co.za");
      }
    })
  );
});