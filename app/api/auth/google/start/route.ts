import { NextResponse } from "next/server";
import { createGoogleOAuthState } from "@/features/customer-auth/google-buyer.service";

function getBaseUrl(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || requestUrl.host;
  const protocol = forwardedProto || requestUrl.protocol.replace(/:$/, "");
  const origin = `${protocol}://${host}`.replace(/\/$/, "");

  if (!origin.includes("localhost") && !origin.includes("127.0.0.1") && !origin.includes("[::1]")) {
    return origin;
  }

  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || origin).replace(/\/$/, "");
}

function getGoogleCallbackBaseUrl(request: Request) {
  const configured = process.env.GOOGLE_OAUTH_CALLBACK_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const currentBaseUrl = getBaseUrl(request);

  if (currentBaseUrl.includes("localhost") || currentBaseUrl.includes("127.0.0.1")) {
    return currentBaseUrl;
  }

  return "https://www.tcringressos.app.br";
}

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function redirectWithStatus(returnTo: string, request: Request, status: string) {
  const redirectUrl = new URL(returnTo, new URL(request.url).origin);
  redirectUrl.searchParams.set("google", status);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return redirectWithStatus(returnTo, request, "unavailable");
  }

  const state = await createGoogleOAuthState(returnTo, getBaseUrl(request));
  const redirectUri = `${getGoogleCallbackBaseUrl(request)}/api/auth/google/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(authUrl);
}
