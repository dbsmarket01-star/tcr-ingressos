"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  getLayoutSeats,
  getSectionSeats,
  normalizeSeatMapLayout,
  type SeatMapLayout,
  type SeatMapSeat,
  type SeatMapSection
} from "@/features/seat-maps/seat-map";
import { formatCurrency } from "@/lib/format";

type InteractiveSeatMapProps = {
  layout: unknown;
  maxSelection?: number;
};

const statusLabels: Record<SeatMapSeat["status"], string> = {
  AVAILABLE: "Disponível",
  SELECTED: "Selecionado",
  UNAVAILABLE: "Indisponível",
  SOLD: "Vendido",
  RESERVED: "Reservado",
  ACCESSIBLE: "PCD / acessível"
};

function sectionViewBox(section: SeatMapSection, layout: SeatMapLayout) {
  const padding = 80;
  const x = Math.max(0, section.x - padding);
  const y = Math.max(0, section.y - padding);
  const width = Math.min(layout.width - x, section.width + padding * 2);
  const height = Math.min(layout.height - y, section.height + padding * 2);

  return `${x} ${y} ${width} ${height}`;
}

function getSeatClass(status: SeatMapSeat["status"], selected: boolean) {
  if (selected) return "is-selected";
  return `is-${status.toLowerCase()}`;
}

function isSelectableSeat(seat: SeatMapSeat) {
  return seat.status === "AVAILABLE" || seat.status === "ACCESSIBLE";
}

function getSeatSummary(seat: SeatMapSeat, section?: SeatMapSection) {
  return [
    section?.name,
    seat.tableId ? `Mesa ${seat.tableId.replace(/^.*?(\d+)$/, "$1")}` : null,
    seat.row ? `Fila ${seat.row}` : null,
    `Lugar ${seat.number}`
  ].filter(Boolean).join(" - ");
}

export function InteractiveSeatMap({ layout: rawLayout, maxSelection = 8 }: InteractiveSeatMapProps) {
  const layout = useMemo(() => normalizeSeatMapLayout(rawLayout), [rawLayout]);
  const [activeSectionId, setActiveSectionId] = useState("");
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);

  if (!layout) {
    return null;
  }

  const activeSection = layout.sections.find((section) => section.id === activeSectionId) ?? null;
  const viewBox = activeSection ? sectionViewBox(activeSection, layout) : `0 0 ${layout.width} ${layout.height}`;
  const seats = getLayoutSeats(layout);
  const selectedSeats = selectedSeatIds
    .map((seatId) => seats.find((seat) => seat.id === seatId))
    .filter((seat): seat is SeatMapSeat => Boolean(seat));
  const sectionsById = new Map(layout.sections.map((section) => [section.id, section]));

  function toggleSeat(seat: SeatMapSeat) {
    if (!isSelectableSeat(seat)) {
      return;
    }

    setSelectedSeatIds((current) => {
      if (current.includes(seat.id)) {
        return current.filter((seatId) => seatId !== seat.id);
      }

      if (current.length >= maxSelection) {
        return current;
      }

      return [...current, seat.id];
    });
  }

  return (
    <section className="interactiveSeatMap" aria-label="Mapa interativo de assentos">
      <div className="interactiveSeatMapHeader">
        <div>
          <span className="eyebrow">Ingressos numerados</span>
          <h2>Escolha seu lugar no mapa</h2>
        </div>
        <div className="interactiveSeatMapTotals">
          <strong>{seats.filter(isSelectableSeat).length.toLocaleString("pt-BR")}</strong>
          <span>lugares disponíveis</span>
        </div>
      </div>

      <div className="interactiveSeatMapShell">
        <aside className="seatMapSectors" aria-label="Setores disponíveis">
          {layout.sections
            .slice()
            .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0))
            .map((section) => {
              const sectionSeats = getSectionSeats(section);
              const available = sectionSeats.filter(isSelectableSeat).length;

              return (
                <button
                  className={section.id === activeSection?.id ? "is-active" : ""}
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  type="button"
                >
                  <i style={{ background: section.color }} />
                  <span>
                    <strong>{section.name}</strong>
                    <small>
                      {formatCurrency(section.priceInCents)} - {available} disponíveis
                    </small>
                  </span>
                </button>
              );
            })}
          <button className={!activeSection ? "is-active" : ""} onClick={() => setActiveSectionId("")} type="button">
            <i />
            <span>
              <strong>Mapa completo</strong>
              <small>Centralizar todos os setores</small>
            </span>
          </button>
        </aside>

        <div className="seatMapViewport">
          <div className="seatMapCanvasToolbar" aria-label="Controles do mapa">
            <button onClick={() => setActiveSectionId("")} type="button">Centralizar</button>
            {activeSection ? <span>{activeSection.name}</span> : <span>Visão geral</span>}
          </div>
          <svg className="seatMapSvg" role="img" viewBox={viewBox}>
            <defs>
              <filter id="seat-map-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" floodColor="#000000" floodOpacity="0.32" stdDeviation="8" />
              </filter>
            </defs>
            <rect className="seatMapFloor" height={layout.height} rx="26" width={layout.width} x="0" y="0" />
            {layout.sections.map((section) => (
              <g key={section.id}>
                <rect
                  className={`seatMapSection ${activeSection?.id === section.id ? "is-active" : ""}`}
                  height={section.height}
                  rx="18"
                  style={{ "--seat-section-color": section.color } as CSSProperties}
                  width={section.width}
                  x={section.x}
                  y={section.y}
                />
                <text className="seatMapSectionLabel" x={section.x + section.width / 2} y={section.y + section.height / 2}>
                  {section.name}
                </text>
              </g>
            ))}
            {layout.elements.map((element) => (
              <g key={element.id} transform={`rotate(${element.rotation ?? 0} ${element.x + element.width / 2} ${element.y + element.height / 2})`}>
                <rect
                  className={`seatMapElement is-${element.kind.toLowerCase()}`}
                  height={element.height}
                  rx="12"
                  width={element.width}
                  x={element.x}
                  y={element.y}
                />
                <text className="seatMapElementLabel" x={element.x + element.width / 2} y={element.y + element.height / 2}>
                  {element.label}
                </text>
              </g>
            ))}
            {layout.sections.flatMap((section) =>
              (section.tables ?? []).map((table) => (
                <g key={table.id} filter="url(#seat-map-soft-shadow)">
                  {table.shape === "ROUND" ? (
                    <ellipse
                      className="seatMapTable"
                      cx={table.x + table.width / 2}
                      cy={table.y + table.height / 2}
                      rx={table.width / 2}
                      ry={table.height / 2}
                    />
                  ) : (
                    <rect
                      className="seatMapTable"
                      height={table.height}
                      rx={table.shape === "SQUARE" ? 12 : 18}
                      width={table.width}
                      x={table.x}
                      y={table.y}
                    />
                  )}
                  <text className="seatMapTableLabel" x={table.x + table.width / 2} y={table.y + table.height / 2}>
                    {table.label}
                  </text>
                </g>
              ))
            )}
            {seats.map((seat) => {
              const selected = selectedSeatIds.includes(seat.id);
              const section = sectionsById.get(seat.sectionId);

              return (
                <g key={seat.id}>
                  <circle
                    className={`seatMapSeat ${getSeatClass(seat.status, selected)}`}
                    cx={seat.x}
                    cy={seat.y}
                    onClick={() => toggleSeat(seat)}
                    r={seat.radius ?? 9}
                    role="button"
                    tabIndex={isSelectableSeat(seat) ? 0 : -1}
                  >
                    <title>
                      {getSeatSummary(seat, section)} - {selected ? "Selecionado" : statusLabels[seat.status]}
                    </title>
                  </circle>
                </g>
              );
            })}
          </svg>
        </div>

        <aside className="seatMapSelectionPanel" aria-label="Resumo dos lugares selecionados">
          <strong>Seleção</strong>
          {selectedSeats.length === 0 ? (
            <p>Escolha um setor e toque nos lugares disponíveis.</p>
          ) : (
            <div className="seatMapSelectionList">
              {selectedSeats.map((seat) => {
                const section = sectionsById.get(seat.sectionId);

                return (
                  <div key={seat.id}>
                    <span>{getSeatSummary(seat, section)}</span>
                    <strong>{formatCurrency(seat.priceInCents ?? section?.priceInCents ?? 0)}</strong>
                  </div>
                );
              })}
            </div>
          )}
          <div className="seatMapLegend">
            {Object.entries(statusLabels).map(([status, label]) => (
              <span key={status}>
                <i className={`is-${status.toLowerCase()}`} />
                {label}
              </span>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
