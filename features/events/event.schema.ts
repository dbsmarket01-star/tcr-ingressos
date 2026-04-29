import { z } from "zod";

const imageUrlSchema = z.string().url().optional().or(z.literal("")).or(z.string().startsWith("/uploads/"));
const imageCropSchema = z.string().max(120).optional();
const bannerPositionSchema = z
  .enum([
    "left top",
    "center 18%",
    "center 28%",
    "center top",
    "right top",
    "left center",
    "center center",
    "right center",
    "left bottom",
    "center bottom",
    "right bottom"
  ])
  .default("center center");
const eventMapTemplateSchema = z
  .enum(["AUTO", "AUDITORIUM", "THEATER", "WAREHOUSE", "CLUB", "FREE"])
  .default("AUTO");
const metaPixelIdSchema = z
  .string()
  .regex(/^\d{8,25}$/, "Meta Pixel ID deve conter apenas numeros.")
  .optional();
const metaConversionsApiTokenSchema = z
  .string()
  .min(20, "Token da API de conversao parece incompleto.")
  .max(400)
  .optional();
const metaTestEventCodeSchema = z
  .string()
  .regex(/^[A-Z0-9_-]{6,120}$/i, "Codigo de teste do Meta parece invalido.")
  .optional();
const googleTagManagerIdSchema = z
  .string()
  .regex(/^GTM-[A-Z0-9]{4,}$/i, "Google Tag Manager ID deve seguir o formato GTM-XXXXXXX.")
  .transform((value) => value.toUpperCase())
  .optional();
const supportWhatsappUrlSchema = z
  .string()
  .url("Link do WhatsApp deve ser uma URL valida.")
  .refine((value) => value.includes("wa.me") || value.includes("api.whatsapp.com"), {
    message: "Use um link do WhatsApp como wa.me ou api.whatsapp.com."
  })
  .optional();
const whatsappGroupUrlSchema = z
  .string()
  .url("Link do grupo de WhatsApp deve ser uma URL valida.")
  .refine((value) => value.includes("chat.whatsapp.com") || value.includes("wa.me") || value.includes("api.whatsapp.com"), {
    message: "Use um link de grupo ou convite do WhatsApp."
  })
  .optional();
const youtubeUrlSchema = z
  .string()
  .url("Link do vídeo deve ser uma URL válida.")
  .refine((value) => value.includes("youtube.com") || value.includes("youtu.be"), {
    message: "Use um link do YouTube."
  })
  .optional();

export const eventDraftSchema = z.object({
  title: z.string().min(3),
  slug: z.string().min(3).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  subtitle: z.string().optional(),
  description: z.string().max(5000).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  venueName: z.string().min(2),
  venueAddress: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2).max(2),
  salesStartsAt: z.coerce.date().optional(),
  salesEndsAt: z.coerce.date().optional(),
  bannerUrl: imageUrlSchema,
  bannerPosition: bannerPositionSchema,
  bannerCrop: imageCropSchema,
  eventMapImageUrl: imageUrlSchema,
  eventMapCrop: imageCropSchema,
  eventMapTemplate: eventMapTemplateSchema,
  eventMapNotes: z.string().max(500).optional(),
  importantInfo: z.string().optional(),
  metaPixelId: metaPixelIdSchema,
  metaConversionsApiToken: metaConversionsApiTokenSchema,
  metaTestEventCode: metaTestEventCodeSchema,
  googleTagManagerId: googleTagManagerIdSchema,
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(180).optional(),
  seoKeywords: z.string().max(300).optional(),
  seoImageUrl: imageUrlSchema,
  supportWhatsappUrl: supportWhatsappUrlSchema,
  leadCaptureEnabled: z.boolean().default(false),
  leadCaptureHeadline: z.string().max(120).optional(),
  leadCaptureDescription: z.string().max(600).optional(),
  leadCaptureOfferText: z.string().max(160).optional(),
  leadCaptureCtaText: z.string().max(80).optional(),
  leadCaptureHeroImageUrl: imageUrlSchema,
  leadCaptureHeroCrop: imageCropSchema,
  leadCaptureVenueGallery: z.string().max(5000).optional(),
  leadCaptureVideoUrl: youtubeUrlSchema,
  leadCaptureWhatsappGroupUrl: whatsappGroupUrlSchema,
  leadCaptureThankYouTitle: z.string().max(120).optional(),
  leadCaptureThankYouDescription: z.string().max(400).optional(),
  leadCaptureThankYouButtonText: z.string().max(80).optional(),
  conversionSocialProofText: z.string().max(120).optional(),
  conversionUrgencyText: z.string().max(140).optional(),
  conversionCtaText: z.string().max(60).optional(),
  highlightedLotId: z.string().optional()
});

export type EventDraftInput = z.infer<typeof eventDraftSchema>;
