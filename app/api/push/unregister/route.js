import { NextResponse } from "next/server";
import { removeFcmToken } from "@/lib/db";

// Called when the client can no longer receive push (permission revoked,
// leaving the room, etc.) so we stop trying to send to a stale token.
export async function POST(request) {
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

  await removeFcmToken(token);
  return NextResponse.json({ ok: true });
}
