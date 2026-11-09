import { AdminShell } from "@/components/admin/AdminShell";
import { requirePermission } from "@/features/auth/auth.service";
import { prisma } from "@/lib/prisma";
import { AssistantChat } from "./AssistantChat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const admin = await requirePermission("SUPPORT");
  const organization = await prisma.organization.findUnique({ where: { id: admin.organizationId }, select: { slug: true } });
  return (
    <AdminShell title="Assistente IA" description="Peça informações e alterações de eventos em linguagem natural.">
      {organization?.slug === "tcr-ingressos" ? (
        <AssistantChat name={admin.name} />
      ) : (
        <section className="card"><p>O Assistente IA está disponível apenas na operação TCR Ingressos.</p></section>
      )}
    </AdminShell>
  );
}
