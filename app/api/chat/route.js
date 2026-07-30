import { NextResponse } from "next/server";
import { getMessagesSince, addMessage } from "../../../lib/db";

// Plain JSON API used by lightweight/non-browser clients (e.g. the J2ME
// feature-phone app) that can't rely on cookies or HTML forms.
//
// GET  /api/chat?room=1812&since=<epoch ms, optional>
//   -> { serverTime, messages: [{ name, text, ts }] }
//
// POST /api/chat   body: { room, name, text }
//   -> { ok: true }

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const room = (searchParams.get("room") || "").trim().slice(0, 20);
  const sinceParam = searchParams.get("since");

  if (!room) {
    return NextResponse.json({ error: "room is required" }, { status: 400 });
  }

  let since = null;
  if (sinceParam) {
    const ms = Number(sinceParam);
    if (!Number.isNaN(ms) && ms > 0) {
      since = new Date(ms);
    }
  }

  const docs = since
    ? await getMessagesSince(room, since, 100)
    : await getMessagesSince(room, null, 50);

  return NextResponse.json({
    serverTime: Date.now(),
    messages: docs.map((m) => ({
      name: m.name,
      text: m.text,
      ts: new Date(m.createdAt).getTime(),
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

  if (!room || !name || !text) {
    return NextResponse.json(
      { error: "room, name and text are required" },
      { status: 400 }
    );
  }

  await addMessage(room, name, text);
  return NextResponse.json({ ok: true });
}
