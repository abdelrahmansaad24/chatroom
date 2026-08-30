"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { colorForName } from "@/lib/colors";
import { setupPushNotifications, requestNotificationPermission } from "@/lib/firebase-client";

// Sound synthesizer using Web Audio API
function playSound(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "send") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === "receive") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(659, now);
      osc.frequency.exponentialRampToValueAtTime(523, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === "pop") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch {
    // AudioContext blocked or not supported
  }
}

// Android Haptic Vibration Helper
function triggerHaptic(type = "light") {
  if (typeof window === "undefined" || !navigator.vibrate) return;
  try {
    if (type === "light") navigator.vibrate(10);
    else if (type === "medium") navigator.vibrate(22);
    else if (type === "notch") navigator.vibrate(16);
    else if (type === "success") navigator.vibrate([12, 35, 18]);
  } catch {
    // ignored
  }
}

function formatMessageTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateSeparator(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const QUICK_EMOJIS = ["👍", "❤️", "🔥", "😂", "😮", "🎉", "🙏", "💯"];

export default function ChatRoomClient({ room, name, initialMessages = [] }) {
  const [messages, setMessages] = useState(() => initialMessages);
  const [inputText, setInputText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(initialMessages.length >= 10);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);
  const [highlightedId, setHighlightedId] = useState(null);
  const [isFindingMsg, setIsFindingMsg] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);
  const [reactions, setReactions] = useState({});
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [notifPermission, setNotifPermission] = useState("default");

  // Search in chat
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);

  const containerRef = useRef(null);
  const seenIds = useRef(
    new Set(initialMessages.map((m) => m.id || `${m.ts}-${m.name}-${m.text}`))
  );
  const lastTs = useRef(
    initialMessages.length > 0
      ? Math.max(...initialMessages.map((m) => m.ts || 0))
      : -1
  );
  const fcmTokenRef = useRef(null);
  const isInitialScrollDone = useRef(false);
  const inputRef = useRef(null);
  const hasMoreOlderRef = useRef(initialMessages.length >= 10);
  const messagesRef = useRef(initialMessages);
  const isLoadingOlderRef = useRef(false);
  const isScrolledNearBottomRef = useRef(true);

  // Sync refs
  useEffect(() => {
    hasMoreOlderRef.current = hasMoreOlder;
  }, [hasMoreOlder]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    isLoadingOlderRef.current = isLoadingOlder;
  }, [isLoadingOlder]);

  useEffect(() => {
    if (lastTs.current === -1) {
      lastTs.current = Date.now();
    }
  }, []);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    triggerHaptic("light");
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2200);
  }, []);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((smooth = true) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
      setUnreadBelowCount(0);
    }
  }, []);

  // Initial scroll
  useEffect(() => {
    if (!isInitialScrollDone.current) {
      scrollToBottom(false);
      isInitialScrollDone.current = true;
    }
  }, [scrollToBottom]);

  // Check notification permission state on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Append message
  const appendMessage = useCallback((msg) => {
    const id = msg.id || `${msg.ts}-${msg.name}-${msg.text}`;
    if (seenIds.current.has(id)) return false;
    seenIds.current.add(id);
    if (msg.ts && msg.ts > lastTs.current) {
      lastTs.current = msg.ts;
    }
    setMessages((prev) => [...prev, { ...msg, id }]);
    return true;
  }, []);

  // Notification dispatcher for incoming messages
  const notifyIncoming = useCallback(
    (msg) => {
      const isOwnMessage = msg.name === name;
      if (!isOwnMessage && soundEnabled) {
        playSound("receive");
      }
      if (
        !isOwnMessage &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.hidden
      ) {
        try {
          if (msg.replyTo && msg.replyTo.name === name) {
            new Notification(`💬 ${msg.name} replied to you`, {
              body: msg.text,
              icon: "/favicon.ico",
            });
          } else {
            new Notification(`💬 ${msg.name} in Room ${room}`, {
              body: msg.text,
              icon: "/favicon.ico",
            });
          }
        } catch {
          // notification dispatch fallback
        }
      }
    },
    [name, room, soundEnabled]
  );

  // Handle incoming messages (SSE / Polling / FCM)
  const handleIncomingMessage = useCallback(
    (msg) => {
      const added = appendMessage(msg);
      if (!added) return;

      notifyIncoming(msg);

      if (containerRef.current) {
        const { scrollHeight, scrollTop, clientHeight } = containerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 160;
        if (isNearBottom || msg.name === name) {
          setTimeout(() => scrollToBottom(true), 40);
        } else {
          setShowScrollBottom(true);
          setUnreadBelowCount((c) => c + 1);
        }
      }
    },
    [appendMessage, name, notifyIncoming, scrollToBottom]
  );

  // Initialize FCM Push Notifications
  const initFCM = useCallback(async () => {
    try {
      const token = await setupPushNotifications({
        onForegroundMessage: (payload) => {
          const data = payload.data || {};
          const notification = payload.notification || {};
          const msgText = data.text || notification.body || "";
          const msgName = data.name || "";
          const msgTs = Number(data.ts) || Date.now();
          const msgId = data.id || `${msgTs}-${msgName}-${msgText}`;

          if (msgText && msgName) {
            handleIncomingMessage({
              id: msgId,
              name: msgName,
              text: msgText,
              ts: msgTs,
              replyTo: data.replyToName
                ? { name: data.replyToName, text: data.replyToText || "" }
                : null,
            });
          }
        },
      });

      if (token) {
        fcmTokenRef.current = token;
        await fetch("/api/push/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, room, name }),
        });
      }
    } catch {
      // ignore setup hiccups
    }
  }, [handleIncomingMessage, name, room]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      initFCM();
    }

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
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [initFCM]);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      showToast("Notifications Enabled 🔔");
      initFCM();
    } else if (perm === "denied") {
      showToast("Notifications Blocked in Browser 🚫");
    }
  };

  // Load older messages batch
  const fetchOlderBatch = useCallback(
    async (beforeTs) => {
      const res = await fetch(
        `/api/chat?room=${encodeURIComponent(room)}&before=${encodeURIComponent(beforeTs)}&limit=15`
      );
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const olderList = data.messages || [];
      const freshOlder = [];
      for (const m of olderList) {
        const id = m.id || `${m.ts}-${m.name}-${m.text}`;
        if (!seenIds.current.has(id)) {
          seenIds.current.add(id);
          freshOlder.push({ ...m, id });
        }
      }
      const newHasMore = Boolean(data.hasMore && olderList.length > 0);
      if (!newHasMore) {
        setHasMoreOlder(false);
        hasMoreOlderRef.current = false;
      }
      if (freshOlder.length > 0) {
        setMessages((prev) => [...freshOlder, ...prev]);
        messagesRef.current = [...freshOlder, ...messagesRef.current];
      }
      return { added: freshOlder.length, hasMore: newHasMore };
    },
    [room]
  );

  // Infinite scroll trigger
  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlderRef.current || !hasMoreOlderRef.current) return;
    const msgs = messagesRef.current;
    if (msgs.length === 0) return;
    const oldest = msgs[0];
    if (!oldest?.ts) return;

    setIsLoadingOlder(true);
    isLoadingOlderRef.current = true;
    const container = containerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;

    try {
      await fetchOlderBatch(oldest.ts);
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop =
            container.scrollHeight - prevScrollHeight + prevScrollTop;
        }
      });
    } catch {
      // transient network issue
    } finally {
      setIsLoadingOlder(false);
      isLoadingOlderRef.current = false;
    }
  }, [fetchOlderBatch]);

  // Scroll listener
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;

    if (scrollTop <= 80 && hasMoreOlderRef.current && !isLoadingOlderRef.current) {
      loadOlderMessages();
    }

    const isNearBottom = scrollHeight - scrollTop - clientHeight < 140;
    isScrolledNearBottomRef.current = isNearBottom;
    setShowScrollBottom(!isNearBottom);
    if (isNearBottom) {
      setUnreadBelowCount(0);
    }
  }, [loadOlderMessages]);

  // Locate message by ID
  const findAndScrollToMessage = useCallback(
    async (targetId) => {
      if (!targetId) return;

      const tryScroll = () => {
        const el = document.getElementById(`msg-${targetId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setHighlightedId(targetId);
          triggerHaptic("notch");
          setTimeout(() => setHighlightedId(null), 2500);
          return true;
        }
        return false;
      };

      if (tryScroll()) return;

      if (!hasMoreOlderRef.current) return;
      setIsFindingMsg(true);

      try {
        let safety = 0;
        while (safety < 40) {
          safety++;
          const msgs = messagesRef.current;
          const oldest = msgs[0];
          if (!oldest?.ts) break;

          const { added, hasMore } = await fetchOlderBatch(oldest.ts);
          await new Promise((r) => setTimeout(r, 70));

          if (tryScroll()) break;
          if (!hasMore || added === 0) break;
        }
      } catch {
        // network error
      } finally {
        setIsFindingMsg(false);
      }
    },
    [fetchOlderBatch]
  );

  // SSE Stream
  useEffect(() => {
    const source = new EventSource("/api/stream");
    source.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleIncomingMessage(msg);
      } catch {
        // parse error
      }
    });
    return () => source.close();
  }, [handleIncomingMessage]);

  // Fallback Polling
  const handleIncomingRef = useRef(handleIncomingMessage);
  useEffect(() => {
    handleIncomingRef.current = handleIncomingMessage;
  }, [handleIncomingMessage]);

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const since = lastTs.current > 0 ? lastTs.current : Date.now();
        const res = await fetch(
          `/api/chat?room=${encodeURIComponent(room)}&since=${since}&limit=20`
        );
        if (!res.ok) return;
        const data = await res.json();
        for (const m of data.messages || []) {
          handleIncomingRef.current(m);
        }
      } catch {
        // ignore
      }
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [room]);

  // Send Message
  const isSendingRef = useRef(false);
  const handleSendMessage = useCallback(
    async (overrideText) => {
      const text = (typeof overrideText === "string" ? overrideText : inputText).trim();
      if (!text || isSendingRef.current) return;
      isSendingRef.current = true;

      const currentReplyTo = replyTo;
      setInputText("");
      setReplyTo(null);

      if (soundEnabled) playSound("send");
      triggerHaptic("medium");

      const tempId = `temp-${Date.now()}`;
      const now = Date.now();
      const optimisticMsg = {
        id: tempId,
        name,
        text,
        ts: now,
        replyTo: currentReplyTo,
        status: "sending",
      };
      seenIds.current.add(tempId);
      if (now > lastTs.current) lastTs.current = now;
      setMessages((prev) => [...prev, optimisticMsg]);
      setTimeout(() => scrollToBottom(true), 20);

      try {
        const res = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ text, replyTo: currentReplyTo }),
        });
        if (!res.ok) throw new Error("send failed");
        const data = await res.json();
        if (data?.message) {
          const serverMsg = data.message;
          seenIds.current.add(serverMsg.id);
          if (serverMsg.ts > lastTs.current) lastTs.current = serverMsg.ts;
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...serverMsg, status: "sent" } : m))
          );
        }
      } catch {
        // keep optimistic message
      } finally {
        isSendingRef.current = false;
      }

      inputRef.current?.focus();
    },
    [inputText, name, replyTo, scrollToBottom, soundEnabled]
  );

  // Toggle reaction on a message
  const handleToggleReaction = useCallback((msgId, emoji) => {
    triggerHaptic("notch");
    playSound("pop");
    setReactions((prev) => {
      const current = prev[msgId] || { counts: {}, userReacted: [] };
      const hasReacted = current.userReacted.includes(emoji);
      const newCounts = { ...current.counts };
      let newUserReacted;

      if (hasReacted) {
        newCounts[emoji] = Math.max(0, (newCounts[emoji] || 1) - 1);
        if (newCounts[emoji] === 0) delete newCounts[emoji];
        newUserReacted = current.userReacted.filter((e) => e !== emoji);
      } else {
        newCounts[emoji] = (newCounts[emoji] || 0) + 1;
        newUserReacted = [...current.userReacted, emoji];
      }

      return {
        ...prev,
        [msgId]: { counts: newCounts, userReacted: newUserReacted },
      };
    });
  }, []);

  // Search filter matches
  const searchMatches = searchQuery.trim()
    ? messages.filter((m) =>
        m.text.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : [];

  const handleNextSearchMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (searchMatchIndex + 1) % searchMatches.length;
    setSearchMatchIndex(nextIdx);
    const target = searchMatches[nextIdx];
    if (target) {
      findAndScrollToMessage(target.id);
    }
  };

  const handlePrevSearchMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx =
      (searchMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setSearchMatchIndex(prevIdx);
    const target = searchMatches[prevIdx];
    if (target) {
      findAndScrollToMessage(target.id);
    }
  };

  const myColor = colorForName(name);

  return (
    <div style={styles.container}>
      {/* Dynamic Background Mesh */}
      <div style={styles.bgMesh} />

      {/* Floating Animated Toast */}
      {toastMessage && (
        <div style={styles.toastContainer} className="custom-toast">
          <span style={{ marginRight: 6 }}>✨</span>
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <div style={{ ...styles.roomAvatar, backgroundColor: myColor }}>
              #{room}
            </div>
            <div style={styles.headerInfo}>
              <div style={styles.roomTitleRow}>
                <span style={styles.roomTitle}>Room {room}</span>
                <span style={styles.onlineBadge}>
                  <span style={styles.onlineDot} /> Live
                </span>
              </div>
              <div style={styles.roomSubtitle}>
                You are <strong style={{ color: "#38bdf8" }}>{name}</strong>
              </div>
            </div>
          </div>

          <div style={styles.headerActions}>
            {/* Search Button */}
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen((v) => !v);
                setSearchQuery("");
                triggerHaptic("light");
              }}
              style={{
                ...styles.iconBtn,
                backgroundColor: isSearchOpen ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.08)",
                color: isSearchOpen ? "#38bdf8" : "#e2e8f0",
              }}
              title="Search chat"
            >
              🔍
            </button>

            {/* Sound Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setSoundEnabled((v) => !v);
                showToast(soundEnabled ? "Sounds Muted 🔇" : "Sounds Enabled 🔊");
              }}
              style={styles.iconBtn}
              title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
            >
              {soundEnabled ? "🔔" : "🔕"}
            </button>

            {/* Leave Room Form */}
            <form method="POST" action="/api/leave" style={{ margin: 0 }}>
              <button type="submit" style={styles.leaveBtn}>
                Exit
              </button>
            </form>
          </div>
        </div>

        {/* Permission Request Alert Banner (One-tap on Android) */}
        {notifPermission === "default" && (
          <div style={styles.notifBanner}>
            <span>Get push notifications when someone replies?</span>
            <button
              type="button"
              onClick={handleEnableNotifications}
              style={styles.enableNotifBtn}
            >
              Enable 🔔
            </button>
          </div>
        )}

        {/* Expandable Live Search Bar */}
        {isSearchOpen && (
          <div style={styles.searchBar}>
            <input
              type="text"
              placeholder="Search in room..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchMatchIndex(0);
              }}
              autoFocus
              style={styles.searchInput}
            />
            {searchQuery && (
              <div style={styles.searchControls}>
                <span style={styles.searchCount}>
                  {searchMatches.length > 0
                    ? `${searchMatchIndex + 1}/${searchMatches.length}`
                    : "No matches"}
                </span>
                <button
                  type="button"
                  onClick={handlePrevSearchMatch}
                  disabled={searchMatches.length === 0}
                  style={styles.searchArrowBtn}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={handleNextSearchMatch}
                  disabled={searchMatches.length === 0}
                  style={styles.searchArrowBtn}
                >
                  ▼
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
              style={styles.searchCloseBtn}
            >
              ✕
            </button>
          </div>
        )}
      </header>

      {/* Finding / History Loading Overlay */}
      {isFindingMsg && (
        <div style={styles.findingOverlay}>
          <span style={{ animation: "pulseLive 1s infinite" }}>🔍</span> Searching history...
        </div>
      )}

      {/* Messages Scroll View */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={styles.messageList}
        id="messages-container"
      >
        {/* Top Loading or Beginning Indicator */}
        <div style={styles.topStatusContainer}>
          {isLoadingOlder ? (
            <div style={styles.loadingPill}>
              <div style={styles.spinnerIcon} />
              <span>Fetching older messages...</span>
            </div>
          ) : !hasMoreOlder && messages.length > 0 ? (
            <div style={styles.endPill}>
              <span>✨</span> Conversation Started <span>✨</span>
            </div>
          ) : hasMoreOlder ? (
            <button
              onClick={loadOlderMessages}
              style={styles.loadOlderBtn}
              type="button"
            >
              ↑ Pull or Tap to Load Older Messages
            </button>
          ) : null}
        </div>

        {/* Empty State */}
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyStateIcon}>🚀</div>
            <div style={styles.emptyStateTitle}>Welcome to Room {room}!</div>
            <div style={styles.emptyStateSubtitle}>
              Be the first to send a message or start a conversation.
            </div>
            <div style={styles.quickStartChips}>
              {["👋 Hey everyone!", "🚀 Ready to chat!", "✨ How is it going?"].map(
                (chipText) => (
                  <button
                    key={chipText}
                    type="button"
                    onClick={() => handleSendMessage(chipText)}
                    style={styles.quickStartChip}
                  >
                    {chipText}
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwn = msg.name === name;
            const prevMsg = messages[index - 1];
            const showDate =
              !prevMsg ||
              new Date(prevMsg.ts).toDateString() !==
                new Date(msg.ts).toDateString();
            const isHighlighted = highlightedId === msg.id;
            const msgReactions = reactions[msg.id];
            const isSearchMatch =
              searchQuery.trim() &&
              msg.text.toLowerCase().includes(searchQuery.trim().toLowerCase());

            return (
              <div key={msg.id || `${msg.ts}-${index}`}>
                {showDate && (
                  <div style={styles.dateSeparator}>
                    <span style={styles.dateBadge}>
                      {formatDateSeparator(msg.ts)}
                    </span>
                  </div>
                )}
                <SwipeableAndroidMessage
                  msg={msg}
                  isOwn={isOwn}
                  isHighlighted={isHighlighted}
                  isSearchMatch={isSearchMatch}
                  reactions={msgReactions}
                  onReply={() => {
                    setReplyTo({ id: msg.id, name: msg.name, text: msg.text });
                    triggerHaptic("notch");
                    setTimeout(() => inputRef.current?.focus(), 60);
                  }}
                  onLongPress={() => {
                    setSelectedMessage(msg);
                    triggerHaptic("medium");
                  }}
                  onToggleReaction={(emoji) => handleToggleReaction(msg.id, emoji)}
                  onQuoteClick={findAndScrollToMessage}
                  onCopy={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(msg.text);
                      showToast("Copied to clipboard ✓");
                    }
                  }}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Floating Scroll to Bottom (FAB) with Unread Count */}
      {showScrollBottom && (
        <button
          onClick={() => {
            scrollToBottom(true);
            triggerHaptic("light");
          }}
          style={styles.fabScrollBottom}
          title="Scroll to latest"
          type="button"
        >
          <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>↓</span>
          {unreadBelowCount > 0 && (
            <span style={styles.unreadBadge}>
              {unreadBelowCount > 99 ? "99+" : unreadBelowCount}
            </span>
          )}
        </button>
      )}

      {/* Bottom Composer Area */}
      <div style={styles.bottomBar}>
        {/* Reply Preview Bar with Smooth Slide-in */}
        {replyTo && (
          <div style={styles.replyPreviewCard}>
            <div
              style={{
                ...styles.replyPreviewAccent,
                backgroundColor: colorForName(replyTo.name),
              }}
            />
            <div style={styles.replyPreviewDetails}>
              <div style={styles.replyPreviewHeader}>
                <span
                  style={{
                    color: colorForName(replyTo.name),
                    fontWeight: "700",
                    fontSize: "0.82rem",
                  }}
                >
                  ↩ Replying to {replyTo.name === name ? "yourself" : replyTo.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    triggerHaptic("light");
                  }}
                  style={styles.replyCancelBtn}
                >
                  ✕
                </button>
              </div>
              <div style={styles.replyPreviewText}>{replyTo.text}</div>
            </div>
          </div>
        )}

        {/* Quick Emoji Bar */}
        <div style={styles.quickEmojiBar}>
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setInputText((prev) => prev + emoji);
                triggerHaptic("light");
                inputRef.current?.focus();
              }}
              style={styles.quickEmojiBtn}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={styles.inputForm}
        >
          <div style={styles.inputWrapper}>
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                replyTo
                  ? `Replying to ${replyTo.name}...`
                  : "Message..."
              }
              maxLength={500}
              autoFocus
              style={styles.textInput}
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim()}
            style={{
              ...styles.sendBtn,
              transform: inputText.trim() ? "scale(1)" : "scale(0.92)",
              opacity: inputText.trim() ? 1 : 0.45,
              background: inputText.trim()
                ? "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)"
                : "#334155",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>

      {/* Android Long-Press Action Sheet Modal */}
      {selectedMessage && (
        <div
          style={styles.modalBackdrop}
          onClick={() => setSelectedMessage(null)}
        >
          <div
            style={styles.actionSheet}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.sheetHandle} />

            {/* Quick Reactions Bar in Sheet */}
            <div style={styles.sheetReactionsRow}>
              {QUICK_EMOJIS.map((emoji) => {
                const userReacted =
                  reactions[selectedMessage.id]?.userReacted?.includes(emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      handleToggleReaction(selectedMessage.id, emoji);
                      setSelectedMessage(null);
                    }}
                    style={{
                      ...styles.sheetEmojiBtn,
                      backgroundColor: userReacted ? "rgba(56, 189, 248, 0.3)" : "rgba(255,255,255,0.06)",
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            {/* Message Preview in Sheet */}
            <div style={styles.sheetMessagePreview}>
              <strong style={{ color: colorForName(selectedMessage.name) }}>
                {selectedMessage.name}:
              </strong>{" "}
              {selectedMessage.text}
            </div>

            {/* Sheet Action Buttons */}
            <div style={styles.sheetActionsList}>
              <button
                type="button"
                onClick={() => {
                  setReplyTo({
                    id: selectedMessage.id,
                    name: selectedMessage.name,
                    text: selectedMessage.text,
                  });
                  setSelectedMessage(null);
                  triggerHaptic("notch");
                  setTimeout(() => inputRef.current?.focus(), 60);
                }}
                style={styles.sheetActionItem}
              >
                <span style={styles.sheetActionIcon}>↩</span> Reply
              </button>

              <button
                type="button"
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(selectedMessage.text);
                    showToast("Message copied to clipboard ✓");
                  }
                  setSelectedMessage(null);
                }}
                style={styles.sheetActionItem}
              >
                <span style={styles.sheetActionIcon}>📋</span> Copy Text
              </button>

              <button
                type="button"
                onClick={() => {
                  findAndScrollToMessage(selectedMessage.id);
                  setSelectedMessage(null);
                }}
                style={styles.sheetActionItem}
              >
                <span style={styles.sheetActionIcon}>📍</span> Pin & Focus Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Android Gesture-Enhanced Swipeable Message Component
function SwipeableAndroidMessage({
  msg,
  isOwn,
  isHighlighted,
  isSearchMatch,
  reactions,
  onReply,
  onLongPress,
  onToggleReaction,
  onQuoteClick,
  onCopy,
}) {
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    direction: null,
    triggered: false,
  });
  const longPressTimer = useRef(null);
  const wrapperRef = useRef(null);

  const TRIGGER_THRESHOLD = 52;

  // Touch Gesture Handling for Android
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    let animFrame = null;

    const onTouchStart = (e) => {
      if (e.target.closest("button, a, [role='button']")) return;
      const t = e.touches[0];
      swipeRef.current = {
        active: true,
        startX: t.clientX,
        startY: t.clientY,
        direction: null,
        triggered: false,
      };

      longPressTimer.current = setTimeout(() => {
        if (swipeRef.current.active && !swipeRef.current.direction) {
          onLongPress();
        }
      }, 420);
    };

    const onTouchMove = (e) => {
      const s = swipeRef.current;
      if (!s.active) return;
      const t = e.touches[0];
      const dx = t.clientX - s.startX;
      const dy = t.clientY - s.startY;

      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(longPressTimer.current);
      }

      if (s.direction === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        s.direction = Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical";
      }

      if (s.direction === "vertical") return;

      if (dx > 0) {
        if (e.cancelable) e.preventDefault();
        setIsSwiping(true);
        const clamped = Math.min(dx * 0.58, 80);
        if (animFrame) cancelAnimationFrame(animFrame);
        animFrame = requestAnimationFrame(() => setTranslateX(clamped));

        if (clamped >= TRIGGER_THRESHOLD && !s.triggered) {
          s.triggered = true;
          triggerHaptic("notch");
        } else if (clamped < TRIGGER_THRESHOLD) {
          s.triggered = false;
        }
      }
    };

    const onTouchEnd = () => {
      clearTimeout(longPressTimer.current);
      const s = swipeRef.current;
      if (!s.active) return;
      const didTrigger = s.triggered;
      swipeRef.current = {
        active: false,
        startX: 0,
        startY: 0,
        direction: null,
        triggered: false,
      };
      setIsSwiping(false);
      if (animFrame) cancelAnimationFrame(animFrame);
      setTranslateX(0);

      if (didTrigger) {
        onReply();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      clearTimeout(longPressTimer.current);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [onLongPress, onReply]);

  const senderColor = colorForName(msg.name);
  const initials = getInitials(msg.name);
  const hasReactions = reactions && Object.keys(reactions.counts || {}).length > 0;

  return (
    <div
      ref={wrapperRef}
      id={`msg-${msg.id}`}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress();
      }}
      style={{
        ...styles.messageRow,
        justifyContent: isOwn ? "flex-end" : "flex-start",
        backgroundColor: isHighlighted
          ? "rgba(56, 189, 248, 0.25)"
          : isSearchMatch
          ? "rgba(234, 179, 8, 0.2)"
          : "transparent",
        transition: "background-color 0.4s ease",
      }}
    >
      {/* Animated Swipe Reply Indicator Icon */}
      <div
        style={{
          ...styles.swipeIndicator,
          opacity: Math.min(translateX / TRIGGER_THRESHOLD, 1),
          transform: `scale(${Math.min(0.6 + (translateX / TRIGGER_THRESHOLD) * 0.55, 1.25)}) rotate(${Math.min((translateX / TRIGGER_THRESHOLD) * 15, 20)}deg)`,
          backgroundColor: translateX >= TRIGGER_THRESHOLD ? "#38bdf8" : "#334155",
          color: translateX >= TRIGGER_THRESHOLD ? "#0f172a" : "#94a3b8",
        }}
      >
        ↩
      </div>

      {/* Message Bubble Container */}
      <div
        style={{
          ...styles.bubbleWrapper,
          transform: `translateX(${translateX}px)`,
          transition: isSwiping
            ? "none"
            : "transform 0.24s cubic-bezier(0.18, 0.89, 0.32, 1.28)",
          alignItems: isOwn ? "flex-end" : "flex-start",
        }}
      >
        {/* Avatar + Sender info for others */}
        {!isOwn && (
          <div style={styles.senderHeader}>
            <div
              style={{
                ...styles.avatarSmall,
                backgroundColor: senderColor,
              }}
            >
              {initials}
            </div>
            <span style={{ ...styles.senderNameText, color: senderColor }}>
              {msg.name}
            </span>
          </div>
        )}

        {/* Main Bubble Card */}
        <div
          style={{
            ...styles.bubbleCard,
            backgroundColor: isOwn ? "#1e40af" : "#1e293b",
            background: isOwn
              ? "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)"
              : "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
            borderTopRightRadius: isOwn ? 4 : 18,
            borderTopLeftRadius: isOwn ? 18 : 4,
            borderColor: isOwn ? "rgba(96, 165, 250, 0.3)" : "rgba(148, 163, 184, 0.15)",
          }}
        >
          {/* Quoted / Reply Preview Block */}
          {msg.replyTo && (
            <div
              onClick={() => onQuoteClick?.(msg.replyTo.id)}
              style={{
                ...styles.quotedBlock,
                borderLeftColor: colorForName(msg.replyTo.name),
              }}
              title="Tap to jump to quoted message"
            >
              <div
                style={{
                  ...styles.quotedSenderName,
                  color: colorForName(msg.replyTo.name),
                }}
              >
                {msg.replyTo.name}
              </div>
              <div style={styles.quotedContentText}>{msg.replyTo.text}</div>
            </div>
          )}

          {/* Message Body Text */}
          <div style={styles.messageContentText}>{msg.text}</div>

          {/* Footer: Quick reply button, timestamp, status checkmark */}
          <div style={styles.bubbleFooter}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReply();
              }}
              style={styles.inlineReplyBtn}
              title="Reply to message"
            >
              ↩
            </button>

            <span style={styles.messageTimestamp}>
              {formatMessageTime(msg.ts)}
            </span>

            {/* Android Delivery Checkmark Status for own messages */}
            {isOwn && (
              <span
                style={{
                  ...styles.statusCheck,
                  color: msg.status === "sending" ? "#94a3b8" : "#38bdf8",
                }}
              >
                {msg.status === "sending" ? "🕒" : "✓✓"}
              </span>
            )}
          </div>
        </div>

        {/* Interactive Reaction Pills */}
        {hasReactions && (
          <div style={styles.reactionsRow}>
            {Object.entries(reactions.counts).map(([emoji, count]) => {
              const isUserReacted = reactions.userReacted?.includes(emoji);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onToggleReaction(emoji)}
                  style={{
                    ...styles.reactionPill,
                    backgroundColor: isUserReacted
                      ? "rgba(56, 189, 248, 0.25)"
                      : "rgba(30, 41, 59, 0.9)",
                    borderColor: isUserReacted
                      ? "#38bdf8"
                      : "rgba(148, 163, 184, 0.2)",
                  }}
                >
                  <span>{emoji}</span>
                  <span style={styles.reactionCount}>{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Modern styling system tailored for Android chatroom experience
const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0f172a",
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#f8fafc",
    overflow: "hidden",
  },
  bgMesh: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `
      radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.12) 0px, transparent 50%),
      radial-gradient(at 100% 100%, rgba(14, 165, 233, 0.1) 0px, transparent 50%)
    `,
    pointerEvents: "none",
    zIndex: 0,
  },
  toastContainer: {
    position: "fixed",
    bottom: "90px",
    left: "50%",
    transform: "translateX(-50%)",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(56, 189, 248, 0.4)",
    color: "#f8fafc",
    padding: "8px 16px",
    borderRadius: "24px",
    fontSize: "0.85rem",
    fontWeight: "600",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    pointerEvents: "none",
  },
  header: {
    position: "relative",
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
    zIndex: 30,
    flexShrink: 0,
    paddingTop: "env(safe-area-inset-top, 0px)",
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  roomAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    fontSize: "0.85rem",
    color: "#ffffff",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    letterSpacing: "-0.5px",
  },
  headerInfo: {
    display: "flex",
    flexDirection: "column",
  },
  roomTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  roomTitle: {
    fontSize: "1.05rem",
    fontWeight: "700",
    color: "#f8fafc",
    letterSpacing: "-0.3px",
  },
  onlineBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "0.68rem",
    fontWeight: "600",
    color: "#4ade80",
    backgroundColor: "rgba(74, 222, 128, 0.12)",
    padding: "2px 7px",
    borderRadius: "10px",
    border: "1px solid rgba(74, 222, 128, 0.25)",
  },
  onlineDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#4ade80",
    animation: "pulseLive 2s infinite",
  },
  roomSubtitle: {
    fontSize: "0.76rem",
    color: "#94a3b8",
    marginTop: "1px",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  iconBtn: {
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "12px",
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.95rem",
    cursor: "pointer",
    touchAction: "manipulation",
    transition: "all 0.15s ease",
  },
  leaveBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#f87171",
    padding: "7px 12px",
    borderRadius: "12px",
    fontSize: "0.8rem",
    fontWeight: "600",
    cursor: "pointer",
    touchAction: "manipulation",
  },
  notifBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "7px 16px",
    backgroundColor: "rgba(30, 58, 138, 0.4)",
    borderTop: "1px solid rgba(56, 189, 248, 0.2)",
    fontSize: "0.78rem",
    color: "#cbd5e1",
  },
  enableNotifBtn: {
    backgroundColor: "#0284c7",
    color: "#ffffff",
    border: "none",
    padding: "4px 10px",
    borderRadius: "10px",
    fontSize: "0.74rem",
    fontWeight: "700",
    cursor: "pointer",
    touchAction: "manipulation",
  },
  searchBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px 12px 16px",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderTop: "1px solid rgba(148, 163, 184, 0.08)",
  },
  searchInput: {
    flex: 1,
    padding: "8px 14px",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    border: "1px solid rgba(56, 189, 248, 0.3)",
    borderRadius: "18px",
    color: "#f8fafc",
    fontSize: "0.85rem",
    outline: "none",
  },
  searchControls: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  searchCount: {
    fontSize: "0.72rem",
    color: "#94a3b8",
    marginRight: "4px",
  },
  searchArrowBtn: {
    background: "rgba(255, 255, 255, 0.08)",
    border: "none",
    color: "#f8fafc",
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "0.68rem",
  },
  searchCloseBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: "0.9rem",
    cursor: "pointer",
    padding: "4px 8px",
  },
  findingOverlay: {
    position: "absolute",
    top: "64px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(15, 23, 42, 0.9)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(56, 189, 248, 0.4)",
    color: "#38bdf8",
    fontSize: "0.8rem",
    fontWeight: "600",
    padding: "6px 16px",
    borderRadius: "20px",
    zIndex: 45,
    pointerEvents: "none",
    boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
  },
  messageList: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    WebkitOverflowScrolling: "touch",
    zIndex: 10,
  },
  topStatusContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "4px 0",
    minHeight: "32px",
  },
  loadingPill: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "0.78rem",
    color: "#94a3b8",
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    padding: "5px 14px",
    borderRadius: "20px",
    backdropFilter: "blur(8px)",
  },
  spinnerIcon: {
    width: "14px",
    height: "14px",
    border: "2px solid rgba(56, 189, 248, 0.2)",
    borderTopColor: "#38bdf8",
    borderRadius: "50%",
    animation: "pulseLive 0.8s linear infinite",
  },
  endPill: {
    fontSize: "0.72rem",
    fontWeight: "600",
    color: "#64748b",
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    padding: "4px 12px",
    borderRadius: "14px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  loadOlderBtn: {
    background: "rgba(30, 41, 59, 0.8)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    color: "#94a3b8",
    padding: "6px 16px",
    borderRadius: "18px",
    fontSize: "0.76rem",
    fontWeight: "600",
    cursor: "pointer",
    touchAction: "manipulation",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  },
  emptyState: {
    margin: "auto",
    textAlign: "center",
    color: "#94a3b8",
    padding: "40px 20px",
    maxWidth: "340px",
  },
  emptyStateIcon: {
    fontSize: "2.8rem",
    marginBottom: "12px",
    animation: "popIn 0.4s ease",
  },
  emptyStateTitle: {
    fontSize: "1.15rem",
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: "6px",
  },
  emptyStateSubtitle: {
    fontSize: "0.84rem",
    lineHeight: "1.4",
    color: "#64748b",
    marginBottom: "20px",
  },
  quickStartChips: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  quickStartChip: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    border: "1px solid rgba(56, 189, 248, 0.3)",
    color: "#e2e8f0",
    padding: "10px 16px",
    borderRadius: "14px",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
    touchAction: "manipulation",
    transition: "all 0.15s ease",
  },
  dateSeparator: {
    display: "flex",
    justifyContent: "center",
    margin: "12px 0 6px 0",
  },
  dateBadge: {
    fontSize: "0.7rem",
    fontWeight: "700",
    backgroundColor: "rgba(30, 41, 59, 0.85)",
    backdropFilter: "blur(10px)",
    color: "#94a3b8",
    padding: "3px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    letterSpacing: "0.3px",
  },
  messageRow: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "2px 0",
    borderRadius: "12px",
  },
  swipeIndicator: {
    position: "absolute",
    left: "4px",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1rem",
    fontWeight: "bold",
    pointerEvents: "none",
    zIndex: 5,
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    transition: "background-color 0.15s ease",
  },
  bubbleWrapper: {
    display: "flex",
    flexDirection: "column",
    maxWidth: "84%",
    minWidth: "110px",
  },
  senderHeader: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "3px",
    marginLeft: "2px",
  },
  avatarSmall: {
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.55rem",
    fontWeight: "800",
    color: "#ffffff",
  },
  senderNameText: {
    fontSize: "0.76rem",
    fontWeight: "700",
    letterSpacing: "-0.2px",
  },
  bubbleCard: {
    position: "relative",
    padding: "9px 12px 7px 12px",
    borderRadius: "18px",
    border: "1px solid",
    boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
    wordBreak: "break-word",
  },
  quotedBlock: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderLeft: "3.5px solid",
    borderRadius: "6px",
    padding: "5px 9px",
    marginBottom: "6px",
    fontSize: "0.78rem",
    cursor: "pointer",
    touchAction: "manipulation",
  },
  quotedSenderName: {
    fontWeight: "700",
    fontSize: "0.73rem",
    marginBottom: "1px",
  },
  quotedContentText: {
    color: "#cbd5e1",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: "0.75rem",
  },
  messageContentText: {
    fontSize: "0.92rem",
    lineHeight: "1.45",
    color: "#f8fafc",
    whiteSpace: "pre-wrap",
    letterSpacing: "-0.1px",
  },
  bubbleFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "6px",
    marginTop: "4px",
  },
  inlineReplyBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    fontSize: "0.78rem",
    cursor: "pointer",
    padding: "2px 4px",
    display: "inline-flex",
    alignItems: "center",
    touchAction: "manipulation",
  },
  messageTimestamp: {
    fontSize: "0.67rem",
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500",
  },
  statusCheck: {
    fontSize: "0.68rem",
    fontWeight: "700",
    letterSpacing: "-1px",
  },
  reactionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    marginTop: "-4px",
    marginBottom: "2px",
    zIndex: 10,
  },
  reactionPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 7px",
    borderRadius: "12px",
    border: "1px solid",
    fontSize: "0.72rem",
    cursor: "pointer",
    touchAction: "manipulation",
    boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
  },
  reactionCount: {
    fontWeight: "700",
    color: "#e2e8f0",
    fontSize: "0.68rem",
  },
  fabScrollBottom: {
    position: "fixed",
    right: "16px",
    bottom: "105px",
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    backgroundColor: "rgba(30, 41, 59, 0.9)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(56, 189, 248, 0.3)",
    color: "#38bdf8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
    cursor: "pointer",
    zIndex: 35,
    touchAction: "manipulation",
  },
  unreadBadge: {
    position: "absolute",
    top: "-4px",
    right: "-4px",
    backgroundColor: "#ef4444",
    color: "#ffffff",
    borderRadius: "10px",
    padding: "2px 6px",
    fontSize: "0.65rem",
    fontWeight: "800",
    border: "2px solid #0f172a",
  },
  bottomBar: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    backdropFilter: "blur(20px)",
    borderTop: "1px solid rgba(148, 163, 184, 0.12)",
    padding: "6px 12px 10px 12px",
    paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
    flexShrink: 0,
    zIndex: 30,
  },
  replyPreviewCard: {
    display: "flex",
    alignItems: "stretch",
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderRadius: "12px",
    marginBottom: "6px",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    overflow: "hidden",
    animation: "slideUp 0.2s ease",
  },
  replyPreviewAccent: {
    width: "4px",
    flexShrink: 0,
  },
  replyPreviewDetails: {
    flex: 1,
    padding: "6px 10px",
    minWidth: 0,
  },
  replyPreviewHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  replyCancelBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: "0.85rem",
    cursor: "pointer",
    padding: "2px 6px",
    touchAction: "manipulation",
  },
  replyPreviewText: {
    fontSize: "0.78rem",
    color: "#cbd5e1",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginTop: "1px",
  },
  quickEmojiBar: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    overflowX: "auto",
    padding: "2px 0 6px 0",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
  },
  quickEmojiBtn: {
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "14px",
    padding: "3px 8px",
    fontSize: "1.05rem",
    cursor: "pointer",
    touchAction: "manipulation",
    flexShrink: 0,
  },
  inputForm: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    width: "100%",
  },
  inputWrapper: {
    flex: 1,
    position: "relative",
  },
  textInput: {
    width: "100%",
    padding: "12px 18px",
    fontSize: "0.95rem",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "26px",
    outline: "none",
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    color: "#f8fafc",
    boxSizing: "border-box",
    touchAction: "manipulation",
    transition: "border-color 0.2s ease",
  },
  sendBtn: {
    color: "#ffffff",
    border: "none",
    borderRadius: "50%",
    width: "46px",
    height: "46px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    touchAction: "manipulation",
    flexShrink: 0,
    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
    transition: "transform 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28), opacity 0.15s ease",
  },
  modalBackdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    backdropFilter: "blur(6px)",
    zIndex: 150,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  actionSheet: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: "24px",
    borderTopRightRadius: "24px",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    width: "100%",
    maxWidth: "480px",
    padding: "12px 16px 24px 16px",
    paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
    animation: "slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
    boxShadow: "0 -10px 35px rgba(0,0,0,0.6)",
  },
  sheetHandle: {
    width: "36px",
    height: "4px",
    backgroundColor: "rgba(148, 163, 184, 0.3)",
    borderRadius: "2px",
    margin: "0 auto 12px auto",
  },
  sheetReactionsRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "6px",
    marginBottom: "14px",
    padding: "6px",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: "18px",
  },
  sheetEmojiBtn: {
    flex: 1,
    border: "none",
    borderRadius: "14px",
    padding: "8px 0",
    fontSize: "1.3rem",
    cursor: "pointer",
    touchAction: "manipulation",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.1s ease",
  },
  sheetMessagePreview: {
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    padding: "8px 12px",
    borderRadius: "10px",
    fontSize: "0.82rem",
    color: "#cbd5e1",
    marginBottom: "14px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sheetActionsList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  sheetActionItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    color: "#f8fafc",
    padding: "12px 16px",
    borderRadius: "14px",
    fontSize: "0.92rem",
    fontWeight: "600",
    cursor: "pointer",
    touchAction: "manipulation",
    textAlign: "left",
  },
  sheetActionIcon: {
    fontSize: "1.1rem",
  },
};
