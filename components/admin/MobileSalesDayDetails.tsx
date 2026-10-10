import { formatCurrency } from "@/lib/format";

type Props = { day: { date: string; salesCount: number; paidTicketQuantity: number }; rows: { label: string; value: number }[] };
export function MobileSalesDayDetails({ day, rows }: Props) {
  return <section className="dashboardMobileDayDetails" aria-label="Resumo do dia selecionado" aria-live="polite">
    <strong>{day.date.split("-").reverse().join("/")}</strong>
    <div>{day.salesCount} pedidos pagos · {day.paidTicketQuantity} ingressos</div>
    <dl>{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{formatCurrency(row.value)}</dd></div>)}</dl>
  </section>;
}
