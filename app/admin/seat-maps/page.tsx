import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  if (status === "PUBLISHED") return "Publicado";
  if (status === "DRAFT") return "Em preparação";
  if (status === "UNPUBLISHED") return "Pausado";
  if (status === "FINISHED") return "Encerrado";
  if (status === "CANCELED") return "Cancelado";
  return status;
}

export default async function SeatMapsPage() {
  const admin = await requirePermission("EVENTS");
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const events = await prisma.event.findMany({
    where: {
      organizationId: admin.organizationId,
      ...(allowedEventIds ? { id: { in: allowedEventIds } } : {})
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      startsAt: true,
      venueName: true,
      city: true,
      state: true,
      lots: {
        select: {
          id: true,
          priceInCents: true,
          status: true
        }
      },
      seatMaps: {
        where: {
          isActive: true
        },
        take: 1,
        select: {
          id: true,
          kind: true,
          seats: {
            select: {
              id: true,
              status: true
            }
          },
          sections: {
            select: {
              id: true
            }
          }
        }
      }
    }
  });

  const eventsWithLots = events.filter((event) => event.lots.length > 0);
  const activeMaps = events.filter((event) => event.seatMaps.length > 0).length;
  const totalMappedSeats = events.reduce(
    (sum, event) => sum + (event.seatMaps[0]?.seats.length ?? 0),
    0
  );

  return (
    <AdminShell
      title="Mapas numerados"
      description="Área separada para venda por mesa, cadeira e assento marcado."
      hideSidebarIntro
    >
      <section className="seatMapsModulePage">
        <div className="seatMapsModuleHero">
          <div>
            <span className="sectionEyebrow">Módulo independente</span>
            <h1>Ingressos numerados não são lotes comuns</h1>
            <p>
              Use esta área para criar e operar mapas de assentos. Lotes continuam controlando preço e regras comerciais;
              o mapa numerado controla o lugar físico vendido ao cliente.
            </p>
          </div>
          <div className="seatMapsModuleHeroStats">
            <div>
              <strong>{activeMaps}</strong>
              <span>mapa(s) ativo(s)</span>
            </div>
            <div>
              <strong>{totalMappedSeats}</strong>
              <span>lugares mapeados</span>
            </div>
          </div>
        </div>

        <section className="eventOverviewPanel">
          <div className="eventOverviewPanelHeader">
            <div>
              <h2>Eventos com mapas numerados</h2>
              <p>Entre na operação de assentos de cada evento por aqui.</p>
            </div>
            <span className="eventOverviewPill">{eventsWithLots.length} evento(s)</span>
          </div>

          <div className="seatMapsEventGrid">
            {eventsWithLots.length === 0 ? (
              <div className="empty">Nenhum evento com lote cadastrado ainda.</div>
            ) : (
              eventsWithLots.map((event) => {
                const seatMap = event.seatMaps[0] ?? null;
                const seats = seatMap?.seats ?? [];
                const sold = seats.filter((seat) => seat.status === "SOLD").length;
                const reserved = seats.filter((seat) => seat.status === "RESERVED").length;
                const available = seats.filter((seat) => seat.status === "AVAILABLE" || seat.status === "ACCESSIBLE").length;
                const minPrice = event.lots.length > 0
                  ? Math.min(...event.lots.map((lot) => lot.priceInCents))
                  : 0;

                return (
                  <article className="seatMapsEventCard" key={event.id}>
                    <div className="seatMapsEventCardHeader">
                      <div>
                        <span>{statusLabel(event.status)}</span>
                        <h3>{event.title}</h3>
                        <p>
                          {event.venueName} - {event.city}, {event.state}
                        </p>
                      </div>
                      <strong>{seatMap ? seatMap.kind : "Sem mapa"}</strong>
                    </div>

                    <dl>
                      <div>
                        <dt>Preço base</dt>
                        <dd>{formatCurrency(minPrice)}</dd>
                      </div>
                      <div>
                        <dt>Lugares</dt>
                        <dd>{seats.length || "-"}</dd>
                      </div>
                      <div>
                        <dt>Disponíveis</dt>
                        <dd>{seatMap ? available : "-"}</dd>
                      </div>
                      <div>
                        <dt>Reservados</dt>
                        <dd>{seatMap ? reserved : "-"}</dd>
                      </div>
                      <div>
                        <dt>Vendidos</dt>
                        <dd>{seatMap ? sold : "-"}</dd>
                      </div>
                      <div>
                        <dt>Setores</dt>
                        <dd>{seatMap?.sections.length ?? "-"}</dd>
                      </div>
                    </dl>

                    <div className="seatMapsEventActions">
                      <Link className="button smallButton" href={`/admin/events/${event.id}/seat-map`}>
                        Abrir mapa numerado
                      </Link>
                      <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}`}>
                        Ver evento
                      </Link>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </section>
    </AdminShell>
  );
}
