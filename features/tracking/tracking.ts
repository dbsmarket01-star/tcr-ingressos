export type TrackingParams = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPage?: string;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function clean(value: string | string[] | undefined) {
  const text = firstParam(value)?.trim();
  return text ? text.slice(0, 240) : undefined;
}

export function getTrackingParamsFromSearch(
  searchParams: Record<string, string | string[] | undefined>,
  landingPath: string
): TrackingParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    const firstValue = firstParam(value);

    if (firstValue) {
      params.set(key, firstValue);
    }
  }

  const queryString = params.toString();

  return {
    utmSource: clean(searchParams.utm_source),
    utmMedium: clean(searchParams.utm_medium),
    utmCampaign: clean(searchParams.utm_campaign),
    utmContent: clean(searchParams.utm_content),
    utmTerm: clean(searchParams.utm_term),
    referrer: clean(searchParams.ref),
    landingPage: queryString ? `${landingPath}?${queryString}` : landingPath
  };
}

function normalizeSourceName(source?: string | null) {
  const value = source?.trim().toLowerCase();

  if (!value) {
    return "Direto";
  }

  if (["ig", "insta", "instagram"].includes(value)) {
    return "Instagram";
  }

  if (["fb", "face", "facebook", "meta"].includes(value)) {
    return "Facebook";
  }

  if (["google", "gads", "googleads", "adwords"].includes(value)) {
    return "Google";
  }

  if (["yt", "youtube"].includes(value)) {
    return "YouTube";
  }

  if (["wa", "wpp", "whatsapp"].includes(value)) {
    return "WhatsApp";
  }

  if (["email", "e-mail", "mail"].includes(value)) {
    return "E-mail";
  }

  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeMediumCategory(medium?: string | null) {
  const value = medium?.trim().toLowerCase();

  if (!value) {
    return "orgânico";
  }

  if (
    /(paid|cpc|ppc|ads?|adset|campaign|sponsored|paid_social|social_paid|boost)/.test(value)
  ) {
    return "anúncio";
  }

  if (/(email|newsletter)/.test(value)) {
    return "e-mail";
  }

  if (/(referral|partner|affiliate)/.test(value)) {
    return "parceria";
  }

  if (/(organic|seo|social|direct|direto)/.test(value)) {
    return "orgânico";
  }

  return value;
}

export function getLeadOriginBucket(source?: string | null, medium?: string | null) {
  const category = normalizeMediumCategory(medium);

  if (category === "anúncio") {
    return "Anúncio";
  }

  if (category === "e-mail") {
    return "E-mail";
  }

  if (category === "parceria") {
    return "Parceria";
  }

  if (!source && !medium) {
    return "Orgânico";
  }

  return "Orgânico";
}

export function getSourceLabel(source?: string | null, medium?: string | null) {
  const sourceLabel = normalizeSourceName(source);
  const mediumLabel = normalizeMediumCategory(medium);

  if (!source && !medium) {
    return "Direto / orgânico";
  }

  return `${sourceLabel} / ${mediumLabel}`;
}
