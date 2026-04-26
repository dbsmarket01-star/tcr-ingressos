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
  const currentOrganizationContext = await getCurrentOrganizationContext();
  const navGroups = admin ? getAdminNavGroupsForRole(admin.role, { isPlatformHost: currentOrganizationContext.isPlatformHost }) : [];
  const adminOrganization =
    admin?.organizationId ? await getOrganizationBrandingById(admin.organizationId) : currentOrganizationContext.organization;
  const isPlatformHost = currentOrganizationContext.isPlatformHost;
  const brandName = isPlatformHost
    ? currentOrganizationContext.platformName
    : adminOrganization?.name || currentOrganizationContext.brandName;
  const brandMark = brandName.trim().charAt(0).toUpperCase() || "I";
  const publicSiteHref = isPlatformHost ? currentOrganizationContext.platformAppUrl || "/" : currentOrganizationContext.publicBaseUrl || "/";
  const sidebarEyebrow = isPlatformHost ? "Central da plataforma" : "Central de operação";
  const sidebarText = isPlatformHost
    ? "Operações, domínios, equipes e evolução do motor de bilheteria em um painel-mãe."
    : "Eventos, pedidos, leads, check-in e financeiro em uma operação mais organizada para a equipe.";
  const pulseTitle = isPlatformHost ? "Plataforma em evolução" : "Operação em andamento";
  const pulseText = isPlatformHost
    ? "A base da Ingresaas sustenta o motor, enquanto cada bilheteria filha mantém sua própria marca e domínio."
    : `A ${brandName} opera como bilheteria filha da Ingresaas, com domínio, equipe e rotina próprios.`;
  const headerActionHref = isPlatformHost ? "/admin/operations" : `${currentOrganizationContext.platformAppUrl}/admin/operations`;
  const headerActionLabel = isPlatformHost ? "Gerir operações" : "Voltar à Ingresaas";

  return (
    <main className="adminShell">
      <aside className="sidebar">
        <Link className="brand sidebarBrand" href="/admin">
          {currentOrganizationContext.brandLogoUrl ? (
            <img
              alt={brandName}
              className="brandLogo"
              src={currentOrganizationContext.brandLogoUrl}
            />
          ) : (
            <span className="brandMark">{brandMark}</span>
          )}
          <span>{brandName}</span>
        </Link>
        <div className="sidebarIntro">
          <span className="eyebrow">{sidebarEyebrow}</span>
          <p>{sidebarText}</p>
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
              <strong>{pulseTitle}</strong>
              <span>{pulseText}</span>
            </div>
            <Link className="secondaryButton" href={headerActionHref}>
              {headerActionLabel}
            </Link>
            {!isPlatformHost ? (
              <Link className="secondaryButton" href={publicSiteHref}>
                Ver site
              </Link>
            ) : null}
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
