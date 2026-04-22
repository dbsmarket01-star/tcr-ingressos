type PublicUrlOrganization = {
  publicDomain?: string | null;
  adminDomain?: string | null;
};

function normalizeDomain(host?: string | null) {
  const value = host?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return value || null;
}

export function getPublicBaseUrl(organization?: PublicUrlOrganization | null) {
  const organizationDomain = normalizeDomain(organization?.publicDomain);

  if (organizationDomain) {
    if (organizationDomain.includes("localhost") || organizationDomain.startsWith("127.0.0.1")) {
      return `http://${organizationDomain}`;
    }

    return `https://${organizationDomain}`;
  }

  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getAdminBaseUrl(organization?: PublicUrlOrganization | null) {
  const organizationDomain = normalizeDomain(organization?.adminDomain);

  if (organizationDomain) {
    if (organizationDomain.includes("localhost") || organizationDomain.startsWith("127.0.0.1")) {
      return `http://${organizationDomain}`;
    }

    return `https://${organizationDomain}`;
  }

  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getPublicEventUrl(slug: string, organization?: PublicUrlOrganization | null) {
  return `${getPublicBaseUrl(organization)}/evento/${slug}`;
}

export function getPublicLeadCaptureUrl(slug: string, organization?: PublicUrlOrganization | null) {
  return `${getPublicBaseUrl(organization)}/lista/${slug}`;
}
