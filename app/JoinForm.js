"use client";

import { requestNotificationPermission } from "@/lib/firebase-client";

export default function JoinForm({ lastName, lastRoom }) {
  const handleSubmit = async (e) => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      try {
        await requestNotificationPermission();
      } catch {
        // Continue even if permission was dismissed
      }
    }
  };

  return (
    <form method="POST" action="/api/join" onSubmit={handleSubmit}>
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
                inputMode="numeric"
                maxLength="10"
                defaultValue={lastRoom}
                placeholder="e.g. 1234"
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
  );
}
