import { beforeEach, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ getCurrentAdmin: vi.fn(), canAccessArea: vi.fn() }));
vi.mock("@/features/crm/whatsapp-chat.actions", () => ({ sendCrmWhatsAppMessage: send }));
vi.mock("@/features/auth/auth.service", () => auth);

import { POST } from "@/app/api/admin/crm/whatsapp/send/route";

beforeEach(() => {
  send.mockReset();
  auth.getCurrentAdmin.mockResolvedValue({ role: "OWNER" });
  auth.canAccessArea.mockReturnValue(true);
});

function request(origin = "https://produtor.tcringressos.app.br") {
  const data = new FormData();
  data.set("phone", "5511999999999");
  data.set("text", "Boa tarde");
  return new Request("https://produtor.tcringressos.app.br/api/admin/crm/whatsapp/send", {
    method: "POST", headers: { origin, host: "produtor.tcringressos.app.br" }, body: data
  });
}

it("encaminha o formulário pela rota estável e preserva o resultado", async () => {
  send.mockResolvedValue({ ok: true, message: "Mensagem enviada." });
  const result = await POST(request());
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ ok: true, message: "Mensagem enviada." });
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][0].get("text")).toBe("Boa tarde");
});

it("bloqueia envio de outra origem", async () => {
  const result = await POST(request("https://outro-site.example"));
  expect(result.status).toBe(403);
  expect(send).not.toHaveBeenCalled();
});

it("informa sessão expirada sem tentar enviar", async () => {
  auth.getCurrentAdmin.mockResolvedValue(null);
  const result = await POST(request());
  expect(result.status).toBe(401);
  expect((await result.json()).message).toMatch(/sessão expirou/);
  expect(send).not.toHaveBeenCalled();
});

it("preserva a recusa de envio fora da janela de 24 horas", async () => {
  send.mockResolvedValue({ ok: false, message: "Use um template aprovado para iniciar a conversa." });
  const result = await POST(request());
  expect(await result.json()).toEqual({ ok: false, message: "Use um template aprovado para iniciar a conversa." });
});
