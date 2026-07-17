import Link from "next/link";

type EventSectionKey =
  | "overview"
  | "home-list"
  | "lots"
  | "seat-map"
  | "map"
  | "leads"
  | "finance"
  | "coupons"
  | "sales-potential"
  | "check-in"
  | "financial-controls"
  | "statistics-report"
  | "geography-report"
  | "tracking-links"
  | "heatmap"
  | "ai-chat"
  | "settings";

type EventSectionNavProps = {
  active: EventSectionKey;
  event: {
    id: string;
    leadCaptureEnabled?: boolean | null;
  };
};

const eventSections: Array<{
  key: EventSectionKey;
  label: string;
  description: string;
  icon: string;
  href: (event: EventSectionNavProps["event"]) => string;
}> = [
  { key: "overview", label: "Visão geral", description: "Resumo do evento", icon: "grid", href: (event) => `/admin/events/${event.id}` },
  { key: "lots", label: "Ingressos e lotes", description: "Preços e estoque", icon: "ticket", href: (event) => `/admin/events/${event.id}/lots` },
  { key: "coupons", label: "Cupons", description: "Descontos e códigos", icon: "tag", href: (event) => `/admin/events/${event.id}#cupons` },
  { key: "finance", label: "Financeiro", description: "Pedidos e receita", icon: "coin", href: (event) => `/admin/finance?eventId=${event.id}` },
  { key: "check-in", label: "Check-in", description: "Entrada do evento", icon: "check", href: () => "/admin/check-in" },
  {
    key: "leads",
    label: "Captação",
    description: "Leads e pré-lista",
    icon: "megaphone",
    href: (event) => (event.leadCaptureEnabled ? `/admin/events/${event.id}/leads` : `/admin/events/${event.id}/edit`)
  },
  { key: "tracking-links", label: "Links rastreáveis", description: "Parceiros e UTMs", icon: "link", href: (event) => `/admin/events/${event.id}` },
  { key: "sales-potential", label: "Potencial de vendas", description: "Projeção e estoque", icon: "trend", href: (event) => `/admin/finance?eventId=${event.id}` },
  { key: "statistics-report", label: "Relatório de estatísticas", description: "Controle por ingresso", icon: "bar", href: (event) => `/admin/reports/lots?eventId=${event.id}` },
  { key: "financial-controls", label: "Controle financeiro", description: "Custos do evento", icon: "wallet", href: (event) => `/admin/finance?eventId=${event.id}` },
  { key: "geography-report", label: "Mapa de vendas", description: "Cidades e regiões", icon: "map-pin", href: (event) => `/admin/events/${event.id}` },
  { key: "heatmap", label: "Mapa de calor", description: "Cliques e navegação", icon: "flame", href: (event) => `/admin/events/${event.id}` },
  { key: "seat-map", label: "Mapa numerado", description: "Mesas e cadeiras", icon: "seats", href: (event) => `/admin/events/${event.id}/seat-map` },
  { key: "map", label: "Mapa convencional", description: "Mapa visual simples", icon: "map", href: (event) => `/admin/events/${event.id}/map` },
  { key: "home-list", label: "Home List", description: "Lista operacional", icon: "list", href: (event) => `/admin/home-list?eventId=${event.id}` },
  { key: "ai-chat", label: "Chat IA", description: "Atendimento automático", icon: "spark", href: (event) => `/admin/events/${event.id}` },
  { key: "settings", label: "Configurações", description: "Dados e publicação", icon: "gear", href: (event) => `/admin/events/${event.id}/edit` }
];

function EventNavIcon({ type }: { type: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24"
  };

  return (
    <svg aria-hidden="true" {...common}>
      {type === "ticket" ? <path d="M4 9a3 3 0 0 0 0 6v3h16v-3a3 3 0 0 0 0-6V6H4v3Z" /> : null}
      {type === "tag" ? <><path d="M4 11V5h6l10 10-6 6L4 11Z" /><path d="M8 8h.01" /></> : null}
      {type === "coin" ? <><path d="M12 3c5 0 8 2 8 4s-3 4-8 4-8-2-8-4 3-4 8-4Z" /><path d="M4 7v6c0 2 3 4 8 4s8-2 8-4V7" /><path d="M4 13v4c0 2 3 4 8 4s8-2 8-4v-4" /></> : null}
      {type === "check" ? <><path d="M9 12l2 2 4-5" /><path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /></> : null}
      {type === "megaphone" ? <><path d="M4 13h3l10 5V6L7 11H4v2Z" /><path d="M7 13l2 6" /></> : null}
      {type === "link" ? <><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></> : null}
      {type === "trend" ? <><path d="M4 17l6-6 4 4 6-8" /><path d="M15 7h5v5" /></> : null}
      {type === "bar" ? <><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></> : null}
      {type === "wallet" ? <><path d="M4 7h16v13H4z" /><path d="M16 11h4v5h-4a2.5 2.5 0 0 1 0-5Z" /><path d="M4 7l3-4h10l3 4" /></> : null}
      {type === "map-pin" ? <><path d="M12 21s7-5 7-11a7 7 0 1 0-14 0c0 6 7 11 7 11Z" /><path d="M12 10h.01" /></> : null}
      {type === "flame" ? <path d="M12 22c4 0 7-3 7-7 0-3-2-5-4-7 0 2-1 3-3 4 1-4-1-7-4-10 0 4-3 7-3 11 0 5 3 9 7 9Z" /> : null}
      {type === "seats" ? <><path d="M7 12V6a3 3 0 0 1 6 0v6" /><path d="M5 12h14v4H5z" /><path d="M7 16v4" /><path d="M17 16v4" /></> : null}
      {type === "map" ? <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" /><path d="M9 4v14" /><path d="M15 6v14" /></> : null}
      {type === "list" ? <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></> : null}
      {type === "spark" ? <><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" /><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></> : null}
      {type === "gear" ? <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a8 8 0 0 0 .1-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 5.5h-4L10.6 8a8 8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 2.5h4l.4-2.5a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2.2-1.5Z" /></> : null}
      {type === "grid" || !type ? <><path d="M4 4h7v7H4z" /><path d="M13 4h7v7h-7z" /><path d="M4 13h7v7H4z" /><path d="M13 13h7v7h-7z" /></> : null}
    </svg>
  );
}

export function EventSectionNav({ active, event }: EventSectionNavProps) {
  const activeSection = eventSections.find((section) => section.key === active) ?? eventSections[0];

  if (active !== "overview") {
    return (
      <nav className="eventSectionNav eventSectionNavCompact" aria-label="Seção atual do evento">
        <Link className="eventSectionBackButton" href={`/admin/events/${event.id}`}>
          Voltar ao menu do evento
        </Link>
        <span className="eventSectionActiveCard">
          <span className="eventSectionIcon"><EventNavIcon type={activeSection.icon} /></span>
          <span>
            <strong>{activeSection.label}</strong>
            <small>{activeSection.description}</small>
          </span>
        </span>
      </nav>
    );
  }

  return (
    <nav className="eventSectionNav eventSectionNavGrid" aria-label="Seções do evento">
      {eventSections.map((section) => {
        const isActive = section.key === active;
        const content = (
          <>
            <span className="eventSectionIcon"><EventNavIcon type={section.icon} /></span>
            <span>
              <strong>{section.label}</strong>
              <small>{section.description}</small>
            </span>
          </>
        );

        return isActive ? (
          <span className="eventSectionCard isActive" key={section.key}>
            {content}
          </span>
        ) : (
          <Link className="eventSectionCard" href={section.href(event)} key={section.key}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
