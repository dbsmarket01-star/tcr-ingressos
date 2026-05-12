import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BUYER_COOKIE_NAME = "ingresaas_buyer_profile";
const GOOGLE_STATE_COOKIE_NAME = "ingresaas_google_oauth_state";
const GOOGLE_RETURN_COOKIE_NAME = "ingresaas_google_oauth_return";
const LEGACY_BUYER_COOKIE_NAME = "tcr_buyer_profile";
const LEGACY_GOOGLE_STATE_COOKIE_NAME = "tcr_google_oauth_state";
const LEGACY_GOOGLE_RETURN_COOKIE_NAME = "tcr_google_oauth_return";
const BUYER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const STATE_COOKIE_MAX_AGE_SECONDS = 60 * 10;

export type BuyerProfile = {
  name: string;
  email: string;
  document?: string | null;
  phone?: string | null;
  picture?: string;
};

type GoogleOAuthStatePayload = {
  version: 2;
  returnTo: string;
  finalOrigin: string;
  nonce: string;
  expiresAt: number;
};

type GoogleOAuthCompletionPayload = {
  version: 1;
  profile: BuyerProfile;
  returnTo: string;
  nonce: string;
  expiresAt: number;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET precisa ser configurado em producao.");
  }

  return "ingresaas-local-development-secret";
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

function isValidReturnPath(value: string) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

function isValidHttpOrigin(value?: string | null) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function createExpiringToken<T extends { expiresAt: number; nonce: string }>(
  payload: Omit<T, "expiresAt" | "nonce">,
  maxAgeSeconds: number
) {
  return encodeSignedPayload({
    ...payload,
    nonce: randomBytes(16).toString("base64url"),
    expiresAt: Date.now() + maxAgeSeconds * 1000
  });
}

function decodeExpiringToken<T extends { expiresAt: number }>(token: string) {
  const payload = decodeSignedPayload<T>(token);

  if (!payload || typeof payload.expiresAt !== "number" || payload.expiresAt < Date.now()) {
    return null;
  }

  return payload;
}

export async function createGoogleOAuthState(returnTo: string, finalOrigin: string) {
  const cookieStore = await cookies();
  const safeReturnTo = isValidReturnPath(returnTo) ? returnTo : "/";
  const safeFinalOrigin = isValidHttpOrigin(finalOrigin) ? finalOrigin.replace(/\/$/, "") : "";
  const state = createExpiringToken<GoogleOAuthStatePayload>(
    {
      version: 2,
      returnTo: safeReturnTo,
      finalOrigin: safeFinalOrigin
    },
    STATE_COOKIE_MAX_AGE_SECONDS
  );

  cookieStore.set(GOOGLE_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  cookieStore.set(GOOGLE_RETURN_COOKIE_NAME, safeReturnTo, {
    httpOnly: true,
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  cookieStore.delete(LEGACY_GOOGLE_STATE_COOKIE_NAME);
  cookieStore.delete(LEGACY_GOOGLE_RETURN_COOKIE_NAME);

  return state;
}

export async function consumeGoogleOAuthState(receivedState: string) {
  const cookieStore = await cookies();
  const savedState =
    cookieStore.get(GOOGLE_STATE_COOKIE_NAME)?.value ||
    cookieStore.get(LEGACY_GOOGLE_STATE_COOKIE_NAME)?.value;
  const returnTo =
    cookieStore.get(GOOGLE_RETURN_COOKIE_NAME)?.value ||
    cookieStore.get(LEGACY_GOOGLE_RETURN_COOKIE_NAME)?.value ||
    "/";

  cookieStore.delete(GOOGLE_STATE_COOKIE_NAME);
  cookieStore.delete(GOOGLE_RETURN_COOKIE_NAME);
  cookieStore.delete(LEGACY_GOOGLE_STATE_COOKIE_NAME);
  cookieStore.delete(LEGACY_GOOGLE_RETURN_COOKIE_NAME);

  const signedState = decodeExpiringToken<GoogleOAuthStatePayload>(receivedState);

  if (
    signedState?.version === 2 &&
    isValidReturnPath(signedState.returnTo) &&
    isValidHttpOrigin(signedState.finalOrigin)
  ) {
    return {
      isValid: true,
      returnTo: signedState.returnTo,
      finalOrigin: signedState.finalOrigin.replace(/\/$/, "")
    };
  }

  if (!savedState || savedState !== receivedState) {
    return {
      isValid: false,
      returnTo,
      finalOrigin: null
    };
  }

  return {
    isValid: true,
    returnTo,
    finalOrigin: null
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
  cookieStore.delete(LEGACY_BUYER_COOKIE_NAME);
}

export function createGoogleOAuthCompletionToken(profile: BuyerProfile, returnTo: string) {
  return createExpiringToken<GoogleOAuthCompletionPayload>(
    {
      version: 1,
      profile,
      returnTo: isValidReturnPath(returnTo) ? returnTo : "/"
    },
    STATE_COOKIE_MAX_AGE_SECONDS
  );
}

export function consumeGoogleOAuthCompletionToken(token: string) {
  const payload = decodeExpiringToken<GoogleOAuthCompletionPayload>(token);

  if (!payload?.profile?.email || !payload.profile.name || !isValidReturnPath(payload.returnTo)) {
    return null;
  }

  return {
    profile: {
      ...payload.profile,
      email: payload.profile.email.toLowerCase()
    },
    returnTo: payload.returnTo
  };
}

export async function getBuyerProfile() {
  const cookieStore = await cookies();
  return decodeSignedPayload<BuyerProfile>(
    cookieStore.get(BUYER_COOKIE_NAME)?.value || cookieStore.get(LEGACY_BUYER_COOKIE_NAME)?.value
  );
}
