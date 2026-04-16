import Link from "next/link";
import { AdminSideNav } from "@/components/admin/AdminSideNav";
import { logoutAction } from "@/features/auth/auth.actions";
import { getCurrentAdmin } from "@/features/auth/auth.service";
import { getAdminNavGroupsForRole } from "@/lib/navigation";

type AdminShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export async function AdminShell({ title, description, children }: AdminShellProps) {
  const admin = await getCurrentAdmin();
  const navGroups = admin ? getAdminNavGroupsForRole(admin.role) : [];

  return (
    <main className="adminShell">
      <aside className="sidebar">
        <Link className="brand sidebarBrand" href="/">
          <span className="brandMark">T</span>
          <span>TCR Ingressos</span>
        </Link>
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
            <Link className="secondaryButton" href="/">
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
