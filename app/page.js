import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import JoinForm from "./JoinForm";

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
            <JoinForm lastName={lastName} lastRoom={lastRoom} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}
