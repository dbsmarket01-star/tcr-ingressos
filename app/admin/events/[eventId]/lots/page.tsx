import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { HotelLotFields } from "@/components/forms/HotelLotFields";
import { getAdminAllowedEventIds, requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { getEventForManagement } from "@/features/events/event.service";
import { listHotelsForOrganization } from "@/features/hospitality/hotel.service";
import { createTicketLotAction } from "@/features/lots/lot.actions";
import { formatCurrency } from "@/lib/format";
import { getPublicEventUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

type EventLotsPageProps = {
  params: Promise<{
    eventId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const lotStatusLabels = {
  ACTIVE: "Ativo",
  DRAFT: "Rascunho",
  PAUSED: "Pausado",
  SOLD_OUT: "Esgotado",
  CLOSED: "Encerrado"
} as const;

function formatPixDiscount(lot: { pixDiscountPercentBps: number; pixDiscountFixedInCents: number }) {
  if (lot.pixDiscountFixedInCents > 0) {
    return `${formatCurrency(lot.pixDiscountFixedInCents)} no Pix`;
  }

  if (lot.pixDiscountPercentBps > 0) {
    return `${(lot.pixDiscountPercentBps / 100).toFixed(2).replace(".", ",")}% no Pix`;
  }

  return "Sem desconto";
}

export default async function EventLotsPage({ params, searchParams }: EventLotsPageProps) {
  const admin = await requirePermission("EVENTS");
  const { eventId } = await params;
  const query = searchParams ? await searchParams : {};
  await requireEventAccess(eventId);

  const [event, hotels] = await Promise.all([
    getEventForManagement(eventId, admin.organizationId!, getAdminAllowedEventIds(admin)),
    listHotelsForOrganization(admin.organizationId!)
  ]);

  if (!event) {
    notFound();
  }

  return (
    <AdminShell
      title="Ingressos e lotes"
      description="Crie, edite e ajuste apenas os ingressos deste evento."
      headerVariant="minimal"
      hideSidebarIntro
    >
      {typeof query.lotError === "string" ? <div className="errorBox spacedSection">{query.lotError}</div> : null}
      {query.lotSaved === "1" ? <div className="successBox spacedSection">Ingresso atualizado com sucesso.</div> : null}

      <section className="eventOverviewShell">
        <div className="eventOverviewBreadcrumbs">
          <Link href="/admin/events">Congressos e eventos</Link>
          <span>›</span>
          <Link href={`/admin/events/${event.id}`}>{event.title}</Link>
          <span>›</span>
          <strong>Ingressos e lotes</strong>
        </div>

        <nav className="eventOverviewTabs" aria-label="Seções do evento">
          <Link href={`/admin/events/${event.id}`}>Visão geral</Link>
          <span className="isActive">Ingressos e lotes</span>
          <Link href={event.leadCaptureEnabled ? `/admin/events/${event.id}/leads` : `/admin/events/${event.id}/edit`}>Captação</Link>
          <Link href={`/admin/finance?eventId=${event.id}`}>Financeiro</Link>
          <Link href={getPublicEventUrl(event.slug, event.organization)} target="_blank">Divulgação</Link>
          <Link href="/admin/check-in">Check-in</Link>
          <Link href={`/admin/events/${event.id}/edit`}>Configurações</Link>
        </nav>

        <section className="card form wideForm">
          <div className="formSectionHeader">
            <div>
              <span className="sectionEyebrow">Ingressos</span>
              <h2>Lotes cadastrados</h2>
            </div>
            <p className="muted">
              Aqui ficam apenas os dados de ingresso: preço, quantidade, status, Pix, taxas, parcelamento e hotelaria.
            </p>
          </div>

          {event.lots.length > 0 ? (
            <div className="adminTableWrap">
              <table className="table operationalTable">
                <thead>
                  <tr>
                    <th>Ingresso</th>
                    <th>Status</th>
                    <th>Preço</th>
                    <th>Quantidade</th>
                    <th>Pix</th>
                    <th>Hotel</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {event.lots.map((lot) => (
                    <tr key={lot.id}>
                      <td>
                        <strong>{lot.name}</strong>
                        {lot.description ? <br /> : null}
                        {lot.description ? <small className="muted">{lot.description}</small> : null}
                      </td>
                      <td>{lotStatusLabels[lot.status]}</td>
                      <td>{formatCurrency(lot.priceInCents)}</td>
                      <td>
                        {lot.soldQuantity + lot.reservedQuantity} / {lot.totalQuantity}
                      </td>
                      <td>{formatPixDiscount(lot)}</td>
                      <td>
                        {lot.hasHotel && lot.hotel
                          ? `${lot.hotel.name} - ${lot.hotel.city}/${lot.hotel.state}`
                          : lot.hasHotel
                            ? "Possui hotel"
                            : "Sem hotel"}
                      </td>
                      <td>
                        <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}/lots/${lot.id}/edit`}>
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Nenhum ingresso cadastrado ainda.</p>
          )}
        </section>

        <section className="card form wideForm" id="criar-ingresso">
          <form action={createTicketLotAction} className="formSection lotCreateForm">
            <div className="formSectionHeader">
              <div>
                <span className="sectionEyebrow">Novo ingresso</span>
                <h2>Criar lote</h2>
              </div>
              <p className="muted">Depois de criar, você pode voltar aqui para editar preço, quantidade e regras.</p>
            </div>
            <input type="hidden" name="eventId" value={event.id} />
            <div className="grid twoColumns">
              <label className="field">
                <span>Nome</span>
                <input name="name" required placeholder="Ex: Ingresso casal" />
              </label>
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue="DRAFT">
                  <option value="DRAFT">Rascunho</option>
                  <option value="ACTIVE">Ativo</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Descrição</span>
              <input name="description" placeholder="Opcional" />
            </label>
            <div className="grid twoColumns">
              <label className="field">
                <span>Preço</span>
                <input name="price" type="number" min="0" step="0.01" required />
              </label>
              <label className="field">
                <span>Quantidade total</span>
                <input name="totalQuantity" type="number" min="1" required />
              </label>
            </div>
            <div className="grid twoColumns">
              <label className="field">
                <span>Mínimo por pedido</span>
                <input name="minPerOrder" type="number" min="1" defaultValue="1" required />
              </label>
              <label className="field">
                <span>Máximo por pedido</span>
                <input name="maxPerOrder" type="number" min="1" defaultValue="10" required />
              </label>
            </div>
            <HotelLotFields hotels={hotels} />
            <div className="grid twoColumns">
              <label className="field">
                <span>Taxa sobre ingresso (%)</span>
                <input name="serviceFeePercent" type="number" min="0" max="30" step="0.01" defaultValue="0" required />
              </label>
              <label className="field">
                <span>Desconto no Pix</span>
                <select name="pixDiscountType" defaultValue="NONE">
                  <option value="NONE">Sem desconto</option>
                  <option value="PERCENTAGE">Percentual</option>
                  <option value="FIXED">Valor fixo</option>
                </select>
              </label>
            </div>
            <div className="grid twoColumns">
              <label className="field">
                <span>Desconto Pix (%)</span>
                <input name="pixDiscountPercent" type="number" min="0" max="100" step="0.01" defaultValue="0" />
              </label>
              <label className="field">
                <span>Desconto Pix (R$)</span>
                <input name="pixDiscountFixed" type="number" min="0" step="0.01" defaultValue="0" />
              </label>
            </div>
            <div className="grid twoColumns">
              <label className="field">
                <span>Juros do cartão por parcela (%)</span>
                <input name="cardInterestPercentPerInstallment" type="number" min="0" max="10" step="0.01" defaultValue="0" required />
              </label>
              <label className="field">
                <span>Cobrar juros a partir da parcela</span>
                <select name="cardInterestStartsAtInstallment" defaultValue="2">
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((installment) => (
                    <option value={installment} key={installment}>
                      {installment}x
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="formActions">
              <button className="button" type="submit">
                Criar ingresso
              </button>
            </div>
          </form>
        </section>
      </section>
    </AdminShell>
  );
}
