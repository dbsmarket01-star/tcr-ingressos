import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_PLATFORM_DOMAIN = "ingresaas.app.br";
const LEGACY_PLATFORM_DOMAINS = ["ingressas.app.br"];

export function normalizedHost(host: string | null) {
  const trimmed = (host || "")
    .split(",")
    .map((part) => part.trim())
    .find(Boolean)
    ?.toLowerCase();

  if (!trimmed) {
    return "";
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const [hostname] = withoutProtocol.split("/");

  return hostname?.split(":")[0] || "";
}

export function platformHosts() {
  const configured = normalizedHost(process.env.PLATFORM_DOMAIN || "");
  const hosts = new Set<string>([DEFAULT_PLATFORM_DOMAIN, ...LEGACY_PLATFORM_DOMAINS]);

  if (configured) {
    hosts.add(configured);
  }

  for (const host of Array.from(hosts)) {
    hosts.add(`www.${host}`);
  }

  return hosts;
}

export function allowedAdminHosts() {
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

export function isInternalPath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

export function isAllowedAdminHostAsset(pathname: string) {
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
  const currentHost = normalizedHost(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("x-original-host") ||
      request.headers.get("host") ||
      request.nextUrl.hostname
  );
  const isPlatformMasterHost = platformHosts().has(currentHost);
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
    const hasAdminSession = Boolean(
      request.cookies.get("ingresaas_admin_session")?.value || request.cookies.get("tcr_admin_session")?.value
    );

    return withInternalHeaders(NextResponse.redirect(new URL(hasAdminSession ? "/admin" : "/login", request.url)));
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

  if (isPlatformMasterHost && isInternalPath(pathname)) {
    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
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
