import { NextResponse } from "next/server";
import { addMessage } from "@/lib/db";
import { requestOrigin } from "@/lib/url";
import { sendChatPush } from "@/lib/firebase-admin";

export async function POST(request) {
  const cookieStore = await request.cookies;
  const name = cookieStore.get("chat_name")?.value;
  const room = cookieStore.get("chat_room")?.value;
  const origin = requestOrigin(request);
  const referer = request.headers.get("referer") || "";

  let isLight = referer.includes("/light");

  if (!name || !room) {
    const isJson =
      request.headers.get("accept")?.includes("application/json") ||
      request.headers.get("content-type")?.includes("application/json");
    if (isJson) {
      return NextResponse.json({ error: "not joined" }, { status: 401 });
    }
    return NextResponse.redirect(new URL(isLight ? "/light" : "/", origin), 303);
  }

  let text = "";
  let replyTo = null;
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const body = await request.json();
      text = String(body.text || "").trim().slice(0, 500);
      if (body.replyTo && typeof body.replyTo === "object") {
        replyTo = body.replyTo;
      }
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
  } else {
    const form = await request.formData();
    if (form.get("source") === "light") isLight = true;
    text = String(form.get("text") || "").trim().slice(0, 500);
    const replyToId = String(form.get("replyToId") || "").trim();
    const replyToName = String(form.get("replyToName") || "").trim().slice(0, 20);
    const replyToText = String(form.get("replyToText") || "").trim().slice(0, 500);
    if (replyToName && replyToText) {
      replyTo = { id: replyToId, name: replyToName, text: replyToText };
    }
  }

  let messageDoc = null;
  if (text) {
    messageDoc = await addMessage(room, name, text, replyTo);
    sendChatPush(room, name, text, replyTo, messageDoc);
  }

  if (
    contentType.includes("application/json") ||
    request.headers.get("accept")?.includes("application/json")
  ) {
    return NextResponse.json({
      ok: true,
      message: messageDoc
        ? {
            id: String(messageDoc._id),
            name: messageDoc.name,
            text: messageDoc.text,
            ts: new Date(messageDoc.createdAt).getTime(),
            replyTo: messageDoc.replyTo || null,
          }
        : null,
    });
  }

  const redirectUrl = isLight ? "/light/room" : "/room";
  return NextResponse.redirect(new URL(redirectUrl, origin), 303);
}
