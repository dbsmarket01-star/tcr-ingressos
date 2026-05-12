import { NextResponse } from "next/server";
import { consumeGoogleOAuthCompletionToken, setBuyerProfile } from "@/features/customer-auth/google-buyer.service";

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
  const token = url.searchParams.get("token") || "";
  const result = consumeGoogleOAuthCompletionToken(token);

  if (!result) {
    return redirectWithStatus("/", request, "invalid");
  }

  await setBuyerProfile(result.profile);

  return redirectWithStatus(result.returnTo, request, "connected");
}
