import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMessages } from "@/lib/db";
import { colorForName } from "@/lib/colors";
import { normalizeRoom } from "@/lib/room";

export const dynamic = "force-dynamic";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default async function LightRoomPage({ searchParams }) {
  const cookieStore = await cookies();
  const name = cookieStore.get("chat_name")?.value;
  const rawRoom = cookieStore.get("chat_room")?.value;

  if (!name || !rawRoom) {
    redirect("/light");
  }

  const room = normalizeRoom(rawRoom);

  const params = await searchParams;
  const replyId = params?.replyId || "";
  const replyName = params?.replyName || "";
  const replyText = params?.replyText || "";

  // Fetch the latest 20 messages (no infinite fetch/scroll)
  const docs = await getMessages(room, 20);
  const messages = docs.map((m) => ({
    id: String(m._id),
    name: m.name,
    text: m.text,
    ts: new Date(m.createdAt).getTime(),
    replyTo: m.replyTo || null,
  }));

  const myColor = colorForName(name);

  return (
    <div
      style={{
        height: "80%",
        margin: "0",
        padding: "6px",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "13px",
        backgroundColor: "#ffffff",
        color: "#111111",
        lineHeight: "1.3",
      }}
    >
      <meta httpEquiv="refresh" content="6" />

      {/* Header Table */}
      <table
        width="100%"
        cellPadding="6"
        cellSpacing="0"
        style={{
          borderCollapse: "collapse",
          backgroundColor: "#2c3e50",
          color: "#ffffff",
          marginBottom: "6px",
        }}
      >
        <tbody>
          <tr>
            <td>
              <b>Room {room}</b> | You:{" "}
              <b style={{ color: myColor === "#2c3e50" ? "#ffd700" : myColor }}>
                {name}
              </b>
            </td>
            <td align="right">
              <a
                href="/light/room"
                style={{ color: "#ecf0f1", textDecoration: "underline", fontSize: "12px", marginRight: "8px" }}
              >
                [Refresh]
              </a>
              <form method="POST" action="/api/leave" style={{ display: "inline", margin: 0 }}>
                <input type="hidden" name="source" value="light" />
                <input
                  type="submit"
                  value="Leave"
                  style={{
                    backgroundColor: "#e74c3c",
                    color: "#fff",
                    border: "none",
                    padding: "2px 8px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                />
              </form>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Messages List Table */}
      <table
        width="100%"
        cellPadding="5"
        cellSpacing="0"
        style={{
          borderCollapse: "collapse",
          border: "1px solid #d0d7de",
          backgroundColor: "#ffffff",
        }}
      >
        <tbody>
          {messages.length === 0 ? (
            <tr>
              <td style={{ textAlign: "center", color: "#888", padding: "16px" }}>
                No messages yet in Room {room}. Send a message above!
              </td>
            </tr>
          ) : (
            messages.map((m, idx) => {
              const isOwn = m.name === name;
              const senderColor = colorForName(m.name);
              const replyUrl = `/light/room?replyId=${encodeURIComponent(m.id)}&replyName=${encodeURIComponent(
                m.name
              )}&replyText=${encodeURIComponent(m.text.slice(0, 80))}`;

              return (
                <tr
                  key={m.id}
                  style={{
                    backgroundColor: isOwn ? "#f7fbff" : idx % 2 === 0 ? "#ffffff" : "#fafafa",
                    borderBottom: "1px solid #e1e4e8",
                  }}
                >
                  <td style={{ verticalAlign: "top" }}>
                    <div style={{ marginBottom: "2px" }}>
                      <b style={{ color: senderColor }}>{m.name}</b>
                      {isOwn ? <span style={{ color: "#777", fontSize: "11px" }}> (You)</span> : null}
                      <span style={{ color: "#888", fontSize: "11px", marginLeft: "6px" }}>
                        {formatTime(m.ts)}
                      </span>
                    </div>

                    {/* Quoted Message */}
                    {m.replyTo ? (
                      <div
                        style={{
                          backgroundColor: "#edf2f7",
                          borderLeft: "2px solid #3182ce",
                          padding: "2px 6px",
                          marginBottom: "4px",
                          fontSize: "11px",
                          color: "#4a5568",
                        }}
                      >
                        <b>{m.replyTo.name}</b>: {m.replyTo.text}
                      </div>
                    ) : null}

                    {/* Message Text */}
                    <div style={{ wordBreak: "break-word", fontSize: "13px", color: "#24292e" }}>
                      {m.text}
                    </div>
                  </td>
                  <td width="55" align="right" style={{ verticalAlign: "top" }}>
                    <a
                      href={replyUrl}
                      style={{
                        color: "#0366d6",
                        textDecoration: "none",
                        fontSize: "11px",
                        backgroundColor: "#edf2f7",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        border: "1px solid #cbd5e0",
                        display: "inline-block",
                      }}
                    >
                      Reply
                    </a>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {/* Reply Status / Send Form */}
      <div
        style={{
          backgroundColor: "#f4f6f9",
          border: "1px solid #ccd0d5",
          padding: "6px",
          marginBottom: "8px",
        }}
      >
        {replyName && replyText ? (
          <div
            style={{
              backgroundColor: "#e8f4fd",
              borderLeft: "3px solid #2980b9",
              padding: "4px 6px",
              marginBottom: "6px",
              fontSize: "12px",
            }}
          >
            Replying to <b style={{ color: colorForName(replyName) }}>{replyName}</b>: &ldquo;
            {replyText.slice(0, 40)}
            {replyText.length > 40 ? "..." : ""}&rdquo;{" "}
            <a href="/light/room" style={{ color: "#c0392b", marginLeft: "6px" }}>
              [Cancel Reply]
            </a>
          </div>
        ) : null}

        <form method="POST" action="/api/send" style={{ margin: 0 }}>
          <input type="hidden" name="source" value="light" />
          {replyName && replyText ? (
            <>
              <input type="hidden" name="replyToId" value={replyId} />
              <input type="hidden" name="replyToName" value={replyName} />
              <input type="hidden" name="replyToText" value={replyText} />
            </>
          ) : null}

          <table width="100%" cellPadding="0" cellSpacing="0">
            <tbody>
              <tr>
                <td>
                  <input
                    type="text"
                    name="text"
                    maxLength="500"
                    placeholder={replyName ? `Reply to ${replyName}...` : "Write a message..."}
                    autoFocus
                    required
                    style={{
                      width: "98%",
                      padding: "5px",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </td>
                <td width="70" align="right">
                  <input
                    type="submit"
                    value="Send"
                    style={{
                      backgroundColor: "#27ae60",
                      color: "#ffffff",
                      border: "none",
                      padding: "5px 12px",
                      fontSize: "13px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </form>
      </div>

      {/* Footer */}
      <div style={{ marginTop: "8px", fontSize: "11px", color: "#888", textAlign: "center" }}>
        Auto-refreshes every 6s | <a href="/light/room" style={{ color: "#555" }}>Refresh Now</a> |{" "}
        <a href="/room" style={{ color: "#555" }}>Switch to Android/Full App</a>
      </div>
    </div>
  );
}
