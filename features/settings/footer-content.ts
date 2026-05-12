type FooterInfoTitleField =
  | "footerAboutTitle"
  | "footerHowItWorksTitle"
  | "footerTermsTitle"
  | "footerPrivacyTitle"
  | "footerHelpTitle"
  | "footerFaqTitle"
  | "footerContactTitle";

type FooterInfoContentField =
  | "footerAboutContent"
  | "footerHowItWorksContent"
  | "footerTermsContent"
  | "footerPrivacyContent"
  | "footerHelpContent"
  | "footerFaqContent"
  | "footerContactContent";

export type FooterInfoItem = {
  key: string;
  slug: string;
  label: string;
  titleField: FooterInfoTitleField;
  contentField: FooterInfoContentField;
};

export const footerInfoSections = [
  {
    title: "Institucional",
    items: [
      {
        key: "about",
        slug: "sobre-nos",
        label: "Sobre nós",
        titleField: "footerAboutTitle",
        contentField: "footerAboutContent"
      },
      {
        key: "howItWorks",
        slug: "como-funciona",
        label: "Como funciona",
        titleField: "footerHowItWorksTitle",
        contentField: "footerHowItWorksContent"
      },
      {
        key: "terms",
        slug: "termos-de-uso",
        label: "Termos de uso",
        titleField: "footerTermsTitle",
        contentField: "footerTermsContent"
      },
      {
        key: "privacy",
        slug: "privacidade",
        label: "Privacidade",
        titleField: "footerPrivacyTitle",
        contentField: "footerPrivacyContent"
      }
    ]
  },
  {
    title: "Ajuda",
    items: [
      {
        key: "help",
        slug: "central-de-ajuda",
        label: "Central de ajuda",
        titleField: "footerHelpTitle",
        contentField: "footerHelpContent"
      },
      {
        key: "faq",
        slug: "duvidas-frequentes",
        label: "Dúvidas frequentes",
        titleField: "footerFaqTitle",
        contentField: "footerFaqContent"
      },
      {
        key: "contact",
        slug: "contato",
        label: "Contato",
        titleField: "footerContactTitle",
        contentField: "footerContactContent"
      }
    ]
  }
] as const satisfies ReadonlyArray<{ title: string; items: ReadonlyArray<FooterInfoItem> }>;

export const footerInfoItems: FooterInfoItem[] = footerInfoSections.flatMap((section) => [...section.items]);

type FooterInfoTextField = FooterInfoItem["titleField"] | FooterInfoItem["contentField"];

export type FooterInfoSlug = FooterInfoItem["slug"];

export type FooterContentSettings = {
  footerDescription?: string | null;
} & {
  [field in FooterInfoTextField]?: string | null;
};

export function getFooterInfoItem(slug: string): FooterInfoItem | null {
  return footerInfoItems.find((item) => item.slug === slug) ?? null;
}

export function getFooterInfoTitle(settings: FooterContentSettings, slug: string) {
  const item = getFooterInfoItem(slug);

  if (!item) {
    return null;
  }

  return settings[item.titleField]?.trim() || item.label;
}

export function getFooterInfoContent(settings: FooterContentSettings, slug: string) {
  const item = getFooterInfoItem(slug);

  if (!item) {
    return null;
  }

  return settings[item.contentField]?.trim() || "";
}
