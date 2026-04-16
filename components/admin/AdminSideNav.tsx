"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminNavGroup } from "@/lib/navigation";

type AdminSideNavProps = {
  groups: AdminNavGroup[];
};

function isActiveLink(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSideNav({ groups }: AdminSideNavProps) {
  const pathname = usePathname();

  return (
    <nav className="sideNav" aria-label="Navegacao administrativa">
      {groups.map((group) => {
        const hasActiveItem = group.items.some((item) => isActiveLink(pathname, item.href));

        return (
          <details className="sideNavGroup" key={group.label} open={group.defaultOpen || hasActiveItem}>
            <summary>
              <strong>{group.label}</strong>
              <span>{group.description}</span>
            </summary>
            <div className="sideNavGroupItems">
              {group.items.map((item) => {
                const active = isActiveLink(pathname, item.href);

                return (
                  <Link href={item.href} key={item.href} aria-current={active ? "page" : undefined} className={active ? "active" : undefined}>
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </Link>
                );
              })}
            </div>
          </details>
        );
      })}
    </nav>
  );
}
