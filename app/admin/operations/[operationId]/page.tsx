import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getOrganizationDetailForPlatformAdmin } from "@/features/organizations/organization.admin.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

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

      <section className="platformOperationCommandBar spacedSection" aria-label="Ações rápidas da operação">
        <div className="platformOperationCommandCopy">
          <span className="eyebrow">Acesso rápido</span>
          <h3>Administre a filha a partir da Ingresaas e entre na operação quando precisar aprofundar.</h3>
          <p>
            Esta tela já funciona como a ponte master -&gt; operação. Você revisa a saúde da bilheteria aqui e salta
            para o painel da filha só quando quiser entrar na camada operacional.
          </p>
        </div>
        <div className="platformOperationCommandActions">
          <Link className="secondaryButton smallButton" href="/admin/operations">
            Voltar para operações
          </Link>
          {operation.publicDomain ? (
            <a className="secondaryButton smallButton" href={`https://${operation.publicDomain}`} target="_blank" rel="noreferrer">
              Abrir site público
            </a>
          ) : null}
          {operation.adminDomain ? (
            <a className="button smallButton" href={`https://${operation.adminDomain}/admin`} target="_blank" rel="noreferrer">
              Entrar no admin da operação
            </a>
          ) : null}
        </div>
      </section>

      <section className="platformOperationOwnerStrip spacedSection" aria-label="Resumo executivo da operação">
        <div>
          <span>Momento da operação</span>
          <strong>{operation.paidOrdersCount > 0 ? "Operação já vendendo" : "Operação ainda em preparação comercial"}</strong>
        </div>
        <div>
          <span>Domínio</span>
          <strong>{operation.publicDomain && operation.adminDomain ? "Público e admin configurados" : "Ainda falta fechar os domínios"}</strong>
        </div>
        <div>
          <span>Equipe</span>
          <strong>{operation._count.adminUsers > 0 ? `${operation._count.adminUsers} usuário(s) ativos` : "Ainda sem equipe ativa"}</strong>
        </div>
        <div>
          <span>Próxima frente</span>
          <strong>{operation._count.events > 0 ? "Refinar a rotina interna da filha" : "Cadastrar e revisar o primeiro evento"}</strong>
        </div>
      </section>

      <section className="platformOperationFocusGrid spacedSection" aria-label="Leitura do momento da operação">
        <article className="dashboardPanel platformOperationFocusCard">
          <span className="eyebrow">Leitura do momento</span>
          <h2>{operation.readinessScore >= 67 ? "A operação já está madura para revisão fina." : "A operação ainda está em montagem."}</h2>
          <p>
            {operation.readinessScore >= 67
              ? "Agora o trabalho mais inteligente é revisar a experiência real da filha: dashboard, eventos, pedidos, check-in e financeiro."
              : "O melhor caminho agora é terminar domínio, branding, equipe e agenda mínima antes de tratar a filha como pronta."}
          </p>
        </article>

        <article className="dashboardPanel platformOperationFocusCard">
          <span className="eyebrow">Próxima ação sugerida</span>
          <h2>{operation.adminDomain ? "Entrar no admin e revisar a rotina real." : "Terminar a estrutura da filha."}</h2>
          <div className="platformOperationFocusActions">
            {operation.adminDomain ? (
              <>
                <a className="button smallButton" href={`https://${operation.adminDomain}/admin`} target="_blank" rel="noreferrer">
                  Entrar no dashboard da filha
                </a>
                <a className="secondaryButton smallButton" href={`https://${operation.adminDomain}/admin/events`} target="_blank" rel="noreferrer">
                  Revisar eventos
                </a>
              </>
            ) : (
              <Link className="button smallButton" href="/admin/operations">
                Voltar para completar a operação
              </Link>
            )}
          </div>
        </article>
      </section>

      {operation.adminDomain ? (
        <section className="platformOperationLaunchpad spacedSection" aria-label="Atalhos internos da operação">
          <article className="platformOperationLaunchpadCard">
            <span className="eyebrow">Entrar na rotina da filha</span>
            <h3>Abra a TCR já no ponto certo do trabalho.</h3>
            <p>Esses atalhos levam você direto para as áreas que mais costumam precisar de revisão diária.</p>
            <div className="platformOperationLaunchpadGrid">
              <a className="secondaryButton smallButton" href={`https://${operation.adminDomain}/admin`} target="_blank" rel="noreferrer">
                Dashboard
              </a>
              <a className="secondaryButton smallButton" href={`https://${operation.adminDomain}/admin/events`} target="_blank" rel="noreferrer">
                Eventos
              </a>
              <a className="secondaryButton smallButton" href={`https://${operation.adminDomain}/admin/orders`} target="_blank" rel="noreferrer">
                Pedidos
              </a>
              <a className="secondaryButton smallButton" href={`https://${operation.adminDomain}/admin/check-in`} target="_blank" rel="noreferrer">
                Check-in
              </a>
              <a className="secondaryButton smallButton" href={`https://${operation.adminDomain}/admin/finance`} target="_blank" rel="noreferrer">
                Financeiro
              </a>
              <a className="secondaryButton smallButton" href={`https://${operation.adminDomain}/admin/users`} target="_blank" rel="noreferrer">
                Usuários
              </a>
            </div>
          </article>
        </section>
      ) : null}

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

      <section className="platformOperationHealthStrip spacedSection" aria-label="Resumo rápido da saúde da operação">
        <div>
          <span>Base comercial</span>
          <strong>{operation.paidOrdersCount > 0 ? "Pedidos pagos já apareceram" : "Ainda sem pedidos pagos"}</strong>
        </div>
        <div>
          <span>Agenda</span>
          <strong>{operation._count.events > 0 ? `${operation._count.events} evento(s) vinculados` : "Agenda ainda vazia"}</strong>
        </div>
        <div>
          <span>Equipe</span>
          <strong>{operation._count.adminUsers > 0 ? `${operation._count.adminUsers} pessoa(s) operando` : "Equipe ainda não liberada"}</strong>
        </div>
        <div>
          <span>Leads</span>
          <strong>{operation.totalLeadsCount > 0 ? `${operation.totalLeadsCount} lead(s) captados` : "Sem captação ainda"}</strong>
        </div>
      </section>

      <section className="grid dashboardGrid platformMasterSnapshot spacedSection" aria-label="Indicadores operacionais da filha">
        <article className="card metric dashboardHeroMetric">
          <span className="muted">Faturamento pago</span>
          <strong>{formatCurrency(operation.paidRevenueInCents)}</strong>
          <small>Soma apenas dos pedidos pagos</small>
        </article>
        <article className="card metric">
          <span className="muted">Pedidos pagos</span>
          <strong>{operation.paidOrdersCount}</strong>
          <small>Compras confirmadas</small>
        </article>
        <article className="card metric">
          <span className="muted">Pedidos totais</span>
          <strong>{operation.totalOrdersCount}</strong>
          <small>Inclui pendentes, expirados e pagos</small>
        </article>
        <article className="card metric">
          <span className="muted">Leads captados</span>
          <strong>{operation.totalLeadsCount}</strong>
          <small>Base de interesse da operação</small>
        </article>
      </section>

      <section className="grid dashboardGrid platformMasterSnapshot spacedSection" aria-label="Situação dos ingressos">
        <article className="card metric">
          <span className="muted">Ingressos ativos</span>
          <strong>{operation.activeTicketsCount}</strong>
          <small>Prontos para uso</small>
        </article>
        <article className="card metric">
          <span className="muted">Usados</span>
          <strong>{operation.usedTicketsCount}</strong>
          <small>Já validados no check-in</small>
        </article>
        <article className="card metric">
          <span className="muted">Cancelados</span>
          <strong>{operation.canceledTicketsCount}</strong>
          <small>Sem validade operacional</small>
        </article>
        <article className="card metric">
          <span className="muted">Equipe / eventos</span>
          <strong>
            {operation._count.adminUsers} / {operation._count.events}
          </strong>
          <small>Base humana e agenda da filha</small>
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
            {operation.publicDomain ? (
              <a className="secondaryButton smallButton" href={`https://${operation.publicDomain}`} target="_blank" rel="noreferrer">
                Conferir vitrine
              </a>
            ) : null}
            {operation.adminDomain ? (
              <>
                <a className="secondaryButton smallButton" href={`https://${operation.adminDomain}/admin`} target="_blank" rel="noreferrer">
                  Ir para o admin da filha
                </a>
                <a className="secondaryButton smallButton" href={`https://${operation.adminDomain}/admin/users`} target="_blank" rel="noreferrer">
                  Revisar equipe
                </a>
              </>
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

          {operation.adminDomain ? (
            <div className="actionRow">
              <a className="button smallButton" href={`https://${operation.adminDomain}/admin/users`} target="_blank" rel="noreferrer">
                Gerir usuários da operação
              </a>
            </div>
          ) : null}
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
                      <div className="platformEventActionStack">
                        <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}`}>
                          Abrir no master
                        </Link>
                        {operation.publicDomain && event.status === "PUBLISHED" ? (
                          <a
                            className="secondaryButton smallButton"
                            href={`https://${operation.publicDomain}/evento/${event.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ver público
                          </a>
                        ) : null}
                      </div>
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
