/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow LAN access in dev mode (phones on the same WiFi hitting the
  // machine's local IP) without Next.js blocking it as a cross-origin request.
  allowedDevOrigins: ["192.168.1.6", "192.168.1.0/24"],
};

export default nextConfig;
