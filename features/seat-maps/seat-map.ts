export type SeatMapKind = "THEATER" | "ARENA" | "OVAL" | "RESTAURANT" | "CUSTOM";
export type SeatMapElementKind = "STAGE" | "AISLE" | "TEXT" | "ACCESSIBLE" | "BOOTH" | "MEZZANINE";
export type SeatMapSeatStatus = "AVAILABLE" | "SELECTED" | "UNAVAILABLE" | "SOLD" | "RESERVED" | "ACCESSIBLE";
export type SeatMapTableShape = "ROUND" | "SQUARE" | "RECTANGLE";

export type SeatMapSeat = {
  id: string;
  sectionId: string;
  ticketLotId?: string | null;
  label: string;
  number: string;
  row?: string;
  tableId?: string;
  x: number;
  y: number;
  radius?: number;
  status: SeatMapSeatStatus;
  priceInCents?: number;
  accessible?: boolean;
};

export type SeatMapTable = {
  id: string;
  sectionId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: SeatMapTableShape;
  rotation?: number;
  seats: SeatMapSeat[];
};

export type SeatMapSection = {
  id: string;
  ticketLotId?: string | null;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priceInCents: number;
  description?: string;
  priority?: number;
  seats?: SeatMapSeat[];
  tables?: SeatMapTable[];
};

export type SeatMapElement = {
  id: string;
  kind: SeatMapElementKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  rotation?: number;
};

export type SeatMapLayout = {
  version: 1;
  kind: SeatMapKind;
  width: number;
  height: number;
  sections: SeatMapSection[];
  elements: SeatMapElement[];
};

type TableSeatInput = {
  tableId: string;
  sectionId: string;
  tableLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: SeatMapTableShape;
  seats: number;
  priceInCents?: number;
  startNumber?: number;
  status?: SeatMapSeatStatus;
};

type TheaterSeatInput = {
  sectionId: string;
  x: number;
  y: number;
  rows: number;
  columns: number;
  rowGap?: number;
  columnGap?: number;
  startNumber?: number;
  priceInCents?: number;
  status?: SeatMapSeatStatus;
};

const mapKinds = new Set<SeatMapKind>(["THEATER", "ARENA", "OVAL", "RESTAURANT", "CUSTOM"]);
const elementKinds = new Set<SeatMapElementKind>(["STAGE", "AISLE", "TEXT", "ACCESSIBLE", "BOOTH", "MEZZANINE"]);
const seatStatuses = new Set<SeatMapSeatStatus>(["AVAILABLE", "SELECTED", "UNAVAILABLE", "SOLD", "RESERVED", "ACCESSIBLE"]);
const tableShapes = new Set<SeatMapTableShape>(["ROUND", "SQUARE", "RECTANGLE"]);

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function cleanText(value: unknown, maxLength: number, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || fallback : fallback;
}

function cleanColor(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function seatStatus(value: unknown): SeatMapSeatStatus {
  return typeof value === "string" && seatStatuses.has(value as SeatMapSeatStatus)
    ? value as SeatMapSeatStatus
    : "AVAILABLE";
}

function normalizeSeat(value: unknown, fallbackSectionId: string, index: number): SeatMapSeat | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const sectionId = cleanText(row.sectionId, 80, fallbackSectionId);
  const number = cleanText(row.number, 24, String(index + 1));
  const label = cleanText(row.label, 80, number);
  const accessible = Boolean(row.accessible);
  const status = accessible && seatStatus(row.status) === "AVAILABLE" ? "ACCESSIBLE" : seatStatus(row.status);

  return {
    id: cleanText(row.id, 100, `${sectionId}-seat-${index + 1}`),
    sectionId,
    ticketLotId: cleanText(row.ticketLotId, 100) || undefined,
    label,
    number,
    row: cleanText(row.row, 24) || undefined,
    tableId: cleanText(row.tableId, 100) || undefined,
    x: clampNumber(row.x, 0, 4000, 0),
    y: clampNumber(row.y, 0, 4000, 0),
    radius: clampNumber(row.radius, 4, 32, 9),
    status,
    priceInCents: row.priceInCents === undefined ? undefined : clampNumber(row.priceInCents, 0, 999999999, 0),
    accessible
  };
}

function normalizeTable(value: unknown, fallbackSectionId: string, index: number): SeatMapTable | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const sectionId = cleanText(row.sectionId, 80, fallbackSectionId);
  const id = cleanText(row.id, 100, `${sectionId}-table-${index + 1}`);
  const shape = typeof row.shape === "string" && tableShapes.has(row.shape as SeatMapTableShape)
    ? row.shape as SeatMapTableShape
    : "ROUND";
  const seats = Array.isArray(row.seats)
    ? row.seats.map((seat, seatIndex) => normalizeSeat(seat, sectionId, seatIndex)).filter((seat): seat is SeatMapSeat => Boolean(seat))
    : [];

  return {
    id,
    sectionId,
    label: cleanText(row.label, 80, `Mesa ${index + 1}`),
    x: clampNumber(row.x, 0, 4000, 0),
    y: clampNumber(row.y, 0, 4000, 0),
    width: clampNumber(row.width, 24, 600, 76),
    height: clampNumber(row.height, 24, 600, 76),
    shape,
    rotation: clampNumber(row.rotation, -180, 180, 0),
    seats
  };
}

function normalizeSection(value: unknown, index: number): SeatMapSection | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = cleanText(row.id, 100, `section-${index + 1}`);

  return {
    id,
    ticketLotId: cleanText(row.ticketLotId, 100) || undefined,
    name: cleanText(row.name, 80, `Setor ${index + 1}`),
    color: cleanColor(row.color, "#d4a017"),
    x: clampNumber(row.x, 0, 4000, 0),
    y: clampNumber(row.y, 0, 4000, 0),
    width: clampNumber(row.width, 40, 4000, 300),
    height: clampNumber(row.height, 40, 4000, 180),
    priceInCents: clampNumber(row.priceInCents, 0, 999999999, 0),
    description: cleanText(row.description, 240) || undefined,
    priority: clampNumber(row.priority, 0, 999, index),
    seats: Array.isArray(row.seats)
      ? row.seats.map((seat, seatIndex) => normalizeSeat(seat, id, seatIndex)).filter((seat): seat is SeatMapSeat => Boolean(seat))
      : [],
    tables: Array.isArray(row.tables)
      ? row.tables.map((table, tableIndex) => normalizeTable(table, id, tableIndex)).filter((table): table is SeatMapTable => Boolean(table))
      : []
  };
}

function normalizeElement(value: unknown, index: number): SeatMapElement | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const kind = typeof row.kind === "string" && elementKinds.has(row.kind as SeatMapElementKind)
    ? row.kind as SeatMapElementKind
    : "TEXT";

  return {
    id: cleanText(row.id, 100, `element-${index + 1}`),
    kind,
    label: cleanText(row.label, 80, kind === "STAGE" ? "Palco" : "Elemento"),
    x: clampNumber(row.x, 0, 4000, 0),
    y: clampNumber(row.y, 0, 4000, 0),
    width: clampNumber(row.width, 16, 4000, 120),
    height: clampNumber(row.height, 16, 4000, 56),
    color: cleanColor(row.color, kind === "STAGE" ? "#27313d" : "#334155"),
    rotation: clampNumber(row.rotation, -180, 180, 0)
  };
}

export function normalizeSeatMapLayout(value: unknown): SeatMapLayout | null {
  if (!value) {
    return null;
  }

  const raw = typeof value === "string" ? parseJson(value) : value;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const kind = typeof record.kind === "string" && mapKinds.has(record.kind as SeatMapKind)
    ? record.kind as SeatMapKind
    : "CUSTOM";
  const sections = Array.isArray(record.sections)
    ? record.sections.map((section, index) => normalizeSection(section, index)).filter((section): section is SeatMapSection => Boolean(section))
    : [];

  if (sections.length === 0) {
    return null;
  }

  return {
    version: 1,
    kind,
    width: clampNumber(record.width, 480, 4000, 1200),
    height: clampNumber(record.height, 360, 4000, 800),
    sections: sections.slice(0, 120),
    elements: Array.isArray(record.elements)
      ? record.elements.map((element, index) => normalizeElement(element, index)).filter((element): element is SeatMapElement => Boolean(element)).slice(0, 200)
      : []
  };
}

export function getSectionSeats(section: SeatMapSection) {
  return [
    ...(section.seats ?? []),
    ...(section.tables ?? []).flatMap((table) => table.seats)
  ];
}

export function getLayoutSeats(layout: SeatMapLayout) {
  return layout.sections.flatMap(getSectionSeats);
}

export function createTableSeats(input: TableSeatInput): SeatMapSeat[] {
  const total = clampNumber(input.seats, 1, 20, 4);
  const seatRadius = total <= 8 ? 10 : total <= 14 ? 8 : 7;
  const horizontalRadius = input.width / 2 + seatRadius + 8;
  const verticalRadius = input.height / 2 + seatRadius + 8;
  const centerX = input.x + input.width / 2;
  const centerY = input.y + input.height / 2;
  const start = input.startNumber ?? 1;

  return Array.from({ length: total }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
    const number = String(start + index).padStart(total >= 10 ? 2 : 1, "0");

    return {
      id: `${input.tableId}-seat-${number}`,
      sectionId: input.sectionId,
      tableId: input.tableId,
      label: number,
      number,
      x: Math.round(centerX + Math.cos(angle) * horizontalRadius),
      y: Math.round(centerY + Math.sin(angle) * verticalRadius),
      radius: seatRadius,
      status: input.status ?? "AVAILABLE",
      priceInCents: input.priceInCents
    };
  });
}

export function createTheaterSeats(input: TheaterSeatInput): SeatMapSeat[] {
  const rows = clampNumber(input.rows, 1, 80, 8);
  const columns = clampNumber(input.columns, 1, 120, 12);
  const columnGap = input.columnGap ?? 22;
  const rowGap = input.rowGap ?? 22;
  const start = input.startNumber ?? 1;

  return Array.from({ length: rows * columns }, (_, index) => {
    const rowIndex = Math.floor(index / columns);
    const columnIndex = index % columns;
    const rowName = String.fromCharCode(65 + (rowIndex % 26));
    const number = String(start + columnIndex).padStart(columns >= 10 ? 2 : 1, "0");

    return {
      id: `${input.sectionId}-${rowName}-${number}`,
      sectionId: input.sectionId,
      label: `${rowName}${number}`,
      row: rowName,
      number,
      x: Math.round(input.x + columnIndex * columnGap),
      y: Math.round(input.y + rowIndex * rowGap),
      radius: 8,
      status: input.status ?? "AVAILABLE",
      priceInCents: input.priceInCents
    };
  });
}

export function createRestaurantPreset(): SeatMapLayout {
  const goldTables = Array.from({ length: 24 }, (_, index) => {
    const row = Math.floor(index / 8);
    const column = index % 8;
    const id = `gold-table-${index + 1}`;
    const x = 120 + column * 116;
    const y = 180 + row * 96;

    return {
      id,
      sectionId: "gold",
      label: String(index + 1).padStart(2, "0"),
      x,
      y,
      width: 58,
      height: 58,
      shape: "ROUND" as const,
      seats: createTableSeats({
        tableId: id,
        sectionId: "gold",
        tableLabel: String(index + 1),
        x,
        y,
        width: 58,
        height: 58,
        shape: "ROUND",
        seats: 4,
        priceInCents: 80000,
        startNumber: 1
      })
    };
  });

  const silverTables = Array.from({ length: 24 }, (_, index) => {
    const row = Math.floor(index / 8);
    const column = index % 8;
    const id = `silver-table-${index + 25}`;
    const x = 120 + column * 116;
    const y = 500 + row * 96;

    return {
      id,
      sectionId: "silver",
      label: String(index + 25).padStart(2, "0"),
      x,
      y,
      width: 58,
      height: 58,
      shape: "ROUND" as const,
      seats: createTableSeats({
        tableId: id,
        sectionId: "silver",
        tableLabel: String(index + 25),
        x,
        y,
        width: 58,
        height: 58,
        shape: "ROUND",
        seats: 4,
        priceInCents: 65000,
        startNumber: 1
      })
    };
  });

  return {
    version: 1,
    kind: "RESTAURANT",
    width: 1120,
    height: 840,
    elements: [
      { id: "stage", kind: "STAGE", label: "Palco", x: 240, y: 34, width: 640, height: 96, color: "#27313d" },
      { id: "central-aisle", kind: "AISLE", label: "Corredor", x: 80, y: 442, width: 960, height: 34, color: "#334155" }
    ],
    sections: [
      {
        id: "gold",
        ticketLotId: undefined,
        name: "Setor Ouro",
        color: "#ffc107",
        x: 70,
        y: 150,
        width: 980,
        height: 294,
        priceInCents: 80000,
        description: "Mesas mais próximas ao palco",
        priority: 1,
        tables: goldTables
      },
      {
        id: "silver",
        ticketLotId: undefined,
        name: "Setor Prata",
        color: "#a7b0b7",
        x: 70,
        y: 490,
        width: 980,
        height: 294,
        priceInCents: 65000,
        description: "Mesas com visão ampla do salão",
        priority: 2,
        tables: silverTables
      }
    ]
  };
}
