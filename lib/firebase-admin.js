import admin from "firebase-admin";
import { getTokensForRoom, removeFcmTokens } from "@/lib/db";

// Server-side Firebase Admin setup, used to push chat notifications to
// devices that aren't actively polling/streaming (tab closed, phone locked,
// etc). This is the "push" half of the push+pull hybrid: /api/stream and
// /api/chat still poll Mongo for the source of truth, FCM just wakes up
// devices faster / while backgrounded.
//
// Requires a Firebase service-account key (Project settings > Service
// accounts > Generate new private key) exposed via env vars. If those
// vars are missing we no-op instead of throwing, so the app still works
// without push configured.

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Private keys stored in .env files usually have their newlines escaped.
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

function getFirebaseAdmin() {
  if (!projectId || !clientEmail || !privateKey) return null;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
  return admin.apps[0];
}

// Fire-and-forget push to everyone else in `room`. Never throws — a push
// failure should never prevent the message from being saved/shown.
export async function sendChatPush(room, senderName, text) {
  try {
    const app = getFirebaseAdmin();
    if (!app) return; // push not configured

    const tokens = await getTokensForRoom(room, senderName);
    if (tokens.length === 0) return;

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: `${senderName} in ${room}`,
        body: text.slice(0, 150),
      },
      data: { room, name: senderName, text },
      webpush: {
        fcmOptions: { link: "/room" },
        notification: { icon: "/next.svg" },
      },
    });

    const deadTokens = [];
    response.responses.forEach((r, i) => {
      // Stale/unregistered tokens should be pruned so future sends don't
      // keep retrying them.
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
  } catch {
    // Transient Firebase hiccup — the message is already saved and will
    // still reach clients via SSE/polling, so just swallow the error.
  }
}
