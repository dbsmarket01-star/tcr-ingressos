import { AdminRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ensureDefaultOrganizationBackfill } from "@/features/organizations/organization.service";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "tcr_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type SessionPayload = {
  sub: string;
  email: string;
  role: string;
  exp: number;
};

export type CurrentAdmin = {
  id: string;
  organizationId: string | null;
  name: string;
  email: string;
  role: AdminRole;
  accessAllEvents: boolean;
  allowedEventIds: string[];
};

export type AuthenticatedAdmin = CurrentAdmin & {
  passwordHash: string;
};

export type AdminArea =
  | "DASHBOARD"
  | "EVENTS"
  | "ORDERS"
  | "SUPPORT"
  | "FINANCE"
  | "CHECKIN"
  | "TICKETS"
  | "SECURITY"
  | "SUBSCRIPTIONS"
  | "DEVICES"
  | "INCIDENTS"
  | "CUSTOMERS"
  | "BILLING"
  | "ACCOUNT"
  | "AUDIT"
  | "REPORTS"
  | "PRODUCTION"
  | "SETTINGS"
  | "USERS";

const areaPermissions: Record<AdminArea, AdminRole[]> = {
  DASHBOARD: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.FINANCE, AdminRole.SUPPORT, AdminRole.STAFF],
  EVENTS: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.STAFF],
  ORDERS: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.FINANCE, AdminRole.SUPPORT, AdminRole.STAFF],
  SUPPORT: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.SUPPORT, AdminRole.STAFF],
  FINANCE: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.FINANCE],
  CHECKIN: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.CHECKIN],
  TICKETS: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.SUPPORT, AdminRole.CHECKIN, AdminRole.STAFF],
  SECURITY: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.SUPPORT, AdminRole.STAFF],
  SUBSCRIPTIONS: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.FINANCE, AdminRole.SUPPORT],
  DEVICES: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.SUPPORT, AdminRole.STAFF],
  INCIDENTS: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.SUPPORT, AdminRole.STAFF],
  CUSTOMERS: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.SUPPORT, AdminRole.STAFF],
  BILLING: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.FINANCE],
  ACCOUNT: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.FINANCE, AdminRole.SUPPORT, AdminRole.STAFF, AdminRole.CHECKIN],
  AUDIT: [AdminRole.OWNER],
  REPORTS: [AdminRole.OWNER, AdminRole.MANAGER, AdminRole.FINANCE],
  PRODUCTION: [AdminRole.OWNER, AdminRole.MANAGER],
  SETTINGS: [AdminRole.OWNER],
  USERS: [AdminRole.OWNER]
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET precisa ser configurado em producao.");
  }

  return "tcr-ingressos-local-development-secret";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function createSessionToken(payload: SessionPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function parseSessionToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  if (!safeCompare(signature, sign(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;

    if (!payload.sub || !payload.email || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function createAdminSession(admin: CurrentAdmin) {
  const cookieStore = await cookies();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const token = createSessionToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role,
    exp: expiresAt
  });

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const defaultOrganizationId = await ensureDefaultOrganizationBackfill();
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const payload = parseSessionToken(token);

  if (!payload) {
    return null;
  }

  const admin = await prisma.adminUser.findFirst({
    where: {
      id: payload.sub,
      email: payload.email,
      isActive: true
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      email: true,
      role: true,
      accessAllEvents: true,
      allowedEventIds: true
    }
  });

  if (!admin) {
    return null;
  }

  if (admin.organizationId) {
    return admin;
  }

  await prisma.adminUser.update({
    where: {
      id: admin.id
    },
    data: {
      organizationId: defaultOrganizationId
    }
  });

  return {
    ...admin,
    organizationId: defaultOrganizationId
  };
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/login");
  }

  return admin;
}

export function getAdminAllowedEventIds(admin: CurrentAdmin): string[] | null {
  if (admin.role === AdminRole.OWNER || admin.accessAllEvents) {
    return null;
  }

  return admin.allowedEventIds;
}

export function canAccessEvent(admin: CurrentAdmin, eventId: string) {
  const allowedEventIds = getAdminAllowedEventIds(admin);
  return !allowedEventIds || allowedEventIds.includes(eventId);
}

export async function requireEventAccess(eventId: string) {
  const admin = await requireAdmin();

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organizationId: admin.organizationId
    },
    select: {
      id: true
    }
  });

  if (!event || !canAccessEvent(admin, eventId)) {
    redirect("/admin/events");
  }

  return admin;
}

export function canAccessArea(role: AdminRole, area: AdminArea) {
  return areaPermissions[area].includes(role);
}

export async function requirePermission(area: AdminArea) {
  const admin = await requireAdmin();

  if (!canAccessArea(admin.role, area)) {
    redirect("/admin");
  }

  return admin;
}

export async function findActiveAdminByEmail(email: string) {
  const defaultOrganizationId = await ensureDefaultOrganizationBackfill();
  const admin = await prisma.adminUser.findFirst({
    where: {
      email,
      isActive: true
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      accessAllEvents: true,
      allowedEventIds: true
    }
  });

  if (!admin) {
    return null;
  }

  if (admin.organizationId) {
    return admin;
  }

  await prisma.adminUser.update({
    where: {
      id: admin.id
    },
    data: {
      organizationId: defaultOrganizationId
    }
  });

  return {
    ...admin,
    organizationId: defaultOrganizationId
  };
}
