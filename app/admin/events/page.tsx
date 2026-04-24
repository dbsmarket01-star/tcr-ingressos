import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { duplicateEventAction } from "@/features/events/event.actions";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getEventCapacity, getEventRevenueInCents, listEvents } from "@/features/events/event.service";
import { getPublicEventUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

const statusLabels = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  UNPUBLISHED: "Despublicado",
  FINISHED: "Encerrado",
  CANCELED: "Cancelado"
};

export default async function EventsPage() {
  const admin = await requirePermission("EVENTS");
  const organizationContext = await getCurrentOrganizationContext();
  const events = await listEvents(admin.organizationId!, getAdminAllowedEventIds(admin));
  const publishedEvents = events.filter((event) => event.status === "PUBLISHED").length;
  const draftEvents = events.filter((event) => event.status !== "PUBLISHED").length;
  const totalRevenueInCents = events.reduce((sum, event) => sum + getEventRevenueInCents(event), 0);
  const totalCapacity = events.reduce((sum, event) => sum + getEventCapacity(event).total, 0);
  const totalSold = events.reduce((sum, event) => sum + getEventCapacity(event).sold, 0);
  const preparedEvents = events.filter((event) => getEventCapacity(event).total > 0).length;

  return (
    <AdminShell
      title="Eventos"
      description="Gerencie publicação, lotes, vendas, faturamento e páginas públicas dos eventos."
    >
      <section className="operationCommandStrip spacedSection" aria-label="Atalhos da área de eventos">
        <article className="operationCommandCard">
          <span className="eyebrow">Centro de agenda</span>
          <h2>Revise a agenda, a vitrine pública e o preparo comercial.</h2>
          <p>
            Esta tela concentra o que mais importa para a operação: publicação, capacidade, faturamento e acesso rápido
            aos eventos da {organizationContext.brandName}.
          </p>
        </article>
        <div className="operationCommandActions">
          <Link className="button smallButton" href="/admin/events/new">
            Novo evento
          </Link>
          <Link className="secondaryButton smallButton" href="/admin/orders">
            Ir para pedidos
          </Link>
          <Link className="secondaryButton smallButton" href="/admin">
            Voltar ao dashboard
          </Link>
        </div>
      </section>

      <section className="grid dashboardGrid">
        <article className="card metric">
          <span className="muted">Eventos publicados</span>
          <strong>{publishedEvents}</strong>
          <small>{draftEvents} em preparação ou despublicados</small>
        </article>
        <article className="card metric">
          <span className="muted">Faturamento total</span>
          <strong>{formatCurrency(totalRevenueInCents)}</strong>
          <small>Receita acumulada dos eventos cadastrados</small>
        </article>
        <article className="card metric">
          <span className="muted">Ingressos vendidos</span>
          <strong>{totalSold}</strong>
          <small>{totalCapacity} lugares na capacidade total</small>
        </article>
        <article className="card metric">
          <span className="muted">Operação preparada</span>
          <strong>{preparedEvents}</strong>
          <small>Eventos com lotes prontos para vender</small>
        </article>
        <article className="card metric">
          <span className="muted">Captações ativas</span>
          <strong>{events.filter((event) => event.leadCaptureEnabled).length}</strong>
          <small>{events.reduce((sum, event) => sum + (event._count?.leads ?? 0), 0)} leads captados no total</small>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader inlineHeader">
          <div>
            <h2>Lista operacional</h2>
            <p className="muted">Acompanhe status, capacidade, faturamento e acesso rápido à página pública.</p>
          </div>
          <Link className="button" href="/admin/events/new">
            Novo evento
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="empty">
            Nenhum evento cadastrado ainda. Clique em Novo evento para criar o primeiro evento da{" "}
            {organizationContext.brandName}.
          </div>
        ) : (
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Evento</th>
                  <th>Data</th>
                  <th>Local</th>
                  <th>Vendas</th>
                  <th>Faturamento</th>
                  <th>Alerta</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const capacity = getEventCapacity(event);
                  const revenueInCents = getEventRevenueInCents(event);
                  const progress =
                    capacity.total > 0 ? Math.round((capacity.sold / capacity.total) * 100) : 0;
                  const hasLots = capacity.total > 0;

                  return (
                    <tr key={event.id}>
                      <td>
                        <span
                          className={`status ${
                            event.status === "PUBLISHED" ? "published" : "draft"
                          }`}
                        >
                          {statusLabels[event.status]}
                        </span>
                      </td>
                      <td className="primaryCell">
                        <strong>{event.title}</strong>
                        <br />
                        <span className="muted">/{event.slug}</span>
                      </td>
                      <td>{formatDateTime(event.startsAt)}</td>
                      <td>
                        {event.city}, {event.state}
                        <br />
                        <span className="muted">{event.venueName}</span>
                      </td>
                      <td>
                        <div className="progressCell">
                          <div className="progressMeta">
                            <span>
                              {capacity.sold} / {capacity.total}
                            </span>
                            <strong>{progress}%</strong>
                          </div>
                          <div className="progressTrack" aria-label={`${progress}% vendido`}>
                            <span style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{formatCurrency(revenueInCents)}</strong>
                      </td>
                      <td>
                        <span className={`operationHint ${hasLots ? "ok" : "warning"}`}>
                          {hasLots ? "Operação preparada" : "Cadastre lotes para vender"}
                        </span>
                        {event.leadCaptureEnabled ? (
                          <>
                            <br />
                            <span className="muted">
                              Captação ativa • {event._count?.leads ?? 0} lead(s)
                            </span>
                          </>
                        ) : null}
                      </td>
                      <td>
                        <div className="actionRow">
                          <Link className="secondaryButton smallButton" href={getPublicEventUrl(event.slug)}>
                            Visualizar
                          </Link>
                          <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}`}>
                            Gerenciar
                          </Link>
                          <form action={duplicateEventAction}>
                            <input type="hidden" name="eventId" value={event.id} />
                            <button className="secondaryButton smallButton" type="submit">
                              Duplicar
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </AdminShell>
  );
}
