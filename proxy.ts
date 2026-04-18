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

export function proxy(request: NextRequest) {
  const hosts = allowedAdminHosts();

  if (hosts.length === 0) {
    return NextResponse.next();
  }

  const currentHost = normalizedHost(request.headers.get("host"));

  if (hosts.includes(currentHost)) {
    return NextResponse.next();
  }

  return new NextResponse("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export const config = {
  matcher: ["/admin/:path*", "/login/:path*"]
};
