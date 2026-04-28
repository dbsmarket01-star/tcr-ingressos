import type { ReactNode } from "react";

type PublicSiteFooterProps = {
  brandName: string;
  settings: {
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    youtubeUrl?: string | null;
    whatsappUrl?: string | null;
    supportEmail?: string | null;
  };
};

function InstagramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M13.2 20V12.8H15.7L16.1 9.9H13.2V8.1C13.2 7.2 13.5 6.6 14.8 6.6H16.2V4.1C15.9 4.1 14.9 4 13.8 4C11.4 4 9.9 5.5 9.9 8.1V9.9H7.5V12.8H9.9V20H13.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12C21 9.9 20.8 8.5 20.5 7.7C20.2 6.8 19.5 6.1 18.6 5.8C17.8 5.5 16.4 5.3 14.3 5.3H9.7C7.6 5.3 6.2 5.5 5.4 5.8C4.5 6.1 3.8 6.8 3.5 7.7C3.2 8.5 3 9.9 3 12C3 14.1 3.2 15.5 3.5 16.3C3.8 17.2 4.5 17.9 5.4 18.2C6.2 18.5 7.6 18.7 9.7 18.7H14.3C16.4 18.7 17.8 18.5 18.6 18.2C19.5 17.9 20.2 17.2 20.5 16.3C20.8 15.5 21 14.1 21 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M10.4 15.4V8.6L15.9 12L10.4 15.4Z" fill="currentColor" />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 4.2C7.7 4.2 4.2 7.6 4.2 11.9C4.2 13.4 4.6 14.8 5.4 16L4.5 19.7L8.3 18.8C9.4 19.5 10.7 19.9 12 19.9C16.3 19.9 19.8 16.5 19.8 12.2C19.8 7.9 16.3 4.2 12 4.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9.4 8.7C9.1 8.7 8.8 8.8 8.6 9.2C8.3 9.7 8.1 10.2 8.1 10.7C8.1 11.4 8.4 12.1 8.9 12.8C9.7 14 10.9 15 12.3 15.6C12.9 15.9 13.5 16.1 14.1 16.1C14.7 16.1 15.2 15.9 15.7 15.6C16 15.4 16.1 15.1 16.1 14.8V14.2C16.1 14 16 13.8 15.7 13.7L14.2 13C14 12.9 13.8 13 13.7 13.2L13.1 14C13 14.1 12.8 14.2 12.6 14.1C11.8 13.8 10.6 12.8 10.2 12C10.1 11.8 10.1 11.6 10.3 11.5L10.9 11C11.1 10.8 11.2 10.6 11.1 10.4L10.5 9C10.3 8.8 10 8.7 9.7 8.7H9.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PublicSiteFooter({ brandName, settings }: PublicSiteFooterProps) {
  const socialLinks = [
    settings.instagramUrl ? { label: "Instagram", href: settings.instagramUrl, icon: <InstagramIcon /> } : null,
    settings.facebookUrl ? { label: "Facebook", href: settings.facebookUrl, icon: <FacebookIcon /> } : null,
    settings.youtubeUrl ? { label: "YouTube", href: settings.youtubeUrl, icon: <YoutubeIcon /> } : null,
    settings.whatsappUrl ? { label: "WhatsApp", href: settings.whatsappUrl, icon: <WhatsappIcon /> } : null
  ].filter(Boolean) as Array<{ label: string; href: string; icon: ReactNode }>;

  if (socialLinks.length === 0 && !settings.supportEmail) {
    return null;
  }

  return (
    <footer className="publicSiteFooter">
      <div className="container publicSiteFooterInner">
        <div className="publicSiteFooterBrand">
          <strong>{brandName}</strong>
          <span>{settings.supportEmail || "Siga nossas redes oficiais para avisos e novidades."}</span>
        </div>
        {socialLinks.length > 0 ? (
          <div className="publicSiteFooterSocials" aria-label="Redes sociais oficiais">
            {socialLinks.map((item) => (
              <a key={item.label} href={item.href} target="_blank" rel="noreferrer noopener" aria-label={item.label}>
                {item.icon}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
