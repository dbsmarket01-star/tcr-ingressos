import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLeadCaptureEventBySlug } from "@/features/leads/lead.service";
import { getCurrentOrganizationContext } from "@/features/organizations/organization.service";

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
  const location = [event.city, event.state].filter(Boolean).join(", ");
  const isExistingLead = query.existing === "1";

  return (
    <main className="shell leadCaptureThanksShell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brandMark">{organizationContext.brandMark}</span>
          <span>{organizationContext.brandName}</span>
        </Link>
      </header>

      <section className="leadThankYouCard card">
        <span className="leadEyebrow">Cadastro confirmado</span>
        <h1>{title}</h1>
        {isExistingLead ? (
          <div className="infoBox">
            Você já estava nesta lista. Atualizamos seus dados e mantivemos seu acesso à próxima etapa.
          </div>
        ) : null}
        <p>{description}</p>
        <div className="leadCaptureMeta leadThankYouMeta">
          <span>{event.title}</span>
          <span>{location}</span>
        </div>
        <div className="leadThankYouProgress" aria-hidden="true">
          <span className="isDone" />
          <span className="isDone" />
          <span className="isActive" />
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
        <small>Seu cadastro já está salvo. Agora entre no grupo para liberar a próxima etapa e receber as condições deste lançamento.</small>
      </section>
    </main>
  );
}
