import { NextResponse } from "next/server";
import { consumeGoogleOAuthState, setBuyerProfile } from "@/features/customer-auth/google-buyer.service";
import { prisma } from "@/lib/prisma";

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
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
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

  const redirectUri = `${getBaseUrl(request)}/api/auth/google/callback`;
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

  const existingCustomer = await prisma.customer.findFirst({
    where: {
      email: userInfo.email.toLowerCase()
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      document: true,
      phone: true
    }
  });

  await setBuyerProfile({
    name: userInfo.name,
    email: userInfo.email.toLowerCase(),
    document: existingCustomer?.document ?? null,
    phone: existingCustomer?.phone ?? null,
    picture: userInfo.picture
  });

  return redirectWithStatus(stateResult.returnTo, request, "connected");
}
