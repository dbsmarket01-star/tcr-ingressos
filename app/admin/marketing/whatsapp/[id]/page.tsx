import { AdminShell } from "@/components/admin/AdminShell";
import {
  requirePermission,
  getAdminAllowedEventIds,
} from "@/features/auth/auth.service";
import { CampaignModule } from "../CampaignModule";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requirePermission("MARKETING");
  return (
    <AdminShell
      title="Nova campanha WhatsApp"
      description="Configure e acompanhe sua campanha"
      headerVariant="minimal"
      hideSidebarIntro
    >
      {getAdminAllowedEventIds(admin) === null ? (
        <CampaignModule campaignId={(await params).id} />
      ) : (
        <p>Acesso restrito à equipe com acesso a todos os eventos.</p>
      )}
    </AdminShell>
  );
}
