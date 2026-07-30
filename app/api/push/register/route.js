import { NextResponse } from "next/server";
import { saveFcmToken } from "@/lib/db";

// Called by the client once it has an FCM device token, so the server
// knows where to send push notifications for this room.
export async function POST(request) {
  const cookieStore = request.cookies;
  const name = cookieStore.get("chat_name")?.value;
  const room = cookieStore.get("chat_room")?.value;

  if (!name || !room) {
    return NextResponse.json({ error: "not joined" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const token = String(body.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  await saveFcmToken(room, name, token);
  return NextResponse.json({ ok: true });
}
