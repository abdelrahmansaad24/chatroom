// Background FCM handler. Loaded as a plain static file (not bundled by
// Next.js), so it uses the Firebase compat CDN scripts and reads its config
// from the query string that lib/firebase-client.js registers it with.
importScripts("https://www.gstatic.com/firebasejs/11.3.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.3.1/firebase-messaging-compat.js");

let firebaseConfig = {};
try {
  const params = new URL(location.href).searchParams;
  firebaseConfig = JSON.parse(params.get("config") || "{}");
} catch {
  firebaseConfig = {};
}

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Fires when a push arrives while no tab has focus (or the app/browser
  // is closed on platforms that support it). Foreground messages while a
  // tab is focused are handled instead by onMessage() in firebase-client.js.
  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const data = payload.data || {};
    self.registration.showNotification(notification.title || `${data.name || "New"} message`, {
      body: notification.body || data.text || "",
      icon: "/next.svg",
      data,
    });
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/room"));
});
