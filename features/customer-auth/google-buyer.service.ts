import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BUYER_COOKIE_NAME = "tcr_buyer_profile";
const GOOGLE_STATE_COOKIE_NAME = "tcr_google_oauth_state";
const GOOGLE_RETURN_COOKIE_NAME = "tcr_google_oauth_return";
const BUYER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const STATE_COOKIE_MAX_AGE_SECONDS = 60 * 10;

export type BuyerProfile = {
  name: string;
  email: string;
  picture?: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET precisa ser configurado em producao.");
  }

  return "tcr-ingressos-local-development-secret";
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeSignedPayload(payload: unknown) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function decodeSignedPayload<T>(token?: string) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !safeCompare(signature, sign(encodedPayload))) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function createGoogleOAuthState(returnTo: string) {
  const cookieStore = await cookies();
  const state = randomBytes(24).toString("base64url");

  cookieStore.set(GOOGLE_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  cookieStore.set(GOOGLE_RETURN_COOKIE_NAME, returnTo, {
    httpOnly: true,
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return state;
}

export async function consumeGoogleOAuthState(receivedState: string) {
  const cookieStore = await cookies();
  const savedState = cookieStore.get(GOOGLE_STATE_COOKIE_NAME)?.value;
  const returnTo = cookieStore.get(GOOGLE_RETURN_COOKIE_NAME)?.value || "/";

  cookieStore.delete(GOOGLE_STATE_COOKIE_NAME);
  cookieStore.delete(GOOGLE_RETURN_COOKIE_NAME);

  if (!savedState || savedState !== receivedState) {
    return {
      isValid: false,
      returnTo
    };
  }

  return {
    isValid: true,
    returnTo
  };
}

export async function setBuyerProfile(profile: BuyerProfile) {
  const cookieStore = await cookies();

  cookieStore.set(BUYER_COOKIE_NAME, encodeSignedPayload(profile), {
    httpOnly: true,
    maxAge: BUYER_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function getBuyerProfile() {
  const cookieStore = await cookies();
  return decodeSignedPayload<BuyerProfile>(cookieStore.get(BUYER_COOKIE_NAME)?.value);
}
