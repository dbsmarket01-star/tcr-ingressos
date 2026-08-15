export type ParsedMarketingEmailContact = {
  name: string;
  email: string;
  phone: string | null;
};

export type MarketingEmailImportSummary = {
  contacts: ParsedMarketingEmailContact[];
  totalRows: number;
  recognized: number;
  ignored: number;
  invalidEmails: number;
  duplicates: number;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizePhone(value?: string) {
  const text = value?.trim() ?? "";

  return text || null;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function detectDelimiter(row: string) {
  if (row.includes("\t")) {
    return "\t";
  }

  const semicolons = row.match(/;/g)?.length ?? 0;
  const commas = row.match(/,/g)?.length ?? 0;

  return semicolons >= commas ? ";" : ",";
}

function splitColumns(row: string) {
  const delimiter = detectDelimiter(row);
  const columns: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    const next = row[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      columns.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  columns.push(current.trim());

  return columns.map((column) => column.replace(/^"|"$/g, "").trim());
}

function getHeaderIndexes(columns: string[]) {
  const normalized = columns.map(normalizeHeader);
  const email = normalized.findIndex((column) => ["email", "emailaddress", "correioeletronico"].includes(column));
  const name = normalized.findIndex((column) => ["nome", "nomecompleto", "cliente", "contato"].includes(column));
  const phone = normalized.findIndex((column) => ["telefone", "celular", "whatsapp", "fone"].includes(column));

  if (email === -1) {
    return null;
  }

  return {
    email,
    name: name === -1 ? null : name,
    phone: phone === -1 ? null : phone
  };
}

function getColumn(columns: string[], index?: number | null) {
  return typeof index === "number" && index >= 0 ? columns[index]?.trim() || "" : "";
}

export function parseMarketingEmailContactList(rawText: string): MarketingEmailImportSummary {
  const rows = rawText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  const contacts: ParsedMarketingEmailContact[] = [];
  const seenEmails = new Set<string>();
  let invalidEmails = 0;
  let duplicates = 0;
  let headerIndexes: ReturnType<typeof getHeaderIndexes> = null;

  for (const [index, row] of rows.entries()) {
    const columns = splitColumns(row);

    if (index === 0) {
      headerIndexes = getHeaderIndexes(columns);

      if (headerIndexes) {
        continue;
      }
    }

    const emailColumnIndex = headerIndexes?.email ?? columns.findIndex((column) => isValidEmail(normalizeEmail(column)));

    if (emailColumnIndex === -1) {
      invalidEmails += 1;
      continue;
    }

    const email = normalizeEmail(columns[emailColumnIndex]);

    if (!isValidEmail(email)) {
      invalidEmails += 1;
      continue;
    }

    if (seenEmails.has(email)) {
      duplicates += 1;
      continue;
    }

    seenEmails.add(email);

    const rawName =
      getColumn(columns, headerIndexes?.name) ||
      columns[emailColumnIndex === 0 ? 1 : 0] ||
      email.split("@")[0] ||
      "Contato importado";
    const rawPhone =
      getColumn(columns, headerIndexes?.phone) ||
      columns.find((column, columnIndex) => columnIndex !== emailColumnIndex && column.replace(/\D/g, "").length >= 8);

    contacts.push({
      name: rawName.trim().replace(/\s+/g, " ").slice(0, 160) || "Contato importado",
      email,
      phone: sanitizePhone(rawPhone)
    });
  }

  return {
    contacts,
    totalRows: rows.length,
    recognized: contacts.length,
    ignored: Math.max(rows.length - contacts.length, 0),
    invalidEmails,
    duplicates
  };
}

export async function readMarketingEmailImportFile(file: FormDataEntryValue | null) {
  if (
    !file ||
    typeof file !== "object" ||
    !("size" in file) ||
    !("arrayBuffer" in file) ||
    typeof file.arrayBuffer !== "function" ||
    file.size <= 0
  ) {
    return "";
  }

  const buffer = await file.arrayBuffer();

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("latin1").decode(buffer).replace(/^\uFEFF/, "");
  }
}
