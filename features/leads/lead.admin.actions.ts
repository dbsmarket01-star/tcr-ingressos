"use server";

import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicBaseUrl } from "@/lib/public-url";
import { redirect } from "next/navigation";
import {
  canAccessArea,
  getAdminAllowedEventIds,
  requireAdmin,
  requireEventAccess,
  requirePermission,
  type CurrentAdmin
} from "@/features/auth/auth.service";
import { sendLeadBroadcastEmail } from "@/features/email/email.service";
import { getEventForManagement } from "@/features/events/event.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import { processLeadEmailCampaignInBackground } from "@/features/leads/lead-email-campaign-processor.service";
import { savePublicImageUpload } from "@/features/uploads/local-upload.service";
import {
  IMPORTED_LEAD_MEDIUM,
  IMPORTED_LEAD_SOURCE,
  listEventLeadsForBroadcast,
  normalizeImportedLeadListName,
  reconcileInvalidLeadEmailCampaigns
} from "@/features/leads/lead.service";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";

function splitIntoBatches<T>(items: T[], size: number) {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

function normalizeDestinationUrl(value: string, fallbackUrl?: string | null) {
  const text = value.trim();

  if (!text) {
    return fallbackUrl?.trim() || null;
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (text.startsWith("www.")) {
    return `https://${text}`;
  }

  return `https://${text}`;
}

async function requireLeadMarketingAccess() {
  const admin = await requireAdmin();

  if (!canAccessArea(admin.role, "MARKETING") && !canAccessArea(admin.role, "EVENTS")) {
    redirect("/admin");
  }

  return admin;
}

async function getManagedEventOrRedirect(eventId: string, admin: CurrentAdmin, anchor: "lead-broadcast" | "lead-import") {
  await requireEventAccess(eventId);
  const event = await getEventForManagement(eventId, admin.organizationId!, getAdminAllowedEventIds(admin));

  if (!event) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("Evento não encontrado.")}#${anchor}`);
  }

  return event;
}

function normalizeBodySignature(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseMunicipalityFilters(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBrazilDateStart(value: string) {
  return value ? new Date(`${value}T00:00:00-03:00`) : null;
}

function parseBrazilDateEnd(value: string) {
  return value ? new Date(`${value}T23:59:59.999-03:00`) : null;
}

function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

function sanitizeImportedPhone(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.startsWith("00") && digits.length > 4) {
    return digits.slice(2);
  }

  if (digits.length <= 11) {
    return `55${digits}`;
  }

  return digits;
}

function splitImportedColumns(row: string) {
  const delimiter = row.includes("\t") ? "\t" : (row.match(/;/g)?.length ?? 0) >= (row.match(/,/g)?.length ?? 0) ? ";" : ",";
  const columns: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (const char of row) {
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

function normalizeImportedHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getImportedHeaderIndexes(columns: string[]) {
  const normalized = columns.map(normalizeImportedHeader);
  const email = normalized.findIndex((column) => column === "email" || column === "e-mail" || column === "correioeletronico");
  const name = normalized.findIndex((column) => ["nome", "nomecompleto", "cliente", "contato"].includes(column));
  const phone = normalized.findIndex((column) => ["telefone", "celular", "whatsapp", "fone"].includes(column));
  const municipality = normalized.findIndex((column) => ["cidade", "municipio", "localidade"].includes(column));

  if (email === -1) {
    return null;
  }

  return {
    email,
    name: name === -1 ? null : name,
    phone: phone === -1 ? null : phone,
    municipality: municipality === -1 ? null : municipality
  };
}

function getIndexedColumn(columns: string[], index?: number | null) {
  return typeof index === "number" && index >= 0 ? columns[index]?.trim() || "" : "";
}

function parseImportedLeadRows(rawText: string) {
  const rows = rawText
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  const parsedRows: Array<{ name: string; email: string; phone?: string | null; municipality?: string | null }> = [];
  const invalidRows: string[] = [];
  const seenEmails = new Set<string>();
  let duplicateRows = 0;
  let headerIndexes: ReturnType<typeof getImportedHeaderIndexes> = null;

  for (const [index, row] of rows.entries()) {
    const columns = splitImportedColumns(row);

    if (index === 0) {
      headerIndexes = getImportedHeaderIndexes(columns);

      if (headerIndexes) {
        continue;
      }
    }

    const emailColumnIndex = headerIndexes?.email ?? columns.findIndex((column) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(column));

    if (emailColumnIndex === -1) {
      invalidRows.push(`linha ${index + 1}`);
      continue;
    }

    const email = normalizeEmailAddress(columns[emailColumnIndex]);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalidRows.push(`linha ${index + 1}`);
      continue;
    }

    if (seenEmails.has(email)) {
      duplicateRows += 1;
      continue;
    }

    seenEmails.add(email);

    const name =
      getIndexedColumn(columns, headerIndexes?.name) ||
      columns[emailColumnIndex === 0 ? 1 : 0] ||
      email.split("@")[0] ||
      "Contato importado";
    const phone =
      getIndexedColumn(columns, headerIndexes?.phone) ||
      columns.find((column, columnIndex) => columnIndex !== emailColumnIndex && column.replace(/\D/g, "").length >= 8);
    const municipality =
      getIndexedColumn(columns, headerIndexes?.municipality) ||
      columns.find(
        (column, columnIndex) =>
          columnIndex !== emailColumnIndex &&
          column !== name &&
          column !== phone &&
          column.length >= 2 &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(column)
      );

    parsedRows.push({
      name: name.trim().replace(/\s+/g, " ").slice(0, 160),
      email,
      phone: sanitizeImportedPhone(phone),
      municipality: municipality?.trim().replace(/\s+/g, " ").slice(0, 120) || null
    });
  }

  return {
    rows: parsedRows,
    invalidRows,
    duplicateRows,
    totalRows: rows.length
  };
}

async function readImportedLeadFileText(file: FormDataEntryValue | null) {
  if (!file || typeof file !== "object" || !("size" in file) || !("arrayBuffer" in file) || typeof file.arrayBuffer !== "function" || file.size <= 0) {
    return "";
  }

  const buffer = await file.arrayBuffer();

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("latin1").decode(buffer).replace(/^\uFEFF/, "");
  }
}

function buildScopeSummary({
  testRecipientEmail,
  municipalities,
  dateFrom,
  dateTo,
  importedListName,
  count
}: {
  testRecipientEmail?: string | null;
  municipalities: string[];
  dateFrom?: string;
  dateTo?: string;
  importedListName?: string | null;
  count: number;
}) {
  if (testRecipientEmail) {
    return `teste para ${testRecipientEmail}`;
  }

  const fragments: string[] = [`${count} lead(s)`];

  if (dateFrom && dateTo) {
    fragments.push(dateFrom === dateTo ? `dia ${dateFrom}` : `período ${dateFrom} a ${dateTo}`);
  } else if (dateFrom) {
    fragments.push(`a partir de ${dateFrom}`);
  } else if (dateTo) {
    fragments.push(`até ${dateTo}`);
  }

  if (municipalities.length > 0) {
    fragments.push(`município(s): ${municipalities.join(", ")}`);
  }

  if (importedListName) {
    fragments.push(`lista importada: ${importedListName}`);
  }

  if (fragments.length === 1) {
    fragments.push("todos os leads");
  }

  return fragments.join(" · ");
}

export async function sendLeadBroadcastAction(formData: FormData) {
  const admin = await requireLeadMarketingAccess();
  const organizationContext = await getCurrentOrganizationContext();
  const eventId = String(formData.get("eventId") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim();
  const destinationUrl = String(formData.get("destinationUrl") ?? "").trim();
  const instagramUrl = String(formData.get("instagramUrl") ?? "").trim() || null;
  const imageCrop = String(formData.get("imageCrop") ?? "").trim() || null;
  const imageWidth = Number(formData.get("imageFileWidth") ?? 0) || null;
  const imageHeight = Number(formData.get("imageFileHeight") ?? 0) || null;
  const dateFrom = String(formData.get("dateFrom") ?? "").trim();
  const dateTo = String(formData.get("dateTo") ?? "").trim();
  const municipalities = parseMunicipalityFilters(String(formData.get("municipalities") ?? ""));
  const importedListName = normalizeImportedLeadListName(String(formData.get("importedListName") ?? ""));
  const testRecipientEmail = normalizeEmailAddress(String(formData.get("testRecipientEmail") ?? ""));

  if (!eventId) {
    redirect("/admin/events?error=Evento%20nao%20informado.");
  }

  const event = await getManagedEventOrRedirect(eventId, admin, "lead-broadcast");

  if (subject.length < 4 || body.length < 12) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("Preencha assunto e mensagem com um conteúdo mais completo.")}`);
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("A data inicial não pode ser maior do que a data final.")}#lead-broadcast`);
  }

  if (testRecipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRecipientEmail)) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("Informe um e-mail de teste válido.")}#lead-broadcast`);
  }

  let imageUrl: string | null = null;

  try {
    imageUrl = await savePublicImageUpload(
      formData.get("imageFile") as File | null,
      `events/${event.slug}/lead-broadcast`
    );
  } catch (error) {
    redirect(
      `/admin/events/${eventId}/leads?error=${encodeURIComponent(
        getFriendlyErrorMessage(error, "Não foi possível salvar a imagem do e-mail.")
      )}`
    );
  }

  const leads = await listEventLeadsForBroadcast(event.id, {
    dateFrom: parseBrazilDateStart(dateFrom),
    dateTo: parseBrazilDateEnd(dateTo),
    municipalities,
    importedListName
  });
  const companySettings = await getCompanySettingsByOrganizationId(admin.organizationId!);
  const normalizedDestinationUrl = normalizeDestinationUrl(destinationUrl, event.leadCaptureWhatsappGroupUrl);

  if (!normalizedDestinationUrl) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("Informe um link de destino válido para o e-mail.")}`);
  }

  const publicBaseUrl = getPublicBaseUrl({
    publicDomain: organizationContext.organization.publicDomain
  });
  const scopeSummary = buildScopeSummary({
    testRecipientEmail: testRecipientEmail || null,
    municipalities,
    dateFrom,
    dateTo,
    importedListName,
    count: leads.length
  });

  if (testRecipientEmail) {
    const matchedLead = leads.find((lead) => normalizeEmailAddress(lead.email) === testRecipientEmail);

    await sendLeadBroadcastEmail({
      to: testRecipientEmail,
      name: matchedLead?.name || "Teste",
      subject,
      body,
      imageUrl,
      imageCrop,
      imageWidth,
      imageHeight,
      publicBaseUrl,
      brandLogoUrl: organizationContext.brandLogoUrl,
      brandName: organizationContext.brandName,
      brandPrimaryColor: organizationContext.organization.primaryColor,
      organization: organizationContext.organization,
      eventTitle: event.title,
      ctaLabel: ctaLabel || "Abrir link",
      ctaUrl: normalizedDestinationUrl,
      instagramUrl,
      supportEmail: companySettings.supportEmail
    });

    redirect(
      `/admin/events/${eventId}/leads?sent=1&mode=test&scope=${encodeURIComponent(scopeSummary)}#lead-broadcast`
    );
  }

  if (leads.length === 0) {
    redirect(
      `/admin/events/${eventId}/leads?error=${encodeURIComponent(
        "Nenhum lead encontrado para os filtros informados."
      )}#lead-broadcast`
    );
  }

  const hasScopedFilters = Boolean(dateFrom || dateTo || municipalities.length > 0 || importedListName);
  await reconcileInvalidLeadEmailCampaigns(event.id);
  const activeCampaign = await prisma.leadEmailCampaign.findFirst({
    where: {
      eventId: event.id,
      status: {
        in: ["QUEUED", "PROCESSING"]
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true
    }
  });

  if (activeCampaign) {
    redirect(
      `/admin/events/${eventId}/leads?error=${encodeURIComponent(
        "Já existe um disparo em processamento para este evento. Aguarde a conclusão antes de iniciar outro."
      )}#lead-broadcast`
    );
  }

  if (!hasScopedFilters) {
    const recentDuplicateWindow = new Date(Date.now() - 3 * 60 * 1000);
    const duplicateCampaign = await prisma.leadEmailCampaign.findFirst({
      where: {
        eventId: event.id,
        subject,
        body: normalizeBodySignature(body),
        destinationUrl: normalizedDestinationUrl,
        ctaLabel: ctaLabel || null,
        createdAt: {
          gte: recentDuplicateWindow
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (duplicateCampaign) {
      redirect(
        `/admin/events/${eventId}/leads?error=${encodeURIComponent(
          "Encontramos um disparo idêntico feito há poucos minutos. Aguarde um pouco antes de enviar de novo."
        )}#lead-broadcast`
      );
    }
  }

  const campaign = await prisma.leadEmailCampaign.create({
    data: {
      eventId: event.id,
      subject,
      body: normalizeBodySignature(body),
      imageUrl,
      imageCrop,
      imageWidth,
      imageHeight,
      ctaLabel: ctaLabel || null,
      destinationUrl: normalizedDestinationUrl,
      instagramUrl,
      totalCount: leads.length,
      status: "QUEUED"
    }
  });

  const recipientBatches = splitIntoBatches(
    leads.map((lead) => ({
      campaignId: campaign.id,
      leadId: lead.id,
      email: lead.email,
      name: lead.name
    })),
    1000
  );

  for (const batch of recipientBatches) {
    await prisma.leadEmailCampaignRecipient.createMany({
      data: batch
    });
  }

  after(async () => {
    try {
      await processLeadEmailCampaignInBackground(campaign.id);
    } catch (error) {
      console.error("[lead-email] Falha no processamento em segundo plano", {
        campaignId: campaign.id,
        error
      });
      await prisma.leadEmailCampaign.updateMany({
        where: {
          id: campaign.id,
          status: {
            in: ["QUEUED", "PROCESSING"]
          }
        },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          lastError: getFriendlyErrorMessage(error, "Falha ao processar disparo de e-mail.")
        }
      });
    }
  });

  redirect(
    `/admin/events/${eventId}/leads?queued=${campaign.id}&scope=${encodeURIComponent(scopeSummary)}#lead-broadcast`
  );
}

export async function importLeadListAction(formData: FormData) {
  const admin = await requireLeadMarketingAccess();
  const eventId = String(formData.get("eventId") ?? "").trim();
  const listName = normalizeImportedLeadListName(String(formData.get("importListName") ?? ""));
  const pastedList = String(formData.get("leadListText") ?? "").trim();
  const file = formData.get("leadListFile");

  if (!eventId) {
    redirect("/admin/events?error=Evento%20nao%20informado.");
  }

  const event = await getManagedEventOrRedirect(eventId, admin, "lead-import");

  if (listName.length < 3) {
    redirect(
      `/admin/events/${eventId}/leads?importError=${encodeURIComponent(
        "Dê um nome para a lista importada. Ex.: Lista anuncio agosto."
      )}#lead-import`
    );
  }

  const fileText = await readImportedLeadFileText(file);
  const rawText = [pastedList, fileText].filter(Boolean).join("\n");

  if (!rawText.trim()) {
    redirect(
      `/admin/events/${eventId}/leads?importError=${encodeURIComponent(
        "Cole os contatos ou selecione um arquivo CSV/TXT para importar."
      )}#lead-import`
    );
  }

  const { rows, invalidRows, duplicateRows, totalRows } = parseImportedLeadRows(rawText);

  if (rows.length === 0) {
    redirect(
      `/admin/events/${eventId}/leads?importError=${encodeURIComponent(
        "Nenhum e-mail válido foi encontrado na lista enviada."
      )}#lead-import`
    );
  }

  if (rows.length > 5000) {
    redirect(
      `/admin/events/${eventId}/leads?importError=${encodeURIComponent(
        "Importe no máximo 5.000 contatos por vez para manter o disparo seguro."
      )}#lead-import`
    );
  }

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await prisma.eventLead.findUnique({
      where: {
        eventId_email: {
          eventId: event.id,
          email: row.email
        }
      },
      select: {
        id: true
      }
    });

    await prisma.eventLead.upsert({
      where: {
        eventId_email: {
          eventId: event.id,
          email: row.email
        }
      },
      update: {
        name: row.name,
        phone: row.phone,
        municipality: row.municipality,
        utmSource: IMPORTED_LEAD_SOURCE,
        utmMedium: IMPORTED_LEAD_MEDIUM,
        utmCampaign: listName,
        landingPage: "importacao-manual"
      },
      create: {
        eventId: event.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        municipality: row.municipality,
        utmSource: IMPORTED_LEAD_SOURCE,
        utmMedium: IMPORTED_LEAD_MEDIUM,
        utmCampaign: listName,
        landingPage: "importacao-manual"
      }
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  redirect(
    `/admin/events/${eventId}/leads?imported=1&importList=${encodeURIComponent(listName)}&importRecognized=${rows.length}&importCreated=${created}&importUpdated=${updated}&importInvalid=${invalidRows.length}&importDuplicate=${duplicateRows}&importTotal=${totalRows}#lead-import`
  );
}

export async function saveLeadBroadcastTemplateAction(formData: FormData) {
  const admin = await requirePermission("EVENTS");
  const eventId = String(formData.get("eventId") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!eventId) {
    redirect("/admin/events?error=Evento%20nao%20informado.");
  }

  await requireEventAccess(eventId);
  const event = await getEventForManagement(eventId, admin.organizationId!, getAdminAllowedEventIds(admin));

  if (!event) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("Evento não encontrado.")}#lead-broadcast`);
  }

  if (subject.length < 4 || body.length < 12) {
    redirect(
      `/admin/events/${eventId}/leads?templateError=${encodeURIComponent(
        "Preencha assunto e mensagem antes de salvar o modelo."
      )}#lead-broadcast`
    );
  }

  const existingMatch = await prisma.leadEmailTemplate.findFirst({
    where: {
      eventId: event.id,
      subject
    }
  });

  if (existingMatch) {
    await prisma.leadEmailTemplate.update({
      where: {
        id: existingMatch.id
      },
      data: {
        body
      }
    });

    redirect(`/admin/events/${eventId}/leads?templateSaved=1#lead-broadcast`);
  }

  const count = await prisma.leadEmailTemplate.count({
    where: {
      eventId: event.id
    }
  });

  if (count >= 3) {
    redirect(
      `/admin/events/${eventId}/leads?templateError=${encodeURIComponent(
        "Você já salvou 3 modelos. Apague um antes de criar outro."
      )}#lead-broadcast`
    );
  }

  await prisma.leadEmailTemplate.create({
    data: {
      eventId: event.id,
      subject,
      body
    }
  });

  redirect(`/admin/events/${eventId}/leads?templateSaved=1#lead-broadcast`);
}

export async function deleteLeadBroadcastTemplateAction(formData: FormData) {
  const admin = await requirePermission("EVENTS");
  const eventId = String(formData.get("eventId") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "").trim();

  if (!eventId || !templateId) {
    redirect("/admin/events?error=Modelo%20nao%20informado.");
  }

  await requireEventAccess(eventId);
  const event = await getEventForManagement(eventId, admin.organizationId!, getAdminAllowedEventIds(admin));

  if (!event) {
    redirect(`/admin/events/${eventId}/leads?error=${encodeURIComponent("Evento não encontrado.")}#lead-broadcast`);
  }

  await prisma.leadEmailTemplate.deleteMany({
    where: {
      id: templateId,
      eventId: event.id
    }
  });

  redirect(`/admin/events/${eventId}/leads?templateDeleted=1#lead-broadcast`);
}
