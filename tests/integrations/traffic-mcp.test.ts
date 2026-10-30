import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/integrations/traffic-mcp/route";

const token = "traffic-report-test-token-at-least-thirty-two-characters";
const originalToken = process.env.TRAFFIC_REPORT_API_TOKEN;

async function mcpBody(response: Response) {
  const body = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = body.split("\n").find((line) => line.startsWith("data: "));
    if (!data) throw new Error("MCP response did not contain a data event");
    return JSON.parse(data.slice(6));
  }
  return JSON.parse(body);
}

afterEach(() => {
  if (originalToken === undefined) delete process.env.TRAFFIC_REPORT_API_TOKEN;
  else process.env.TRAFFIC_REPORT_API_TOKEN = originalToken;
});

describe("traffic MCP access", () => {
  it("fails closed without a configured secret", async () => {
    delete process.env.TRAFFIC_REPORT_API_TOKEN;
    const response = await POST(new Request("https://example.test/api/integrations/traffic-mcp", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("requires the correct bearer token", async () => {
    process.env.TRAFFIC_REPORT_API_TOKEN = token;
    const response = await POST(new Request("https://example.test/api/integrations/traffic-mcp", {
      method: "POST", headers: { Authorization: "Bearer wrong" }
    }));
    expect(response.status).toBe(401);
  });

  it("answers the MCP initialize handshake and lists read-only tools", async () => {
    process.env.TRAFFIC_REPORT_API_TOKEN = token;
    const url = "https://example.test/api/integrations/traffic-mcp";
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
    const initialize = await POST(new Request(url, { method: "POST", headers, body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "initialize", params: {
        protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" }
      }
    }) }));
    expect(initialize.status).toBe(200);
    expect((await mcpBody(initialize)).result.serverInfo.name).toBe("tcr-traffic-reports");
    const tools = await POST(new Request(url, { method: "POST", headers, body: JSON.stringify({
      jsonrpc: "2.0", id: 2, method: "tools/list", params: {}
    }) }));
    expect(tools.status).toBe(200);
    const names = (await mcpBody(tools)).result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual(["listar_eventos", "vendas_por_evento"]);
  });
});
