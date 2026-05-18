import type { CSSProperties } from "react";
import { normalizeEventMapLayout, type EventMapLayout } from "@/features/events/event-map";

type EventMapViewProps = {
  layout: unknown;
  notes?: string | null;
};

const kindLabels: Record<string, string> = {
  STAGE: "Palco",
  SECTOR: "Setor",
  BOX: "Camarote",
  AISLE: "Corredor",
  ACCESSIBLE: "Acessível/PCD",
  EMPTY: "Espaço livre",
  TEXT: "Legenda"
};

function buildBlockStyle(block: EventMapLayout["blocks"][number], layout: EventMapLayout) {
  const textLength = Math.max(block.label.length, 6);
  const isCompactBox = block.kind === "BOX" && /^\d{1,3}$/.test(block.label);
  const readableSize = isCompactBox
    ? Math.min(20, Math.max(10, Math.min(block.height * 0.48, (block.width / textLength) * 1.85)))
    : Math.min(30, Math.max(9, Math.min(block.height * 0.27, (block.width / textLength) * 1.5)));

  return {
    "--map-block-color": block.color,
    "--map-block-font-size": `${readableSize}px`,
    height: `${(block.height / layout.height) * 100}%`,
    left: `${(block.x / layout.width) * 100}%`,
    top: `${(block.y / layout.height) * 100}%`,
    transform: `rotate(${block.rotation ?? 0}deg)`,
    width: `${(block.width / layout.width) * 100}%`
  } as CSSProperties;
}

export function EventMapView({ layout: rawLayout, notes }: EventMapViewProps) {
  const layout = normalizeEventMapLayout(rawLayout);

  if (!layout) {
    return null;
  }

  const legend = layout.blocks.reduce<Array<{ label: string; color: string; kind: string }>>((items, block) => {
    if (block.kind === "EMPTY" || block.kind === "TEXT") {
      return items;
    }

    const key = `${block.label}-${block.color}`;
    if (items.some((item) => `${item.label}-${item.color}` === key)) {
      return items;
    }

    return [...items, { label: block.label, color: block.color, kind: kindLabels[block.kind] ?? "Setor" }];
  }, []);

  return (
    <section className="contentBlock eventMapBlock eventModularMapBlock">
      <div className="eventModularMapHeader">
        <div>
          <span className="eyebrow">Setores e acessos</span>
          <h2>Mapa do evento</h2>
        </div>
        <span className="eventModularMapNotice">Imagem meramente ilustrativa do local.</span>
      </div>

      <div className="eventModularMapFrame">
        <div
          className="eventModularMapCanvas"
          style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
        >
          <div className="eventModularMapFloor" />
          {layout.blocks.map((block) => (
            <div
              className={`eventModularMapBlockItem is-${block.kind.toLowerCase()}`}
              key={block.id}
              style={buildBlockStyle(block, layout)}
              title={block.description || block.label}
            >
              <span>{block.label}</span>
              {block.seats ? <small>{block.seats.toLocaleString("pt-BR")} lugares estimados</small> : null}
            </div>
          ))}
        </div>
      </div>

      {legend.length > 0 ? (
        <div className="eventModularMapLegend" aria-label="Legenda do mapa">
          {legend.map((item) => (
            <span key={`${item.label}-${item.color}`}>
              <i style={{ background: item.color }} />
              <strong>{item.label}</strong>
              <small>{item.kind}</small>
            </span>
          ))}
        </div>
      ) : null}

      {notes ? <p className="mapNotes">{notes}</p> : null}
    </section>
  );
}
