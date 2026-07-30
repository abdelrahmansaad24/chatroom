import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMessages } from "@/lib/db";
import { colorForName } from "@/lib/colors";
import ChatStream from "./ChatStream";

export const dynamic = "force-dynamic";

export default async function RoomPage() {
  const cookieStore = await cookies();
  const name = cookieStore.get("chat_name")?.value;
  const room = cookieStore.get("chat_room")?.value;

  if (!name || !room) {
    redirect("/");
  }

  const messages = await getMessages(room, 50);
  const myColor = colorForName(name);

  return (
    <>
      {/* JS-enabled browsers get live updates via SSE (ChatStream) instead;
          this only fires for no-JS/old clients (e.g. feature phones). */}
      <noscript>
        <meta httpEquiv="refresh" content="5" />
      </noscript>
      <ChatStream room={room} name={name} />
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
                <tbody id="messages">
                  {messages.length === 0 ? (
                    <tr data-empty="true">
                      <td style={{ color: "#777" }}>
                        No messages yet. Say hello!
                      </td>
                    </tr>
                  ) : (
                    messages.map((m) => (
                      <tr key={String(m._id)}>
                        <td
                          style={{
                            borderBottom: "1px solid #eee",
                            background: m.name === name ? "#f5f9ff" : "#fff",
                          }}
                        >
                          <b style={{ color: colorForName(m.name) }}>
                            {m.name}
                          </b>
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
    </>
  );
}
