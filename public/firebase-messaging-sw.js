// Background FCM Service Worker handler
importScripts("https://www.gstatic.com/firebasejs/11.3.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.3.1/firebase-messaging-compat.js");

const defaultFirebaseConfig = {
  apiKey: "AIzaSyC5YkBiuF-7RnyfzC_PfL8mq8dg9Vt8f5g",
  authDomain: "chatroom-a5b94.firebaseapp.com",
  projectId: "chatroom-a5b94",
  storageBucket: "chatroom-a5b94.firebasestorage.app",
  messagingSenderId: "29840204708",
  appId: "1:29840204708:web:0c508ded1a8fe42bacd731",
  measurementId: "G-2HT0Q0F45D",
};

let firebaseConfig = { ...defaultFirebaseConfig };
try {
  const params = new URL(location.href).searchParams;
  const configParam = params.get("config");
  if (configParam) {
    const parsed = JSON.parse(configParam);
    if (parsed && parsed.apiKey) {
      firebaseConfig = { ...firebaseConfig, ...parsed };
    }
  }
} catch {
  // Use defaultFirebaseConfig
}

if (firebaseConfig.apiKey) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const messaging = firebase.messaging();

    // Fires when an FCM push arrives while the browser/tab is in the background
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

// Fallback native push event handler if FCM compat doesn't intercept
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    // If Firebase messaging already handled it or if it's a raw payload
    const notification = payload.notification || {};
    const data = payload.data || {};

    if (!notification.title && !data.text && !data.name) return;

    const title =
      notification.title ||
      (data.isReplyToYou === "true"
        ? `💬 ${data.name || "Someone"} replied to your message`
        : `💬 ${data.name || "New message"} in Room ${data.room || "Chat"}`);

    const body = notification.body || data.text || "New message in chatroom";
    const room = data.room || "chat";

    event.waitUntil(
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
      })
    );
  } catch {
    // Non-JSON or handled by Firebase SDK
  }
});

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
