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

function isInternalPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/login" || pathname.startsWith("/login/");
}

function isAllowedAdminHostAsset(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/uploads/") ||
    pathname === "/favicon.ico" ||
    /\.(?:avif|css|gif|ico|jpg|jpeg|js|png|svg|webp|woff2?)$/i.test(pathname)
  );
}

function notFound() {
  return withInternalHeaders(
    new NextResponse("Not found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store"
      }
    })
  );
}

export function proxy(request: NextRequest) {
  const hosts = allowedAdminHosts();
  const currentHost = normalizedHost(request.nextUrl.hostname || request.headers.get("host"));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-resolved-host", currentHost);

  if (hosts.length === 0) {
    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
  }

  const isAdminHost = hosts.includes(currentHost);
  const { pathname } = request.nextUrl;

  if (isAdminHost && pathname === "/") {
    return withInternalHeaders(NextResponse.redirect(new URL("/login", request.url)));
  }

  if (isAdminHost && (isInternalPath(pathname) || isAllowedAdminHostAsset(pathname))) {
    return withInternalHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders
        }
      })
    );
  }

  if (isAdminHost) {
    return notFound();
  }

  if (isInternalPath(pathname)) {
    return notFound();
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
