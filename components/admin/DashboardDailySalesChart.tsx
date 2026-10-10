"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

type Day = {
  date: string;
  label: string;
  revenueInCents: number;
  ticketSalesInCents: number;
  serviceFeesInCents: number;
  cardInterestInCents: number;
  salesCount: number;
  paidTicketQuantity: number;
};

export const DESKTOP_DAYS_PER_PAGE = 14;
export const MOBILE_DAYS_PER_PAGE = 7;

export function getDailySalesPage<T>(days: T[], pageSize: number, requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(days.length / pageSize));
  const page = Math.max(0, Math.min(requestedPage, pageCount - 1));
  const firstPageSize = days.length % pageSize || pageSize;
  const start = page === 0 ? 0 : firstPageSize + (page - 1) * pageSize;
  const end = page === 0 ? firstPageSize : start + pageSize;
  return { page, pageCount, days: days.slice(start, end) };
}

function buildChart(days: Day[]) {
  const width = 640;
  const height = 280;
  const max = Math.max(0, ...days.map((day) => day.revenueInCents));
  const points = days.map((day, index) => {
    const x = 26 + 596 * (days.length === 1 ? 0.5 : index / (days.length - 1));
    const y = (value: number) => 246 - (value / Math.max(1, max)) * 228;
    return { ...day, x, revenueY: y(day.revenueInCents), ticketSalesY: y(day.ticketSalesInCents), serviceFeesY: y(day.serviceFeesInCents) };
  });
  const line = (key: "revenueY" | "ticketSalesY" | "serviceFeesY") =>
    points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point[key].toFixed(1)}`).join(" ");
  const revenueLinePath = line("revenueY");
  const areaPath = points.length
    ? `${revenueLinePath} L ${points.at(-1)!.x.toFixed(1)} 246 L ${points[0].x.toFixed(1)} 246 Z`
    : "";
  return { width, height, max, points, revenueLinePath, ticketSalesLinePath: line("ticketSalesY"), serviceFeesLinePath: line("serviceFeesY"), areaPath };
}

export function DashboardDailySalesChart({ days, periodLabel }: { days: Day[]; periodLabel: string }) {
  const [pageSize, setPageSize] = useState(DESKTOP_DAYS_PER_PAGE);
  const [requestedPage, setRequestedPage] = useState(() => Math.max(0, Math.ceil(days.length / DESKTOP_DAYS_PER_PAGE) - 1));

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => {
      const size = media.matches ? MOBILE_DAYS_PER_PAGE : DESKTOP_DAYS_PER_PAGE;
      setPageSize(size);
      setRequestedPage(Math.max(0, Math.ceil(days.length / size) - 1));
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [days.length]);

  const current = getDailySalesPage(days, pageSize, requestedPage);
  const chart = buildChart(current.days);
  const firstDay = current.days[0];
  const lastDay = current.days.at(-1);
  const dateLabel = firstDay && lastDay
    ? `${firstDay.date.split("-").reverse().join("/")} a ${lastDay.date.split("-").reverse().join("/")}`
    : "Sem vendas no período";

  return (
    <article className="dashboardGeneralPanel dashboardGeneralChartPanel">
      <div className="dashboardGeneralPanelHeader">
        <div><h2>Vendas por dia</h2><p>{periodLabel}</p></div>
        <span className="dashboardGeneralPill">{days.length} dias</span>
      </div>

      {current.pageCount > 1 ? (
        <nav className="dashboardDailySalesPager" aria-label="Navegar pelos dias de venda">
          <button type="button" onClick={() => setRequestedPage(current.page - 1)} disabled={current.page === 0} aria-label="Dias anteriores">←</button>
          <span aria-live="polite">{dateLabel} · {current.page + 1} de {current.pageCount}</span>
          <button type="button" onClick={() => setRequestedPage(current.page + 1)} disabled={current.page === current.pageCount - 1} aria-label="Dias seguintes">→</button>
        </nav>
      ) : null}

      <div className="dashboardGeneralLineChartWrap">
        <div className="dashboardGeneralYAxis">
          {[1, 0.75, 0.5, 0.25, 0].map((ratio) => <span key={ratio}>{formatCurrency(Math.round(chart.max * ratio))}</span>)}
        </div>
        <div className="dashboardGeneralLineChart">
          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="none" role="img" aria-label={`Vendas diárias de ${dateLabel}. Valores completos disponíveis ao tocar ou focar em cada dia.`}>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = 18 + 228 * ratio;
              return <line className="dashboardGeneralGridLine" key={ratio} x1="26" x2="622" y1={y} y2={y} />;
            })}
            <path className="dashboardGeneralAreaPath" d={chart.areaPath} />
            <path className="dashboardGeneralLinePath is-revenue" d={chart.revenueLinePath} />
            <path className="dashboardGeneralLinePath is-ticket-sales" d={chart.ticketSalesLinePath} />
            <path className="dashboardGeneralLinePath is-service-fees" d={chart.serviceFeesLinePath} />
            {chart.points.map((point) => (
              <g key={point.date}>
                <circle className="dashboardGeneralLinePoint is-revenue" cx={point.x} cy={point.revenueY} r="5.2" />
                <circle className="dashboardGeneralLinePoint is-ticket-sales" cx={point.x} cy={point.ticketSalesY} r="4.6" />
                <circle className="dashboardGeneralLinePoint is-service-fees" cx={point.x} cy={point.serviceFeesY} r="4.2" />
              </g>
            ))}
          </svg>
          <div className="dashboardGeneralChartLegend" aria-hidden="true">
            <span><i className="is-revenue" />Total pago</span>
            <span><i className="is-ticket-sales" />Venda de ingressos</span>
            <span><i className="is-service-fees" />Taxa bilheteria</span>
          </div>
          <div className="dashboardGeneralChartHotspots" style={{ gridTemplateColumns: `repeat(${Math.max(current.days.length, 1)}, minmax(0, 1fr))` }}>
            {current.days.map((day) => (
              <button
                type="button"
                className="dashboardGeneralChartHotspot"
                key={day.date}
                aria-label={`${day.label}: ${day.salesCount} pedido(s), ${formatCurrency(day.revenueInCents)} total pago`}
              >
                <span className="dashboardGeneralChartTooltip">
                  <strong className="dashboardGeneralChartTooltipTitle">{day.date.split("-").reverse().join("/")}</strong>
                  <span className="dashboardGeneralChartTooltipCounts"><small>{day.salesCount} pedido(s) pago(s)</small><small>{day.paidTicketQuantity} ingresso(s) pago(s)</small></span>
                  <span className="dashboardGeneralChartTooltipRows">
                    <span className="dashboardGeneralChartTooltipRow is-revenue"><span><i />Total pago</span><b>{formatCurrency(day.revenueInCents)}</b></span>
                    <span className="dashboardGeneralChartTooltipRow is-ticket-sales"><span><i />Ingressos</span><b>{formatCurrency(day.ticketSalesInCents)}</b></span>
                    <span className="dashboardGeneralChartTooltipRow is-service-fees"><span><i />Taxa bilheteria</span><b>{formatCurrency(day.serviceFeesInCents)}</b></span>
                    <span className="dashboardGeneralChartTooltipRow is-card-fees"><span><i />Taxas cartão</span><b>{formatCurrency(day.cardInterestInCents)}</b></span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="dashboardGeneralXAxis" style={{ gridTemplateColumns: `repeat(${Math.max(current.days.length, 1)}, minmax(0, 1fr))` }}>
            {current.days.map((day, index) => <span key={day.date}>{index % 2 === 0 || index === current.days.length - 1 ? day.date.slice(8, 10) + "/" + day.date.slice(5, 7) : ""}</span>)}
          </div>
        </div>
      </div>
    </article>
  );
}
