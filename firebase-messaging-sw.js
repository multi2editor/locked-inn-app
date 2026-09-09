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
  /* Two senders reach this worker with different shapes:
     - Firebase Console / any "notification" message -> payload.notification
     - netlify/functions/exam-reminders.js (data-only) -> payload.data
     Read both so neither renders blank. */
  const d = payload.data || {};
  const n = payload.notification || {};
  self.registration.showNotification(d.title || n.title || "Locked Inn", {
    body: d.body || n.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-96.png",
    tag: d.tag || "locked-inn",
    data: { url: d.url || "./" }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "./", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
