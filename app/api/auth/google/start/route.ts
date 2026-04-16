import { NextResponse } from "next/server";
import { createGoogleOAuthState } from "@/features/customer-auth/google-buyer.service";

function getBaseUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
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

  const state = await createGoogleOAuthState(returnTo);
  const redirectUri = `${getBaseUrl(request)}/api/auth/google/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(authUrl);
}
