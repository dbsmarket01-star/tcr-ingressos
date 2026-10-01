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
      {getAdminAllowedEventIds(admin) === null ? (
        <CampaignModule />
      ) : (
        <p>Este módulo exige acesso a todos os eventos da organização.</p>
      )}
    </AdminShell>
  );
}
