import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { EventSectionNav } from "@/components/admin/EventSectionNav";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { getAdminAllowedEventIds, requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { getEventForManagement } from "@/features/events/event.service";
import { applyNumberedSeatMapAction } from "@/features/seat-maps/seat-map.admin.actions";
import { getLayoutSeats, getSectionSeats } from "@/features/seat-maps/seat-map";
import { getPublicSeatMapForEvent } from "@/features/seat-maps/seat-map.service";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

type SeatMapAdminPageProps = {
  params: Promise<{
    eventId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels = {
  AVAILABLE: "Disponível",
  ACCESSIBLE: "PCD / acessível",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  UNAVAILABLE: "Bloqueado",
  SELECTED: "Selecionado"
} as const;

const mapTypes = [
  {
    value: "THEATER",
    title: "Teatro / Auditório",
    description: "Fileiras numeradas voltadas para o palco, com setores por proximidade."
  },
  {
    value: "ARENA",
    title: "Arena / Galeria",
    description: "Setores retos, laterais, pista sentada ou camarotes."
  },
  {
    value: "RESTAURANT",
    title: "Mesas / Restaurante",
    description: "Mesas numeradas com cadeiras distribuídas ao redor."
  },
  {
    value: "OVAL",
    title: "Oval / Circular",
    description: "Setores em arco para estádio, arena circular ou palco central."
  },
  {
    value: "CUSTOM",
    title: "Personalizado",
    description: "Base livre para eventos com desenho próprio."
  }
];

const seatsPerTableOptions = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20];

function countByStatus(seats: ReturnType<typeof getLayoutSeats>) {
  return seats.reduce<Record<string, number>>((acc, seat) => {
    acc[seat.status] = (acc[seat.status] ?? 0) + 1;
    return acc;
  }, {});
}

export default async function SeatMapAdminPage({ params, searchParams }: SeatMapAdminPageProps) {
  const admin = await requirePermission("EVENTS");
  const { eventId } = await params;
  const query = searchParams ? await searchParams : {};
  await requireEventAccess(eventId);

  const [event, seatMapLayout] = await Promise.all([
    getEventForManagement(eventId, admin.organizationId, getAdminAllowedEventIds(admin)),
    getPublicSeatMapForEvent(eventId)
  ]);

  if (!event) {
    notFound();
  }

  const seats = seatMapLayout ? getLayoutSeats(seatMapLayout) : [];
  const totals = countByStatus(seats);
  const selectedError = typeof query.error === "string" ? query.error : null;
  const selectedSuccess = typeof query.success === "string" ? query.success : null;

  return (
    <AdminShell
      title="Mapa numerado"
      description="Configure a venda por mesa, cadeira e assento numerado deste evento."
      headerVariant="minimal"
      hideSidebarIntro
    >
      <section className="eventOverviewShell numberedSeatAdminPage">
        <div className="eventOverviewBreadcrumbs">
          <Link href="/admin/events">Congressos e eventos</Link>
          <span>›</span>
          <Link href={`/admin/events/${event.id}`}>{event.title}</Link>
          <span>›</span>
          <strong>Mapa numerado</strong>
        </div>

        {selectedError ? <ErrorNotice message={selectedError} /> : null}
        {selectedSuccess ? <div className="successBox">{selectedSuccess}</div> : null}

        <section className="numberedSeatAdminHero">
          <div>
            <span className="sectionEyebrow">Ingressos numerados</span>
            <h1>Venda por mesa, cadeira e setor</h1>
            <p>
              Esta é a tela de edição operacional do mapa numerado. Gere a estrutura inicial, confira setores,
              lugares e status antes de abrir a venda.
            </p>
          </div>
        </section>

        <EventSectionNav active="seat-map" event={event} />

        <form action={applyNumberedSeatMapAction} className="eventOverviewPanel numberedSeatWizard">
          <input type="hidden" name="eventId" value={event.id} />
          <div className="eventOverviewPanelHeader">
            <div>
              <h2>1. Qual é o estilo do seu mapa?</h2>
              <p>Escolha primeiro a arquitetura visual do evento. Depois configure mesas ou cadeiras.</p>
            </div>
            <span className="eventOverviewPill">Assistente</span>
          </div>

          <div className="numberedSeatMapTypeGrid">
            {mapTypes.map((type, index) => (
              <label className="numberedSeatOptionCard" key={type.value}>
                <input defaultChecked={type.value === "RESTAURANT"} name="mapKind" type="radio" value={type.value} />
                <span>{index + 1}</span>
                <strong>{type.title}</strong>
                <small>{type.description}</small>
              </label>
            ))}
          </div>

          <div className="numberedSeatWizardGrid">
            <section>
              <h3>2. Esse mapa terá mesas?</h3>
              <div className="numberedSeatSegmented">
                <label>
                  <input defaultChecked name="seatingMode" type="radio" value="WITH_TABLES" />
                  <span>Com mesas</span>
                </label>
                <label>
                  <input name="seatingMode" type="radio" value="SEATS_ONLY" />
                  <span>Sem mesas, só cadeiras/fileiras</span>
                </label>
              </div>
            </section>

            <section>
              <h3>3. Quantas mesas por setor?</h3>
              <label className="numberedSeatTablePlanner">
                <span>Mesas por setor (opcional)</span>
                <input name="tablesPerSection" type="number" min="1" max="500" placeholder="Automático" />
                <small>Em branco, o sistema calcula pelos ingressos do setor. Ex.: 400 lugares / 4 cadeiras = 100 mesas.</small>
              </label>
            </section>

            <section>
              <h3>4. Quantas cadeiras por mesa?</h3>
              <div className="numberedSeatStepperOptions">
                {seatsPerTableOptions.map((quantity) => (
                  <label key={quantity}>
                    <input defaultChecked={quantity === 4} name="seatsPerTable" type="radio" value={quantity} />
                    <span>{quantity}</span>
                  </label>
                ))}
              </div>
              <small className="muted">Usado quando o mapa escolhido for com mesas. O limite operacional é até 20 lugares por mesa.</small>
            </section>

            <section>
              <h3>5. Formato da mesa</h3>
              <div className="numberedSeatSegmented">
                <label>
                  <input defaultChecked name="tableShape" type="radio" value="ROUND" />
                  <span>Redonda</span>
                </label>
                <label>
                  <input name="tableShape" type="radio" value="SQUARE" />
                  <span>Quadrada</span>
                </label>
                <label>
                  <input name="tableShape" type="radio" value="RECTANGLE" />
                  <span>Retangular</span>
                </label>
              </div>
            </section>
          </div>

          <div className="numberedSeatApplyBar">
            <div>
              <strong>Aplicar mapa numerado neste evento</strong>
              <span>Isso substitui o mapa numerado ativo e muda a experiência pública de compra para seleção visual de lugares.</span>
            </div>
            <button className="button" type="submit">
              Aplicar mapa numerado
            </button>
          </div>
        </form>

        {seatMapLayout ? (
          <>
            <section className="eventOverviewKpiGrid">
              <article className="eventOverviewKpiCard">
                <span className="eventOverviewKpiLabel">Total de lugares</span>
                <strong>{seats.length}</strong>
                <small>Assentos cadastrados no mapa ativo</small>
              </article>
              <article className="eventOverviewKpiCard">
                <span className="eventOverviewKpiLabel">Disponíveis</span>
                <strong>{(totals.AVAILABLE ?? 0) + (totals.ACCESSIBLE ?? 0)}</strong>
                <small>Lugares livres para compra</small>
              </article>
              <article className="eventOverviewKpiCard">
                <span className="eventOverviewKpiLabel">Reservados</span>
                <strong>{totals.RESERVED ?? 0}</strong>
                <small>Reservas temporárias no checkout</small>
              </article>
              <article className="eventOverviewKpiCard">
                <span className="eventOverviewKpiLabel">Vendidos</span>
                <strong>{totals.SOLD ?? 0}</strong>
                <small>Assentos confirmados por pagamento</small>
              </article>
            </section>

            <section className="eventOverviewPanel">
              <div className="eventOverviewPanelHeader">
                <div>
                  <h2>Setores do mapa</h2>
                  <p>Confira os setores, preços e quantidade de lugares vinculados aos lotes.</p>
                </div>
                <span className="eventOverviewPill">{seatMapLayout.kind}</span>
              </div>
              <div className="numberedSeatSectionGrid">
                {seatMapLayout.sections.map((section) => {
                  const sectionSeats = getSectionSeats(section);
                  const sectionTotals = countByStatus(sectionSeats);

                  return (
                    <article className="numberedSeatSectionCard" key={section.id}>
                      <span style={{ background: section.color }} />
                      <div>
                        <strong>{section.name}</strong>
                        <small>{section.description || "Setor numerado"}</small>
                      </div>
                      <dl>
                        <div>
                          <dt>Preço</dt>
                          <dd>{formatCurrency(section.priceInCents)}</dd>
                        </div>
                        <div>
                          <dt>Lugares</dt>
                          <dd>{sectionSeats.length}</dd>
                        </div>
                        <div>
                          <dt>Disponíveis</dt>
                          <dd>{(sectionTotals.AVAILABLE ?? 0) + (sectionTotals.ACCESSIBLE ?? 0)}</dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="eventOverviewPanel">
              <div className="eventOverviewPanelHeader">
                <div>
                  <h2>Status dos assentos</h2>
                  <p>Resumo visual para operação e suporte.</p>
                </div>
              </div>
              <div className="numberedSeatStatusLegend">
                {Object.entries(statusLabels).map(([status, label]) => (
                  <span key={status}>
                    <i className={`is-${status.toLowerCase()}`} />
                    <strong>{label}</strong>
                    <small>{totals[status] ?? 0}</small>
                  </span>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="eventOverviewPanel numberedSeatEmptyState">
            <h2>Nenhum mapa numerado ativo ainda</h2>
            <p>
              Clique em <strong>Gerar mapa numerado de mesas</strong>. O sistema criará uma estrutura inicial com mesas,
              cadeiras, setores e vínculo com os lotes do evento.
            </p>
          </section>
        )}
      </section>
    </AdminShell>
  );
}
