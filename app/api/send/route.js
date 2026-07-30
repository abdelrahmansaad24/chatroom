import { NextResponse } from "next/server";
import { addMessage } from "../../../lib/db";
import { requestOrigin } from "@/lib/url";

export async function POST(request) {
  const form = await request.formData();
  const cookieStore = request.cookies;
  const name = cookieStore.get("chat_name")?.value;
  const room = cookieStore.get("chat_room")?.value;
  const text = String(form.get("text") || "").trim().slice(0, 500);

  const origin = requestOrigin(request);

  if (!name || !room) {
    return NextResponse.redirect(new URL("/", origin), 303);
  }
  if (text) {
    await addMessage(room, name, text);
  }
  return NextResponse.redirect(new URL("/room", origin), 303);
}
