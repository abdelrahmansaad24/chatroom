"use client";

import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

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

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return "denied";
  }
}

export async function setupPushNotifications({ onForegroundMessage } = {}) {
  if (typeof window === "undefined") return null;

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !vapidKey) {
    console.warn("[FCM] Firebase config or VAPID key is missing in environment.");
    return null;
  }
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    return null;
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.warn("[FCM] Firebase Messaging is not supported in this browser context.");
    return null;
  }

  if (Notification.permission !== "granted") {
    // If not granted, will be requested when user interacts or via requestNotificationPermission
    return null;
  }

  try {
    const swUrl = `/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(firebaseConfig))}`;
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: "/",
    });
    
    // Ensure service worker is fully active and ready
    await navigator.serviceWorker.ready;

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
  } catch (err) {
    console.error("[FCM] setupPushNotifications error:", err);
    return null;
  }
}
