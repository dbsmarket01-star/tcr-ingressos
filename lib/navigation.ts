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
    description: "Vendas, faturamento e alertas",
    area: "DASHBOARD"
  },
  {
    href: "/admin/events",
    label: "Eventos",
    description: "Cadastro, edicao e publicacao",
    area: "EVENTS"
  },
  {
    href: "/admin/orders",
    label: "Pedidos",
    description: "Compras, status e pagamentos",
    area: "ORDERS"
  },
  {
    href: "/admin/support",
    label: "Atendimento",
    description: "Busca e reenvio de ingressos",
    area: "SUPPORT"
  },
  {
    href: "/admin/finance",
    label: "Financeiro",
    description: "Receita, taxas e repasses",
    area: "FINANCE"
  },
  {
    href: "/admin/reports/lots",
    label: "Relatorios",
    description: "Vendas por lote e evento",
    area: "REPORTS"
  },
  {
    href: "/admin/production",
    label: "Pre-producao",
    description: "Checklist para vender de verdade",
    area: "PRODUCTION"
  },
  {
    href: "/admin/launch",
    label: "Lancamento",
    description: "Checklist por evento",
    area: "PRODUCTION"
  },
  {
    href: "/admin/final-presale",
    label: "Pre-venda final",
    description: "Teste operacional final",
    area: "PRODUCTION"
  },
  {
    href: "/admin/check-in",
    label: "Check-in",
    description: "Validacao na entrada",
    area: "CHECKIN"
  },
  {
    href: "/admin/tickets",
    label: "Ingressos",
    description: "Emissao, QR Code e status",
    area: "TICKETS"
  },
  {
    href: "/admin/account",
    label: "Minha conta",
    description: "Senha e dados de acesso",
    area: "ACCOUNT"
  },
  {
    href: "/admin/users",
    label: "Usuarios",
    description: "Equipe interna e permissoes",
    area: "USERS"
  },
  {
    href: "/admin/audit",
    label: "Auditoria",
    description: "Logs de acoes internas",
    area: "AUDIT"
  },
  {
    href: "/admin/settings",
    label: "Configuracoes",
    description: "Dados da TCR Ingressos",
    area: "SETTINGS"
  }
];

export function getAdminNavItemsForRole(role: AdminRole) {
  return adminNavItems.filter((item) => canAccessArea(role, item.area));
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Visao geral",
    description: "Painel",
    defaultOpen: true,
    items: adminNavItems.filter((item) => item.area === "DASHBOARD")
  },
  {
    label: "Operacao",
    description: "Eventos e entrada",
    defaultOpen: true,
    items: adminNavItems.filter((item) => ["EVENTS", "CHECKIN", "SUPPORT"].includes(item.area))
  },
  {
    label: "Vendas",
    description: "Pedidos",
    defaultOpen: true,
    items: adminNavItems.filter((item) => ["ORDERS", "TICKETS"].includes(item.area))
  },
  {
    label: "Analise",
    description: "Financeiro",
    items: adminNavItems.filter((item) => ["FINANCE", "REPORTS", "PRODUCTION"].includes(item.area))
  },
  {
    label: "Sistema",
    description: "Acessos",
    items: adminNavItems.filter((item) => ["SETTINGS", "USERS", "AUDIT", "ACCOUNT"].includes(item.area))
  }
];

export function getAdminNavGroupsForRole(role: AdminRole) {
  return adminNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessArea(role, item.area))
    }))
    .filter((group) => group.items.length > 0);
}

export const phaseOneModules = [
  "Admins/usuarios internos",
  "Eventos",
  "Lotes de ingressos",
  "Clientes/participantes",
  "Pedidos e itens do pedido",
  "Pagamentos",
  "Ingressos com QR Code",
  "Check-ins",
  "Cupons",
  "Configuracoes da empresa"
];
