import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { updateManualPresaleCheckAction } from "@/features/launch/final-presale.actions";
import { getFinalPresaleChecklist } from "@/features/launch/final-presale-checklist.service";
import { formatDateTime } from "@/lib/format";
import { getPublicEventUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

type FinalPresalePageProps = {
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

function PresaleSection({
  title,
  items
}: {
  title: string;
  items: Awaited<ReturnType<typeof getFinalPresaleChecklist>>["sale"];
}) {
  return (
    <section className="card">
      <div className="sectionHeader inlineHeader">
        <h2>{title}</h2>
      </div>
      <div className="presaleCheckList">
        {items.map((item) => (
          <article className="presaleCheckItem" key={item.label}>
            <div>
              <span className={`status ${statusClasses[item.status]}`}>{statusLabels[item.status]}</span>
              <strong>{item.label}</strong>
              <p className="muted">{item.description}</p>
              {item.evidence ? <small>{item.evidence}</small> : null}
              {item.status !== "READY" && item.action ? <p className="formHint">{item.action}</p> : null}
            </div>
            {item.href ? (
              <Link className="secondaryButton smallButton" href={item.href}>
                Abrir
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function FinalPresalePage({ searchParams }: FinalPresalePageProps) {
  await requirePermission("PRODUCTION");
  const params = searchParams ? await searchParams : {};
  const checklist = await getFinalPresaleChecklist(params.eventId);
  const canStartControlledPresale = checklist.summary.blocked === 0 && checklist.summary.warning <= 2;

  return (
    <AdminShell
      title="Pre-venda final"
      description="Checklist operacional final antes de rodar anuncio e vender em dominio real."
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
            Revisar
          </button>
          {checklist.event ? (
            <>
              <Link className="secondaryButton" href={getPublicEventUrl(checklist.event.slug)}>
                Pagina publica
              </Link>
              <Link className="secondaryButton" href={`/admin/launch?eventId=${checklist.event.id}`}>
                Checklist lancamento
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
          <span className="muted">Decisao</span>
          <strong>{canStartControlledPresale ? "Pre-venda controlada" : "Ajustar antes"}</strong>
        </article>
      </section>

      {checklist.event ? (
        <section className="card spacedSection">
          <div className="sectionHeader inlineHeader">
            <h2>{checklist.event.title}</h2>
            <span className={`status ${canStartControlledPresale ? "published" : "pending"}`}>
              {canStartControlledPresale ? "Pronto para teste publico pequeno" : "Ainda revisar"}
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
              <span>Pagos</span>
              <strong>{checklist.event.paidOrders}</strong>
            </div>
            <div>
              <span>Pix / Cartao</span>
              <strong>
                {checklist.event.pixPayments} / {checklist.event.cardPayments}
              </strong>
            </div>
            <div>
              <span>Split</span>
              <strong>{checklist.event.splitPayments}</strong>
            </div>
            <div>
              <span>Ingressos</span>
              <strong>{checklist.event.emittedTickets}</strong>
            </div>
            <div>
              <span>Check-ins aprovados</span>
              <strong>{checklist.event.approvedCheckIns}</strong>
            </div>
            <div>
              <span>Bloqueios</span>
              <strong>{checklist.event.blockedCheckIns}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {checklist.nextActions.length > 0 ? (
        <section className="card spacedSection">
          <div className="sectionHeader inlineHeader">
            <h2>O que falta fazer</h2>
          </div>
          <div className="operationsAlertGrid">
            {checklist.nextActions.map((item) => (
              <article
                className={`operationAlert ${item.status === "BLOCKED" ? "danger" : "warning"}`}
                key={item.label}
              >
                <div>
                  <span>{statusLabels[item.status]}</span>
                  <strong>{item.label}</strong>
                </div>
                <p>{item.action || item.description}</p>
                {item.evidence ? <small>{item.evidence}</small> : null}
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
          <div className="successBox">Checklist final sem pendencias para este evento.</div>
        </section>
      )}

      {checklist.evidence.length > 0 ? (
        <section className="card spacedSection">
          <div className="sectionHeader inlineHeader">
            <h2>Evidencias rapidas</h2>
          </div>
          <div className="presaleEvidenceGrid">
            {checklist.evidence.map((item) => (
              <Link href={item.href} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid twoColumns spacedSection">
        <PresaleSection title="Venda e pagina publica" items={checklist.sale} />
        <PresaleSection title="Pagamento e repasse" items={checklist.payment} />
      </section>

      {checklist.event ? (
        <section className="card spacedSection" id="manual">
          <div className="sectionHeader inlineHeader">
            <div>
              <span className="eyebrow">Checklist manual por evento</span>
              <h2>Testes antes de anunciar</h2>
            </div>
            <span className="status pending">
              {checklist.manual.filter((item) => item.checked).length} / {checklist.manual.length}
            </span>
          </div>
          <div className="manualPresaleList">
            {checklist.manual.map((item) => (
              <form action={updateManualPresaleCheckAction} className="manualPresaleItem" key={item.key}>
                <input type="hidden" name="eventId" value={checklist.event?.id} />
                <input type="hidden" name="key" value={item.key} />
                <label className="manualCheckToggle">
                  <input type="checkbox" name="checked" defaultChecked={item.checked} />
                  <span>{item.checked ? "Feito" : "Pendente"}</span>
                </label>
                <div>
                  <strong>{item.label}</strong>
                  <p className="muted">{item.description}</p>
                  {item.checkedAt ? <small>Marcado em {formatDateTime(item.checkedAt)}</small> : null}
                  <label className="field">
                    <span>Observacao</span>
                    <input
                      name="note"
                      placeholder="Ex.: testado por Lucas no iPhone, pedido TCR..."
                      defaultValue={item.note || ""}
                    />
                  </label>
                </div>
                <button className="secondaryButton smallButton" type="submit">
                  Salvar
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid twoColumns spacedSection">
        <PresaleSection title="Ingresso e portaria" items={checklist.operation} />
        <PresaleSection title="Backoffice e suporte" items={checklist.backoffice} />
      </section>
    </AdminShell>
  );
}
