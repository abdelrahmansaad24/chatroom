export const metadata = {
  title: "Chat Rooms",
  description: "Modern Android-optimized real-time chat rooms",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ height: "100%", margin: 0, padding: 0 }}>
      <head>
        <meta name="theme-color" content="#1e293b" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>{`
          * {
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
          }
          body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            height: 100%;
            background-color: #0f172a;
            color: #f8fafc;
            overflow: hidden;
            overscroll-behavior-y: none;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          /* Android smooth custom scrollbars */
          ::-webkit-scrollbar {
            width: 4px;
            height: 4px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.25);
            border-radius: 999px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(148, 163, 184, 0.45);
          }
          @keyframes pulseLive {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.85); }
          }
          @keyframes popIn {
            0% { transform: scale(0.8); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes slideUp {
            0% { transform: translateY(12px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes toastSlide {
            0% { transform: translate(-50%, 20px); opacity: 0; }
            15% { transform: translate(-50%, 0); opacity: 1; }
            85% { transform: translate(-50%, 0); opacity: 1; }
            100% { transform: translate(-50%, 20px); opacity: 0; }
          }
          @keyframes ripple {
            0% { transform: scale(0); opacity: 0.7; }
            100% { transform: scale(2.5); opacity: 0; }
          }
          .custom-toast {
            animation: toastSlide 2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
