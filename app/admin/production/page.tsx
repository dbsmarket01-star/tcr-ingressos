import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getProductionReadiness } from "@/features/settings/production-readiness.service";

export const dynamic = "force-dynamic";

const statusLabels = {
  READY: "Pronto",
  WARNING: "Atenção",
  BLOCKED: "Pendente"
};

const statusClasses = {
  READY: "published",
  WARNING: "pending",
  BLOCKED: "draft"
};

function ChecklistSection({
  title,
  eyebrow,
  items
}: {
  title: string;
  eyebrow?: string;
  items: Awaited<ReturnType<typeof getProductionReadiness>>["deploy"];
}) {
  return (
    <section className="card">
      <div className="sectionHeader inlineHeader">
        <div>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
      </div>
      <div className="readinessList">
        {items.map((item) => (
          <article className="readinessItem" key={item.label}>
            <div>
              <span className={`status ${statusClasses[item.status]}`}>{statusLabels[item.status]}</span>
              <strong>{item.label}</strong>
              <p className="muted">{item.description}</p>
              {item.action ? <p className="formHint">{item.action}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function ProductionPage() {
  await requirePermission("PRODUCTION");
  const readiness = await getProductionReadiness();

  return (
    <AdminShell
      title="Pre-producao"
      description="Checklist para sair do localhost com mais seguranca e vender ingressos de verdade."
    >
      <section className="grid dashboardGrid">
        <article className="card metric">
          <span className="muted">Prontos</span>
          <strong>{readiness.summary.ready}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Atencao</span>
          <strong>{readiness.summary.warning}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Pendentes</span>
          <strong>{readiness.summary.blocked}</strong>
        </article>
        <article className="card metric">
          <span className="muted">Total</span>
          <strong>{readiness.summary.total}</strong>
        </article>
      </section>

      <section className="card spacedSection">
        <div className="sectionHeader inlineHeader">
          <div>
            <span className="eyebrow">Copiar quando publicar</span>
            <h2>Links de producao esperados</h2>
          </div>
        </div>
        <div className="settingsGrid">
          <div>
            <span>URL publica</span>
            <strong className="breakText">{readiness.links.appUrl}</strong>
          </div>
          <div>
            <span>Health check</span>
            <strong className="breakText">{readiness.links.health}</strong>
          </div>
          <div>
            <span>Webhook Asaas</span>
            <strong className="breakText">{readiness.links.asaasWebhook}</strong>
          </div>
          <div>
            <span>Cron de expiracao com query</span>
            <strong className="breakText">{readiness.links.cron}</strong>
          </div>
          <div>
            <span>Cron alternativo com Bearer</span>
            <strong className="breakText">{readiness.links.cronBearer}</strong>
          </div>
        </div>
        <p className="formHint">
          Troque os textos ASAAS_WEBHOOK_TOKEN e CRON_SECRET pelos valores cadastrados nas variaveis de ambiente.
          Nao envie esses tokens em conversas ou prints publicos.
        </p>
      </section>

      <section className="grid twoColumns spacedSection">
        <ChecklistSection title="Deploy e seguranca" eyebrow="Sair do localhost" items={readiness.deploy} />
        <ChecklistSection title="Infraestrutura critica" eyebrow="Antes do trafego" items={readiness.infrastructure} />
      </section>

      <section className="grid twoColumns spacedSection">
        <ChecklistSection title="Pagamentos" eyebrow="Asaas, webhooks e split" items={readiness.payments} />
        <ChecklistSection title="Operacao minima" eyebrow="Painel e portaria" items={readiness.operation} />
      </section>

      <ChecklistSection title="Pre-venda controlada" eyebrow="Teste com pessoas reais" items={readiness.goLive} />

      <section className="grid twoColumns spacedSection">
        <article className="card">
          <span className="eyebrow">Recomendacao atual</span>
          <h2>Infraestrutura recomendada</h2>
          <p className="muted">
            Para a primeira operacao real da TCR, use Vercel Pro para a aplicacao, Supabase Pro para banco/storage,
            dominio definitivo com HTTPS, Asaas em producao, Resend autenticado e rotina externa de expiracao a cada
            5 minutos. AWS fica como etapa futura quando houver necessidade de containers, Redis, filas e controle fino
            de infraestrutura.
          </p>
          <div className="formActions">
            <Link className="secondaryButton" href="/admin/events">
              Conferir eventos
            </Link>
            <Link className="button" href="/admin/settings">
              Configuracoes
            </Link>
          </div>
        </article>
        <article className="card">
          <span className="eyebrow">Rotina automatica</span>
          <h2>Expiracao de reservas</h2>
          <p className="muted">
            Agende uma chamada a cada 5 minutos para liberar estoque de pedidos pendentes vencidos. A rota aceita
            token por query, header x-cron-token ou Authorization Bearer.
          </p>
          <div className="codeBlock">{readiness.links.cron}</div>
        </article>
      </section>

      <section className="card spacedSection">
        <span className="eyebrow">Plano de escala</span>
        <h2>Quando pensar em AWS</h2>
        <p className="muted">
          Vercel Pro + Supabase Pro e uma base profissional para a pre-venda e para os primeiros eventos. A migracao para
          AWS, containers ou Postgres dedicado deve entrar quando o volume exigir cache Redis, filas de processamento,
          workers separados, observabilidade avancada e controle de custo em alto trafego.
        </p>
        <div className="settingsGrid">
          <div>
            <span>Agora</span>
            <strong>Vercel Pro + Supabase Pro</strong>
          </div>
          <div>
            <span>Proxima camada</span>
            <strong>Redis, filas e monitoramento</strong>
          </div>
          <div>
            <span>Escala pesada</span>
            <strong>AWS ou containers dedicados</strong>
          </div>
        </div>
      </section>

      <section className="card spacedSection">
        <h2>Roteiro manual antes de trafego pago</h2>
        <ol className="orderedChecklist">
          <li>Publicar em dominio real com HTTPS.</li>
          <li>Atualizar APP_URL e NEXT_PUBLIC_APP_URL no deploy.</li>
          <li>Atualizar o webhook do Asaas para o dominio definitivo.</li>
          <li>Agendar a expiracao automatica de pedidos pendentes.</li>
          <li>Comprar 1 ingresso via Pix real.</li>
          <li>Comprar 1 ingresso via cartao real.</li>
          <li>Confirmar webhook automatico do Asaas sem usar botao manual.</li>
          <li>Confirmar recebimento do e-mail com QR Code.</li>
          <li>Ler QR Code em celular real na tela de check-in.</li>
          <li>Tentar ler o mesmo ingresso novamente e confirmar bloqueio.</li>
          <li>Exportar pedidos e ingressos em CSV.</li>
          <li>Cancelar um pedido pendente teste e conferir estoque liberado.</li>
        </ol>
        <div className="formActions">
          <Link className="secondaryButton" href="/admin/settings">
            Ver configuracoes
          </Link>
          <Link className="button" href="/admin/orders">
            Ver pedidos
          </Link>
        </div>
      </section>
    </AdminShell>
  );
}
