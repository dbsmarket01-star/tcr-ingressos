"use client";

import { useEffect, useMemo, useState } from "react";
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

type SeatMapTicketSelectorProps = {
  layout: unknown;
  maxSelection?: number;
};

function isSelectableSeat(seat: SeatMapSeat) {
  return seat.status === "AVAILABLE" || seat.status === "ACCESSIBLE";
}

function sectionViewBox(section: SeatMapSection, layout: SeatMapLayout) {
  const padding = 80;
  const x = Math.max(0, section.x - padding);
  const y = Math.max(0, section.y - padding);
  const width = Math.min(layout.width - x, section.width + padding * 2);
  const height = Math.min(layout.height - y, section.height + padding * 2);
  return { x, y, width, height };
}

function getSeatClass(seat: SeatMapSeat, selected: boolean) {
  if (selected) return "is-selected";
  return `is-${seat.status.toLowerCase()}`;
}

function getSeatSummary(seat: SeatMapSeat, section?: SeatMapSection) {
  return [
    section?.name,
    seat.tableId ? `Mesa ${seat.tableId.replace(/^.*?(\d+)$/, "$1")}` : null,
    seat.row ? `Fila ${seat.row}` : null,
    `Lugar ${seat.number}`
  ].filter(Boolean).join(" - ");
}

export function SeatMapTicketSelector({ layout: rawLayout, maxSelection = 8 }: SeatMapTicketSelectorProps) {
  const layout = useMemo(() => normalizeSeatMapLayout(rawLayout), [rawLayout]);
  const [activeSectionId, setActiveSectionId] = useState("");
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  useEffect(() => {
    window.dispatchEvent(new Event("seatmap-selection-change"));
  }, [selectedSeatIds]);

  if (!layout) {
    return null;
  }

  const allSeats = getLayoutSeats(layout);
  const totalTables = layout.sections.reduce((sum, section) => sum + (section.tables?.length ?? 0), 0);
  const availableSeats = allSeats.filter(isSelectableSeat).length;
  const hasTables = totalTables > 0;
  const activeSection = layout.sections.find((section) => section.id === activeSectionId) ?? null;
  const baseViewBox = activeSection ? sectionViewBox(activeSection, layout) : { x: 0, y: 0, width: layout.width, height: layout.height };
  const zoomedWidth = baseViewBox.width / zoom;
  const zoomedHeight = baseViewBox.height / zoom;
  const maxX = Math.max(0, layout.width - zoomedWidth);
  const maxY = Math.max(0, layout.height - zoomedHeight);
  const centeredX = baseViewBox.x + (baseViewBox.width - zoomedWidth) / 2;
  const centeredY = baseViewBox.y + (baseViewBox.height - zoomedHeight) / 2;
  const viewBoxX = Math.min(maxX, Math.max(0, centeredX + (panX / 100) * Math.max(0, baseViewBox.width - zoomedWidth)));
  const viewBoxY = Math.min(maxY, Math.max(0, centeredY + (panY / 100) * Math.max(0, baseViewBox.height - zoomedHeight)));
  const viewBox = `${viewBoxX} ${viewBoxY} ${zoomedWidth} ${zoomedHeight}`;
  const sectionsById = new Map(layout.sections.map((section) => [section.id, section]));
  const selectedSeats = selectedSeatIds
    .map((seatId) => allSeats.find((seat) => seat.id === seatId))
    .filter((seat): seat is SeatMapSeat => Boolean(seat));
  const selectedSeatsByLotId = selectedSeats.reduce<Record<string, SeatMapSeat[]>>((acc, seat) => {
    const section = sectionsById.get(seat.sectionId);
    const lotId = seat.ticketLotId || section?.ticketLotId;

    if (!lotId) {
      return acc;
    }

    acc[lotId] = [...(acc[lotId] ?? []), seat];
    return acc;
  }, {});

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

  function resetMapView() {
    setActiveSectionId("");
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }

  return (
    <div className="seatMapTicketSelector">
      {Object.entries(selectedSeatsByLotId).map(([lotId, seats]) => (
        <div key={lotId}>
          <input type="hidden" name="lotId" value={lotId} />
          <input type="hidden" name={`quantity_${lotId}`} value={seats.length} />
          {seats.map((seat) => (
            <input key={seat.id} type="hidden" name={`seatId_${lotId}`} value={seat.id} />
          ))}
        </div>
      ))}

      <div className="interactiveSeatMap seatMapTicketSelectorMap">
        <div className="seatMapTicketSelectorHero">
          <div>
            <span className="seatMapTicketSelectorEyebrow">
              <i aria-hidden="true" />
              Mapa numerado
            </span>
            <h2>Escolha seus lugares</h2>
            <p>{hasTables ? "Selecione a mesa e as cadeiras que deseja para o seu evento." : "Selecione o setor e as cadeiras que deseja para o seu evento."}</p>
          </div>
          <div className="interactiveSeatMapTotals">
            <strong>{selectedSeats.length}</strong>
            <span>selecionado(s)</span>
          </div>
        </div>

        <div className="seatMapTicketSelectorContent">
          <div className="seatMapTicketSelectorIntro">
            <h2>{hasTables ? "Escolha sua mesa e cadeira" : "Escolha seus lugares"}</h2>
            <p className="interactiveSeatMapLead">
              {hasTables
                ? `${totalTables} mesas numeradas e ${availableSeats.toLocaleString("pt-BR")} lugares disponíveis.`
                : `${availableSeats.toLocaleString("pt-BR")} lugares disponíveis para seleção.`}
            </p>
          </div>

          <div className="interactiveSeatMapShell">
            <aside className="seatMapSectors" aria-label="Setores disponíveis">
            <strong className="seatMapPanelTitle">Setores e preços</strong>
            {layout.sections.map((section) => {
              const seats = getSectionSeats(section);
              const available = seats.filter(isSelectableSeat).length;
              const tables = section.tables?.length ?? 0;

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
                      {formatCurrency(section.priceInCents)} - {tables > 0 ? `${tables} mesas / ` : null}{available} livres
                    </small>
                    <em>{available.toLocaleString("pt-BR")} lugares disponíveis</em>
                  </span>
                </button>
              );
            })}
          </aside>

          <div className="seatMapViewport">
            <div className="seatMapCanvasToolbar">
              <button onClick={resetMapView} type="button">Ver mapa completo</button>
              <span>{activeSection ? `Zoom em ${activeSection.name}` : "Toque em um setor para aproximar"}</span>
            </div>
            <div className="seatMapZoomControls" aria-label="Controles de aproximação do mapa">
              <label>
                <span>Zoom</span>
                <input
                  aria-label="Zoom do mapa"
                  max="4"
                  min="1"
                  onChange={(event) => setZoom(Number(event.target.value))}
                  onInput={(event) => setZoom(Number(event.currentTarget.value))}
                  step="0.1"
                  type="range"
                  value={zoom}
                />
              </label>
              <label>
                <span>Lateral</span>
                <input
                  aria-label="Mover mapa para os lados"
                  max="100"
                  min="-100"
                  onChange={(event) => setPanX(Number(event.target.value))}
                  onInput={(event) => setPanX(Number(event.currentTarget.value))}
                  step="1"
                  type="range"
                  value={panX}
                />
              </label>
              <label>
                <span>Altura</span>
                <input
                  aria-label="Mover mapa para cima ou baixo"
                  max="100"
                  min="-100"
                  onChange={(event) => setPanY(Number(event.target.value))}
                  onInput={(event) => setPanY(Number(event.currentTarget.value))}
                  step="1"
                  type="range"
                  value={panY}
                />
              </label>
            </div>
            <svg className="seatMapSvg" role="img" viewBox={viewBox}>
              <rect className="seatMapFloor" height={layout.height} rx="26" width={layout.width} x="0" y="0" />
              {layout.elements.map((element) => (
                <g key={element.id}>
                  <rect className={`seatMapElement is-${element.kind.toLowerCase()}`} height={element.height} rx="12" width={element.width} x={element.x} y={element.y} />
                  <text className="seatMapElementLabel" x={element.x + element.width / 2} y={element.y + element.height / 2}>{element.label}</text>
                </g>
              ))}
              {layout.sections.map((section) => (
                <g key={section.id}>
                  <rect
                    className={`seatMapSection ${activeSection?.id === section.id ? "is-active" : ""}`}
                    height={section.height}
                    onClick={() => setActiveSectionId(section.id)}
                    rx="18"
                    style={{ "--seat-section-color": section.color } as CSSProperties}
                    width={section.width}
                    x={section.x}
                    y={section.y}
                  />
                  <rect
                    className="seatMapSectionLabelPill"
                    height={34}
                    rx={10}
                    width={Math.min(220, Math.max(118, section.name.length * 12))}
                    x={section.x + section.width / 2 - Math.min(220, Math.max(118, section.name.length * 12)) / 2}
                    y={section.y - 17}
                  />
                  <text className="seatMapSectionLabel" x={section.x + section.width / 2} y={section.y}>{section.name}</text>
                </g>
              ))}
              {layout.sections.flatMap((section) =>
                (section.tables ?? []).map((table) => (
                  <g key={table.id}>
                    {table.shape === "ROUND" ? (
                      <ellipse className="seatMapTable" cx={table.x + table.width / 2} cy={table.y + table.height / 2} rx={table.width / 2} ry={table.height / 2} />
                    ) : (
                      <rect className="seatMapTable" height={table.height} rx={table.shape === "SQUARE" ? 12 : 18} width={table.width} x={table.x} y={table.y} />
                    )}
                    <text className="seatMapTableLabel" x={table.x + table.width / 2} y={table.y + table.height / 2}>{table.label}</text>
                  </g>
                ))
              )}
              {allSeats.map((seat) => {
                const selected = selectedSeatIds.includes(seat.id);
                const section = sectionsById.get(seat.sectionId);

                return (
                  <circle
                    className={`seatMapSeat ${getSeatClass(seat, selected)}`}
                    cx={seat.x}
                    cy={seat.y}
                    key={seat.id}
                    onClick={() => toggleSeat(seat)}
                    r={seat.radius ?? 9}
                  >
                    <title>{getSeatSummary(seat, section)}</title>
                  </circle>
                );
              })}
            </svg>
            <div className="seatMapLegend seatMapLegendInline" aria-label="Legenda do mapa">
              <span><i />Disponível</span>
              <span><i className="is-selected" />Selecionado</span>
              <span><i className="is-unavailable" />Indisponível</span>
            </div>
          </div>

          <aside className="seatMapSelectionPanel">
            <strong>Sua seleção</strong>
            {selectedSeats.length === 0 ? (
              <p>Toque em um setor, aproxime o mapa e selecione as cadeiras disponíveis.</p>
            ) : (
              <>
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
                <div className="seatMapSelectionTotal">
                  <span>Total selecionado</span>
                  <strong>
                    {formatCurrency(selectedSeats.reduce((sum, seat) => {
                      const section = sectionsById.get(seat.sectionId);
                      return sum + (seat.priceInCents ?? section?.priceInCents ?? 0);
                    }, 0))}
                  </strong>
                </div>
              </>
            )}
          </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
