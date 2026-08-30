// Background FCM Service Worker handler
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
  try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // Fires when a push arrives while the browser/tab is in the background
    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {};
      const data = payload.data || {};
      let title = notification.title;
      if (!title) {
        if (data.isReplyToYou === "true") {
          title = `💬 ${data.name || "Someone"} replied to your message`;
        } else {
          title = `💬 ${data.name || "New message"} in Room ${data.room || "Chat"}`;
        }
      }

      const body = notification.body || data.text || "New message in chatroom";
      const room = data.room || "chat";

      self.registration.showNotification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        vibrate: [200, 100, 200],
        tag: `chatroom-${room}`,
        renotify: true,
        data: {
          url: "/room",
          room: data.room,
          ...data,
        },
      });
    });
  } catch (e) {
    console.error("[SW] Firebase init error:", e);
  }
}

// Android & Web notification click handler: Focuses existing room tab or opens new window
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const clickData = event.notification.data || {};
  const targetUrl = clickData.url || "/room";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("/room") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
