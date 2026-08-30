import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/url";

export async function POST(request) {
  const origin = requestOrigin(request);
  let isLight = false;
  try {
    const form = await request.formData();
    isLight = form.get("source") === "light";
  } catch {
    // not form data
  }
  const referer = request.headers.get("referer") || "";
  if (referer.includes("/light")) isLight = true;

  const targetPath = isLight ? "/light" : "/";
  const response = NextResponse.redirect(new URL(targetPath, origin), 303);
  response.cookies.set("chat_name", "", { maxAge: 0, path: "/" });
  response.cookies.set("chat_room", "", { maxAge: 0, path: "/" });
  return response;
}
