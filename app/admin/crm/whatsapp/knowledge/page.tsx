import Link from "next/link";
import { AdminRole } from "@prisma/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { prisma } from "@/lib/prisma";
import { createSupportKnowledge, reviewSupportKnowledge } from "./actions";

export const dynamic = "force-dynamic";

export default async function WhatsAppKnowledgePage() {
  const admin = await requirePermission("CRM");
  const [rules, events] = await Promise.all([
    prisma.whatsAppSupportKnowledge.findMany({
      where: { organizationId: admin.organizationId }, orderBy: { createdAt: "desc" }, take: 100
    }),
    prisma.event.findMany({ where: { organizationId: admin.organizationId }, select: { id: true, title: true } })
  ]);
  const eventNames = new Map(events.map((event) => [event.id, event.title]));
  const mayReview = admin.role === AdminRole.OWNER || admin.role === AdminRole.MANAGER;
  return <AdminShell title="Aprendizado do atendimento" description="Revisão das respostas sugeridas pela equipe para a IA.">
    <main style={{ maxWidth: 1050, margin: "0 auto", padding: 24 }}>
      <p><Link href="/admin/crm/whatsapp">← Voltar às conversas</Link></p>
      <h1>Aprendizado do atendimento</h1>
      <p>Respostas do Lucas geram sugestões por evento. Uma pessoa da gestão revisa cada regra antes de a IA utilizá-la.</p>
      {mayReview && <section style={{ background: "white", border: "1px solid #d8e2dc", borderRadius: 12, padding: 18, marginBottom: 22 }}>
        <h2>Cadastrar regra confirmada</h2>
        <form action={createSupportKnowledge}>
          <label>Aplicação<br/><select name="eventId"><option value="">Regra geral para todos os eventos</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
          <label style={{ display: "block", marginTop: 10 }}>Assunto<br/><input name="topic" maxLength={120} required style={{ width: "100%" }}/></label>
          <label style={{ display: "block", marginTop: 10 }}>Pergunta<br/><textarea name="question" rows={2} maxLength={300} required style={{ width: "100%" }}/></label>
          <label style={{ display: "block", marginTop: 10 }}>Resposta confirmada<br/><textarea name="answer" rows={4} maxLength={1000} required style={{ width: "100%" }}/></label>
          <button type="submit">Salvar regra</button>
        </form>
      </section>}
      {rules.length === 0 && <p>Ainda não há sugestões. Novas respostas do Lucas em conversas vinculadas a eventos serão analisadas.</p>}
      {rules.map((rule) => <section key={rule.id} style={{ background: "white", border: "1px solid #d8e2dc", borderRadius: 12, padding: 18, marginBottom: 14 }}>
        <p><strong>{eventNames.get(rule.eventId || "") || "Regra geral"}</strong> · {rule.topic} · {rule.status === "PENDING" ? "Aguardando revisão" : rule.status === "APPROVED" ? "Aprovada" : rule.status === "SUPERSEDED" ? "Substituída" : "Rejeitada"}</p>
        <form action={reviewSupportKnowledge}>
          <input type="hidden" name="id" value={rule.id}/>
          <label style={{ display: "block", marginBottom: 10 }}>Pergunta frequente<br/><textarea name="question" defaultValue={rule.question} rows={2} maxLength={300} readOnly={!mayReview} style={{ width: "100%" }}/></label>
          <label style={{ display: "block", marginBottom: 10 }}>Resposta correta<br/><textarea name="answer" defaultValue={rule.answer} rows={4} maxLength={1000} readOnly={!mayReview} style={{ width: "100%" }}/></label>
          {mayReview && <div style={{ display: "flex", gap: 10 }}><button name="decision" value="APPROVED">Aprovar resposta</button><button name="decision" value="REJECTED">Rejeitar</button></div>}
        </form>
      </section>)}
    </main>
  </AdminShell>;
}
