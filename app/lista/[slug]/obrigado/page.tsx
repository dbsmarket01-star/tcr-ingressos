import Script from "next/script";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLeadCaptureEventBySlug } from "@/features/leads/lead.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";
import { getTrackingParamsFromSearch } from "@/features/tracking/tracking";
import { LeadCaptureTrackingRuntime } from "../LeadCaptureTrackingRuntime";
import { LeadThankYouTracker } from "./LeadThankYouTracker";
import { WhatsAppGroupRedirect } from "./WhatsAppGroupRedirect";

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
  const emptySearchParams: Record<string, string | string[] | undefined> = {};
  const [{ slug }, query, organizationContext] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(emptySearchParams),
    getCurrentOrganizationContext()
  ]);
  const event = await getLeadCaptureEventBySlug(slug, organizationContext.organization.id);

  if (!event) {
    notFound();
  }

  const buttonText = "ENTRAR AGORA NO GRUPO E GARANTIR 30% OFF";
  const leadEventId = typeof query.leid === "string" ? query.leid : null;
  const leadId = typeof query.lead === "string" ? query.lead : null;
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
        leadEventId={leadEventId}
      />
      <LeadThankYouTracker leadId={leadId} />
      <section className="leadThankYouCard card">
        <div className="leadThankYouCheckmark" aria-hidden="true">
          ✓
        </div>
        <h1 className="leadThankYouHeadline">
          <span>FALTA SÓ 1 PASSO PARA</span>
          <strong>GARANTIR SEU DESCONTO!</strong>
        </h1>
        <p className="leadThankYouSubheadline">Seu cadastro foi concluído com sucesso.</p>
        <div className="leadThankYouWarning">
          <span className="leadThankYouWarningIcon" aria-hidden="true">
            ⚠️
          </span>
          <div>
            <strong>ATENÇÃO:</strong> Se você sair desta página, pode perder o acesso ao grupo.
            <br />
            <span>Entre agora e garanta sua participação.</span>
          </div>
        </div>
        <div className="leadThankYouBenefits">
          <article>
            <span className="leadThankYouBenefitIcon" aria-hidden="true">
              %
            </span>
            <div>
              <strong>Receba até 30% de desconto</strong>
              <small>Desconto exclusivo para membros do grupo oficial.</small>
            </div>
          </article>
          <article>
            <span className="leadThankYouBenefitIcon" aria-hidden="true">
              ◔
            </span>
            <div>
              <strong>Acesso antecipado aos ingressos</strong>
              <small>Seja o primeiro a garantir o seu ingresso.</small>
            </div>
          </article>
          <article>
            <span className="leadThankYouBenefitIcon" aria-hidden="true">
              ★
            </span>
            <div>
              <strong>Prioridade antes da abertura oficial</strong>
              <small>Tenha prioridade e não fique de fora.</small>
            </div>
          </article>
        </div>
        {event.leadCaptureWhatsappGroupUrl ? (
          <WhatsAppGroupRedirect
            buttonText={buttonText}
            url={event.leadCaptureWhatsappGroupUrl}
            leadId={leadId}
            eventTitle={event.title}
          />
        ) : (
          <div className="leadThankYouAction">
            <div className="infoBox">
              Adicione o link do grupo de WhatsApp na captação do evento para liberar este último passo.
            </div>
          </div>
        )}
        <small className="leadThankYouClosing">
          🔒 O grupo pode ser fechado a qualquer momento após atingir o limite de vagas.
        </small>
      </section>
    </main>
  );
}
