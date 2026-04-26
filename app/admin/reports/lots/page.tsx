import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getLotSalesReport } from "@/features/reports/lot-sales-report.service";
import { formatCurrency, formatDateTime } from "@/lib/format";

type LotSalesReportPageProps = {
  searchParams?: Promise<{
    eventId?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function LotSalesReportPage({ searchParams }: LotSalesReportPageProps) {
  const admin = await requirePermission("REPORTS");
  const params = searchParams ? await searchParams : {};
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const report = await getLotSalesReport(admin.organizationId!, params.eventId, allowedEventIds);
  const exportHref = `/admin/reports/lots/export?${new URLSearchParams({
    ...(params.eventId ? { eventId: params.eventId } : {})
  }).toString()}`;

  return (
    <AdminShell
      title="Relatórios"
      description="Acompanhe vendas pagas, capacidade e bruto confirmado por evento e por lote."
    >
      <section className="adminPanelHero compact">
        <div>
          <span className="sectionEyebrow">Leitura analítica</span>
          <h2>Relatórios mais claros para decisão</h2>
          <p className="muted">Os filtros, métricas e alertas agora ficam em blocos separados para você bater o olho e agir mais rápido.</p>
        </div>
      </section>

      <section className="card financeFilters adminPanelBlock">
        <form className="financeFiltersForm">
          <label className="field">
            <span>Evento</span>
            <select name="eventId" defaultValue={report.filters.eventId}>
              <option value="">Todos os eventos</option>
              {report.events.map((event) => (
                <option value={event.id} key={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            Filtrar
          </button>
          <Link className="secondaryButton" href="/admin/reports/lots">
            Limpar
          </Link>
          <Link className="button" href={exportHref}>
            Exportar CSV
          </Link>
        </form>
      </section>

      <section className="grid dashboardGrid adminMetricsDense">
        <article className="card metric">
          <span className="muted">Lotes</span>
          <strong>{report.totals.totalLots}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Capacidade</span>
          <strong>{report.totals.totalCapacity}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Vendidos pagos</span>
          <strong>{report.totals.totalSold}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Reservados</span>
          <strong>{report.totals.totalReserved}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Disponíveis</span>
          <strong>{report.totals.totalAvailable}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Bruto pago</span>
          <strong>{formatCurrency(report.totals.totalGrossInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Ocupação</span>
          <strong>{report.totals.totalOccupancyPercent}%</strong>
        </article>
        <article className="card metric">
          <span className="muted">Check-in</span>
          <strong>{report.totals.totalCheckInPercent}%</strong>
        </article>
        <article className="card metric">
          <span className="muted">Ticket médio</span>
          <strong>{formatCurrency(report.totals.averageGrossPerSoldTicketInCents)}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Alertas</span>
          <strong>{report.totals.criticalAlerts}</strong>
        </article>
      </section>

      <section className="card spacedSection adminPanelBlock">
        <div className="sectionHeader inlineHeader">
          <h2>Alertas operacionais</h2>
        </div>
        {report.alerts.length === 0 ? (
          <div className="empty">Nenhum alerta operacional para os filtros selecionados.</div>
        ) : (
          <div className="operationsAlertGrid">
            {report.alerts.map((row) => (
              <article className={`operationAlert ${row.alert.level}`} key={row.id}>
                <div>
                  <span>{row.eventTitle}</span>
                  <strong>{row.name}</strong>
                </div>
                <p>{row.alert.label}</p>
                <small>{row.alert.action}</small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card spacedSection adminPanelBlock">
        {report.rows.length === 0 ? (
          <div className="empty">Nenhum lote encontrado para os filtros selecionados.</div>
        ) : (
          <div className="tableScroll wideTableScroll adminTableWrap">
          <table className="table operationalTable">
            <thead>
              <tr>
                <th>Evento</th>
                <th>Lote</th>
                <th>Status</th>
                <th>Alerta</th>
                <th>Preço</th>
                <th>Pago / Total</th>
                <th>Reservado</th>
                <th>Disponível</th>
                <th>Check-ins</th>
                <th>Ticket médio</th>
                <th>Taxas</th>
                <th>Bruto pago</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.eventTitle}</strong>
                    <br />
                    <span className="muted">{formatDateTime(row.eventStartsAt)}</span>
                  </td>
                  <td>{row.name}</td>
                  <td>
                    <span className={`status ${row.status === "ACTIVE" ? "published" : "draft"}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <span className={`status ${row.alert.level === "ok" ? "published" : "draft"}`}>
                      {row.alert.label}
                    </span>
                  </td>
                  <td>{formatCurrency(row.priceInCents)}</td>
                  <td>
                    <strong>
                      {row.soldQuantity} / {row.totalQuantity}
                    </strong>
                    <div className="progressTrack">
                      <span style={{ width: `${Math.min(row.soldPercent, 100)}%` }} />
                    </div>
                  </td>
                  <td>{row.reservedQuantity}</td>
                  <td>{row.availableQuantity}</td>
                  <td>
                    {row.usedTickets} / {row.issuedTickets}
                    <br />
                    <span className="muted">{row.checkInPercent}% usado</span>
                  </td>
                  <td>{formatCurrency(row.averageGrossPerSoldTicketInCents)}</td>
                  <td>{formatCurrency(row.serviceFeeInCents)}</td>
                  <td>{formatCurrency(row.grossInCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
