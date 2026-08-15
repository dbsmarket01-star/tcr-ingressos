import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { getMarketingEmailCampaigns } from "@/features/marketing-email/marketing-email.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MarketingEmailHubPage() {
  const admin = await requirePermission("MARKETING");
  const organizationContext = await getCurrentOrganizationContext();
  const [externalCampaigns, eventCampaignTotals] = await Promise.all([
    getMarketingEmailCampaigns(admin.organizationId),
    prisma.leadEmailCampaign.count({
      where: {
        event: {
          organizationId: admin.organizationId
        }
      }
    })
  ]);

  return (
    <AdminShell
      title="Disparos de e-mail"
      description="Escolha entre criar uma campanha independente ou usar as listas de leads dos eventos."
    >
      <section className="operationCommandStrip spacedSection" aria-label="Fluxos de disparo de e-mail">
        <article className="operationCommandCard">
          <span className="eyebrow">Marketing</span>
          <h2>Escolha o tipo de campanha da {organizationContext.brandName}.</h2>
          <p>
            Campanhas externas ficam separadas dos leads captados nas páginas de evento. Campanhas por evento continuam usando as listas já existentes.
          </p>
        </article>
      </section>

      <section className="adminTwoColumnGrid spacedSection">
        <article className="card adminPanelBlock">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Campanha nova do zero</h2>
              <p className="muted">Importe uma lista externa e dispare sem vincular a um evento publicado.</p>
            </div>
          </div>
          <div className="campaignSummaryGrid">
            <article className="campaignSummaryCard">
              <span>Campanhas externas</span>
              <strong>{externalCampaigns.length}</strong>
            </article>
          </div>
          <Link className="button smallButton" href="/admin/marketing/email/campaigns">
            Criar ou gerenciar campanha nova
          </Link>
        </article>

        <article className="card adminPanelBlock">
          <div className="sectionHeader inlineHeader">
            <div>
              <h2>Campanhas para eventos</h2>
              <p className="muted">Use os leads captados nas páginas dos eventos e preserve o fluxo antigo.</p>
            </div>
          </div>
          <div className="campaignSummaryGrid">
            <article className="campaignSummaryCard">
              <span>Campanhas por evento</span>
              <strong>{eventCampaignTotals}</strong>
            </article>
          </div>
          <Link className="secondaryButton smallButton" href="/admin/marketing/email/events">
            Ver eventos com disparo
          </Link>
        </article>
      </section>
    </AdminShell>
  );
}
