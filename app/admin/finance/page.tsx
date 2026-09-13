import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getFinanceReport } from "@/features/finance/finance-report.service";
import { formatCurrency } from "@/lib/format";
import styles from "./finance-report.module.css";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<Record<string, string | undefined>> };
type IconName = "calendar" | "card" | "download" | "list" | "map" | "percent" | "ticket" | "cart" | "coins";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/></>,
    list: <><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
    map: <><path d="M12 21s7-5 7-12a7 7 0 1 0-14 0c0 7 7 12 7 12Z"/><circle cx="12" cy="9" r="2"/></>,
    percent: <><path d="m19 5-14 14"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/></>,
    ticket: <><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z"/><path d="M13 6v12"/></>,
    cart: <><circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.5 11h11l2-7H7"/></>,
    coins: <><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
const datePt = (value: string) => { const [y,m,d] = value.split("-"); return y&&m&&d ? `${d}/${m}/${y}` : value; };
const query = (values: Record<string,string>) => new URLSearchParams(Object.entries(values).filter(([,v]) => v)).toString();

export default async function FinancePage({ searchParams }: Props) {
  const admin = await requirePermission("FINANCE");
  const params = await searchParams;
  const report = await getFinanceReport(params, admin.organizationId, getAdminAllowedEventIds(admin));
  const selectedEvent = report.events.find(event => event.id === report.filters.eventId);
  const selectedLot = report.lots.find(lot => lot.id === report.filters.lotId);
  const exportParams = query({ eventId: report.filters.eventId, lotId: report.filters.lotId, paymentMethod: report.filters.paymentMethod, startDate: report.filters.startDate, endDate: report.filters.endDate });
  const card = report.byMethod.find(row => row.method === "CREDIT_CARD")?.count ?? 0;
  const pix = report.byMethod.find(row => row.method === "PIX")?.count ?? 0;
  const paymentTotal = card + pix;
  const cardRate = paymentTotal ? Math.round(card / paymentTotal * 100) : 0;
  const pixRate = paymentTotal ? 100 - cardRate : 0;
  const filterText = [selectedEvent?.title ?? "Todos os eventos", selectedLot?.name ?? "Todos os setores", report.filters.paymentMethod === "CREDIT_CARD" ? "Cartão de crédito" : report.filters.paymentMethod === "PIX" ? "Pix" : "Todas as formas"].join(" | ");
  const chart = paymentTotal ? `conic-gradient(#006347 0 ${cardRate}%, #18b978 ${cardRate}% 100%)` : "#dce9e4";
  const issuedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle:"short", timeStyle:"short", timeZone:"America/Sao_Paulo" }).format(new Date());

  return <AdminShell title="Relatório de pedidos por evento" description="Vendas de ingressos - Visão consolidada">
    <section className={`card ${styles.filters}`}><form>
      <label><span>Período inicial</span><input type="date" name="startDate" defaultValue={report.filters.startDate}/></label>
      <label><span>Período final</span><input type="date" name="endDate" defaultValue={report.filters.endDate}/></label>
      <label><span>Evento</span><select name="eventId" defaultValue={report.filters.eventId}><option value="">Todos os eventos</option>{report.events.map(event=><option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
      <label><span>Setor</span><select name="lotId" defaultValue={report.filters.lotId}><option value="">Todos os setores</option>{report.lots.map(lot=><option key={lot.id} value={lot.id}>{report.filters.eventId?lot.name:`${lot.event.title} - ${lot.name}`}</option>)}</select></label>
      <label><span>Pagamento</span><select name="paymentMethod" defaultValue={report.filters.paymentMethod}><option value="">Todos</option><option value="CREDIT_CARD">Cartão de crédito</option><option value="PIX">Pix</option></select></label>
      <button className="button" type="submit">Aplicar filtros</button><Link className={`button ${styles.pdfButton}`} href={`/admin/finance/export/pdf?${exportParams}`}><Icon name="download"/>Baixar PDF</Link>
    </form></section>

    <section className={styles.report}>
      <header className={styles.hero}><div className={styles.heroTitle}><span><Icon name="ticket"/></span><div><h1>Relatório de pedidos por evento</h1><p>Vendas de ingressos - Visão consolidada</p></div></div><div className={styles.period}><Icon name="calendar"/><div><small>Período do relatório</small><strong>{datePt(report.filters.startDate)} a {datePt(report.filters.endDate)}</strong><p>Filtros: {filterText}</p></div></div></header>
      <div className={styles.pageNumber}>Página 1 de 1</div>
      <div className={styles.kpis}>{[
        ["cart","Pedidos",report.totals.paidOrders,"no filtro"], ["ticket","Ingressos",report.totals.ticketsIssued,"vendidos"], ["coins","Valor dos ingressos",formatCurrency(report.totals.ticketNetInCents),"sem taxas"], ["percent","Taxa da bilheteria",formatCurrency(report.totals.serviceFeeInCents),"taxa paga"]
      ].map(([icon,title,value,caption])=><article key={String(title)}><span><Icon name={icon as IconName}/></span><div><h2>{title}</h2><strong>{value}</strong><p>{caption}</p></div></article>)}</div>
      <section className={styles.payment}><div className={styles.sectionTitle}><span><Icon name="card"/></span><div><h2>Cartão x Pix</h2><p>Distribuição das vendas por forma de pagamento</p></div></div><div className={styles.donut} style={{background:chart}}><i/><b className={styles.cardPercent}>{cardRate}%</b><b className={styles.pixPercent}>{pixRate}%</b></div><div className={styles.legend}><div><i className={styles.cardDot}/><p><strong>Cartão de crédito</strong><span>{card} vendas ({cardRate}%)</span></p></div><div><i className={styles.pixDot}/><p><strong>Pix</strong><span>{pix} vendas ({pixRate}%)</span></p></div></div></section>
      <section className={styles.detail}><div className={styles.detailHeading}><span><Icon name="list"/></span><div><h2>Detalhamento por evento</h2><p>Confira abaixo o desempenho de cada evento no período selecionado.</p></div></div><div className={styles.tableWrap}><table><thead><tr><th><Icon name="ticket"/>Evento</th><th><Icon name="map"/>Cidade</th><th><Icon name="ticket"/>Ingressos</th><th><Icon name="coins"/>Valor dos ingressos</th><th><Icon name="percent"/>Taxa da bilheteria</th><th><Icon name="card"/>Juros cartão</th></tr></thead><tbody>{report.byEvent.length?report.byEvent.map(row=><tr key={row.id}><td><strong>{row.title}</strong><span>{row.venueName}</span></td><td>{row.city}/{row.state}</td><td>{row.tickets}</td><td>{formatCurrency(row.ticketNetInCents)}</td><td>{formatCurrency(row.serviceFeeInCents)}</td><td>{formatCurrency(row.cardInterestInCents)}</td></tr>):<tr><td colSpan={6}>Nenhuma venda paga encontrada neste período.</td></tr>}</tbody><tfoot><tr><td colSpan={2}>∑ <strong>Total geral</strong></td><td>{report.totals.ticketsIssued}</td><td>{formatCurrency(report.totals.ticketNetInCents)}</td><td>{formatCurrency(report.totals.serviceFeeInCents)}</td><td>{formatCurrency(report.totals.cardInterestInCents)}</td></tr></tfoot></table></div></section>
      <footer className={styles.footer}><span><Icon name="ticket"/></span><p>Relatório gerado automaticamente pelo sistema de vendas de ingressos.<br/>Em caso de dúvidas, entre em contato com a equipe.</p><div><Icon name="calendar"/><p>Gerado em<br/><strong>{issuedAt}</strong></p></div><b>Eventos que<br/>inspiram pessoas</b></footer>
    </section>
  </AdminShell>;
}
