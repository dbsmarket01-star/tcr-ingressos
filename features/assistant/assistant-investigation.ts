import { prisma } from "@/lib/prisma";
import { getAdminAllowedEventIds, type CurrentAdmin } from "@/features/auth/auth.service";

const repository = "dbsmarket01-star/tcr-ingressos";
const maxFileBytes = 24_000;

type ToolCall = { name: string; arguments: string };

export const assistantInvestigationTools = [
  {
    type: "function", name: "list_events", description: "Search the real TCR event catalog. Returns IDs, dates, status, city and slug; use an ID before editing.",
    strict: true, parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false }
  },
  {
    type: "function", name: "inspect_event", description: "Read one real event and all its ticket lots in sortOrder, including paused lots. Never assumes a lot is visible solely because it exists.",
    strict: true, parameters: { type: "object", properties: { eventId: { type: "string" } }, required: ["eventId"], additionalProperties: false }
  },
  {
    type: "function", name: "find_code_files", description: "Find source-code paths in the deployed TCR commit by filename/path. Read-only; never includes environment files.",
    strict: true, parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false }
  },
  {
    type: "function", name: "read_code_file", description: "Read a source file from the deployed TCR commit. Read-only; use a path returned by find_code_files.",
    strict: true, parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false }
  }
] as const;

function safeSourcePath(path: string) {
  if (!/^[a-zA-Z0-9_./@+ -]+$/.test(path) || path.startsWith("/") || path.split("/").some((part) => !part || part === "." || part === "..")) return false;
  if (/(^|\/)(\.env[^/]*|\.git|node_modules|\.next|private|secrets?)(\/|$)/i.test(path)) return false;
  return /\.(tsx?|jsx?|json|md|prisma|css|sql|ya?ml)$/.test(path);
}

export function assistantSourcePathIsSafe(path: string) { return safeSourcePath(path); }

async function githubJson<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "TCR-Admin-Assistant" },
    signal: AbortSignal.timeout(8000), next: { revalidate: 300 }
  });
  if (!response.ok) throw new Error(`GitHub retornou HTTP ${response.status}.`);
  return response.json() as Promise<T>;
}

export async function executeAssistantInvestigationTool(admin: CurrentAdmin, call: ToolCall): Promise<string> {
  let args: Record<string, unknown>;
  try { args = JSON.parse(call.arguments) as Record<string, unknown>; }
  catch { return JSON.stringify({ error: "Argumentos inválidos." }); }
  const allowedEventIds = getAdminAllowedEventIds(admin);

  if (call.name === "list_events") {
    const query = String(args.query || "").trim().slice(0, 120);
    const events = await prisma.event.findMany({
      where: { organizationId: admin.organizationId, ...(allowedEventIds ? { id: { in: allowedEventIds } } : {}),
        ...(query ? { OR: [ { title: { contains: query, mode: "insensitive" } }, { city: { contains: query, mode: "insensitive" } }, { slug: { contains: query, mode: "insensitive" } } ] } : {}) },
      orderBy: { startsAt: "desc" }, take: 60,
      select: { id: true, title: true, city: true, state: true, slug: true, startsAt: true, status: true }
    });
    return JSON.stringify({ events });
  }

  if (call.name === "inspect_event") {
    const eventId = String(args.eventId || "");
    if (!eventId || (allowedEventIds && !allowedEventIds.includes(eventId))) return JSON.stringify({ error: "Evento fora do escopo autorizado." });
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId: admin.organizationId },
      select: { id: true, title: true, slug: true, city: true, state: true, startsAt: true, status: true,
        venueName: true, venueAddress: true, description: true, eventMapImageUrl: true, bannerUrl: true,
        lots: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, description: true, priceInCents: true, status: true,
          sortOrder: true, totalQuantity: true, soldQuantity: true, reservedQuantity: true, highlightColor: true, serviceFeeBps: true } } }
    });
    return JSON.stringify(event ? { event } : { error: "Evento não encontrado." });
  }

  if (call.name === "find_code_files") {
    const query = String(args.query || "").trim().toLowerCase().slice(0, 80);
    if (query.length < 2) return JSON.stringify({ error: "Informe pelo menos dois caracteres do nome ou caminho." });
    const ref = process.env.VERCEL_GIT_COMMIT_SHA || "main";
    const tree = await githubJson<{ tree?: Array<{ path?: string; type?: string }>; truncated?: boolean }>(`git/trees/${encodeURIComponent(ref)}?recursive=1`);
    const normalized = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const publicEventQuestion = /\/evento|pagina publica|evento publico|ingressos.*evento|lotes.*evento/.test(normalized);
    const terms = normalized.split(/[^a-z0-9]+/).filter((term) => term.length >= 3);
    const candidates = (tree.tree || []).filter((item) => item.type === "blob" && item.path && safeSourcePath(item.path)).map((item) => item.path!);
    const direct = candidates.filter((path) => path.toLowerCase().includes(query));
    const semantic = publicEventQuestion ? candidates.filter((path) => path.startsWith("app/evento/[slug]/") || path.startsWith("features/events/") || path.startsWith("features/lots/")) : [];
    const tokenMatches = candidates.filter((path) => terms.some((term) => path.toLowerCase().includes(term)));
    const files = [...new Set([...direct, ...semantic, ...tokenMatches])].slice(0, 50);
    return JSON.stringify({ ref, files, truncated: Boolean(tree.truncated) });
  }

  if (call.name === "read_code_file") {
    const path = String(args.path || "");
    if (!safeSourcePath(path)) return JSON.stringify({ error: "Caminho de código não permitido." });
    const ref = process.env.VERCEL_GIT_COMMIT_SHA || "main";
    const response = await fetch(`https://raw.githubusercontent.com/${repository}/${encodeURIComponent(ref)}/${path.split("/").map(encodeURIComponent).join("/")}`, { signal: AbortSignal.timeout(8000), next: { revalidate: 300 } });
    if (!response.ok) return JSON.stringify({ error: `Arquivo indisponível (HTTP ${response.status}).` });
    const source = await response.text();
    return JSON.stringify({ ref, path, content: source.slice(0, maxFileBytes), truncated: source.length > maxFileBytes });
  }

  return JSON.stringify({ error: "Ferramenta não autorizada." });
}
