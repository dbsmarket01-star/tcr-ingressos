import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_PLATFORM_DOMAIN = "ingresaas.app.br";
const LEGACY_PLATFORM_DOMAINS = ["ingressas.app.br"];
const TCR_LEGACY_EVENT_PATHS: Record<string, string> = {
  "ovnlwqeQ1nTrEpwwYgt5h6i*EvnxKhLJ88wGE9_HqmQ:": "fernandinho-santo-andre-2026",
  "0hwVgLowlRH4438I_oGnKbailkaEyKOxd*EACpYKgF8:": "geriatricus-em-santo-andre-2026",
  "0hwVgLowlRH4438I_oGnKZLEC6tPpb7kqlfiHApapos:": "geriatricus-em-suzano-2026",
  "0hwVgLowlRH4438I_oGnKTZEwjTa0AyjtvEsx*e1wLM:": "rodrigo-teaser-em-marilia-2026",
  "0hwVgLowlRH4438I_oGnKfY465tNWRwtAKdF1oWg0Ws:": "rodrigo-teaser-em-taubate-2026",
  "0hwVgLowlRH4438I_oGnKW3NmayPU*_n2sR605GN9ec:": "rodrigo-teaser-em-piracicaba-2026",
  "0hwVgLowlRH4438I_oGnKUAj1xCQYkXmbXPQLwZHgs2_4T_jztDNwLeRYdG9O5zS": "rodrigo-teaser-em-piracicaba-2026",
  "0hwVgLowlRH4438I_oGnKSUWYslKqBDWMG1436FUqW4:": "rodrigo-teaser-em-sao-caetano-do-sul-2026",
  "0hwVgLowlRH4438I_oGnKQf8P3oa5EvHrBCxxjuNbPXYSgpU*vW6aVpDOmBzsOKY": "rodrigo-teaser-em-sao-caetano-do-sul-2026",
  "0hwVgLowlRH4438I_oGnKWBPB*kK2lPQn97fBv8Zo6c:": "rodrigo-teaser-em-sorocaba-2026",
  "HDyXwCcXvS6DhuU9I9s_yioj9*wLDONhafKRx59oVGk:": "guilherme-arantes-sao-caetano-do-sul"
};

export function legacyTcrRedirectPath(pathname: string): string | null {
  if (pathname === "/home") return "/";
  try {
    const legacyId = decodeURIComponent(pathname.slice(1));
    const slug = TCR_LEGACY_EVENT_PATHS[legacyId];
    return slug ? `/evento/${slug}` : null;
  } catch {
    return null;
  }
}

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

function withInternalHeaders(response: NextResponse, privateContent = true, allowMicrophone = false) {
  if (privateContent) response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("Permissions-Policy", `camera=(self), microphone=${allowMicrophone ? "(self)" : "()"}, geolocation=()`);

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
  if (currentHost === "tcringressos.com.br" || currentHost === "www.tcringressos.com.br") {
    const destination = legacyTcrRedirectPath(request.nextUrl.pathname);
    if (destination) return NextResponse.redirect(new URL(destination, request.url), 301);
  }
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

    return withInternalHeaders(
      NextResponse.rewrite(new URL(hasAdminSession ? "/admin" : "/login", request.url), {
        request: {
          headers: requestHeaders
        }
      })
    );
  }

  if (isAdminHost && (isInternalPath(pathname) || isAllowedAdminHostAsset(pathname))) {
    return withInternalHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders
        }
      }),
      isInternalPath(pathname),
      pathname === "/admin/crm/whatsapp"
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
