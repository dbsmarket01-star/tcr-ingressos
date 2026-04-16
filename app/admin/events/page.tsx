import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ModuleCard } from "@/components/admin/ModuleCard";
import { requirePermission } from "@/features/auth/auth.service";
import { duplicateEventAction } from "@/features/events/event.actions";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getEventCapacity, getEventRevenueInCents, listEvents } from "@/features/events/event.service";

export const dynamic = "force-dynamic";

const statusLabels = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  UNPUBLISHED: "Despublicado",
  FINISHED: "Encerrado",
  CANCELED: "Cancelado"
};

export default async function EventsPage() {
  await requirePermission("EVENTS");
  const events = await listEvents();

  return (
    <AdminShell
      title="Eventos"
      description="Gerencie publicacao, lotes, vendas, faturamento e paginas publicas dos eventos."
    >
      <section className="card">
        <div className="sectionHeader inlineHeader">
          <h2>Lista operacional</h2>
          <Link className="button" href="/admin/events/new">
            Novo evento
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="empty">
            Nenhum evento cadastrado ainda. Clique em Novo evento para criar o primeiro evento da
            TCR Ingressos.
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
                  <th>Acoes</th>
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
                          {hasLots ? "Operacao preparada" : "Cadastre lotes para vender"}
                        </span>
                      </td>
                      <td>
                        <div className="actionRow">
                          <Link className="secondaryButton smallButton" href={`/evento/${event.slug}`}>
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

      <section className="grid cardsGrid spacedSection">
        <ModuleCard title="Listagem de eventos" status="Pronto">
          A tabela agora le dados reais do Supabase e calcula capacidade, vendidos e faturamento.
        </ModuleCard>
        <ModuleCard title="Cadastro de evento" status="Pronto">
          O fluxo salva dados, banner, mapa, imagem SEO, tracking, textos de conversao e status.
        </ModuleCard>
        <ModuleCard title="Operacao de lotes" status="Pronto">
          Cada evento tem lotes, estoque, taxa, juros de parcelamento, cupom e destaque comercial.
        </ModuleCard>
      </section>
    </AdminShell>
  );
}
