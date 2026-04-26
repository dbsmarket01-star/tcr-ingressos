import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { listPlatformLeads } from "@/features/platform-leads/platform-lead.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type AdminPlatformLeadsPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function AdminPlatformLeadsPage({ searchParams }: AdminPlatformLeadsPageProps) {
  await requirePermission("OPERATIONS");
  const organizationContext = await getCurrentOrganizationContext();

  if (!organizationContext.isPlatformHost) {
    redirect("/admin");
  }

  const params = searchParams ? await searchParams : {};
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const leads = await listPlatformLeads(query);
  const leadsWithInstagram = leads.filter((lead) => Boolean(lead.instagramHandle)).length;

  return (
    <AdminShell
      title="Leads"
      description="Base comercial da Ingresaas com produtores e operações que demonstraram interesse em ter bilheteria própria."
    >
      <section className="platformOperationsHero spacedSection" aria-label="Visão comercial da plataforma">
        <div>
          <span className="eyebrow">Comercial</span>
          <h2>Aqui ficam os leads que chegaram pela home pública e já estão prontos para abordagem.</h2>
          <p>
            Use esta tela para bater o olho no perfil de cada operação, identificar nicho, porte e contato principal
            e puxar a conversa comercial com mais contexto.
          </p>
        </div>
        <div className="platformOperationsHeroBadges">
          <span>{leads.length} lead(s)</span>
          <span>{leadsWithInstagram} com Instagram</span>
          {query ? <span>Busca: {query}</span> : null}
        </div>
      </section>

      <section className="grid dashboardGrid platformMasterSnapshot spacedSection" aria-label="Resumo da base comercial">
        <article className="card metric dashboardHeroMetric">
          <span className="muted">Leads totais</span>
          <strong>{leads.length}</strong>
          <small>Registros da home comercial da Ingresaas</small>
        </article>
        <article className="card metric">
          <span className="muted">Instagram informado</span>
          <strong>{leadsWithInstagram}</strong>
          <small>Operações com sinal mais claro de presença digital</small>
        </article>
        <article className="card metric">
          <span className="muted">Último lead</span>
          <strong>{leads[0] ? formatDateTime(leads[0].createdAt) : "Sem registro"}</strong>
          <small>Entrada comercial mais recente</small>
        </article>
      </section>

      <section className="grid twoColumns spacedSection platformOperationsWorkspace">
        <form className="card form platformOperationsFilterCard">
          <div>
            <span className="eyebrow">Filtro</span>
            <h2>Busque por nome, e-mail, telefone, nicho ou Instagram.</h2>
            <p className="muted">A ideia aqui é encontrar rápido quem entrou e já puxar o contato comercial certo.</p>
          </div>

          <label className="field">
            <span>Buscar lead</span>
            <input name="q" defaultValue={query} placeholder="Ex.: gospel, Diego, @produtora, 11 999..." />
          </label>

          <button className="button" type="submit">
            Filtrar leads
          </button>
        </form>

        <article className="card platformOperationsGuideCard">
          <span className="eyebrow">Leitura sugerida</span>
          <h2>O que vale observar em cada lead.</h2>
          <div className="platformSecurityList">
            <span>Porte da operação</span>
            <span>Nicho principal</span>
            <span>Contato direto</span>
            <span>Instagram comercial</span>
          </div>
          <p className="muted">
            Isso ajuda a qualificar melhor a conversa e entender se a entrada deve ser por margem, caixa, base de leads
            ou autonomia comercial.
          </p>
        </article>
      </section>

      <section className="dashboardPanel spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Lista de leads</h2>
            <p>Os contatos mais recentes ficam no topo para o time comercial não perder timing.</p>
          </div>
        </div>

        {leads.length === 0 ? (
          <p className="muted">Nenhum lead encontrado com esse filtro.</p>
        ) : (
          <div className="platformLeadAdminGrid">
            {leads.map((lead) => (
              <article className="card platformLeadAdminCard" key={lead.id}>
                <strong>{lead.name}</strong>
                <span>{lead.email}</span>
                <span>{lead.phone}</span>
                <p>
                  <strong>Faturamento:</strong> {lead.annualRevenueBand}
                </p>
                <p>
                  <strong>Nicho:</strong> {lead.eventNiche}
                </p>
                <p>
                  <strong>Instagram:</strong> {lead.instagramHandle ? `@${lead.instagramHandle}` : "Não informado"}
                </p>
                <small>{formatDateTime(lead.createdAt)}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
