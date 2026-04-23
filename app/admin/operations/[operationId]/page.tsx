import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getOrganizationDetailForPlatformAdmin } from "@/features/organizations/organization.admin.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type OperationDetailPageProps = {
  params: Promise<{
    operationId: string;
  }>;
};

export default async function OperationDetailPage({ params }: OperationDetailPageProps) {
  await requirePermission("OPERATIONS");
  const { operationId } = await params;
  const organizationContext = await getCurrentOrganizationContext();

  if (!organizationContext.isPlatformHost) {
    redirect("/admin");
  }

  const operation = await getOrganizationDetailForPlatformAdmin(operationId);

  if (!operation) {
    notFound();
  }

  return (
    <AdminShell
      title={operation.name}
      description="Visão detalhada da bilheteria filha, com branding, equipe, eventos e links rápidos da operação."
    >
      <section className="platformOperationsHero spacedSection" aria-label="Cabeçalho da operação">
        <div>
          <span className="eyebrow">Detalhe da operação</span>
          <h2>{operation.name}</h2>
          <p>
            Use esta tela para revisar prontidão, branding, equipe e eventos antes de tratar a bilheteria como pronta
            dentro da Ingresaas.
          </p>
        </div>
        <div className="platformOperationsHeroBadges">
          <span>{operation.slug}</span>
          <span>{operation.isActive ? "Operação ativa" : "Operação inativa"}</span>
          <span>{operation.readinessScore}% de prontidão</span>
        </div>
      </section>

      <section className="grid dashboardGrid platformMasterSnapshot spacedSection">
        <article className="card metric dashboardHeroMetric">
          <span className="muted">Prontidão</span>
          <strong>{operation.readinessScore}%</strong>
          <small>{operation.readinessLabel}</small>
        </article>
        <article className="card metric">
          <span className="muted">Eventos</span>
          <strong>{operation._count.events}</strong>
          <small>Eventos vinculados à operação</small>
        </article>
        <article className="card metric">
          <span className="muted">Equipe</span>
          <strong>{operation._count.adminUsers}</strong>
          <small>Usuários internos ativos</small>
        </article>
        <article className="card metric">
          <span className="muted">Criada em</span>
          <strong>{formatDateTime(operation.createdAt)}</strong>
          <small>Primeiro registro da operação</small>
        </article>
      </section>

      <section className="grid twoColumns spacedSection">
        <article className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Branding e domínios</h2>
              <p>Resumo visual do que já está ligado na bilheteria filha.</p>
            </div>
          </div>

          <div className="operationsAdminLinks">
            <span>{operation.publicDomain || "Domínio público pendente"}</span>
            <span>{operation.adminDomain || "Domínio admin pendente"}</span>
            <span>{operation.supportEmail || "E-mail de suporte pendente"}</span>
            <span>{operation.supportPhone || "WhatsApp / telefone pendente"}</span>
          </div>

          <div className="operationsAdminSwatches">
            <span>
              <i style={{ background: operation.primaryColor || "#0b7a63" }} />
              Principal
            </span>
            <span>
              <i style={{ background: operation.secondaryColor || "#dff3ec" }} />
              Secundária
            </span>
          </div>

          <div className="platformReadinessBar" aria-label={`Prontidão de ${operation.readinessScore}%`}>
            <span style={{ width: `${operation.readinessScore}%` }} />
          </div>
          <div className="platformReadinessTags">
            {operation.readinessItems.map((item) => (
              <span className={item.done ? "isDone" : "isTodo"} key={item.label}>
                {item.label}
              </span>
            ))}
          </div>

          <div className="actionRow">
            <Link className="secondaryButton smallButton" href="/admin/operations">
              Voltar para operações
            </Link>
            {operation.publicDomain ? (
              <a className="button smallButton" href={`https://${operation.publicDomain}`} target="_blank" rel="noreferrer">
                Abrir público
              </a>
            ) : null}
            {operation.adminDomain ? (
              <a
                className="secondaryButton smallButton"
                href={`https://${operation.adminDomain}/login`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir admin
              </a>
            ) : null}
          </div>
        </article>

        <article className="dashboardPanel">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Equipe da operação</h2>
              <p>Quem já está liberado para operar essa bilheteria filha.</p>
            </div>
          </div>

          <div className="platformMemberList">
            {operation.adminUsers.length > 0 ? (
              operation.adminUsers.map((member) => (
                <article className="platformMemberCard" key={member.id}>
                  <div>
                    <strong>{member.name}</strong>
                    <span>{member.email}</span>
                  </div>
                  <div className="platformMemberMeta">
                    <span className="status published">{member.role}</span>
                    <small>{member.accessAllEvents ? "Acesso a todos os eventos" : `${member.allowedEventIds.length} evento(s) liberado(s)`}</small>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">Nenhum usuário ativo ligado a essa operação ainda.</p>
            )}
          </div>
        </article>
      </section>

      <section className="dashboardPanel spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Eventos da operação</h2>
            <p>Leitura rápida da agenda já vinculada a esta bilheteria.</p>
          </div>
        </div>

        <div className="tableScroll">
          <table className="table operationalTable">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Status</th>
                <th>Data</th>
                <th>Cidade</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {operation.events.length > 0 ? (
                operation.events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.title}</strong>
                      <br />
                      <span className="muted">{event.slug}</span>
                    </td>
                    <td>
                      <span className={`status ${event.status === "PUBLISHED" ? "published" : "draft"}`}>{event.status}</span>
                    </td>
                    <td>{formatDateTime(event.startsAt)}</td>
                    <td>
                      {[event.city, event.state].filter(Boolean).join(", ") || "Local pendente"}
                    </td>
                    <td>
                      <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}`}>
                        Abrir evento
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>Nenhum evento cadastrado nessa operação ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
