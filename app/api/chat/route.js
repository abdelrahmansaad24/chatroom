import { NextResponse } from "next/server";
import { getMessagesSince, getMessagesBefore, getMessages, addMessage } from "@/lib/db";
import { sendChatPush } from "@/lib/firebase-admin";

// Plain JSON API used by web client (infinite scroll / polling) and lightweight clients.
//
// GET  /api/chat?room=1812&before=<epoch ms>&limit=10
//   -> { serverTime, messages: [{ id, name, text, ts, replyTo }], hasMore }
//
// POST /api/chat   body: { room, name, text, replyTo }
//   -> { ok: true }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const room = (searchParams.get("room") || "").trim().slice(0, 20);
  const sinceParam = searchParams.get("since");
  const beforeParam = searchParams.get("before");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 10, 1), 50);

  if (!room) {
    return NextResponse.json({ error: "room is required" }, { status: 400 });
  }

  let docs = [];
  let hasMore = false;

  if (beforeParam) {
    const ms = Number(beforeParam);
    const beforeDate = !Number.isNaN(ms) && ms > 0 ? new Date(ms) : new Date(beforeParam);
    docs = await getMessagesBefore(room, beforeDate, limit);
    hasMore = docs.length === limit;
  } else if (sinceParam) {
    const ms = Number(sinceParam);
    const sinceDate = !Number.isNaN(ms) && ms > 0 ? new Date(ms) : new Date(sinceParam);
    docs = await getMessagesSince(room, sinceDate, limit);
    hasMore = false;
  } else {
    docs = await getMessages(room, limit);
    hasMore = docs.length === limit;
  }

  return NextResponse.json({
    serverTime: Date.now(),
    hasMore,
    messages: docs.map((m) => ({
      id: String(m._id),
      name: m.name,
      text: m.text,
      ts: new Date(m.createdAt).getTime(),
      replyTo: m.replyTo || null,
    })),
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const room = String(body.room || "").trim().slice(0, 20);
  const name = String(body.name || "").trim().slice(0, 20);
  const text = String(body.text || "").trim().slice(0, 500);
  const replyTo = body.replyTo && typeof body.replyTo === "object" ? body.replyTo : null;

  if (!room || !name || !text) {
    return NextResponse.json(
      { error: "room, name and text are required" },
      { status: 400 }
    );
  }

  const messageDoc = await addMessage(room, name, text, replyTo);
  // Fire-and-forget: don't block response on push
  sendChatPush(room, name, text, replyTo, messageDoc);

  return NextResponse.json({
    ok: true,
    message: {
      id: String(messageDoc._id),
      name: messageDoc.name,
      text: messageDoc.text,
      ts: new Date(messageDoc.createdAt).getTime(),
      replyTo: messageDoc.replyTo || null,
    },
  });
}
