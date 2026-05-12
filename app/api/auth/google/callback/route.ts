import { NextResponse } from "next/server";
import {
  consumeGoogleOAuthState,
  createGoogleOAuthCompletionToken,
  setBuyerProfile
} from "@/features/customer-auth/google-buyer.service";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleUserInfoResponse = {
  name?: string;
  email?: string;
  picture?: string;
  error?: string;
};

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

function sanitizeReturnTo(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function redirectWithStatus(returnTo: string, request: Request, status: string) {
  const redirectUrl = new URL(sanitizeReturnTo(returnTo), new URL(request.url).origin);
  redirectUrl.searchParams.set("google", status);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const stateResult = await consumeGoogleOAuthState(state);

  if (!stateResult.isValid || !code) {
    return redirectWithStatus(stateResult.returnTo, request, "invalid");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return redirectWithStatus(stateResult.returnTo, request, "unavailable");
  }

  const redirectUri = `${getGoogleCallbackBaseUrl(request)}/api/auth/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });

  const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    return redirectWithStatus(stateResult.returnTo, request, "invalid");
  }

  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`
    }
  });
  const userInfo = (await userInfoResponse.json()) as GoogleUserInfoResponse;

  if (!userInfoResponse.ok || !userInfo.email || !userInfo.name) {
    return redirectWithStatus(stateResult.returnTo, request, "invalid");
  }

  const profile = {
    name: userInfo.name,
    email: userInfo.email.toLowerCase(),
    picture: userInfo.picture
  };

  const currentOrigin = getBaseUrl(request);
  const finalOrigin = stateResult.finalOrigin;

  if (finalOrigin && finalOrigin !== currentOrigin) {
    const completeUrl = new URL("/api/auth/google/complete", finalOrigin);
    completeUrl.searchParams.set("token", createGoogleOAuthCompletionToken(profile, stateResult.returnTo));
    return NextResponse.redirect(completeUrl);
  }

  await setBuyerProfile(profile);

  return redirectWithStatus(stateResult.returnTo, request, "connected");
}
