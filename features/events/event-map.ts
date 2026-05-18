import { Prisma } from "@prisma/client";

export type EventMapBlockKind = "STAGE" | "SECTOR" | "BOX" | "AISLE" | "ACCESSIBLE" | "EMPTY" | "TEXT";

export type EventMapBlock = {
  id: string;
  kind: EventMapBlockKind;
  label: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  seats?: number;
  description?: string;
};

export type EventMapLayout = {
  version: 1;
  width: number;
  height: number;
  blocks: EventMapBlock[];
};

const blockKinds = new Set<EventMapBlockKind>(["STAGE", "SECTOR", "BOX", "AISLE", "ACCESSIBLE", "EMPTY", "TEXT"]);

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanColor(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeBlock(block: unknown, index: number): EventMapBlock | null {
  if (!block || typeof block !== "object") {
    return null;
  }

  const row = block as Record<string, unknown>;
  const kind = typeof row.kind === "string" && blockKinds.has(row.kind as EventMapBlockKind) ? row.kind as EventMapBlockKind : "SECTOR";
  const fallbackLabel = kind === "STAGE" ? "Palco" : kind === "BOX" ? "Camarote" : kind === "ACCESSIBLE" ? "Área PCD" : "Setor";
  const label = cleanText(row.label, 80) || fallbackLabel;
  const id = cleanText(row.id, 80) || `block-${index + 1}`;
  const description = cleanText(row.description, 240);
  const seats = row.seats === undefined || row.seats === null || row.seats === ""
    ? undefined
    : clampNumber(row.seats, 0, 999999, 0);

  return {
    id,
    kind,
    label,
    color: cleanColor(row.color, kind === "STAGE" ? "#1f2937" : "#d4a017"),
    x: clampNumber(row.x, 0, 1000, 60),
    y: clampNumber(row.y, 0, 1000, 60),
    width: clampNumber(row.width, 40, 1000, 220),
    height: clampNumber(row.height, 28, 1000, 90),
    ...(seats !== undefined ? { seats } : {}),
    ...(description ? { description } : {})
  };
}

export function normalizeEventMapLayout(value: unknown): EventMapLayout | null {
  if (!value) {
    return null;
  }

  const raw = typeof value === "string" ? safeJsonParse(value) : value;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const rawBlocks = Array.isArray(record.blocks) ? record.blocks : [];
  const blocks = rawBlocks
    .map((block, index) => normalizeBlock(block, index))
    .filter((block): block is EventMapBlock => Boolean(block))
    .slice(0, 80);

  if (blocks.length === 0) {
    return null;
  }

  return {
    version: 1,
    width: clampNumber(record.width, 480, 2200, 1200),
    height: clampNumber(record.height, 360, 1600, 800),
    blocks
  };
}

export function parseEventMapLayoutFormValue(value: FormDataEntryValue | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const normalized = normalizeEventMapLayout(typeof value === "string" ? value : "");
  return normalized ? normalized as unknown as Prisma.InputJsonValue : Prisma.JsonNull;
}

export function eventMapLayoutToFormValue(value: unknown) {
  const normalized = normalizeEventMapLayout(value);
  return normalized ? JSON.stringify(normalized) : "";
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
