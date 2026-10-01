import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { json } from "./meta";
import { normalizePhone, normalizeOptIn } from "./rules";
const key = (value: unknown) =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const aliases = {
  phone: [
    "telefone",
    "celular",
    "phone",
    "whatsapp",
    "numero",
    "numerodetelefone",
  ],
  name: ["nome", "name", "contato"],
  city: ["cidade", "city"],
  tag: ["tag", "origem", "tags"],
  optInStatus: ["optinstatus", "consentimento", "optin"],
  optInDate: ["optindate", "dataconsentimento"],
  optInSource: ["optinsource", "fonteconsentimento"],
  purpose: ["finalidade", "purpose", "categoria"],
  collectionSource: ["origemcoleta", "collectionsource"],
};
export async function parseContacts(
  bytes: Buffer,
  filename: string,
  country = "BR",
) {
  if (bytes.length > 10 * 1024 * 1024)
    throw new Error("A lista deve ter até 10 MB.");
  let rows: unknown[][] = [];
  if (filename.toLowerCase().endsWith(".csv")) {
    const text = bytes.toString("utf8");
    const first = text.split(/\r?\n/)[0];
    rows = parse(text, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      delimiter: first.split(";").length > first.split(",").length ? ";" : ",",
    });
  } else if (filename.toLowerCase().endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("A planilha está vazia.");
    sheet.eachRow((row) =>
      rows.push(
        (row.values as unknown[])
          .slice(1)
          .map((v) =>
            v instanceof Date
              ? v.toISOString()
              : typeof v === "object" && v !== null && "text" in v
                ? (v as { text: string }).text
                : v,
          ),
      ),
    );
  } else throw new Error("Selecione um arquivo CSV ou XLSX.");
  if (rows.length > 20001)
    throw new Error("Importe até 20.000 contatos por lista.");
  const headers = rows.shift()?.map(key) ?? [];
  const mapping = Object.fromEntries(
    Object.entries(aliases).map(([field, names]) => [
      field,
      headers.findIndex((h) => names.includes(h)),
    ]),
  );
  if (mapping.phone < 0)
    throw new Error(
      "Não encontramos a coluna telefone. Use o cabeçalho telefone, celular ou phone.",
    );
  const contacts: any[] = [];
  const errors: Array<{ row: number; reason: string }> = [];
  const seen = new Set<string>();
  let original = 0,
    duplicates = 0,
    invalid = 0;
  rows.forEach((row, i) => {
    if (!row.some((x) => String(x ?? "").trim())) return;
    original++;
    const get = (field: string) => String(row[mapping[field]] ?? "").trim();
    const phone = normalizePhone(get("phone"), country);
    if (!phone) {
      invalid++;
      if (errors.length < 100)
        errors.push({
          row: i + 2,
          reason: "Telefone inválido ou sem código de país válido",
        });
      return;
    }
    if (seen.has(phone)) {
      duplicates++;
      if (normalizeOptIn(get("optInStatus")) === "opt_out") {
        const existing = contacts.find((c) => c.phone === phone);
        if (existing) existing.optInStatus = "opt_out";
      }
      return;
    }
    seen.add(phone);
    let consent = normalizeOptIn(get("optInStatus"));
    const optDate = get("optInDate"),
      date = optDate ? new Date(optDate) : null;
    const source = get("optInSource");
    const purpose = get("purpose").toLowerCase();
    if (
      consent === "opt_in" &&
      (!date ||
        !Number.isFinite(date.getTime()) ||
        date > new Date() ||
        !source ||
        !["marketing", "utility"].includes(purpose))
    )
      consent = "unknown";
    contacts.push({
      phone,
      name: get("name").slice(0, 160) || phone,
      city: get("city").slice(0, 100),
      tag: get("tag").slice(0, 100),
      optInStatus: consent,
      optInDate: consent === "opt_in" ? date : null,
      optInSource: source || null,
      purpose,
      collectionSource: get("collectionSource") || filename,
    });
  });
  return {
    contacts,
    original,
    duplicates,
    invalid,
    errors,
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
}
export async function importList(
  organizationId: string,
  actorId: string,
  name: string,
  bytes: Buffer,
  filename: string,
  country: string,
) {
  if (!name.trim() || name.length > 160)
    throw new Error("Informe um nome para a lista (até 160 caracteres).");
  const parsed = await parseContacts(bytes, filename, country);
  return prisma.$transaction(
    async (tx) => {
      const list = await tx.waContactList.create({
        data: {
          organizationId,
          name: name.trim(),
          source: filename.toLowerCase().endsWith(".csv") ? "CSV" : "XLSX",
          createdBy: actorId,
          originalCount: parsed.original,
          validCount: parsed.contacts.length,
          invalidCount: parsed.invalid,
          duplicateCount: parsed.duplicates,
          importDetails: json({ errors: parsed.errors, sha256: parsed.hash }),
        },
      });
      const existing = await tx.waContact.findMany({
        where: {
          organizationId,
          phone: { in: parsed.contacts.map((c) => c.phone) },
        },
      });
      const oldByPhone = new Map(existing.map((c) => [c.phone, c]));
      await tx.waContact.createMany({
        data: parsed.contacts
          .filter((c) => !oldByPhone.has(c.phone))
          .map((c) => ({ organizationId, ...c })),
        skipDuplicates: true,
      });
      for (const data of parsed.contacts.filter((c) =>
        oldByPhone.has(c.phone),
      )) {
        const old = oldByPhone.get(data.phone)!;
        await tx.waContact.update({
          where: { id: old.id },
          data:
            old.optInStatus === "opt_out" ||
            (old.optInStatus === "opt_in" && data.optInStatus === "unknown")
              ? { name: data.name, city: data.city, tag: data.tag }
              : data,
        });
      }
      const contacts = await tx.waContact.findMany({
        where: {
          organizationId,
          phone: { in: parsed.contacts.map((c) => c.phone) },
        },
        select: { id: true, phone: true },
      });
      const byPhone = new Map(contacts.map((c) => [c.phone, c.id]));
      await tx.waSuppression.createMany({
        data: parsed.contacts
          .filter((c) => c.optInStatus === "opt_out")
          .map((c) => ({
            organizationId,
            phone: c.phone,
            reason: "Opt-out informado na importação",
            source: list.id,
          })),
        skipDuplicates: true,
      });
      await tx.waListMember.createMany({
        data: parsed.contacts.map((data) => ({
          listId: list.id,
          contactId: byPhone.get(data.phone)!,
          snapshot: json(data),
        })),
      });

      await tx.waAudit.create({
        data: {
          organizationId,
          actorId,
          action: "LIST_IMPORTED",
          detail: json({
            listId: list.id,
            original: parsed.original,
            valid: parsed.contacts.length,
            invalid: parsed.invalid,
            duplicates: parsed.duplicates,
          }),
        },
      });
      return tx.waContactList.update({
        where: { id: list.id },
        data: { status: "ready" },
      });
    },
    { timeout: 120000, maxWait: 10000 },
  );
}
