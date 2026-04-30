import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requireEventAccess, requirePermission } from "@/features/auth/auth.service";
import { createCouponAction, updateCouponStatusAction } from "@/features/coupons/coupon.actions";
import { duplicateEventAction, updateEventStatusAction } from "@/features/events/event.actions";
import { getEventCapacity, getEventForManagement, getEventRevenueInCents } from "@/features/events/event.service";
import {
  createTicketLotAction,
  updateTicketLotPricingAction,
  updateTicketLotStatusAction
} from "@/features/lots/lot.actions";
import { formatPercentageFromBps } from "@/features/pricing/pricing";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getPublicEventUrl, getPublicLeadCaptureUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

type EventManagementPageProps = {
  params: Promise<{
    eventId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  UNPUBLISHED: "Despublicado",
  FINISHED: "Encerrado",
  CANCELED: "Cancelado"
};

const lotStatusLabels = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  SOLD_OUT: "Esgotado",
  CLOSED: "Encerrado"
};

const couponStatusLabels = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  EXPIRED: "Expirado"
};

const couponTypeLabels = {
  PERCENTAGE: "Percentual",
  FIXED_AMOUNT: "Valor fixo"
};

function getPixDiscountType(lot: { pixDiscountPercentBps: number; pixDiscountFixedInCents: number }) {
  if (lot.pixDiscountPercentBps > 0) {
    return "PERCENTAGE";
  }

  if (lot.pixDiscountFixedInCents > 0) {
    return "FIXED";
  }

  return "NONE";
}

export default async function EventManagementPage({ params, searchParams }: EventManagementPageProps) {
  const admin = await requirePermission("EVENTS");
  const { eventId } = await params;
  await requireEventAccess(eventId);
  const query = searchParams ? await searchParams : {};
  const event = await getEventForManagement(eventId, admin.organizationId!, getAdminAllowedEventIds(admin));

  if (!event) {
    notFound();
  }

  const capacity = getEventCapacity(event);
  const revenueInCents = getEventRevenueInCents(event);
  const progress = capacity.total > 0 ? Math.round((capacity.sold / capacity.total) * 100) : 0;
  const activeLots = event.lots.filter((lot) => lot.status === "ACTIVE").length;
  const availableTickets = Math.max(capacity.total - capacity.sold - capacity.reserved, 0);
  const hasPublishedSalesReady = event.status === "PUBLISHED" && activeLots > 0 && availableTickets > 0;
  const eventAlerts = [
    ...(event.status !== "PUBLISHED"
      ? ["Evento ainda não publicado."]
      : []),
    ...(activeLots === 0
      ? ["Nenhum lote ativo para venda."]
      : []),
    ...(availableTickets <= 0
      ? ["Sem ingressos disponíveis para venda."]
      : []),
    ...(capacity.reserved >= 5 && capacity.reserved > availableTickets
      ? ["Reservas pendentes altas em relação aos disponíveis."]
      : [])
  ];
  const lotError = typeof query.lotError === "string" ? query.lotError : null;
  const lotSaved = query.lotSaved === "1";
  const couponError = typeof query.couponError === "string" ? query.couponError : null;
  const couponSaved = query.couponSaved === "1";
  const eventError = typeof query.eventError === "string" ? query.eventError : null;
  const eventSaved = query.eventSaved === "1";

  return (
    <AdminShell
      title={event.title}
      description="Gerencie publicação, leitura operacional e lotes deste evento."
    >
      {eventError ? <div className="errorBox spacedSection">{eventError}</div> : null}
      {eventSaved ? <div className="successBox spacedSection">Evento atualizado com sucesso.</div> : null}
      {lotError ? <div className="errorBox spacedSection">{lotError}</div> : null}
      {lotSaved ? <div className="successBox spacedSection">Lote atualizado com sucesso.</div> : null}
      {couponError ? <div className="errorBox spacedSection">{couponError}</div> : null}
      {couponSaved ? <div className="successBox spacedSection">Cupom atualizado com sucesso.</div> : null}

      <section className="grid dashboardGrid">
        <div className="card metric">
          <span className="muted">Status</span>
          <strong>{statusLabels[event.status]}</strong>
        </div>
        <div className="card metric">
          <span className="muted">Vendidos / total</span>
          <strong>
            {capacity.sold} / {capacity.total}
          </strong>
        </div>
        <div className="card metric">
          <span className="muted">Faturamento pago</span>
          <strong>{formatCurrency(revenueInCents)}</strong>
        </div>
        <div className="card metric">
          <span className="muted">Data</span>
          <strong>{formatDateTime(event.startsAt)}</strong>
        </div>
        <div className="card metric">
          <span className="muted">Disponíveis</span>
          <strong>{availableTickets}</strong>
        </div>
        <div className="card metric">
          <span className="muted">Lotes ativos</span>
          <strong>{activeLots}</strong>
        </div>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Pronto para venda</h2>
          <span className={`status ${hasPublishedSalesReady ? "published" : "draft"}`}>
            {hasPublishedSalesReady ? "Pronto" : "Pendente"}
          </span>
        </div>
        {eventAlerts.length === 0 ? (
          <div className="successBox">Evento publicado, com lote ativo e ingressos disponíveis.</div>
        ) : (
          <div className="operationsAlertGrid">
            {eventAlerts.map((alert) => (
              <article className="operationAlert warning" key={alert}>
                <div>
                  <span>Atenção</span>
                  <strong>{alert}</strong>
                </div>
                <small>Resolva antes de aumentar tráfego pago para este evento.</small>
              </article>
            ))}
          </div>
        )}
          <div className="actionRow spacedSection">
            <Link className="secondaryButton smallButton" href={`/admin/reports/lots?eventId=${event.id}`}>
              Relatório do evento
            </Link>
            <Link className="secondaryButton smallButton" href={`/admin/orders?eventId=${event.id}`}>
            Pedidos do evento
          </Link>
            <Link className="secondaryButton smallButton" href={`/admin/finance?eventId=${event.id}`}>
              Financeiro do evento
            </Link>
            {event.leadCaptureEnabled ? (
              <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}/leads`}>
                Leads captados
              </Link>
            ) : null}
          </div>
      </section>

      <section className="grid dashboardGrid spacedSection">
        <article className="card metric">
          <span className="muted">Pedidos</span>
          <strong>{event.orders.length}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Ingressos vendidos</span>
          <strong>{capacity.sold}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Cupons</span>
          <strong>{event.coupons.length}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Leads captados</span>
          <strong>{event._count.leads}</strong>
        </article>
      </section>

      <section className="grid twoColumns spacedSection">
        <div className="card">
          <div className="sectionHeader inlineHeader">
          <h2>Operação do evento</h2>
            <div className="actionRow">
              <Link className="secondaryButton smallButton" href={getPublicEventUrl(event.slug)}>
                Visualizar
              </Link>
              <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}/edit`}>
                Editar
              </Link>
              <form action={duplicateEventAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <button className="secondaryButton smallButton" type="submit">
                  Duplicar
                </button>
              </form>
            </div>
          </div>
          <p className="muted">
            {event.city}, {event.state} - {event.venueName}
          </p>
          <p>{event.description}</p>
          <div className="progressCell eventProgress">
            <div className="progressMeta">
              <span>
                {capacity.sold} vendidos de {capacity.total} disponíveis
              </span>
              <strong>{progress}%</strong>
            </div>
            <div className="progressTrack" aria-label={`${progress}% vendido`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="actionRow spacedSection">
            <form action={updateEventStatusAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="eventSlug" value={event.slug} />
              <input type="hidden" name="status" value="PUBLISHED" />
              <button className="button smallButton" type="submit">
                Publicar
              </button>
            </form>
            <form action={updateEventStatusAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="eventSlug" value={event.slug} />
              <input type="hidden" name="status" value="UNPUBLISHED" />
              <button className="secondaryButton smallButton" type="submit">
                Ocultar venda pública
              </button>
            </form>
            <form action={updateEventStatusAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="eventSlug" value={event.slug} />
              <input type="hidden" name="status" value="DRAFT" />
              <button className="secondaryButton smallButton" type="submit">
                Voltar para rascunho
              </button>
            </form>
            {event.leadCaptureEnabled ? (
              <Link className="secondaryButton smallButton" href={getPublicLeadCaptureUrl(event.slug)} target="_blank">
                Abrir captação
              </Link>
            ) : null}
            {event.leadCaptureEnabled ? (
              <Link className="secondaryButton smallButton" href={`${getPublicLeadCaptureUrl(event.slug)}/obrigado`} target="_blank">
                Abrir obrigado
              </Link>
            ) : null}
            {event.leadCaptureEnabled ? (
              <Link className="secondaryButton smallButton" href={`/admin/events/${event.id}/leads`}>
                Ver leads ({event._count.leads})
              </Link>
            ) : null}
          </div>
          {event.leadCaptureEnabled ? (
            <p className="muted">
              Quando a venda pública fica oculta, a landing de captação em <strong>/lista/{event.slug}</strong> continua no ar.
            </p>
          ) : null}
        </div>

        <form action={createTicketLotAction} className="card form">
          <h2>Novo lote</h2>
          <input type="hidden" name="eventId" value={event.id} />
          <label className="field">
            <span>Nome do lote</span>
            <input name="name" placeholder="Ex: Pista - Primeiro lote" required />
          </label>
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
              <span>Quantidade</span>
              <input name="totalQuantity" type="number" min="1" required />
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Taxa sobre ingresso (%)</span>
              <input name="serviceFeePercent" type="number" min="0" max="30" step="0.01" defaultValue="0" required />
              <small>Ex: 17 para cobrar 17% sobre o valor do ingresso.</small>
            </label>
            <label className="field">
              <span>Desconto no Pix</span>
              <select name="pixDiscountType" defaultValue="NONE">
                <option value="NONE">Sem desconto</option>
                <option value="PERCENTAGE">Percentual</option>
                <option value="FIXED">Valor fixo</option>
              </select>
              <small>Escolha se o desconto no Pix será em porcentagem ou em valor fixo.</small>
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Desconto Pix (%)</span>
              <input name="pixDiscountPercent" type="number" min="0" max="100" step="0.01" defaultValue="0" />
              <small>Preencha apenas se o tipo acima for percentual.</small>
            </label>
            <label className="field">
              <span>Desconto Pix (R$)</span>
              <input name="pixDiscountFixed" type="number" min="0" step="0.01" defaultValue="0" />
              <small>Preencha apenas se o tipo acima for valor fixo.</small>
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Juros do cartão por parcela (%)</span>
              <input
                name="cardInterestPercentPerInstallment"
                type="number"
                min="0"
                max="10"
                step="0.01"
                defaultValue="0"
                required
              />
              <small>Ex: 3 para cobrar 3% por parcela no cartão.</small>
            </label>
          </div>
          <label className="field">
            <span>Cobrar juros a partir da parcela</span>
            <select name="cardInterestStartsAtInstallment" defaultValue="2">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((installment) => (
                <option value={installment} key={installment}>
                  {installment}x
                </option>
              ))}
            </select>
            <small>Ex: escolha 4x para permitir ate 3x sem juros.</small>
          </label>
          <div className="grid twoColumns">
            <label className="field">
              <span>Minimo por pedido</span>
              <input name="minPerOrder" type="number" min="1" defaultValue="1" required />
            </label>
            <label className="field">
              <span>Maximo por pedido</span>
              <input name="maxPerOrder" type="number" min="1" defaultValue="10" required />
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Início das vendas</span>
              <input name="salesStartsAt" type="datetime-local" />
            </label>
            <label className="field">
              <span>Fim das vendas</span>
              <input name="salesEndsAt" type="datetime-local" />
            </label>
          </div>
          <label className="field">
            <span>Status inicial</span>
            <select name="status" defaultValue="ACTIVE">
              <option value="ACTIVE">Ativo</option>
              <option value="DRAFT">Rascunho</option>
            </select>
          </label>
          <button className="button" type="submit">
            Salvar lote
          </button>
        </form>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <h2>Lotes do evento</h2>
        </div>

        {event.lots.length === 0 ? (
          <div className="empty">Nenhum lote cadastrado ainda.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Status</th>
                <th>Preco</th>
                <th>Taxas</th>
                <th>Vendidos</th>
                <th>Reservados</th>
                <th>Total</th>
                <th>Vendas</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {event.lots.map((lot) => {
                const available = lot.totalQuantity - lot.soldQuantity - lot.reservedQuantity;
                const serviceFeePercent = (lot.serviceFeeBps / 100).toFixed(2);
                const pixDiscountPercent = (lot.pixDiscountPercentBps / 100).toFixed(2);
                const cardInterestPercent = (lot.cardInterestBpsPerInstallment / 100).toFixed(2);
                const pixDiscountType = getPixDiscountType(lot);

                return (
                  <tr key={lot.id}>
                    <td>
                      <strong>{lot.name}</strong>
                      {lot.description ? (
                        <>
                          <br />
                          <span className="muted">{lot.description}</span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <span className={`status ${lot.status === "ACTIVE" ? "published" : "draft"}`}>
                        {lotStatusLabels[lot.status]}
                      </span>
                    </td>
                    <td>{formatCurrency(lot.priceInCents)}</td>
                    <td>
                      <form action={updateTicketLotPricingAction} className="lotPricingForm">
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="eventSlug" value={event.slug} />
                        <input type="hidden" name="lotId" value={lot.id} />
                        <label>
                          <span>Preco</span>
                          <input
                            aria-label={`Preco de ${lot.name}`}
                            name="price"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={(lot.priceInCents / 100).toFixed(2)}
                          />
                        </label>
                        <label>
                          <span>Taxa %</span>
                          <input
                            aria-label={`Taxa de ${lot.name}`}
                            name="serviceFeePercent"
                            type="number"
                            min="0"
                            max="30"
                            step="0.01"
                            defaultValue={serviceFeePercent}
                          />
                        </label>
                        <label>
                          <span>Juros %</span>
                          <input
                            aria-label={`Juros de cartão de ${lot.name}`}
                            name="cardInterestPercentPerInstallment"
                            type="number"
                            min="0"
                            max="10"
                            step="0.01"
                            defaultValue={cardInterestPercent}
                          />
                        </label>
                        <label>
                          <span>Pix</span>
                          <select
                            aria-label={`Tipo de desconto no Pix de ${lot.name}`}
                            name="pixDiscountType"
                            defaultValue={pixDiscountType}
                          >
                            <option value="NONE">Sem desconto</option>
                            <option value="PERCENTAGE">Percentual</option>
                            <option value="FIXED">Valor fixo</option>
                          </select>
                        </label>
                        <label>
                          <span>Pix %</span>
                          <input
                            aria-label={`Desconto percentual no Pix de ${lot.name}`}
                            name="pixDiscountPercent"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            defaultValue={pixDiscountPercent}
                          />
                        </label>
                        <label>
                          <span>Pix R$</span>
                          <input
                            aria-label={`Desconto fixo no Pix de ${lot.name}`}
                            name="pixDiscountFixed"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={(lot.pixDiscountFixedInCents / 100).toFixed(2)}
                          />
                        </label>
                        <label>
                          <span>A partir</span>
                          <select
                            aria-label={`Início do juros de cartão de ${lot.name}`}
                            name="cardInterestStartsAtInstallment"
                            defaultValue={String(lot.cardInterestStartsAtInstallment)}
                          >
                            {Array.from({ length: 10 }, (_, index) => index + 1).map((installment) => (
                              <option value={installment} key={installment}>
                                {installment}x
                              </option>
                            ))}
                          </select>
                        </label>
                        <button className="secondaryButton smallButton" type="submit">
                          Salvar
                        </button>
                      </form>
                      <p className="muted">
                        Atual: {formatPercentageFromBps(lot.serviceFeeBps)} taxa /{" "}
                        {lot.pixDiscountPercentBps > 0
                          ? `${formatPercentageFromBps(lot.pixDiscountPercentBps)} desconto Pix`
                          : lot.pixDiscountFixedInCents > 0
                            ? `${formatCurrency(lot.pixDiscountFixedInCents)} desconto Pix`
                            : "sem desconto Pix"}{" "}
                        /{" "}
                        {formatPercentageFromBps(lot.cardInterestBpsPerInstallment)} a partir de{" "}
                        {lot.cardInterestStartsAtInstallment}x
                      </p>
                    </td>
                    <td>{lot.soldQuantity}</td>
                    <td>{lot.reservedQuantity}</td>
                    <td>{lot.totalQuantity}</td>
                    <td>{available} disponíveis</td>
                    <td>
                      <div className="actionRow">
                        <Link
                          className="secondaryButton smallButton"
                          href={`/admin/events/${event.id}/lots/${lot.id}/edit`}
                        >
                          Editar
                        </Link>
                        <form action={updateTicketLotStatusAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="lotId" value={lot.id} />
                          <input type="hidden" name="status" value="ACTIVE" />
                          <button className="secondaryButton smallButton" type="submit">
                            Ativar
                          </button>
                        </form>
                        <form action={updateTicketLotStatusAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="lotId" value={lot.id} />
                          <input type="hidden" name="status" value="PAUSED" />
                          <button className="secondaryButton smallButton" type="submit">
                            Pausar
                          </button>
                        </form>
                        <form action={updateTicketLotStatusAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="lotId" value={lot.id} />
                          <input type="hidden" name="status" value="CLOSED" />
                          <button className="secondaryButton smallButton" type="submit">
                            Encerrar
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="grid twoColumns spacedSection">
        <form action={createCouponAction} className="card form">
          <h2>Novo cupom</h2>
          <input type="hidden" name="eventId" value={event.id} />
          <label className="field">
            <span>Código</span>
            <input name="code" placeholder="Ex: TCR10" required />
          </label>
          <div className="grid twoColumns">
            <label className="field">
              <span>Tipo</span>
              <select name="type" defaultValue="PERCENTAGE">
                <option value="PERCENTAGE">Percentual</option>
                <option value="FIXED_AMOUNT">Valor fixo</option>
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue="ACTIVE">
                <option value="ACTIVE">Ativo</option>
                <option value="PAUSED">Pausado</option>
              </select>
            </label>
          </div>
          <div className="grid twoColumns">
            <label className="field">
              <span>Desconto percentual (%)</span>
              <input name="percentage" type="number" min="1" max="100" step="1" placeholder="10" />
            </label>
            <label className="field">
              <span>Desconto fixo (R$)</span>
              <input name="amount" type="number" min="0" step="0.01" placeholder="20.00" />
            </label>
          </div>
          <label className="field">
            <span>Limite de usos</span>
            <input name="maxRedemptions" type="number" min="1" placeholder="Opcional" />
          </label>
          <div className="grid twoColumns">
            <label className="field">
              <span>Inicio</span>
              <input name="startsAt" type="datetime-local" />
            </label>
            <label className="field">
              <span>Fim</span>
              <input name="endsAt" type="datetime-local" />
            </label>
          </div>
          <button className="button" type="submit">
            Salvar cupom
          </button>
        </form>

        <section className="card">
          <div className="sectionHeader inlineHeader">
            <h2>Cupons do evento</h2>
          </div>
          {event.coupons.length === 0 ? (
            <div className="empty">Nenhum cupom cadastrado ainda.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Desconto</th>
                  <th>Uso</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {event.coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td>
                      <strong>{coupon.code}</strong>
                    </td>
                    <td>{couponTypeLabels[coupon.type]}</td>
                    <td>
                      {coupon.type === "PERCENTAGE"
                        ? `${coupon.percentage ?? 0}%`
                        : formatCurrency(coupon.amountInCents ?? 0)}
                    </td>
                    <td>
                      {coupon.redeemedCount}
                      {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""}
                    </td>
                    <td>
                      <span className={`status ${coupon.status === "ACTIVE" ? "published" : "draft"}`}>
                        {couponStatusLabels[coupon.status]}
                      </span>
                    </td>
                    <td>
                      <div className="actionRow">
                        <form action={updateCouponStatusAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="couponId" value={coupon.id} />
                          <input type="hidden" name="status" value="ACTIVE" />
                          <button className="secondaryButton smallButton" type="submit">
                            Ativar
                          </button>
                        </form>
                        <form action={updateCouponStatusAction}>
                          <input type="hidden" name="eventId" value={event.id} />
                          <input type="hidden" name="couponId" value={coupon.id} />
                          <input type="hidden" name="status" value="PAUSED" />
                          <button className="secondaryButton smallButton" type="submit">
                            Pausar
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </section>
    </AdminShell>
  );
}
