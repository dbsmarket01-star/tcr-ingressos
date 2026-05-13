import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/request-host";

function addHostCandidate(hosts: Set<string>, value?: string | null) {
  const host = normalizeHost(value);

  if (!host) {
    return;
  }

  hosts.add(host);

  if (host.startsWith("www.")) {
    hosts.add(host.slice(4));
    return;
  }

  hosts.add(`www.${host}`);
}

function addUrlHostCandidate(hosts: Set<string>, value?: string | null) {
  if (!value) {
    return;
  }

  try {
    addHostCandidate(hosts, new URL(value).host);
  } catch {
    addHostCandidate(hosts, value);
  }
}

export async function getMaintenanceOrganizationForRequest(request: Request) {
  const hosts = new Set<string>();
  const url = new URL(request.url);

  addHostCandidate(hosts, request.headers.get("x-resolved-host"));
  addHostCandidate(hosts, request.headers.get("x-forwarded-host"));
  addHostCandidate(hosts, request.headers.get("x-original-host"));
  addHostCandidate(hosts, request.headers.get("host"));
  addHostCandidate(hosts, url.host);
  addUrlHostCandidate(hosts, process.env.NEXT_PUBLIC_APP_URL);
  addUrlHostCandidate(hosts, process.env.APP_URL);

  const hostCandidates = [...hosts];

  if (hostCandidates.length === 0) {
    return null;
  }

  const organization = await prisma.organization.findFirst({
    where: {
      isActive: true,
      OR: [
        {
          publicDomain: {
            in: hostCandidates
          }
        },
        {
          adminDomain: {
            in: hostCandidates
          }
        }
      ]
    },
    select: {
      id: true,
      slug: true,
      name: true,
      publicDomain: true,
      adminDomain: true
    }
  });

  if (!organization && process.env.NODE_ENV === "production") {
    throw new Error(`Bilheteria nao encontrada para manutencao: ${hostCandidates.join(", ")}`);
  }

  return organization;
}
