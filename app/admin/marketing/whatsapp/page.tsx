import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  requirePermission,
  getAdminAllowedEventIds,
} from "@/features/auth/auth.service";
import { CampaignModule } from "./CampaignModule";
export const dynamic = "force-dynamic";
export default async function Page() {
  const admin = await requirePermission("MARKETING");
  return (
    <AdminShell
      title="Disparos WhatsApp"
      description="Campanhas pela API oficial da Meta"
      headerVariant="minimal"
      hideSidebarIntro
    >
      <section className="card spacedSection adminPanelBlock">
        <Link className="button" href="/admin/marketing/whatsapp/cart-recovery">Ver relatório de recuperação de carrinho</Link>
      </section>
      {getAdminAllowedEventIds(admin) === null ? (
        <CampaignModule />
      ) : (
        <p>Este módulo exige acesso a todos os eventos da organização.</p>
      )}
    </AdminShell>
  );
}
