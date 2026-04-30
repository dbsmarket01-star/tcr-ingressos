import Script from "next/script";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLeadCaptureEventBySlug } from "@/features/leads/lead.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getTrackingParamsFromSearch } from "@/features/tracking/tracking";
import { LeadCaptureTrackingRuntime } from "../LeadCaptureTrackingRuntime";

type LeadCaptureThankYouPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function LeadCaptureThankYouPage({ params, searchParams }: LeadCaptureThankYouPageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const organizationContext = await getCurrentOrganizationContext();
  const event = await getLeadCaptureEventBySlug(slug, organizationContext.organization.id);

  if (!event) {
    notFound();
  }

  const title = event.leadCaptureThankYouTitle || "Seu cadastro foi concluído";
  const description =
    event.leadCaptureThankYouDescription ||
    "Último passo: entre no grupo oficial para receber um desconto de até 30% e acompanhar as informações deste lançamento.";
  const buttonText = event.leadCaptureThankYouButtonText || "Quero entrar no grupo do WhatsApp";
  const tracking = getTrackingParamsFromSearch(query, `/lista/${event.slug}/obrigado`);

  return (
    <main className="shell leadCaptureThanksShell">
      {event.googleTagManagerId ? (
        <>
          <Script id="lead-thanks-gtm-script" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer',${JSON.stringify(event.googleTagManagerId)});
            `}
          </Script>
          <noscript>
            <iframe
              title="Google Tag Manager"
              src={`https://www.googletagmanager.com/ns.html?id=${event.googleTagManagerId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      ) : null}
      {event.metaPixelId ? (
        <Script id="lead-thanks-meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', ${JSON.stringify(event.metaPixelId)});
            fbq('track', 'PageView');
          `}
        </Script>
      ) : null}
      <LeadCaptureTrackingRuntime
        eventTitle={event.title}
        eventSlug={event.slug}
        metaPixelId={event.metaPixelId}
        googleTagManagerId={event.googleTagManagerId}
        tracking={tracking}
        mode="lead"
      />
      <section className="leadThankYouCard card">
        <span className="leadEyebrow">Cadastro confirmado</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="leadThankYouEvent">
          <strong>{event.title}</strong>
          <small>Seu nome já está na pré-lista. Agora falta só entrar no grupo para receber a abertura e as condições deste lançamento.</small>
        </div>
        <div className="leadThankYouChecklist">
          <div>
            <strong>Cadastro feito</strong>
            <small>Seu interesse já foi registrado.</small>
          </div>
          <div>
            <strong>Agora entre no grupo</strong>
            <small>É lá que você vai receber o desconto, a abertura e as orientações deste evento.</small>
          </div>
        </div>
        <div className="leadThankYouAction">
          {event.leadCaptureWhatsappGroupUrl ? (
            <a
              className="button fullButton whatsappGroupButton whatsappGroupButtonLarge"
              href={event.leadCaptureWhatsappGroupUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {buttonText}
            </a>
          ) : (
            <div className="infoBox">
              Adicione o link do grupo de WhatsApp na captação do evento para liberar este último passo.
            </div>
          )}
        </div>
        <small>Entre no grupo agora para não perder o aviso de abertura e as próximas instruções do evento.</small>
      </section>
    </main>
  );
}
