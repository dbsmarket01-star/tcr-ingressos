import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import {
  getOrdersSummary,
  listAdminOrders,
  listOrderFilterEventsForOrganization
} from "@/features/orders/order.admin.service";
import { calculateCardInterestInCents } from "@/features/pricing/pricing";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const orderStatusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_PAYMENT: "Pendente",
  PAID: "Pago",
  CANCELED: "Cancelado",
  EXPIRED: "Vencido",
  REFUNDED: "Estornado"
};

const orderStatusClasses: Record<string, string> = {
  DRAFT: "neutral",
  PENDING_PAYMENT: "pending",
  PAID: "paid",
  CANCELED: "canceled",
  EXPIRED: "expired",
  REFUNDED: "canceled"
};

const paymentStatusLabels: Record<string, string> = {
  CREATED: "Criado",
  PENDING: "Aguardando",
  APPROVED: "Aprovado",
  FAILED: "Falhou",
  CANCELED: "Cancelado",
  REFUNDED: "Estornado"
};

type OrderSearchParams = {
  eventId?: string;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  city?: string;
  state?: string;
};

type OrdersPageProps = {
  searchParams?: Promise<OrderSearchParams>;
};

type DateRangePreset = {
  label: string;
  startDate: string;
  endDate: string;
};

function getSaoPauloDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

function formatDateInput(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDateRangePresets(): DateRangePreset[] {
  const now = new Date();
  const today = getSaoPauloDateParts(now);
  const yesterday = getSaoPauloDateParts(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const previousMonth = today.month === 1 ? 12 : today.month - 1;
  const previousMonthYear = today.month === 1 ? today.year - 1 : today.year;
  const previousMonthLastDay = new Date(Date.UTC(previousMonthYear, previousMonth, 0)).getUTCDate();
  const todayValue = formatDateInput(today.year, today.month, today.day);

  return [
    {
      label: "Hoje",
      startDate: todayValue,
      endDate: todayValue
    },
    {
      label: "Ontem",
      startDate: formatDateInput(yesterday.year, yesterday.month, yesterday.day),
      endDate: formatDateInput(yesterday.year, yesterday.month, yesterday.day)
    },
    {
      label: "Este mês",
      startDate: formatDateInput(today.year, today.month, 1),
      endDate: todayValue
    },
    {
      label: "Mês passado",
      startDate: formatDateInput(previousMonthYear, previousMonth, 1),
      endDate: formatDateInput(previousMonthYear, previousMonth, previousMonthLastDay)
    }
  ];
}

function buildOrdersPresetHref(params: OrderSearchParams, preset: DateRangePreset) {
  const nextParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && key !== "startDate" && key !== "endDate") {
      nextParams.set(key, value);
    }
  });

  nextParams.set("startDate", preset.startDate);
  nextParams.set("endDate", preset.endDate);

  return `/admin/orders?${nextParams.toString()}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function extractPaymentPayload(rawPayload: unknown) {
  const root = asRecord(rawPayload);
  const nestedPayment = asRecord(root?.payment);
  return nestedPayment ?? root;
}

function extractInstallmentCount(rawPayload: unknown) {
  const payload = extractPaymentPayload(rawPayload);
  const installment = asRecord(payload?.installment);
  const creditCard = asRecord(payload?.creditCard);
  const candidates = [
    payload?.installmentCount,
    payload?.installments,
    installment?.installmentCount,
    creditCard?.installmentCount
  ];

  for (const candidate of candidates) {
    const parsed = typeof candidate === "string" ? Number(candidate) : candidate;
    if (typeof parsed === "number" && Number.isInteger(parsed) && parsed > 1) {
      return parsed;
    }
  }

  const description = typeof payload?.description === "string" ? payload.description : "";
  const descriptionMatch = description.match(/parcela\s+\d+\s+de\s+(\d+)/i);
  if (descriptionMatch) {
    const parsed = Number(descriptionMatch[1]);
    if (Number.isInteger(parsed) && parsed > 1) {
      return parsed;
    }
  }

  return null;
}

function isCreditCardPayment(rawPayload: unknown) {
  const payload = extractPaymentPayload(rawPayload);
  return payload?.billingType === "CREDIT_CARD";
}

function inferInstallmentCountFromInterest(order: {
  cardInterestInCents: number;
  items: Array<{
    totalInCents: number;
    serviceFeeInCents: number;
    cardInterestBpsPerInstallment: number;
    cardInterestStartsAtInstallment: number;
  }>;
}) {
  if (order.cardInterestInCents <= 0) {
    return null;
  }

  for (let installments = 2; installments <= 12; installments += 1) {
    const expectedInterestInCents = order.items.reduce(
      (sum, item) =>
        sum +
        calculateCardInterestInCents(
          item.totalInCents + item.serviceFeeInCents,
          installments,
          item.cardInterestBpsPerInstallment,
          item.cardInterestStartsAtInstallment
        ),
      0
    );

    if (expectedInterestInCents === order.cardInterestInCents) {
      return installments;
    }
  }

  return null;
}

function pluralizeTicket(quantity: number) {
  return quantity === 1 ? "ingresso" : "ingressos";
}

function getOrderTicketLines(order: {
  items: Array<{
    quantity: number;
    admissionsPerUnit?: number | null;
    lot: { name: string };
    lotOption?: { label: string } | null;
  }>;
}) {
  const groupedItems = new Map<string, { label: string; quantity: number; admissions: number }>();

  order.items.forEach((item) => {
    const label = item.lotOption?.label ? `${item.lot.name} - ${item.lotOption.label}` : item.lot.name;
    const previous = groupedItems.get(label) ?? { label, quantity: 0, admissions: 0 };
    const admissionsPerUnit = Math.max(item.admissionsPerUnit ?? 1, 1);

    groupedItems.set(label, {
      label,
      quantity: previous.quantity + item.quantity,
      admissions: previous.admissions + item.quantity * admissionsPerUnit
    });
  });

  return Array.from(groupedItems.values());
}

function getOrderFeeLines(order: {
  serviceFeeInCents: number;
  cardInterestInCents: number;
  payment?: { rawPayload?: unknown } | null;
  items: Array<{
    totalInCents: number;
    serviceFeeInCents: number;
    cardInterestBpsPerInstallment: number;
    cardInterestStartsAtInstallment: number;
  }>;
}) {
  const lines = [{ label: "Taxa bilheteria", value: formatCurrency(order.serviceFeeInCents) }];
  const isCreditCard = isCreditCardPayment(order.payment?.rawPayload);
  const installmentCount = extractInstallmentCount(order.payment?.rawPayload) ?? inferInstallmentCountFromInterest(order);

  if (isCreditCard) {
    lines.push({ label: "Parcelamento cartão", value: `${installmentCount ?? 1}x` });
  }

  if (order.cardInterestInCents > 0) {
    lines.push({ label: "Juros cartão", value: formatCurrency(order.cardInterestInCents) });
  }

  return lines;
}

function getOrderFinancialBreakdown(order: {
  subtotalInCents: number;
  serviceFeeInCents: number;
  cardInterestInCents: number;
  payment?: { rawPayload?: unknown } | null;
  items: Array<{
    quantity: number;
    admissionsPerUnit?: number | null;
    totalInCents: number;
    serviceFeeInCents: number;
    cardInterestBpsPerInstallment: number;
    cardInterestStartsAtInstallment: number;
    lot: { name: string };
    lotOption?: { label: string } | null;
  }>;
}) {
  return {
    ticketSubtotalInCents: order.subtotalInCents,
    serviceFeeInCents: order.serviceFeeInCents,
    cardInterestInCents: order.cardInterestInCents,
    ticketLines: getOrderTicketLines(order),
    feeLines: getOrderFeeLines(order)
  };
}

function findCardLast4(value: unknown, depth = 0): string | null {
  if (depth > 4) {
    return null;
  }

  if (typeof value === "string") {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 4 ? digits.slice(-4) : null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const [key, nestedValue] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("last4") ||
      normalizedKey.includes("lastfour") ||
      normalizedKey.includes("creditcardnumber") ||
      normalizedKey.includes("cardnumber")
    ) {
      const last4 = findCardLast4(nestedValue, depth + 1);
      if (last4) {
        return last4;
      }
    }
  }

  for (const nestedValue of Object.values(record)) {
    const last4 = findCardLast4(nestedValue, depth + 1);
    if (last4) {
      return last4;
    }
  }

  return null;
}

function paymentMethodLabel(payment?: {
  provider: string;
  status: string;
  pixQrCodePayload?: string | null;
  rawPayload?: unknown;
} | null) {
  if (!payment) {
    return {
      title: "Não iniciado",
      detail: "Sem cobrança"
    };
  }

  const payload = extractPaymentPayload(payment.rawPayload);
  const billingType = typeof payload?.billingType === "string" ? payload.billingType : null;
  const manualLabel = typeof payload?.paymentMethodLabel === "string" ? payload.paymentMethodLabel : null;

  if (manualLabel) {
    return {
      title: manualLabel,
      detail: paymentStatusLabels[payment.status] ?? payment.status
    };
  }

  if (payment.provider === "SIMULATED") {
    return {
      title: "Simulado",
      detail: paymentStatusLabels[payment.status] ?? payment.status
    };
  }

  if (billingType === "PIX" || payment.pixQrCodePayload) {
    return {
      title: "Pix",
      detail: payment.status === "APPROVED" ? "Aprovado" : "Aguardando"
    };
  }

  if (billingType === "BOLETO") {
    return {
      title: "Boleto",
      detail: payment.status === "APPROVED" ? "Aprovado" : "Não pago"
    };
  }

  if (billingType === "CREDIT_CARD") {
    const last4 = findCardLast4(payload);
    return {
      title: last4 ? `Cartão •••• ${last4}` : "Cartão",
      detail: payment.status === "APPROVED" ? "Aprovado" : paymentStatusLabels[payment.status] ?? payment.status
    };
  }

  return {
    title: "Outros",
    detail: paymentStatusLabels[payment.status] ?? payment.status
  };
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const admin = await requirePermission("ORDERS");
  const params = searchParams ? await searchParams : {};
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const dateRangePresets = getDateRangePresets();
  const [{ orders, totalCount }, events, summary] = await Promise.all([
    listAdminOrders(params, admin.organizationId, allowedEventIds),
    listOrderFilterEventsForOrganization(admin.organizationId, allowedEventIds),
    getOrdersSummary(params, admin.organizationId, allowedEventIds)
  ]);

  const cityOptions = Array.from(new Set(events.map((event) => event.city).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "pt-BR")
  );
  const stateOptions = Array.from(new Set(events.map((event) => event.state).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "pt-BR")
  );
  const isPendingReport = params.status === "PENDING_PAYMENT";
  const financialCopy = isPendingReport
    ? {
        totalTitle: "Oportunidade total",
        totalDetail: "Valor potencial pendente",
        subtotalTitle: "Ingressos potenciais",
        subtotalDetail: "Base dos ingressos pendentes",
        serviceFeeTitle: "Taxa bilheteria potencial",
        serviceFeeDetail: "Taxa prevista se pagar",
        cardInterestTitle: "Juros cartão potencial",
        cardInterestDetail: "Parcelamento previsto"
      }
    : {
        totalTitle: "Faturamento total",
        totalDetail: "Valor bruto pago",
        subtotalTitle: "Ingressos",
        subtotalDetail: "Valor base dos ingressos",
        serviceFeeTitle: "Taxa bilheteria",
        serviceFeeDetail: "Taxa de serviço configurada",
        cardInterestTitle: "Juros cartão",
        cardInterestDetail: "Acréscimo de parcelamento"
      };

  return (
    <AdminShell
      title="Pedidos"
      description="Gerencie pedidos gerados: pagos, pendentes, vencidos, cancelados ou estornados."
    >
      <section className="ordersDeskPage" aria-label="Gestão de pedidos">
        <div className="ordersSummaryGrid">
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconTotal">▣</span>
            <div>
              <span>Total de pedidos</span>
              <strong>{summary.totalOrders}</strong>
              <small>Todos os status</small>
            </div>
          </article>
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconPaid">✓</span>
            <div>
              <span>Pagos</span>
              <strong>{summary.paidOrders}</strong>
              <small>Pagamento confirmado</small>
            </div>
          </article>
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconPending">◷</span>
            <div>
              <span>Pendentes</span>
              <strong>{summary.pendingOrders}</strong>
              <small>Aguardando pagamento</small>
            </div>
          </article>
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconExpired">×</span>
            <div>
              <span>Vencidos/Cancelados</span>
              <strong>{summary.canceledOrders}</strong>
              <small>Sem venda ativa</small>
            </div>
          </article>
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconRevenue">$</span>
            <div>
              <span>{financialCopy.totalTitle}</span>
              <strong>{formatCurrency(summary.totalInCents)}</strong>
              <small>{financialCopy.totalDetail}</small>
            </div>
          </article>
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconRevenue">R$</span>
            <div>
              <span>{financialCopy.subtotalTitle}</span>
              <strong>{formatCurrency(summary.subtotalInCents)}</strong>
              <small>{financialCopy.subtotalDetail}</small>
            </div>
          </article>
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconPaid">%</span>
            <div>
              <span>{financialCopy.serviceFeeTitle}</span>
              <strong>{formatCurrency(summary.serviceFeeInCents)}</strong>
              <small>{financialCopy.serviceFeeDetail}</small>
            </div>
          </article>
          <article className="ordersSummaryCard">
            <span className="ordersMetricIcon ordersMetricIconPending">CC</span>
            <div>
              <span>{financialCopy.cardInterestTitle}</span>
              <strong>{formatCurrency(summary.cardInterestInCents)}</strong>
              <small>{financialCopy.cardInterestDetail}</small>
            </div>
          </article>
        </div>

        <section className="ordersFilterPanel" aria-label="Filtros de pedidos">
          <div className="ordersFilterHeader">
            <span aria-hidden="true">⌁</span>
            <h2>Filtros</h2>
          </div>
          <form className="ordersFilterForm">
            <div className="ordersFilterGrid">
              <label className="field ordersPeriodField">
                <span>Período</span>
                <div className="ordersDateRange">
                  <input type="date" name="startDate" defaultValue={params.startDate || ""} aria-label="Data inicial" />
                  <input type="date" name="endDate" defaultValue={params.endDate || ""} aria-label="Data final" />
                </div>
                <div className="ordersQuickDateFilters" aria-label="Atalhos de período">
                  {dateRangePresets.map((preset) => {
                    const isActive = params.startDate === preset.startDate && params.endDate === preset.endDate;

                    return (
                      <Link
                        aria-current={isActive ? "page" : undefined}
                        className={`ordersQuickDateButton ${isActive ? "isActive" : ""}`}
                        href={buildOrdersPresetHref(params, preset)}
                        key={preset.label}
                      >
                        {preset.label}
                      </Link>
                    );
                  })}
                </div>
              </label>
              <label className="field">
                <span>Evento</span>
                <select name="eventId" defaultValue={params.eventId || ""}>
                  <option value="">Todos os eventos</option>
                  {events.map((event) => (
                    <option value={event.id} key={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Cidade (opcional)</span>
                <select name="city" defaultValue={params.city || ""}>
                  <option value="">Todas as cidades</option>
                  {cityOptions.map((city) => (
                    <option value={city} key={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Estado (opcional)</span>
                <select name="state" defaultValue={params.state || ""}>
                  <option value="">Todos os estados</option>
                  {stateOptions.map((state) => (
                    <option value={state} key={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue={params.status || ""}>
                  <option value="">Todos os status</option>
                  {Object.entries(orderStatusLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field ordersSearchField">
              <span>Buscar</span>
              <input name="search" placeholder="Pedido, nome, e-mail, telefone, CPF ou evento" defaultValue={params.search || ""} />
            </label>

            <div className="ordersFilterActions">
              <button className="ordersPrimaryButton" type="submit">
                Filtrar
              </button>
              <Link className="ordersSecondaryButton" href="/admin/orders">
                Limpar filtros
              </Link>
              <button className="ordersSecondaryButton ordersExportButton" type="submit" formAction="/admin/orders/export">
                Exportar PDF
              </button>
            </div>
          </form>
        </section>

        <section className="ordersTablePanel" aria-label="Lista de pedidos">
          <div className="ordersTableHeader">
            <div>
              <h2>Lista de pedidos</h2>
              <p>Mostrando {orders.length} de {totalCount} pedido(s)</p>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="ordersEmptyState">Nenhum pedido encontrado com estes filtros.</div>
          ) : (
            <div className="ordersTableWrap">
              <table className="ordersDeskTable">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Evento</th>
                    <th>Ingressos</th>
                    <th>Cidade</th>
                    <th>Data de referência</th>
                    <th>Valor vendido</th>
                    <th>Taxas</th>
                    <th>Status</th>
                    <th>Pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const payment = paymentMethodLabel(order.payment);
                    const breakdown = getOrderFinancialBreakdown(order);
                    const referenceDate = order.status === "PAID" && order.paidAt ? order.paidAt : order.createdAt;

                    return (
                      <tr key={order.id}>
                        <td className="ordersCodeCell">
                          <strong>{order.code}</strong>
                        </td>
                        <td className="ordersCustomerCell">
                          <strong>{order.customer.name}</strong>
                          <span>{order.customer.email}</span>
                          <span>{order.customer.phone || "Telefone não informado"}</span>
                        </td>
                        <td className="ordersEventCell">
                          <strong>{order.event.title}</strong>
                          <span>{order.event.venueName}</span>
                        </td>
                        <td className="ordersTicketItemsCell">
                          {breakdown.ticketLines.map((item) => (
                            <span key={item.label}>
                              <strong>
                                {item.quantity} {pluralizeTicket(item.quantity)}
                              </strong>{" "}
                              {item.label}
                              {item.admissions !== item.quantity ? ` (${item.admissions} QR Codes)` : ""}
                            </span>
                          ))}
                        </td>
                        <td className="ordersCityCell">
                          <strong>{order.event.city}</strong>
                          <span>{order.event.state}</span>
                        </td>
                        <td className="ordersDateCell">{formatDateTime(referenceDate)}</td>
                        <td className="ordersValueCell">
                          <strong>{formatCurrency(breakdown.ticketSubtotalInCents)}</strong>
                          <span>Somente ingressos</span>
                        </td>
                        <td className="ordersFeesCell">
                          {breakdown.feeLines.map((fee) => (
                            <span key={fee.label}>
                              <strong>{fee.label}</strong>
                              {fee.value}
                            </span>
                          ))}
                        </td>
                        <td>
                          <span className={`ordersStatusBadge ${orderStatusClasses[order.status] ?? "neutral"}`}>
                            {orderStatusLabels[order.status] ?? order.status}
                          </span>
                        </td>
                        <td className="ordersPaymentCell">
                          <strong>{payment.title}</strong>
                          <span>{payment.detail}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </AdminShell>
  );
}
