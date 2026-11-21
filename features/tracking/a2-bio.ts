export const A2_BIO_CAMPAIGNS = {
  geral: { campaign: "bio_a2_geral", destination: "/" },
  gramado: { campaign: "bio_a2_gramado_2027", destination: "/evento/a2-imergidos-gramado-2027" }
} as const;

export type A2BioLink = keyof typeof A2_BIO_CAMPAIGNS;

export function getA2BioDestination(requestUrl: string, link: A2BioLink) {
  const config = A2_BIO_CAMPAIGNS[link];
  const destination = new URL(config.destination, requestUrl);
  destination.searchParams.set("utm_source", "instagram");
  destination.searchParams.set("utm_medium", "organic_social");
  destination.searchParams.set("utm_campaign", config.campaign);
  destination.searchParams.set("utm_content", "perfil_a2");
  return destination;
}
