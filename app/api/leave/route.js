import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/url";

export async function POST(request) {
  const origin = requestOrigin(request);
  const response = NextResponse.redirect(new URL("/", origin), 303);
  response.cookies.set("chat_name", "", { maxAge: 0, path: "/" });
  response.cookies.set("chat_room", "", { maxAge: 0, path: "/" });
  return response;
}
