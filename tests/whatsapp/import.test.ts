import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseContacts } from "@/features/whatsapp/campaigns/import";
describe("CSV/XLSX contact import", () => {
  it("reports invalid, duplicate and valid rows and does not infer consent", async () => {
    const csv =
      "nome;telefone;opt_in_status;opt_in_date;opt_in_source;finalidade\nLucas;(11) 98765-4321;sim;2026-01-01;formulario;marketing\nLucas;5511987654321;;;;\nInválido;123;;;;\nSem consentimento;21987654321;;;;\n;;;;;";
    const r = await parseContacts(Buffer.from(csv), "lista.csv");
    expect([r.original, r.contacts.length, r.invalid, r.duplicates]).toEqual([
      4, 2, 1, 1,
    ]);
    expect(r.contacts[0].optInStatus).toBe("opt_in");
    expect(r.contacts[1].optInStatus).toBe("unknown");
  });
  it("preserves opt-out even if a duplicate opt-in appeared first", async () => {
    const r = await parseContacts(
      Buffer.from(
        "telefone,opt_in_status,opt_in_date,opt_in_source,finalidade\n11987654321,sim,2026-01-01,form,marketing\n11987654321,opt_out,,,",
      ),
      "a.csv",
    );
    expect(r.contacts[0].optInStatus).toBe("opt_out");
  });
  it("requires complete evidence for opt-in", async () => {
    const r = await parseContacts(
      Buffer.from("telefone;opt_in_status\n11987654321;sim"),
      "a.csv",
    );
    expect(r.contacts[0].optInStatus).toBe("unknown");
  });
  it("reads XLSX cell values and valid international phone numbers", async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Contatos");
    sheet.addRow(["Nome", "Telefone"]);
    sheet.addRow(["Lucas", "+5511987654321"]);
    const r = await parseContacts(
      Buffer.from(await wb.xlsx.writeBuffer()),
      "lista.xlsx",
    );
    expect(r.contacts[0].name).toBe("Lucas");
    expect(r.contacts[0].phone).toBe("+5511987654321");
  });
  it("rejects missing phone columns and unsupported file extensions", async () => {
    await expect(
      parseContacts(Buffer.from("nome\nLucas"), "a.csv"),
    ).rejects.toThrow(/coluna telefone/);
    await expect(parseContacts(Buffer.from("x"), "a.exe")).rejects.toThrow(
      /CSV/,
    );
  });
});
