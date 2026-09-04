import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMessages } from "@/lib/db";
import { colorForName } from "@/lib/colors";
import { normalizeRoom } from "@/lib/room";
import ChatRoomClient from "./ChatRoomClient";

export const dynamic = "force-dynamic";

export default async function RoomPage() {
  const cookieStore = await cookies();
  const name = cookieStore.get("chat_name")?.value;
  const rawRoom = cookieStore.get("chat_room")?.value;

  if (!name || !rawRoom) {
    redirect("/");
  }

  const room = normalizeRoom(rawRoom);

  // Initial load fetches the last 10 messages
  const docs = await getMessages(room, 10);
  const initialMessages = docs.map((m) => ({
    id: String(m._id),
    name: m.name,
    text: m.text,
    ts: new Date(m.createdAt).getTime(),
    replyTo: m.replyTo || null,
  }));

  const myColor = colorForName(name);

  return (
    <>
      <noscript>
        <meta httpEquiv="refresh" content="5" />
        <table
          width="100%"
          cellPadding="6"
          style={{ borderCollapse: "collapse" }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  background: "#2c3e50",
                  color: "#fff",
                }}
              >
                <b>Room {room}</b> &nbsp;|&nbsp; You:{" "}
                <b style={{ color: myColor === "#2c3e50" ? "#ecf0f1" : myColor }}>
                  {name}
                </b>
              </td>
            </tr>
            <tr>
              <td style={{ background: "#ecf0f1" }}>
                <form method="POST" action="/api/leave">
                  <input type="submit" value="Leave room" />
                </form>
              </td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #bbb" }}>
                <table width="100%" cellPadding="4" cellSpacing="0">
                  <tbody>
                    {initialMessages.length === 0 ? (
                      <tr>
                        <td style={{ color: "#777" }}>
                          No messages yet. Say hello!
                        </td>
                      </tr>
                    ) : (
                      initialMessages.map((m) => (
                        <tr key={m.id}>
                          <td
                            style={{
                              borderBottom: "1px solid #eee",
                              background: m.name === name ? "#f5f9ff" : "#fff",
                            }}
                          >
                            <b style={{ color: colorForName(m.name) }}>
                              {m.name}
                            </b>
                            {m.replyTo && (
                              <div style={{ fontSize: "0.8em", color: "#666" }}>
                                [Replying to {m.replyTo.name}: {m.replyTo.text}]
                              </div>
                            )}
                            : {m.text}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style={{ background: "#ecf0f1" }}>
                <form method="POST" action="/api/send">
                  <input
                    type="text"
                    name="text"
                    maxLength="500"
                    autoFocus
                    style={{ width: "70%" }}
                  />
                  <input type="submit" value="Send" />
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </noscript>

      {/* Modern React interactive chatroom client */}
      <ChatRoomClient room={room} name={name} initialMessages={initialMessages} />
    </>
  );
}
