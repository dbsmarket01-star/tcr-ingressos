import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicSiteFooter } from "@/components/public/PublicSiteFooter";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getCompanySettingsByOrganizationId } from "@/features/settings/company-settings.service";
import {
  getFooterInfoContent,
  getFooterInfoItem,
  getFooterInfoTitle,
  type FooterContentSettings
} from "@/features/settings/footer-content";

export const dynamic = "force-dynamic";

type InfoPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function getParagraphs(content: string) {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export async function generateMetadata({ params }: InfoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const organizationContext = await getCurrentOrganizationContext();
  const companySettings = await getCompanySettingsByOrganizationId(organizationContext.organization.id);
  const settings = companySettings as typeof companySettings & FooterContentSettings;
  const item = getFooterInfoItem(slug);

  if (!item) {
    return {
      title: `Informação não encontrada | ${organizationContext.brandName}`
    };
  }

  return {
    title: `${getFooterInfoTitle(settings, slug)} | ${organizationContext.brandName}`
  };
}

export default async function PublicInfoPage({ params }: InfoPageProps) {
  const { slug } = await params;
  const item = getFooterInfoItem(slug);

  if (!item) {
    notFound();
  }

  const organizationContext = await getCurrentOrganizationContext();
  const companySettings = await getCompanySettingsByOrganizationId(organizationContext.organization.id);
  const settings = companySettings as typeof companySettings & FooterContentSettings & {
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    youtubeUrl?: string | null;
    whatsappUrl?: string | null;
    supportEmail?: string | null;
  };
  const title = getFooterInfoTitle(settings, slug) || item.label;
  const content = getFooterInfoContent(settings, slug) || "";
  const paragraphs = getParagraphs(content);
  const fallbackText = `Este conteúdo ainda está sendo organizado pela equipe da ${organizationContext.brandName}.`;

  return (
    <main className="shell publicInfoShell">
      <header className="topbar">
        <Link className="brand" href="/">
          {organizationContext.brandLogoUrl ? (
            <img alt={organizationContext.brandName} className="brandLogo" src={organizationContext.brandLogoUrl} />
          ) : (
            <span className="brandMark">{organizationContext.brandMark}</span>
          )}
          {!organizationContext.brandLogoUrl ? <span>{organizationContext.brandName}</span> : null}
        </Link>
        <nav className="nav" aria-label="Navegação">
          <Link href="/">Eventos</Link>
        </nav>
      </header>

      <section className="container publicInfoPage">
        <Link className="checkoutBackLink" href="/">
          Voltar para eventos
        </Link>
        <article className="publicInfoCard">
          <span className="eyebrow">{item.label}</span>
          <h1>{title}</h1>
          {paragraphs.length > 0 ? (
            <div className="publicInfoContent">
              {paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <div className="publicInfoContent">
              <p>{fallbackText}</p>
              {settings.supportEmail ? (
                <p>
                  Para falar com a equipe, envie um e-mail para{" "}
                  <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>.
                </p>
              ) : null}
            </div>
          )}
        </article>
      </section>

      <PublicSiteFooter
        brandName={organizationContext.brandName}
        supportPhone={organizationContext.organization.supportPhone}
        settings={settings}
      />
    </main>
  );
}
