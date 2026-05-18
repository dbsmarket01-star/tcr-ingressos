"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { normalizeEventMapLayout, type EventMapBlock, type EventMapBlockKind, type EventMapLayout } from "@/features/events/event-map";

type EventMapEditorProps = {
  initialValue?: string | null;
  mapSources?: Array<{
    id: string;
    title: string;
    layoutValue: string;
  }>;
};

type DragState = {
  id: string;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  startBlock: EventMapBlock;
};

const layoutSize = {
  width: 1200,
  height: 800
};

const blockPresets: Array<{
  kind: EventMapBlockKind;
  label: string;
  color: string;
  width: number;
  height: number;
}> = [
  { kind: "STAGE", label: "Palco", color: "#20242a", width: 540, height: 120 },
  { kind: "SECTOR", label: "Setor Ouro", color: "#d4a017", width: 520, height: 160 },
  { kind: "SECTOR", label: "Setor Prata", color: "#9ca3af", width: 520, height: 160 },
  { kind: "BOX", label: "Camarote", color: "#7c3aed", width: 220, height: 130 },
  { kind: "AISLE", label: "Corredor", color: "#334155", width: 80, height: 260 },
  { kind: "ACCESSIBLE", label: "Área PCD", color: "#2563eb", width: 160, height: 90 },
  { kind: "EMPTY", label: "Espaço livre", color: "#d6e4de", width: 180, height: 100 },
  { kind: "TEXT", label: "Acesso principal", color: "#111827", width: 260, height: 60 }
];

const kindLabels: Record<EventMapBlockKind, string> = {
  STAGE: "Palco",
  SECTOR: "Setor",
  BOX: "Camarote",
  AISLE: "Corredor",
  ACCESSIBLE: "Área PCD",
  EMPTY: "Espaço vazio",
  TEXT: "Texto/Legenda"
};

type MapTemplate = {
  id: string;
  title: string;
  description: string;
  blocks: Omit<EventMapBlock, "id">[];
};

const mapTemplates: MapTemplate[] = [
  {
    id: "theater",
    title: "Teatro",
    description: "Palco frontal com setores em fileiras.",
    blocks: [
      { kind: "STAGE", label: "Palco", color: "#20242a", x: 330, y: 54, width: 540, height: 110 },
      { kind: "SECTOR", label: "Setor Diamond", color: "#38bdf8", x: 290, y: 210, width: 620, height: 135 },
      { kind: "SECTOR", label: "Setor Gold", color: "#d4a017", x: 235, y: 385, width: 730, height: 150 },
      { kind: "SECTOR", label: "Setor Silver", color: "#9ca3af", x: 180, y: 575, width: 840, height: 145 },
      { kind: "TEXT", label: "Acesso principal", color: "#111827", x: 420, y: 735, width: 360, height: 48 }
    ]
  },
  {
    id: "gallery",
    title: "Galeria",
    description: "Mapa de piso livre com setores amplos.",
    blocks: [
      { kind: "STAGE", label: "Palco", color: "#20242a", x: 320, y: 54, width: 560, height: 110 },
      { kind: "SECTOR", label: "Pista Premium", color: "#7c3aed", x: 250, y: 215, width: 700, height: 210 },
      { kind: "SECTOR", label: "Pista", color: "#16a34a", x: 175, y: 470, width: 850, height: 205 },
      { kind: "TEXT", label: "Entrada", color: "#111827", x: 470, y: 715, width: 260, height: 50 }
    ]
  },
  {
    id: "gallery-box",
    title: "Galeria + camarote",
    description: "Piso central com camarotes nas laterais.",
    blocks: [
      { kind: "STAGE", label: "Palco", color: "#20242a", x: 330, y: 52, width: 540, height: 110 },
      { kind: "BOX", label: "Camarote esquerdo", color: "#7c3aed", x: 55, y: 220, width: 185, height: 330 },
      { kind: "SECTOR", label: "Pista Premium", color: "#d4a017", x: 285, y: 225, width: 630, height: 170 },
      { kind: "SECTOR", label: "Pista", color: "#9ca3af", x: 285, y: 455, width: 630, height: 190 },
      { kind: "BOX", label: "Camarote direito", color: "#7c3aed", x: 960, y: 220, width: 185, height: 330 },
      { kind: "TEXT", label: "Acesso principal", color: "#111827", x: 420, y: 710, width: 360, height: 55 }
    ]
  },
  {
    id: "theater-box",
    title: "Teatro + camarote",
    description: "Setores em frente ao palco e camarotes laterais.",
    blocks: [
      { kind: "STAGE", label: "Palco", color: "#20242a", x: 330, y: 52, width: 540, height: 110 },
      { kind: "BOX", label: "Camarote A", color: "#7c3aed", x: 70, y: 235, width: 170, height: 140 },
      { kind: "BOX", label: "Camarote B", color: "#7c3aed", x: 960, y: 235, width: 170, height: 140 },
      { kind: "SECTOR", label: "Setor Black", color: "#111827", x: 285, y: 220, width: 630, height: 135 },
      { kind: "SECTOR", label: "Setor Ouro", color: "#d4a017", x: 235, y: 405, width: 730, height: 145 },
      { kind: "SECTOR", label: "Setor Bronze", color: "#b45309", x: 190, y: 585, width: 820, height: 135 },
      { kind: "TEXT", label: "Acesso principal", color: "#111827", x: 420, y: 735, width: 360, height: 48 }
    ]
  },
  {
    id: "mezzanine",
    title: "Mezanino",
    description: "Piso principal com área superior destacada.",
    blocks: [
      { kind: "STAGE", label: "Palco", color: "#20242a", x: 330, y: 52, width: 540, height: 110 },
      { kind: "SECTOR", label: "Setor Principal", color: "#d4a017", x: 250, y: 225, width: 700, height: 190 },
      { kind: "SECTOR", label: "Mezanino", color: "#0f766e", x: 220, y: 500, width: 760, height: 130 },
      { kind: "AISLE", label: "Escada / acesso", color: "#334155", x: 520, y: 650, width: 160, height: 60 },
      { kind: "TEXT", label: "Entrada", color: "#111827", x: 470, y: 725, width: 260, height: 48 }
    ]
  },
  {
    id: "box-mezzanine",
    title: "Camarote + mezanino",
    description: "Camarotes laterais com mezanino ao fundo.",
    blocks: [
      { kind: "STAGE", label: "Palco", color: "#20242a", x: 330, y: 52, width: 540, height: 110 },
      { kind: "BOX", label: "Camarote esquerdo", color: "#7c3aed", x: 75, y: 220, width: 175, height: 260 },
      { kind: "SECTOR", label: "Área Premium", color: "#38bdf8", x: 290, y: 225, width: 620, height: 175 },
      { kind: "BOX", label: "Camarote direito", color: "#7c3aed", x: 950, y: 220, width: 175, height: 260 },
      { kind: "SECTOR", label: "Mezanino", color: "#0f766e", x: 250, y: 520, width: 700, height: 120 },
      { kind: "TEXT", label: "Acesso principal", color: "#111827", x: 420, y: 720, width: 360, height: 50 }
    ]
  },
  {
    id: "gallery-mezzanine",
    title: "Galeria + mezanino",
    description: "Pista no piso e mezanino superior.",
    blocks: [
      { kind: "STAGE", label: "Palco", color: "#20242a", x: 330, y: 52, width: 540, height: 110 },
      { kind: "SECTOR", label: "Galeria Premium", color: "#d4a017", x: 245, y: 220, width: 710, height: 190 },
      { kind: "SECTOR", label: "Galeria", color: "#16a34a", x: 190, y: 455, width: 820, height: 160 },
      { kind: "SECTOR", label: "Mezanino", color: "#0f766e", x: 250, y: 650, width: 700, height: 80 },
      { kind: "ACCESSIBLE", label: "Área PCD", color: "#2563eb", x: 75, y: 650, width: 150, height: 75 }
    ]
  }
];

const sectorColorOptions = [
  { label: "Diamond", color: "#38bdf8" },
  { label: "Black", color: "#111827" },
  { label: "Gold", color: "#d4a017" },
  { label: "Silver", color: "#9ca3af" },
  { label: "Bronze", color: "#b45309" },
  { label: "Roxo", color: "#7c3aed" },
  { label: "Verde", color: "#16a34a" }
];

function makeBlockId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialLayout(initialValue?: string | null): EventMapLayout {
  const normalized = normalizeEventMapLayout(initialValue || "");

  if (normalized) {
    return normalized;
  }

  return {
    version: 1,
    ...layoutSize,
    blocks: []
  };
}

function blockStyle(block: EventMapBlock, layout: EventMapLayout) {
  const textLength = Math.max(block.label.length, 6);
  const readableSize = Math.min(22, Math.max(8, Math.min(block.height * 0.28, (block.width / textLength) * 1.7)));

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

function toStoredLayout(layout: EventMapLayout) {
  return JSON.stringify({
    version: 1,
    width: layout.width,
    height: layout.height,
    blocks: layout.blocks
  });
}

export function EventMapEditor({ initialValue, mapSources = [] }: EventMapEditorProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState(() => createInitialLayout(initialValue));
  const [selectedId, setSelectedId] = useState(() => layout.blocks[0]?.id ?? "");
  const [customSectorLabel, setCustomSectorLabel] = useState("Novo setor");
  const [customSectorColor, setCustomSectorColor] = useState("#d4a017");
  const [sourceEventId, setSourceEventId] = useState(mapSources[0]?.id ?? "");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const selectedBlock = layout.blocks.find((block) => block.id === selectedId) ?? layout.blocks[0] ?? null;
  const storedValue = useMemo(() => toStoredLayout(layout), [layout]);

  function updateBlock(id: string, patch: Partial<EventMapBlock>) {
    setLayout((current) => ({
      ...current,
      blocks: current.blocks.map((block) => block.id === id ? { ...block, ...patch } : block)
    }));
  }

  function addBlock(preset: typeof blockPresets[number]) {
    const id = makeBlockId();
    const block: EventMapBlock = {
      id,
      kind: preset.kind,
      label: preset.label,
      color: preset.color,
      x: Math.max(20, 80 + layout.blocks.length * 20) % 760,
      y: Math.max(20, 90 + layout.blocks.length * 28) % 520,
      width: preset.width,
      height: preset.height,
      rotation: 0
    };

    setLayout((current) => ({ ...current, blocks: [...current.blocks, block] }));
    setSelectedId(id);
    setPreviewMode(false);
  }

  function applyTemplate(template: MapTemplate) {
    const blocks = template.blocks.map((block) => ({ ...block, id: makeBlockId() }));
    setLayout({ version: 1, ...layoutSize, blocks });
    setSelectedId(blocks[0]?.id ?? "");
    setPreviewMode(false);
  }

  function addCustomSector() {
    addBlock({
      kind: "SECTOR",
      label: customSectorLabel.trim() || "Novo setor",
      color: customSectorColor,
      width: 520,
      height: 150
    });
  }

  function duplicateSelectedBlock() {
    if (!selectedBlock) return;
    const id = makeBlockId();
    const duplicated = {
      ...selectedBlock,
      id,
      label: `${selectedBlock.label} cópia`,
      x: Math.min(layout.width - selectedBlock.width, selectedBlock.x + 36),
      y: Math.min(layout.height - selectedBlock.height, selectedBlock.y + 36)
    };

    setLayout((current) => ({ ...current, blocks: [...current.blocks, duplicated] }));
    setSelectedId(id);
  }

  function deleteSelectedBlock() {
    if (!selectedBlock) return;
    const nextBlocks = layout.blocks.filter((block) => block.id !== selectedBlock.id);
    setLayout((current) => ({ ...current, blocks: current.blocks.filter((block) => block.id !== selectedBlock.id) }));
    setSelectedId(nextBlocks[0]?.id ?? "");
  }

  function clearMap() {
    setLayout({ version: 1, ...layoutSize, blocks: [] });
    setSelectedId("");
  }

  function duplicateMapFromEvent() {
    const source = mapSources.find((item) => item.id === sourceEventId);
    const sourceLayout = normalizeEventMapLayout(source?.layoutValue ?? "");
    if (!sourceLayout) return;
    const nextLayout = {
      ...sourceLayout,
      blocks: sourceLayout.blocks.map((block) => ({ ...block, id: makeBlockId() }))
    };
    setLayout(nextLayout);
    setSelectedId(nextLayout.blocks[0]?.id ?? "");
    setPreviewMode(false);
  }

  function pointerToLayoutDelta(event: PointerEvent<HTMLDivElement>, state: DragState) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { dx: 0, dy: 0 };
    return {
      dx: ((event.clientX - state.startClientX) / rect.width) * layout.width,
      dy: ((event.clientY - state.startClientY) / rect.height) * layout.height
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState) return;
    const { dx, dy } = pointerToLayoutDelta(event, dragState);

    if (dragState.mode === "move") {
      updateBlock(dragState.id, {
        x: Math.round(Math.min(layout.width - dragState.startBlock.width, Math.max(0, dragState.startBlock.x + dx))),
        y: Math.round(Math.min(layout.height - dragState.startBlock.height, Math.max(0, dragState.startBlock.y + dy)))
      });
      return;
    }

    updateBlock(dragState.id, {
      width: Math.round(Math.min(layout.width - dragState.startBlock.x, Math.max(40, dragState.startBlock.width + dx))),
      height: Math.round(Math.min(layout.height - dragState.startBlock.y, Math.max(28, dragState.startBlock.height + dy)))
    });
  }

  function startDrag(event: PointerEvent<HTMLElement>, block: EventMapBlock, mode: "move" | "resize") {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(block.id);
    setPreviewMode(false);
    setDragState({
      id: block.id,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBlock: block
    });
  }

  return (
    <div className="eventMapEditor">
      <input name="eventMapLayout" type="hidden" value={storedValue} />

      <aside className="eventMapEditorPalette" aria-label="Blocos do mapa">
        <strong>Modelo inicial</strong>
        <div className="eventMapTemplateGrid">
          {mapTemplates.map((template) => (
            <button className="eventMapTemplateButton" key={template.id} onClick={() => applyTemplate(template)} type="button">
              <span>{template.title}</span>
              <small>{template.description}</small>
            </button>
          ))}
        </div>

        <strong>Setor personalizado</strong>
        <div className="eventMapCustomSector">
          <input
            aria-label="Nome do setor personalizado"
            onChange={(event) => setCustomSectorLabel(event.target.value)}
            placeholder="Ex: Diamond, Black, com hospedagem"
            value={customSectorLabel}
          />
          <div className="eventMapColorChoices" aria-label="Cores sugeridas">
            {sectorColorOptions.map((option) => (
              <button
                aria-label={`Usar cor ${option.label}`}
                className={customSectorColor === option.color ? "isSelected" : ""}
                key={option.color}
                onClick={() => setCustomSectorColor(option.color)}
                style={{ background: option.color }}
                title={option.label}
                type="button"
              />
            ))}
            <input
              aria-label="Cor personalizada do setor"
              onChange={(event) => setCustomSectorColor(event.target.value)}
              type="color"
              value={customSectorColor}
            />
          </div>
          <button className="button smallButton" onClick={addCustomSector} type="button">
            Adicionar setor
          </button>
        </div>

        <strong>Adicionar bloco</strong>
        <div>
          {blockPresets.map((preset) => (
            <button key={`${preset.kind}-${preset.label}`} onClick={() => addBlock(preset)} type="button">
              <i style={{ background: preset.color }} />
              {preset.label}
            </button>
          ))}
        </div>
      </aside>

      <section className="eventMapEditorStage">
        <div className="eventMapEditorToolbar">
          {mapSources.length > 0 ? (
            <div className="eventMapEditorCopy">
              <select value={sourceEventId} onChange={(event) => setSourceEventId(event.target.value)} aria-label="Mapa de outro evento">
                {mapSources.map((source) => (
                  <option key={source.id} value={source.id}>{source.title}</option>
                ))}
              </select>
              <button className="secondaryButton smallButton" onClick={duplicateMapFromEvent} type="button">
                Duplicar mapa de outro evento
              </button>
            </div>
          ) : null}
          <button className="secondaryButton smallButton" onClick={() => setPreviewMode((value) => !value)} type="button">
            {previewMode ? "Editar mapa" : "Visualizar mapa"}
          </button>
          <button className="secondaryButton smallButton" onClick={duplicateSelectedBlock} type="button" disabled={!selectedBlock}>
            Duplicar
          </button>
          <button className="secondaryButton smallButton" onClick={clearMap} type="button">
            Limpar
          </button>
          <button className="button smallButton" type="submit">
            Salvar
          </button>
        </div>

        <div
          className={`eventMapEditorCanvas ${previewMode ? "isPreview" : ""}`}
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDragState(null)}
          ref={canvasRef}
          style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
        >
          <div className="eventMapEditorFloor" />
          {layout.blocks.length === 0 ? (
            <div className="eventMapEditorEmpty">Adicione blocos para montar o mapa deste evento.</div>
          ) : null}
          {layout.blocks.map((block) => (
            <div
              className={`eventMapEditorBlock is-${block.kind.toLowerCase()} ${block.id === selectedId ? "isSelected" : ""}`}
              key={block.id}
              onPointerDown={(event) => startDrag(event, block, "move")}
              style={blockStyle(block, layout)}
            >
              <span>{block.label}</span>
              {block.seats ? <small>{block.seats.toLocaleString("pt-BR")} lugares</small> : null}
              {!previewMode ? (
                <button
                  aria-label={`Redimensionar ${block.label}`}
                  className="eventMapEditorResize"
                  onPointerDown={(event) => startDrag(event, block, "resize")}
                  type="button"
                />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <aside className="eventMapEditorInspector">
        <strong>Bloco selecionado</strong>
        {selectedBlock ? (
          <>
            <label>
              <span>Nome</span>
              <input value={selectedBlock.label} onChange={(event) => updateBlock(selectedBlock.id, { label: event.target.value })} />
            </label>
            <label>
              <span>Tipo</span>
              <select
                value={selectedBlock.kind}
                onChange={(event) => updateBlock(selectedBlock.id, { kind: event.target.value as EventMapBlockKind })}
              >
                {Object.entries(kindLabels).map(([kind, label]) => (
                  <option key={kind} value={kind}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Cor</span>
              <input type="color" value={selectedBlock.color} onChange={(event) => updateBlock(selectedBlock.id, { color: event.target.value })} />
            </label>
            <div className="eventMapEditorNumberGrid">
              <label>
                <span>X</span>
                <input type="number" value={selectedBlock.x} onChange={(event) => updateBlock(selectedBlock.id, { x: Number(event.target.value) })} />
              </label>
              <label>
                <span>Y</span>
                <input type="number" value={selectedBlock.y} onChange={(event) => updateBlock(selectedBlock.id, { y: Number(event.target.value) })} />
              </label>
              <label>
                <span>Largura</span>
                <input type="number" value={selectedBlock.width} onChange={(event) => updateBlock(selectedBlock.id, { width: Number(event.target.value) })} />
              </label>
              <label>
                <span>Altura</span>
                <input type="number" value={selectedBlock.height} onChange={(event) => updateBlock(selectedBlock.id, { height: Number(event.target.value) })} />
              </label>
              <label>
                <span>Rotação</span>
                <input type="number" value={selectedBlock.rotation ?? 0} onChange={(event) => updateBlock(selectedBlock.id, { rotation: Number(event.target.value) })} />
              </label>
            </div>
            <label>
              <span>Girar bloco</span>
              <input
                max={180}
                min={-180}
                step={1}
                type="range"
                value={selectedBlock.rotation ?? 0}
                onChange={(event) => updateBlock(selectedBlock.id, { rotation: Number(event.target.value) })}
              />
            </label>
            <div className="eventMapEditorQuickActions">
              <button className="secondaryButton smallButton" onClick={() => updateBlock(selectedBlock.id, { rotation: 0 })} type="button">
                0°
              </button>
              <button className="secondaryButton smallButton" onClick={() => updateBlock(selectedBlock.id, { rotation: -90 })} type="button">
                -90°
              </button>
              <button className="secondaryButton smallButton" onClick={() => updateBlock(selectedBlock.id, { rotation: 90 })} type="button">
                90°
              </button>
            </div>
            <label>
              <span>Lugares estimados</span>
              <input
                min={0}
                type="number"
                value={selectedBlock.seats ?? ""}
                onChange={(event) => updateBlock(selectedBlock.id, { seats: event.target.value ? Number(event.target.value) : undefined })}
              />
            </label>
            <label>
              <span>Descrição opcional</span>
              <textarea
                rows={3}
                value={selectedBlock.description ?? ""}
                onChange={(event) => updateBlock(selectedBlock.id, { description: event.target.value })}
              />
            </label>
            <button className="secondaryButton smallButton dangerButton" onClick={deleteSelectedBlock} type="button">
              Excluir bloco
            </button>
          </>
        ) : (
          <p className="muted">Selecione ou adicione um bloco para editar nome, cor, tamanho e posição.</p>
        )}
      </aside>
    </div>
  );
}
