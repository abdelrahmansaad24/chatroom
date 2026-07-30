"use client";

import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

// Public web config — safe to expose to the browser (this is how Firebase
// web apps identify themselves; the actual security boundary is Firebase's
// server-side rules/App Check, not secrecy of these values).
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// Registers the FCM service worker, requests notification permission, and
// returns a device token (or null if push isn't supported/configured).
// `onForegroundMessage` fires when a push arrives while the tab is open and
// focused (background/closed-tab pushes are handled by the service worker).
export async function setupPushNotifications({ onForegroundMessage } = {}) {
  if (typeof window === "undefined") return null;
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !vapidKey) {
    return null; // Firebase push not configured — hybrid falls back to polling only.
  }
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    return null;
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return null;

  try {
    // Pass the (public) config to the service worker via the query string
    // since it's loaded as a plain static file and can't read env vars.
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(firebaseConfig))}`
    );

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    if (onForegroundMessage) {
      onMessage(messaging, onForegroundMessage);
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch {
    // Permission denied, unsupported browser, network hiccup, etc. — the
    // polling/SSE side of the hybrid keeps working regardless.
    return null;
  }
}
