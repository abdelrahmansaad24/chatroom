export const metadata = {
  title: "Chat Rooms",
  description: "Minimal chat rooms",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial, Helvetica, sans-serif", margin: 8 }}>
        {children}
      </body>
    </html>
  );
}
