import type { AdminArea } from "@/features/auth/auth.service";
import { canAccessArea } from "@/features/auth/auth.service";
import type { AdminRole } from "@prisma/client";

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  area: AdminArea;
};

export type AdminNavGroup = {
  label: string;
  description: string;
  defaultOpen?: boolean;
  items: AdminNavItem[];
};

export const adminNavItems: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    description: "Faturamento, pedidos e visão geral",
    area: "DASHBOARD"
  },
  {
    href: "/admin/operations",
    label: "Operações",
    description: "Bilheterias filhas, domínios e status",
    area: "OPERATIONS"
  },
  {
    href: "/admin/events",
    label: "Eventos",
    description: "Cadastro, publicação e lotes",
    area: "EVENTS"
  },
  {
    href: "/admin/support",
    label: "Atendimento",
    description: "Suporte de pedidos e clientes",
    area: "SUPPORT"
  },
  {
    href: "/admin/check-in",
    label: "Check-in",
    description: "Validação e entrada do evento",
    area: "CHECKIN"
  },
  {
    href: "/admin/orders",
    label: "Pedidos",
    description: "Compras, pagamentos e reservas",
    area: "ORDERS"
  },
  {
    href: "/admin/tickets",
    label: "Ingressos",
    description: "Emissão, status e QR Code",
    area: "TICKETS"
  },
  {
    href: "/admin/finance",
    label: "Financeiro",
    description: "Receita, taxas, split e repasses",
    area: "FINANCE"
  },
  {
    href: "/admin/customers",
    label: "Clientes",
    description: "Compradores e histórico",
    area: "CUSTOMERS"
  },
  {
    href: "/admin/launch",
    label: "Lançamento",
    description: "Checklist de publicação",
    area: "PRODUCTION"
  },
  {
    href: "/admin/final-presale",
    label: "Pré-venda final",
    description: "Validação antes do tráfego",
    area: "PRODUCTION"
  },
  {
    href: "/admin/production",
    label: "Produção",
    description: "Deploy, webhook e saúde operacional",
    area: "PRODUCTION"
  },
  {
    href: "/admin/reports/lots",
    label: "Relatório de lotes",
    description: "Capacidade, viradas e desempenho",
    area: "REPORTS"
  },
  {
    href: "/admin/settings",
    label: "Configurações",
    description: "Dados da TCR e integrações",
    area: "SETTINGS"
  },
  {
    href: "/admin/users",
    label: "Usuários",
    description: "Equipe interna e permissões",
    area: "USERS"
  },
  {
    href: "/admin/account",
    label: "Minha conta",
    description: "Senha e dados de acesso",
    area: "ACCOUNT"
  },
  {
    href: "/admin/audit",
    label: "Auditoria",
    description: "Histórico de ações internas",
    area: "AUDIT"
  }
];

export function getAdminNavItemsForRole(role: AdminRole) {
  return adminNavItems.filter((item) => canAccessArea(role, item.area));
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Visão geral",
    description: "Painel central",
    defaultOpen: true,
    items: adminNavItems.filter((item) => item.href === "/admin")
  },
  {
    label: "Operação",
    description: "Evento e atendimento",
    defaultOpen: true,
    items: adminNavItems.filter((item) =>
      ["/admin/events", "/admin/support", "/admin/check-in"].includes(item.href)
    )
  },
  {
    label: "Vendas",
    description: "Pedidos, ingressos e receita",
    defaultOpen: true,
    items: adminNavItems.filter((item) =>
      ["/admin/orders", "/admin/tickets", "/admin/finance", "/admin/customers"].includes(item.href)
    )
  },
  {
    label: "Lançamento",
    description: "Preparação de abertura",
    items: adminNavItems.filter((item) =>
      ["/admin/launch", "/admin/final-presale", "/admin/production", "/admin/reports/lots"].includes(item.href)
    )
  },
  {
    label: "Sistema",
    description: "Configurações e acessos",
    items: adminNavItems.filter((item) =>
      ["/admin/operations", "/admin/settings", "/admin/users", "/admin/account", "/admin/audit"].includes(item.href)
    )
  }
];

export function getAdminNavGroupsForRole(role: AdminRole, options?: { isPlatformHost?: boolean }) {
  if (options?.isPlatformHost) {
    const platformGroups: AdminNavGroup[] = [
      {
        label: "Painel",
        description: "Resumo e clientes",
        defaultOpen: true,
        items: adminNavItems.filter((item) => ["/admin", "/admin/operations"].includes(item.href))
      },
      {
        label: "Acesso",
        description: "Equipe e segurança",
        items: adminNavItems.filter((item) =>
          ["/admin/users", "/admin/audit", "/admin/account"].includes(item.href)
        )
      }
    ];

    return platformGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccessArea(role, item.area))
      }))
      .filter((group) => group.items.length > 0);
  }

  return adminNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.href === "/admin/operations" && !options?.isPlatformHost) {
          return false;
        }

        return canAccessArea(role, item.area);
      })
    }))
    .filter((group) => group.items.length > 0);
}

export const phaseOneModules = [
  "Dashboard operacional",
  "Eventos e lotes",
  "Pedidos e pagamentos",
  "Ingressos com QR Code",
  "Check-in e validação",
  "Financeiro e split",
  "Atendimento",
  "Relatórios de lotes",
  "Checklist de lançamento",
  "Configurações da operação"
];
