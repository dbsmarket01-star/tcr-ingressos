import {
  getCurrentAdmin,
  canAccessArea,
  getAdminAllowedEventIds,
} from "@/features/auth/auth.service";
export async function campaignAdmin(request?: Request) {
  if (
    request &&
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    throw new Error("FORBIDDEN");
  const admin = await getCurrentAdmin();
  if (
    !admin ||
    !canAccessArea(admin.role, "MARKETING") ||
    getAdminAllowedEventIds(admin) !== null
  )
    throw new Error("FORBIDDEN");
  return admin;
}
