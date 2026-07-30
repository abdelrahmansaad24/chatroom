"use client";

import { useEffect, useRef } from "react";
import { colorForName } from "@/lib/colors";
import { setupPushNotifications } from "@/lib/firebase-client";

const POLL_FALLBACK_MS = 8000;

// Hybrid real-time strategy:
//  1. SSE (/api/stream) - low-latency updates while the tab is open.
//  2. Firebase Cloud Messaging - wakes the device/shows a notification
//     even when the tab/browser is backgrounded or closed.
//  3. Plain REST polling (/api/chat) - reconciles the message list on an
//     interval regardless of whether SSE/FCM delivered everything, so a
//     dropped connection or missed push never leaves the room stale.
// All three funnel through the same seenIds dedupe + appendMessage path.
export default function ChatStream({ room, name }) {
  const tbodyRef = useRef(null);
  const seenIds = useRef(new Set());
  const lastTs = useRef(0);
  const fcmTokenRef = useRef(null);

  useEffect(() => {
    tbodyRef.current = document.getElementById("messages");
    lastTs.current = Date.now();

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    function appendMessage(msg) {
      const tbody = tbodyRef.current;
      if (!tbody) return;

      const emptyRow = tbody.querySelector("[data-empty]");
      if (emptyRow) emptyRow.remove();

      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.style.borderBottom = "1px solid #eee";
      td.style.background = msg.name === name ? "#f5f9ff" : "#fff";

      const b = document.createElement("b");
      b.style.color = colorForName(msg.name);
      b.textContent = msg.name;

      td.appendChild(b);
      td.appendChild(document.createTextNode(`: ${msg.text}`));
      tr.appendChild(td);
      tbody.appendChild(tr);
      tr.scrollIntoView({ block: "nearest" });
    }

    function handleIncoming(msg) {
      if (seenIds.current.has(msg.id)) return;
      seenIds.current.add(msg.id);
      if (msg.ts) lastTs.current = Math.max(lastTs.current, msg.ts);

      appendMessage(msg);

      const isOwnMessage = msg.name === name;
      if (
        !isOwnMessage &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.hidden
      ) {
        new Notification(`${msg.name} in ${room}`, { body: msg.text });
      }
    }

    const source = new EventSource("/api/stream");

    source.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      handleIncoming(msg);
    });

    // If the connection drops (proxy timeout, server restart, etc.),
    // EventSource auto-reconnects on its own; nothing to do here.

    // --- Firebase push notifications (background/closed-tab) ---
    setupPushNotifications({
      onForegroundMessage: (payload) => {
        const data = payload.data || {};
        if (data.text && data.ts) {
          handleIncoming({ id: `${data.ts}-${data.name}-${data.text}`, ...data, ts: Number(data.ts) });
        }
      },
    }).then((token) => {
      if (!token) return;
      fcmTokenRef.current = token;
      fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    });

    // Unregister the push token when leaving the room so we stop sending
    // notifications to a device that's no longer in the chat.
    const leaveForm = document.querySelector('form[action="/api/leave"]');
    const onLeave = () => {
      if (fcmTokenRef.current) {
        navigator.sendBeacon?.(
          "/api/push/unregister",
          new Blob([JSON.stringify({ token: fcmTokenRef.current })], {
            type: "application/json",
          })
        );
      }
    };
    leaveForm?.addEventListener("submit", onLeave);

    // --- REST polling fallback (hybrid "pull" side) ---
    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/chat?room=${encodeURIComponent(room)}&since=${lastTs.current}`
        );
        if (!res.ok) return;
        const data = await res.json();
        for (const m of data.messages || []) {
          handleIncoming({ id: `${m.ts}-${m.name}-${m.text}`, ...m });
        }
      } catch {
        // Transient network hiccup — just try again on the next tick.
      }
    }, POLL_FALLBACK_MS);

    return () => {
      source.close();
      clearInterval(pollTimer);
      leaveForm?.removeEventListener("submit", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
