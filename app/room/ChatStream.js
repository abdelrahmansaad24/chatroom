"use client";

import { useEffect, useRef } from "react";
import { colorForName } from "@/lib/colors";

// Progressive enhancement: when JS is available, this replaces the 5s
// meta-refresh (see the <noscript> fallback in page.js) with a live
// Server-Sent Events feed from /api/stream, and shows a browser
// notification for messages from other people when the tab isn't focused.
// No third-party service, no service worker — just native EventSource +
// Notification APIs, so it stays free and framework-agnostic.
export default function ChatStream({ room, name }) {
  const tbodyRef = useRef(null);
  const seenIds = useRef(new Set());

  useEffect(() => {
    tbodyRef.current = document.getElementById("messages");

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const source = new EventSource("/api/stream");

    source.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (seenIds.current.has(msg.id)) return;
      seenIds.current.add(msg.id);

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
    });

    // If the connection drops (proxy timeout, server restart, etc.),
    // EventSource auto-reconnects on its own; nothing to do here.

    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;

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
}
