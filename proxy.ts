import { NextResponse, type NextRequest } from "next/server";

function normalizedHost(host: string | null) {
  return (host || "").split(":")[0].toLowerCase();
}

function allowedAdminHosts() {
  return (process.env.ADMIN_HOST || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function withInternalHeaders(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export function proxy(request: NextRequest) {
  const hosts = allowedAdminHosts();

  if (hosts.length === 0) {
    return withInternalHeaders(NextResponse.next());
  }

  const currentHost = normalizedHost(request.headers.get("host"));

  if (hosts.includes(currentHost)) {
    return withInternalHeaders(NextResponse.next());
  }

  return withInternalHeaders(
    new NextResponse("Not found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store"
      }
    })
  );
}

export const config = {
  matcher: ["/admin/:path*", "/login/:path*"]
};
