"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AdminNavGroup } from "@/lib/navigation";

type AdminSideNavProps = {
  groups: AdminNavGroup[];
  compact?: boolean;
};

function isActiveLink(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSideNav({ groups, compact = false }: AdminSideNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const prefetched = useRef(new Map<string, number>());
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const pendingHref = pending?.from === pathname ? pending.href : null;

  useEffect(() => {
    if (!pendingHref) return;
    // An interrupted navigation must not leave the menu looking busy forever.
    const timeout = window.setTimeout(() => setPending(null), 12_000);
    return () => window.clearTimeout(timeout);
  }, [pendingHref]);

  function prefetchOnIntent(href: string) {
    if (href === pathname || Date.now() - (prefetched.current.get(href) || 0) < 30_000) return;
    prefetched.current.set(href, Date.now());
    router.prefetch(href);
  }

  return (
    <nav className="sideNav" aria-label="Navegacao administrativa" aria-busy={Boolean(pendingHref)}>
      {groups.map((group) => {
        const hasActiveItem = group.items.some((item) => isActiveLink(pathname, item.href));

        return (
          <details className="sideNavGroup" key={group.label} open={hasActiveItem || (!compact && group.defaultOpen)}>
            <summary>
              <strong>{group.label}</strong>
              <span>{group.description}</span>
            </summary>
            <div className="sideNavGroupItems">
              {group.items.map((item) => {
                const active = isActiveLink(pathname, item.href);

                return (
                  <Link
                    href={item.href}
                    prefetch={item.href === "/admin" || item.href === "/admin/crm" || item.href === "/admin/crm/whatsapp" || item.href === "/admin/events"}
                    onPointerEnter={() => prefetchOnIntent(item.href)}
                    onFocus={() => prefetchOnIntent(item.href)}
                    onClick={(event) => {
                      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      event.currentTarget.closest("details.adminMobileMenu")?.removeAttribute("open");
                      if (item.href === pathname) {
                        event.preventDefault();
                        return;
                      }
                      setPending({ href: item.href, from: pathname });
                    }}
                    key={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`${active ? "active" : ""}${pendingHref === item.href ? " isPending" : ""}`}
                  >
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
