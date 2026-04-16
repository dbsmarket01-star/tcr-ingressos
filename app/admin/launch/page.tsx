import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getLaunchChecklist } from "@/features/launch/launch-checklist.service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type LaunchPageProps = {
  searchParams?: Promise<{
    eventId?: string;
  }>;
};

const statusLabels = {
  READY: "Pronto",
  WARNING: "Atencao",
  BLOCKED: "Pendente"
};

const statusClasses = {
  READY: "published",
  WARNING: "pending",
  BLOCKED: "draft"
};

function ChecklistCard({
  title,
  items
}: {
  title: string;
  items: Awaited<ReturnType<typeof getLaunchChecklist>>["content"];
}) {
  return (
    <section className="card">
      <div className="sectionHeader inlineHeader">
        <h2>{title}</h2>
      </div>
      <div className="readinessList">
        {items.map((item) => (
          <article className="readinessItem" key={item.label}>
            <div>
              <span className={`status ${statusClasses[item.status]}`}>{statusLabels[item.status]}</span>
              <strong>{item.label}</strong>
              <p className="muted">{item.description}</p>
              {item.action ? <p className="formHint">{item.action}</p> : null}
              {item.href ? (
                <Link className="secondaryButton smallButton" href={item.href}>
                  Abrir
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function LaunchPage({ searchParams }: LaunchPageProps) {
  await requirePermission("PRODUCTION");
  const params = searchParams ? await searchParams : {};
  const checklist = await getLaunchChecklist(params.eventId);
  const launchReady = checklist.summary.blocked === 0 && checklist.summary.warning <= 2;

  return (
    <AdminShell
      title="Lancamento"
      description="Checklist por evento antes de liberar trafego pago e venda real."
    >
      <section className="card financeFilters">
        <form className="financeFiltersForm">
          <label className="field">
            <span>Evento</span>
            <select name="eventId" defaultValue={checklist.filters.eventId}>
              {checklist.events.length === 0 ? <option value="">Nenhum evento cadastrado</option> : null}
              {checklist.events.map((event) => (
                <option value={event.id} key={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            Revisar evento
          </button>
          {checklist.event ? (
            <>
              <Link className="secondaryButton" href={`/evento/${checklist.event.slug}`}>
                Pagina publica
              </Link>
              <Link className="secondaryButton" href={`/admin/events/${checklist.event.id}`}>
                Gerenciar evento
              </Link>
            </>
          ) : null}
        </form>
      </section>

      <section className="grid dashboardGrid">
        <article className="card metric">
          <span className="muted">Prontos</span>
          <strong>{checklist.summary.ready}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Atencao</span>
          <strong>{checklist.summary.warning}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Pendentes</span>
          <strong>{checklist.summary.blocked}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Status</span>
          <strong>{launchReady ? "Pode testar trafego" : "Revisar antes"}</strong>
        </article>
      </section>

      {checklist.event ? (
        <section className="card spacedSection">
          <div className="sectionHeader inlineHeader">
            <h2>{checklist.event.title}</h2>
            <span className={`status ${launchReady ? "published" : "pending"}`}>
              {launchReady ? "Lancamento viavel" : "Ajustes recomendados"}
            </span>
          </div>
          <div className="settingsGrid">
            <div>
              <span>Data</span>
              <strong>{formatDateTime(checklist.event.startsAt)}</strong>
            </div>
            <div>
              <span>Disponiveis</span>
              <strong>{checklist.event.availableQuantity}</strong>
            </div>
            <div>
              <span>Vendidos</span>
              <strong>{checklist.event.soldQuantity}</strong>
            </div>
            <div>
              <span>Reservados</span>
              <strong>{checklist.event.reservedQuantity}</strong>
            </div>
            <div>
              <span>Pagamentos aprovados</span>
              <strong>{checklist.event.approvedPayments}</strong>
            </div>
            <div>
              <span>Pix / Cartao</span>
              <strong>
                {checklist.event.pixPayments} / {checklist.event.cardPayments}
              </strong>
            </div>
            <div>
              <span>Ingressos emitidos</span>
              <strong>{checklist.event.issuedTickets}</strong>
            </div>
            <div>
              <span>Check-ins aprovados</span>
              <strong>{checklist.event.approvedCheckIns}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {checklist.nextActions.length > 0 ? (
        <section className="card spacedSection">
          <div className="sectionHeader inlineHeader">
            <h2>Proximas acoes</h2>
          </div>
          <div className="operationsAlertGrid">
            {checklist.nextActions.map((item) => (
              <article
                className={`operationAlert ${item.status === "BLOCKED" ? "danger" : "warning"}`}
                key={`${item.status}-${item.label}`}
              >
                <div>
                  <span>{statusLabels[item.status]}</span>
                  <strong>{item.label}</strong>
                </div>
                <p>{item.action || item.description}</p>
                {item.href ? (
                  <Link className="secondaryButton smallButton" href={item.href}>
                    Resolver
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="card spacedSection">
          <div className="successBox">Checklist de lancamento sem pendencias ou alertas para este evento.</div>
        </section>
      )}

      <section className="grid twoColumns spacedSection">
        <ChecklistCard title="Pagina, SEO e tracking" items={checklist.content} />
        <ChecklistCard title="Venda e estoque" items={checklist.sales} />
      </section>

      <section className="grid twoColumns spacedSection">
        <ChecklistCard title="Pagamento, webhook e split" items={checklist.payments} />
        <ChecklistCard title="Operacao e entrada" items={checklist.operation} />
      </section>

      {checklist.recentPaidOrders.length > 0 ? (
        <section className="card spacedSection">
          <div className="sectionHeader inlineHeader">
            <h2>Compras pagas recentes deste evento</h2>
          </div>
          <div className="tableScroll">
            <table className="table operationalTable">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Status</th>
                  <th>Pagamento</th>
                  <th>Ingressos</th>
                  <th>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {checklist.recentPaidOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/admin/orders/${order.code}`}>
                        <strong>{order.code}</strong>
                      </Link>
                    </td>
                    <td>{order.status}</td>
                    <td>{order.payment?.status || "-"}</td>
                    <td>{order.tickets.length}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
