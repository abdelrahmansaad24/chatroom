import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeRoom } from "@/lib/room";

export const dynamic = "force-dynamic";

export default async function LightHomePage() {
  const cookieStore = await cookies();
  const lastName = cookieStore.get("chat_name")?.value || "";
  const rawLastRoom = cookieStore.get("chat_room")?.value || "";
  const lastRoom = normalizeRoom(rawLastRoom);

  // Already logged in — skip straight to the light room
  if (lastName && lastRoom) {
    redirect("/light/room");
  }

  return (
    <div style={{ padding: "8px", fontFamily: "sans-serif", fontSize: "14px", backgroundColor: "#fff", color: "#000" }}>
      <table width="100%" cellPadding="6" cellSpacing="0" style={{ border: "1px solid #999", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ background: "#2c3e50", color: "#ffffff", padding: "8px" }}>
              <strong style={{ fontSize: "16px" }}>Chat Rooms (Lite)</strong>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "10px" }}>
              <form method="POST" action="/api/join">
                <input type="hidden" name="source" value="light" />
                <table cellPadding="4" cellSpacing="0" width="100%">
                  <tbody>
                    <tr>
                      <td><b>Your Name:</b></td>
                      <td>
                        <input
                          type="text"
                          name="name"
                          maxLength="20"
                          defaultValue={lastName}
                          required
                          style={{ width: "100%", padding: "4px" }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td><b>Room Code:</b></td>
                      <td>
                        <input
                          type="text"
                          name="room"
                          inputMode="numeric"
                          maxLength="10"
                          defaultValue={lastRoom}
                          placeholder="e.g. 1234"
                          required
                          style={{ width: "100%", padding: "4px" }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td></td>
                      <td>
                        <input
                          type="submit"
                          value="Join / Enter Room"
                          style={{ padding: "6px 12px", fontWeight: "bold" }}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </form>
            </td>
          </tr>
          <tr>
            <td style={{ background: "#f0f0f0", fontSize: "12px", color: "#666", padding: "6px" }}>
              Lightweight mode for J2ME &amp; 2G Mobile Phones. <a href="/">Switch to Modern App</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
