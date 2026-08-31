import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/url";
import { normalizeRoom } from "@/lib/room";

const YEAR = 60 * 60 * 24 * 30; // 30 days in seconds

export async function POST(request) {
  const origin = requestOrigin(request);
  const form = await request.formData();
  const name = String(form.get("name") || "").trim().slice(0, 20);
  const rawRoom = form.get("room") || "";
  const room = normalizeRoom(rawRoom);
  const source = String(form.get("source") || "");
  const referer = request.headers.get("referer") || "";
  const isLight = source === "light" || referer.includes("/light");

  const failRedirect = isLight ? "/light" : "/";
  const successRedirect = isLight ? "/light/room" : "/room";

  if (!name || !room) {
    return NextResponse.redirect(new URL(failRedirect, origin), 303);
  }

  const response = NextResponse.redirect(new URL(successRedirect, origin), 303);
  response.cookies.set("chat_name", name, { maxAge: YEAR, path: "/" });
  response.cookies.set("chat_room", room, { maxAge: YEAR, path: "/" });
  return response;
}

