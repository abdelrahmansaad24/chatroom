import { getMessagesSince } from "@/lib/db";

// Server-Sent Events endpoint that pushes new chat messages to the browser
// in real time, so JS-enabled clients don't have to wait for the 5s
// meta-refresh (kept as a no-JS/J2ME fallback, see app/room/page.js).
//
// Free/no-extra-infra approach: we already run a long-lived Node process
// (`next start -H 0.0.0.0`), so a plain HTTP streaming response works fine
// and needs no third-party push service. We poll Mongo every second for
// messages newer than the last one seen — cheap, and avoids requiring a
// replica set for Change Streams.

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 1000;
const HEARTBEAT_MS = 15000;

export async function GET(request) {
  const room = request.cookies.get("chat_room")?.value;

  if (!room) {
    return new Response("missing room", { status: 400 });
  }

  const encoder = new TextEncoder();
  let since = new Date();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event, data) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const poll = async () => {
        try {
          const docs = await getMessagesSince(room, since, 50);
          if (docs.length > 0) {
            since = docs[docs.length - 1].createdAt;
            for (const m of docs) {
              send("message", {
                id: String(m._id),
                name: m.name,
                text: m.text,
                ts: new Date(m.createdAt).getTime(),
              });
            }
          }
        } catch {
          // Transient DB hiccup — just try again on the next tick.
        }
      };

      const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
      // Keep intermediary proxies/load balancers from closing an "idle"
      // connection when the room is quiet.
      const heartbeatTimer = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, HEARTBEAT_MS);

      const close = () => {
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
