"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

type Day = { date: string; label: string; ticketSalesInCents: number; paidTicketQuantity: number; salesCount: number };
export function SalesViewerChart({ days, periodLabel }: { days: Day[]; periodLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const maxValue = Math.max(0, ...days.map(d => d.ticketSalesInCents));
  const maxCount = Math.max(0, ...days.map(d => d.paidTicketQuantity));
  const points = days.map((d, i) => ({ ...d, x: 26 + (days.length === 1 ? 0.5 : i / Math.max(1, days.length - 1)) * 596, y: 246 - d.ticketSalesInCents / Math.max(1, maxValue) * 228, countY: 246 - d.paidTicketQuantity / Math.max(1, maxCount) * 228 }));
  const path = (key: "y" | "countY") => points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p[key]}`).join(" ");
  const area = points.length ? `${path("y")} L ${points.at(-1)!.x} 246 L ${points[0].x} 246 Z` : "";
  const step = Math.max(1, Math.ceil(days.length / 8));
  return <article className="dashboardGeneralPanel dashboardGeneralChartPanel salesViewerChart">
    <div className="dashboardGeneralPanelHeader"><div><h2>Vendas por dia</h2><p>{periodLabel}</p></div><span className="dashboardGeneralPill">{days.length} dias</span></div>
    <div className="salesViewerAxisCaption"><span>Venda de ingressos (R$)</span><span>Quantidade de ingressos</span></div>
    <div className="dashboardGeneralLineChartWrap">
      <div className="dashboardGeneralYAxis">{[1,.75,.5,.25,0].map(r => <span key={r}>{formatCurrency(Math.round(maxValue*r))}</span>)}</div>
      <div className="dashboardGeneralLineChart">
        <svg viewBox="0 0 640 280" preserveAspectRatio="none" role="img" aria-label="Vendas por dia: valor dos ingressos em verde e quantidade em amarelo, com escalas independentes">
          {[0,.25,.5,.75,1].map(r => <line className="dashboardGeneralGridLine" key={r} x1="26" x2="622" y1={18+228*r} y2={18+228*r} />)}
          <path className="dashboardGeneralAreaPath" d={area} />
          <path className="dashboardGeneralLinePath is-revenue" d={path("y")} />
          <path className="dashboardGeneralLinePath is-ticket-sales" d={path("countY")} />
          {points.map(p => <g key={p.date}><circle className="dashboardGeneralLinePoint is-revenue" cx={p.x} cy={p.y} r="5.2" /><circle className="dashboardGeneralLinePoint is-ticket-sales" cx={p.x} cy={p.countY} r="4.6" /></g>)}
        </svg>
        <div className="dashboardGeneralChartLegend"><span><i className="is-revenue" />Venda de ingressos</span><span><i className="is-ticket-sales" />Quantidade de ingressos</span></div>
        <div className="dashboardGeneralChartHotspots" style={{ gridTemplateColumns: `repeat(${Math.max(days.length,1)},minmax(0,1fr))` }} onPointerLeave={() => setActive(null)} onTouchMove={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          const touch = event.touches[0];
          if (touch && days.length && rect.width) setActive(Math.max(0, Math.min(days.length - 1, Math.floor((touch.clientX - rect.left) / rect.width * days.length))));
        }}>
          {days.map((d,i) => <button type="button" key={d.date} className={`dashboardGeneralChartHotspot${active===i ? " is-active" : ""}`} onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={() => setActive(i)} aria-label={`${d.label}: ${d.salesCount} pedidos pagos, ${d.paidTicketQuantity} ingressos, ${formatCurrency(d.ticketSalesInCents)} faturados`}>
            <span className="dashboardGeneralChartTooltip" role="tooltip">
              <strong className="dashboardGeneralChartTooltipTitle">{d.date.split("-").reverse().join("/")}</strong>
              <span className="dashboardGeneralChartTooltipCounts"><small>{d.salesCount} pedido(s) pago(s)</small><small>{d.paidTicketQuantity} ingresso(s)</small></span>
              <span className="dashboardGeneralChartTooltipRows"><span className="dashboardGeneralChartTooltipRow is-revenue"><span><i />Valor faturado</span><b>{formatCurrency(d.ticketSalesInCents)}</b></span></span>
            </span>
          </button>)}
        </div>
        <div className="dashboardGeneralXAxis" style={{ gridTemplateColumns: `repeat(${Math.max(days.length,1)},minmax(0,1fr))` }}>{days.map((d,i)=><span key={d.date}>{i===0||i===days.length-1||i%step===0?d.label:""}</span>)}</div>
      </div>
      <div className="dashboardGeneralYAxis salesViewerCountAxis">{[1,.75,.5,.25,0].map(r=><span key={r}>{Math.round(maxCount*r)}</span>)}</div>
    </div>
  </article>;
}
