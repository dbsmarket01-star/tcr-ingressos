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

  const hasCustomThankYouCopy = Boolean(
    event.leadCaptureThankYouTitle || event.leadCaptureThankYouDescription || event.leadCaptureThankYouButtonText
  );
  const buttonText = event.leadCaptureThankYouButtonText || "ENTRAR AGORA NO GRUPO E GARANTIR 30% OFF";
  const headlinePrefix = hasCustomThankYouCopy ? "Cadastro confirmado" : "FALTA SÓ 1 PASSO PARA";
  const headlineHighlight = hasCustomThankYouCopy
    ? event.title
    : "GARANTIR SEU DESCONTO!";
  const subheadline =
    event.leadCaptureThankYouDescription || "Seu cadastro foi concluído com sucesso.";
  const warningTitle = hasCustomThankYouCopy ? "PRÓXIMO PASSO:" : "ATENÇÃO:";
  const warningText = hasCustomThankYouCopy
    ? "Fique atento ao e-mail e telefone cadastrados para receber os próximos avisos oficiais."
    : "Se você sair desta página, pode perder o acesso ao grupo.";
  const warningSupportText = hasCustomThankYouCopy
    ? "Quando o grupo oficial estiver disponível, entre pelo botão desta página."
    : "Entre agora e garanta sua participação.";
  const thankYouBenefits = hasCustomThankYouCopy
    ? [
        {
          icon: "1",
          title: "Lista oficial",
          description: "Seu cadastro foi salvo para a Elo Conference Campinas."
        },
        {
          icon: "2",
          title: "Avisos antecipados",
          description: "Você receberá as próximas informações nos dados informados."
        },
        {
          icon: "3",
          title: "Prioridade",
          description: "Acompanhe a abertura dos ingressos e condições oficiais."
        }
      ]
    : [
        {
          icon: "%",
          title: "Receba até 30% de desconto",
          description: "Desconto exclusivo para membros do grupo oficial."
        },
        {
          icon: "◔",
          title: "Acesso antecipado aos ingressos",
          description: "Seja o primeiro a garantir o seu ingresso."
        },
        {
          icon: "★",
          title: "Prioridade antes da abertura oficial",
          description: "Tenha prioridade e não fique de fora."
        }
      ];
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
        eventId={event.id}
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
          <span>{headlinePrefix}</span>
          <strong>{headlineHighlight}</strong>
        </h1>
        <p className="leadThankYouSubheadline">{subheadline}</p>
        <div className="leadThankYouWarning">
          <span className="leadThankYouWarningIcon" aria-hidden="true">
            ⚠️
          </span>
          <div>
            <strong>{warningTitle}</strong> {warningText}
            <br />
            <span>{warningSupportText}</span>
          </div>
        </div>
        <div className="leadThankYouBenefits">
          {thankYouBenefits.map((benefit) => (
            <article key={benefit.title}>
              <span className="leadThankYouBenefitIcon" aria-hidden="true">
                {benefit.icon}
              </span>
              <div>
                <strong>{benefit.title}</strong>
                <small>{benefit.description}</small>
              </div>
            </article>
          ))}
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
              {hasCustomThankYouCopy
                ? "Cadastro recebido. Você receberá os próximos avisos no e-mail e telefone informados."
                : "Adicione o link do grupo de WhatsApp na captação do evento para liberar este último passo."}
            </div>
          </div>
        )}
        <small className="leadThankYouClosing">
          {hasCustomThankYouCopy
            ? "Fique atento aos próximos comunicados oficiais da Elo Conference."
            : "🔒 O grupo pode ser fechado a qualquer momento após atingir o limite de vagas."}
        </small>
      </section>
    </main>
  );
}
