import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const cookieStore = await cookies();
  const lastName = cookieStore.get("chat_name")?.value || "";
  const lastRoom = cookieStore.get("chat_room")?.value || "";

  // Already logged in from a previous visit — skip straight to the room
  // instead of asking the user to confirm "Continue as ...".
  if (lastName && lastRoom) {
    redirect("/room");
  }

  return (
    <table
      width="100%"
      cellPadding="6"
      style={{ borderCollapse: "collapse" }}
    >
      <tbody>
        <tr>
          <td style={{ background: "#2c3e50", color: "#fff" }}>
            <h2 style={{ margin: 0 }}>Chat Rooms</h2>
          </td>
        </tr>

        <tr>
          <td style={{ border: "1px solid #bbb" }}>
            <form method="POST" action="/api/join">
              <table cellPadding="4">
                <tbody>
                  <tr>
                    <td>Your name:</td>
                    <td>
                      <input
                        type="text"
                        name="name"
                        maxLength="20"
                        defaultValue={lastName}
                        required
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>Room code:</td>
                    <td>
                      <input
                        type="text"
                        name="room"
                        maxLength="20"
                        defaultValue={lastRoom}
                        required
                      />
                    </td>
                  </tr>
                  <tr>
                    <td colSpan="2">
                      <input type="submit" value="Join / Create room" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </form>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
