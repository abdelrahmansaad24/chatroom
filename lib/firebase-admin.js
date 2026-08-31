import admin from "firebase-admin";
import { getTokensForRoom, getTokensForUser, removeFcmTokens } from "@/lib/db";

// Server-side Firebase Admin setup, used to push chat notifications to
// devices that aren't actively polling/streaming (tab closed, phone locked,
// etc).

const cleanStr = (val) => (val ? String(val).replace(/^"|"$/g, "").trim() : "");

const projectId = cleanStr(process.env.FIREBASE_PROJECT_ID);
const clientEmail = cleanStr(process.env.FIREBASE_CLIENT_EMAIL);
let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
if (privateKey) {
  privateKey = privateKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

function getFirebaseAdmin() {
  if (!projectId || !clientEmail || !privateKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[FCM] Server push notifications disabled: FIREBASE_CLIENT_EMAIL and/or FIREBASE_PRIVATE_KEY are missing in .env.local"
      );
    }
    return null;
  }

  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    } catch (err) {
      console.error("[FCM] Failed to initialize Firebase Admin:", err);
      return null;
    }
  }
  return admin.apps[0];
}

async function sendMulticastSafely(tokens, payload) {
  if (!tokens || tokens.length === 0) return;
  try {
    const title = payload.notification?.title || "New chat message";
    const body = payload.notification?.body || payload.data?.text || "New message in chatroom";

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      ...payload,
      webpush: {
        headers: {
          Urgency: "high",
        },
        fcmOptions: {
          link: "/room",
        },
        notification: {
          title,
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          vibrate: [200, 100, 200],
          requireInteraction: false,
          tag: `chatroom-${payload.data?.room || "general"}`,
          renotify: true,
        },
      },
    });

    const deadTokens = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error) {
        const code = r.error.code || "";
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-argument")
        ) {
          deadTokens.push(tokens[i]);
        }
      }
    });
    if (deadTokens.length) await removeFcmTokens(deadTokens);
  } catch (err) {
    console.error("[FCM] sendEachForMulticast error:", err);
  }
}

// Fire-and-forget push to relevant room members.
export async function sendChatPush(room, senderName, text, replyTo = null, messageDoc = null) {
  try {
    const app = getFirebaseAdmin();
    if (!app) return; // Push not configured on server

    const replyAuthor = replyTo?.name;
    const msgId = messageDoc?._id ? String(messageDoc._id) : `${Date.now()}-${senderName}`;
    const msgTs = messageDoc?.createdAt ? String(new Date(messageDoc.createdAt).getTime()) : String(Date.now());

    if (replyAuthor && replyAuthor !== senderName) {
      // 1. Send targeted notification to the author of the message being replied to
      const targetTokens = await getTokensForUser(room, replyAuthor);
      if (targetTokens.length > 0) {
        await sendMulticastSafely(targetTokens, {
          notification: {
            title: `💬 ${senderName} replied to you`,
            body: text.slice(0, 150),
          },
          data: {
            id: msgId,
            ts: msgTs,
            room: String(room),
            name: String(senderName),
            text: String(text),
            replyToName: String(replyAuthor),
            replyToText: String(replyTo.text || "").slice(0, 100),
            isReplyToYou: "true",
          },
        });
      }

      // 2. Send regular notification to other room members (excluding sender and replied author)
      const otherTokens = await getTokensForRoom(room, [senderName, replyAuthor]);
      if (otherTokens.length > 0) {
        await sendMulticastSafely(otherTokens, {
          notification: {
            title: `💬 ${senderName} in Room ${room}`,
            body: text.slice(0, 150),
          },
          data: {
            id: msgId,
            ts: msgTs,
            room: String(room),
            name: String(senderName),
            text: String(text),
            replyToName: String(replyAuthor),
            replyToText: String(replyTo.text || "").slice(0, 100),
            isReplyToYou: "false",
          },
        });
      }
    } else {
      // Standard room notification
      const tokens = await getTokensForRoom(room, senderName);
      if (tokens.length > 0) {
        await sendMulticastSafely(tokens, {
          notification: {
            title: `💬 ${senderName} in Room ${room}`,
            body: text.slice(0, 150),
          },
          data: {
            id: msgId,
            ts: msgTs,
            room: String(room),
            name: String(senderName),
            text: String(text),
            isReplyToYou: "false",
          },
        });
      }
    }
  } catch (err) {
    console.error("[FCM] Push dispatch failed:", err);
  }
}
