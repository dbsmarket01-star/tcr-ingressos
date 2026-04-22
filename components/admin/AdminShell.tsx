import Link from "next/link";
import { AdminSideNav } from "@/components/admin/AdminSideNav";
import { logoutAction } from "@/features/auth/auth.actions";
import { getCurrentAdmin } from "@/features/auth/auth.service";
import { getCurrentOrganizationContext, getOrganizationBrandingById } from "@/features/organizations/organization.service";
import { getAdminNavGroupsForRole } from "@/lib/navigation";

type AdminShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export async function AdminShell({ title, description, children }: AdminShellProps) {
  const admin = await getCurrentAdmin();
  const navGroups = admin ? getAdminNavGroupsForRole(admin.role) : [];
  const currentOrganizationContext = await getCurrentOrganizationContext();
  const adminOrganization =
    admin?.organizationId ? await getOrganizationBrandingById(admin.organizationId) : currentOrganizationContext.organization;
  const brandName = adminOrganization?.name || currentOrganizationContext.brandName;
  const brandMark = brandName.trim().charAt(0).toUpperCase() || "I";
  const publicSiteHref = currentOrganizationContext.publicBaseUrl || "/";

  return (
    <main className="adminShell">
      <aside className="sidebar">
        <Link className="brand sidebarBrand" href="/admin">
          <span className="brandMark">{brandMark}</span>
          <span>{brandName}</span>
        </Link>
        <div className="sidebarIntro">
          <span className="eyebrow">Central de operação</span>
          <p>Eventos, pedidos, leads, check-in e financeiro em uma operação mais organizada para a equipe.</p>
        </div>
        <AdminSideNav groups={navGroups} />
      </aside>

      <section className="adminMain">
        <header className="adminHeader">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="adminHeaderActions">
            {admin ? (
              <div className="adminUserBadge">
                <strong>{admin.name}</strong>
                <span>{admin.role}</span>
              </div>
            ) : null}
            <div className="adminHeaderPulse">
              <strong>Operação em andamento</strong>
              <span>Vendas, atendimento e check-in centralizados para a rotina do produtor.</span>
            </div>
            <Link className="secondaryButton" href={publicSiteHref}>
              Ver site
            </Link>
            <form action={logoutAction}>
              <button className="secondaryButton" type="submit">
                Sair
              </button>
            </form>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
