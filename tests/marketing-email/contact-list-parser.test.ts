import { describe, expect, it } from "vitest";
import { parseMarketingEmailContactList } from "@/features/marketing-email/contact-list-parser";

describe("marketing email contact list parser", () => {
  it("parses semicolon CSV with header and validates contacts", () => {
    const result = parseMarketingEmailContactList([
      "Nome completo;E-mail;Telefone",
      "Adriana Oliveira da Silva;Drycapereira18@yahoo.com.br;+55 (11) 96207-6614",
      "Contato Duplicado;drycapereira18@yahoo.com.br;+55 (11) 90000-0000",
      "Sem Email;;+55 (11) 91111-1111",
      "Email Ruim;email-invalido;+55 (11) 92222-2222"
    ].join("\n"));

    expect(result.contacts).toEqual([
      {
        email: "drycapereira18@yahoo.com.br",
        name: "Adriana Oliveira da Silva",
        phone: "+55 (11) 96207-6614"
      }
    ]);
    expect(result.totalRows).toBe(5);
    expect(result.recognized).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.invalidEmails).toBe(2);
    expect(result.ignored).toBe(4);
  });

  it("accepts pasted spreadsheet text separated by tabs", () => {
    const result = parseMarketingEmailContactList([
      "Nome completo\tE-mail\tTelefone",
      "Maria Silva\tmaria@example.com\t11999999999",
      "Joao Souza\tjoao@example.com\t11988888888"
    ].join("\n"));

    expect(result.recognized).toBe(2);
    expect(result.contacts.map((contact) => contact.email)).toEqual([
      "maria@example.com",
      "joao@example.com"
    ]);
  });

  it("does not require phone, city, or any extra column", () => {
    const result = parseMarketingEmailContactList([
      "Nome completo;E-mail",
      "Ana Contato;ana@example.com",
      "Bruno Contato;bruno@example.com"
    ].join("\n"));

    expect(result.recognized).toBe(2);
    expect(result.invalidEmails).toBe(0);
    expect(result.contacts).toEqual([
      {
        email: "ana@example.com",
        name: "Ana Contato",
        phone: null
      },
      {
        email: "bruno@example.com",
        name: "Bruno Contato",
        phone: null
      }
    ]);
  });
});
