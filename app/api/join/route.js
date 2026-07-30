import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/url";

const YEAR = 60 * 60 * 24 * 30; // 30 days in seconds

export async function POST(request) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim().slice(0, 20);
  const room = String(form.get("room") || "").trim().slice(0, 20);

  const origin = requestOrigin(request);
  if (!name || !room) {
    return NextResponse.redirect(new URL("/", origin), 303);
  }

  const response = NextResponse.redirect(new URL("/room", origin), 303);
  response.cookies.set("chat_name", name, { maxAge: YEAR, path: "/" });
  response.cookies.set("chat_room", room, { maxAge: YEAR, path: "/" });
  return response;
}
