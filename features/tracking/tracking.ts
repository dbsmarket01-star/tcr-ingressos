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

export function getSourceLabel(source?: string | null, medium?: string | null) {
  if (!source && !medium) {
    return "Direto/organico";
  }

  if (source && medium) {
    return `${source} / ${medium}`;
  }

  return source || medium || "Direto/organico";
}
