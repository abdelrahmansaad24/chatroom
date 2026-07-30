// Builds the correct origin for redirects.
//
// `request.url` reports the origin the Node server thinks it's listening on
// (e.g. "http://0.0.0.0:3000" when started with `-H 0.0.0.0` for LAN access),
// not the host/IP the client actually connected to. Redirecting relative to
// that origin sends phones/other LAN devices to the unreachable 0.0.0.0
// address instead of back to e.g. 192.168.1.6:3000. Using the incoming
// `Host` header (what the client actually requested) fixes this.
export function requestOrigin(request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return `${protocol}://${host}`;
}
