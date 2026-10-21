import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminAllowedEventIds, requirePermission } from "@/features/auth/auth.service";
import { getCrmWhatsAppConversation, getCrmWhatsAppInbox, getCrmWhatsAppNotificationSnapshot } from "@/features/crm/whatsapp-chat.service";
import { getWhatsAppAiConversationState } from "@/features/ai/whatsapp-support-ai.service";
import { WhatsAppNotificationWatcher } from "./WhatsAppNotificationWatcher";
import { WhatsAppLiveInboxList } from "./WhatsAppLiveInboxList";
import { WhatsAppStatusTabs } from "./WhatsAppStatusTabs";
import { WhatsAppPeriodBar } from "./WhatsAppPeriodBar";
import { WhatsAppInboxSearch } from "./WhatsAppInboxSearch";
import { WhatsAppConversationPanel } from "./WhatsAppConversationPanel";

export const dynamic = "force-dynamic";

type CrmWhatsAppPageProps = { searchParams?: Promise<{ endDate?: string; leadId?: string; limit?: string; message?: string; notice?: string; orderCode?: string; period?: string; phone?: string; search?: string; startDate?: string; status?: string }> };
function SearchIcon() { return <svg aria-hidden="true" className="crmWaIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>; }
const initials = (name?: string | null) => String(name || "WA").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const CRM_TIME_ZONE = "America/Sao_Paulo";
const BRAZIL_OFFSET = "-03:00";
const localDateKey = (value = new Date()) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: CRM_TIME_ZONE }).format(value);
function addDays(dateKey: string, days: number) {
  const value = new Date(`${dateKey}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function resolvePeriod(params: { endDate?: string; period?: string; startDate?: string }) {
  const today = localDateKey();
  const period = ["all", "today", "yesterday", "week", "month", "lastMonth", "custom"].includes(params.period || "") ? params.period! : "today";
  if (period === "all") return { period, start: today, end: today, startAt: undefined, endAt: undefined };
  let start = today;
  let endExclusive = addDays(today, 1);
  if (period === "yesterday") { start = addDays(today, -1); endExclusive = today; }
  if (period === "week") { const day = new Date(`${today}T12:00:00Z`).getUTCDay(); start = addDays(today, -day); endExclusive = addDays(start, 7); }
  if (period === "month") { start = `${today.slice(0, 7)}-01`; endExclusive = `${addDays(start, 32).slice(0, 7)}-01`; }
  if (period === "lastMonth") { const currentStart = `${today.slice(0, 7)}-01`; start = `${addDays(currentStart, -1).slice(0, 7)}-01`; endExclusive = currentStart; }
  if (period === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(params.startDate || "") && /^\d{4}-\d{2}-\d{2}$/.test(params.endDate || "")) {
    start = params.startDate!;
    endExclusive = addDays(params.endDate!, 1);
  }
  return { period, start, end: addDays(endExclusive, -1), startAt: new Date(`${start}T00:00:00${BRAZIL_OFFSET}`), endAt: new Date(`${endExclusive}T00:00:00${BRAZIL_OFFSET}`) };
}
export default async function CrmWhatsAppPage({ searchParams }: CrmWhatsAppPageProps) {
  const admin = await requirePermission("CRM");
  const params = searchParams ? await searchParams : {};
  const allowedEventIds = getAdminAllowedEventIds(admin);
  const selectedPeriod = resolvePeriod(params);
  const inboxPromise = getCrmWhatsAppInbox({ organizationId: admin.organizationId, allowedEventIds, search: params.search, startAt: selectedPeriod.startAt, endAt: selectedPeriod.endAt });
  const latestInboundPromise = getCrmWhatsAppNotificationSnapshot({ organizationId: admin.organizationId, allowedEventIds });
  const hasExplicitSelection = Boolean(params.orderCode || params.leadId || params.phone);
  const selectedConversationPromise = hasExplicitSelection
    ? getCrmWhatsAppConversation({ orderCode: params.orderCode, leadId: params.leadId, phone: params.phone, organizationId: admin.organizationId, allowedEventIds })
    : null;
  const rawInbox = await inboxPromise;
  const activeStatus = ["ai", "unread", "human", "refund", "followup", "closed", "abandoned"].includes(params.status || "") ? params.status === "unread" ? "ai" : params.status! : "all";
  const counters = {
    all: rawInbox.length,
    ai: rawInbox.filter((item) => item.queue === "ai").length,
    human: rawInbox.filter((item) => item.queue === "human").length,
    refund: rawInbox.filter((item) => item.queue === "refund").length,
    followup: rawInbox.filter((item) => item.queue === "followup").length,
    closed: rawInbox.filter((item) => item.queue === "closed").length,
    abandoned: rawInbox.filter((item) => item.abandonedWithoutReturn).length
  };
  const visualUnreadCount = rawInbox.filter((item) => item.hasUnread).length;
  const inbox = rawInbox.filter((item) =>
    activeStatus === "ai"
      ? item.queue === "ai"
      : activeStatus === "human"
        ? item.queue === "human"
        : activeStatus === "refund"
          ? item.queue === "refund"
        : activeStatus === "followup"
          ? item.queue === "followup"
          : activeStatus === "closed"
            ? item.queue === "closed"
            : activeStatus === "abandoned"
              ? item.abandonedWithoutReturn
              : true
  );
  const requestedLimit = Number(params.limit || 120);
  const displayLimit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 60), 600) : 120;
  const selectedInboxItem = params.orderCode || params.leadId || params.phone ? null : inbox[0] || rawInbox[0] || null;
  const selectedOrderCode = params.orderCode || selectedInboxItem?.orderCode || undefined;
  const selectedPhone = params.phone || selectedInboxItem?.phone || undefined;
  const [latestInbound, conversation] = await Promise.all([
    latestInboundPromise,
    selectedConversationPromise || getCrmWhatsAppConversation({ orderCode: selectedOrderCode, leadId: params.leadId, phone: selectedPhone, organizationId: admin.organizationId, allowedEventIds })
  ]);
  const contact = conversation.contact;
  const selectedContactKey = String(contact?.phone || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  const selectedHasUnread = rawInbox.find((item) => item.key === selectedContactKey)?.hasUnread || false;
  const aiState = contact?.phone
    ? await getWhatsAppAiConversationState(admin.organizationId, contact.phone)
    : { mode: "DISABLED" as const, reason: "Selecione uma conversa." };

  return <AdminShell title="WhatsApp interno" description="Atendimento comercial conectado à API oficial do WhatsApp." headerVariant="minimal">
    <div className="crmWhatsappPage">
      <header className="crmWhatsappHeader">
        <div className="crmWhatsappHeading"><span className="crmWhatsappBreadcrumb">CRM / <strong>WhatsApp</strong></span><h1>Central de conversas</h1><p>Responda compradores e acompanhe retornos das mensagens automáticas.</p></div>
        <div className="crmWhatsappHeaderTools"><Link href="/admin/crm/whatsapp/knowledge">Aprendizado da IA</Link><form action="/admin/crm/whatsapp" className="crmWhatsappGlobalSearch" method="get"><SearchIcon/><input name="search" placeholder="Buscar conversas, contatos ou pedidos..." defaultValue={params.search || ""}/><kbd>⌘ K</kbd></form><WhatsAppNotificationWatcher latestInboundId={latestInbound?.id || null} latestInboundAt={latestInbound?.at.toISOString() || null} unreadCount={visualUnreadCount} refreshOnNewInbound={!selectedPeriod.startAt || (selectedPeriod.startAt <= new Date() && selectedPeriod.endAt! > new Date())}/><span className="crmWhatsappUser"><i>{initials(admin.name)}</i><span><strong>{admin.name}</strong><small>{admin.role}</small></span></span></div>
      </header>

      <WhatsAppStatusTabs initialStatus={activeStatus} initialCounts={counters} period={selectedPeriod.period}/>
      <WhatsAppPeriodBar status={activeStatus} period={selectedPeriod.period} start={selectedPeriod.start} end={selectedPeriod.end} search={params.search}/>
      {params.status === "erro" || params.status === "ok" ? <div className={`crmWhatsappFeedback ${params.status === "erro" ? "isError" : "isSuccess"}`}>{params.message || "Mensagem enviada."}</div> : null}
      {params.notice ? <div className="crmWhatsappFeedback isSuccess">{params.notice}</div> : null}

      <section className="crmWhatsappShell">
        <aside className="crmWhatsappInboxPanel">
          <WhatsAppInboxSearch status={activeStatus} period={selectedPeriod.period} start={selectedPeriod.start} end={selectedPeriod.end} search={params.search}/>
          <WhatsAppLiveInboxList initialItems={rawInbox} activeStatus={activeStatus} selectedOrderCode={selectedOrderCode} selectedPhone={selectedPhone} search={params.search} period={{ period: selectedPeriod.period, start: selectedPeriod.start, end: selectedPeriod.end }} displayLimit={displayLimit}/>
        </aside>

        <WhatsAppConversationPanel initialConversation={conversation} initialAiState={aiState} initialSelection={{ phone: selectedPhone, orderCode: selectedOrderCode, leadId: params.leadId }} initialHasUnread={selectedHasUnread}/>
      </section>
    </div>
  </AdminShell>;
}
