import type { Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sectorFromLotName } from "./event-sector-report";

export const buyerReportFields = {
  orderCode: "Número do pedido",
  ticketCode: "Código do ingresso",
  buyerName: "Nome do comprador",
  buyerEmail: "E-mail do comprador",
  buyerPhone: "Telefone do comprador",
  buyerCpf: "CPF do comprador",
  participantName: "Nome do participante",
  participantEmail: "E-mail do participante",
  participantPhone: "Telefone do participante",
  participantCpf: "CPF do participante",
  ticketType: "Ingresso / categoria",
  sector: "Setor",
  admissionQuantity: "Ingressos nesta linha",
  quantityInOrder: "Quantidade no pedido",
  ticketStatus: "Status do ingresso",
  paidAt: "Data da compra"
} as const;

export type BuyerReportField = keyof typeof buyerReportFields;
export type BuyerReportStatus = "valid" | "used" | "all";
export type BuyerReportFilters = {
  lotId?: string;
  search?: string;
  status: BuyerReportStatus;
  fields: BuyerReportField[];
};

export const defaultBuyerReportFields: BuyerReportField[] = [
  "orderCode", "buyerName", "buyerEmail", "buyerPhone", "participantName",
  "ticketType", "sector", "admissionQuantity"
];

const ticketSelect = {
  id: true,
  code: true,
  status: true,
  lotId: true,
  lot: { select: { name: true } },
  lotOption: { select: { label: true } },
  participant: { select: { name: true, email: true, phone: true, document: true } },
  orderItem: { select: { quantity: true, admissionsPerUnit: true } },
  order: {
    select: {
      code: true,
      paidAt: true,
      customer: { select: { name: true, email: true, phone: true, document: true } }
    }
  }
} satisfies Prisma.TicketSelect;

export type BuyerReportTicket = Prisma.TicketGetPayload<{ select: typeof ticketSelect }>;

export function parseBuyerReportFilters(params: URLSearchParams): BuyerReportFilters {
  const requested = params.getAll("fields");
  const validFields = requested.filter((field): field is BuyerReportField => field in buyerReportFields);
  const status = params.get("status");
  return {
    lotId: params.get("lotId")?.trim().slice(0, 100) || undefined,
    search: params.get("search")?.trim().slice(0, 100) || undefined,
    status: status === "used" || status === "all" ? status : "valid",
    fields: validFields.length ? [...new Set(validFields)] : defaultBuyerReportFields
  };
}

export function buyerReportWhere(eventId: string, filters: BuyerReportFilters): Prisma.TicketWhereInput {
  const search = filters.search;
  return {
    eventId,
    order: {
      status: "PAID",
      // A provider refund can be recorded before the order/tickets finish changing state.
      // Never expose that purchase as an active sale in this report during that window.
      OR: [{ payment: null }, { payment: { status: { not: "REFUNDED" } } }]
    },
    ...(filters.lotId ? { lotId: filters.lotId } : {}),
    ...(filters.status === "valid" ? { status: { in: ["ACTIVE", "USED"] as TicketStatus[] } } : {}),
    ...(filters.status === "used" ? { status: "USED" as TicketStatus } : {}),
    ...(search ? {
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { order: { code: { contains: search, mode: "insensitive" } } },
        { order: { customer: { name: { contains: search, mode: "insensitive" } } } },
        { order: { customer: { email: { contains: search, mode: "insensitive" } } } },
        { order: { customer: { phone: { contains: search } } } },
        { order: { customer: { document: { contains: search } } } },
        { participant: { name: { contains: search, mode: "insensitive" } } },
        { participant: { email: { contains: search, mode: "insensitive" } } },
        { participant: { phone: { contains: search } } },
        { participant: { document: { contains: search } } }
      ]
    } : {})
  };
}

export async function listEventBuyerTickets(eventId: string, filters: BuyerReportFilters, page: number, pageSize = 50) {
  const where = buyerReportWhere(eventId, filters);
  const [total, tickets] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      select: ticketSelect,
      orderBy: [{ order: { paidAt: "desc" } }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);
  return { total, tickets };
}

export async function* iterateEventBuyerTickets(eventId: string, filters: BuyerReportFilters) {
  const where = buyerReportWhere(eventId, filters);
  let cursor: string | undefined;
  while (true) {
    const batch = await prisma.ticket.findMany({
      where,
      select: ticketSelect,
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 500
    });
    if (!batch.length) break;
    yield batch;
    cursor = batch[batch.length - 1].id;
    if (batch.length < 500) break;
  }
}

export function buyerReportCell(ticket: BuyerReportTicket, field: BuyerReportField) {
  const buyer = ticket.order.customer;
  const participant = ticket.participant;
  switch (field) {
    case "orderCode": return ticket.order.code;
    case "ticketCode": return ticket.code;
    case "buyerName": return buyer.name;
    case "buyerEmail": return buyer.email;
    case "buyerPhone": return buyer.phone || "";
    case "buyerCpf": return buyer.document || "";
    case "participantName": return participant?.name || "";
    case "participantEmail": return participant?.email || "";
    case "participantPhone": return participant?.phone || "";
    case "participantCpf": return participant?.document || "";
    case "ticketType": return ticket.lotOption?.label ? `${ticket.lot.name} — ${ticket.lotOption.label}` : ticket.lot.name;
    case "sector": return sectorFromLotName(ticket.lot.name);
    case "admissionQuantity": return "1";
    case "quantityInOrder": return String(ticket.orderItem.quantity * Math.max(ticket.orderItem.admissionsPerUnit, 1));
    case "ticketStatus": return ticket.status === "ACTIVE" ? "Válido" : ticket.status === "USED" ? "Utilizado" : ticket.status === "CANCELED" ? "Cancelado" : "Inválido";
    case "paidAt": return ticket.order.paidAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(ticket.order.paidAt) : "";
  }
}

export function csvCell(value: string) {
  // Keep names, phones and documents from being interpreted as spreadsheet formulas.
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buyerReportCsvLine(values: string[]) {
  return `${values.map(csvCell).join(";")}\r\n`;
}
