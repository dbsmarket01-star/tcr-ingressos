import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isTrafficReportAuthorized } from "@/features/integrations/traffic-report-auth";
import { getTrafficSalesReport, listTrafficReportEvents, validateTrafficSalesFilters } from "@/features/integrations/traffic-sales.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getOrganizationId() {
  const organization = await prisma.organization.findFirst({
    where: { slug: "tcr-ingressos", isActive: true }, select: { id: true }
  });
  if (!organization) throw new Error("TCR organization unavailable");
  return organization.id;
}

const handler = createMcpHandler(() => {
  const server = new McpServer({ name: "tcr-traffic-reports", version: "1.0.0" });
  server.registerTool("listar_eventos", {
    description: "Lista os eventos da bilheteria TCR e seus identificadores para filtrar relatórios. Somente leitura, sem dados de compradores.",
    inputSchema: z.object({})
  }, async () => ({
    content: [{ type: "text", text: JSON.stringify(await listTrafficReportEvents(await getOrganizationId())) }]
  }));
  server.registerTool("vendas_por_evento", {
    description: "Consulta pedidos pagos da bilheteria nova TCR, separados por dia e evento. Valores em centavos de BRL, no fuso America/Sao_Paulo. Não inclui dados pessoais.",
    inputSchema: z.object({
      data_inicio: z.string().describe("Data inicial AAAA-MM-DD"),
      data_fim: z.string().describe("Data final AAAA-MM-DD"),
      evento_id: z.string().optional().describe("ID retornado por listar_eventos; omita para todos")
    })
  }, async ({ data_inicio, data_fim, evento_id }) => {
    const filters = { startDate: data_inicio, endDate: data_fim, eventId: evento_id };
    const error = validateTrafficSalesFilters(filters);
    if (error) return { isError: true, content: [{ type: "text", text: error }] };
    return { content: [{ type: "text", text: JSON.stringify(await getTrafficSalesReport(filters, await getOrganizationId())) }] };
  });
  return server;
});

function unauthorized() {
  return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
    status: 401, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export async function POST(request: Request) {
  if (!isTrafficReportAuthorized(request)) return unauthorized();
  try {
    const response = await handler.fetch(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("[traffic-mcp] MCP request failed", error);
    return new Response("MCP_UNAVAILABLE", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: Request) {
  if (!isTrafficReportAuthorized(request)) return unauthorized();
  return handler.fetch(request);
}
