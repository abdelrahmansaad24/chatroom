import { NextResponse } from "next/server";
import { isAaaaRoom } from "@/lib/room";

const YEAR = 60 * 60 * 24 * 30; // 30 days in seconds

export function proxy(request) {
  const roomCookie = request.cookies.get("chat_room")?.value;

  if (roomCookie && isAaaaRoom(roomCookie)) {
    const isNavigation =
      request.destination === "document" ||
      request.headers.get("accept")?.includes("text/html");

    if (isNavigation) {
      // Cleanly redirect browser with updated cookie to room 8888
      const url = request.nextUrl.clone();
      const response = NextResponse.redirect(url, 307);
      response.cookies.set("chat_room", "8888", {
        maxAge: YEAR,
        path: "/",
        sameSite: "lax",
      });
      return response;
    }

    // For background/fetch/API requests, update cookie on the response
    const response = NextResponse.next();
    response.cookies.set("chat_room", "8888", {
      maxAge: YEAR,
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
