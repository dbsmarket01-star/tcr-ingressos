import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLeadCaptureEventBySlug } from "@/features/leads/lead.service";

type LeadCaptureThankYouPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function LeadCaptureThankYouPage({ params }: LeadCaptureThankYouPageProps) {
  const { slug } = await params;
  const event = await getLeadCaptureEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const title = event.leadCaptureThankYouTitle || "Último passo";
  const description =
    event.leadCaptureThankYouDescription ||
    "Entre agora no grupo oficial para receber as informações do evento e a oferta especial de abertura.";
  const buttonText = event.leadCaptureThankYouButtonText || "Quero entrar no grupo oficial no WhatsApp";
  const location = [event.city, event.state].filter(Boolean).join(", ");

  return (
    <main className="shell leadCaptureThanksShell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brandMark">T</span>
          <span>TCR Ingressos</span>
        </Link>
      </header>

      <section className="leadThankYouCard card">
        <span className="leadEyebrow">Cadastro confirmado</span>
        <h1>{title}</h1>
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
            <small>É lá que você vai receber a abertura e as orientações deste evento.</small>
          </div>
        </div>
        {event.leadCaptureWhatsappGroupUrl ? (
          <a
            className="button fullButton whatsappGroupButton"
            href={event.leadCaptureWhatsappGroupUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {buttonText}
          </a>
        ) : null}
        <small>
          O acesso à lista foi registrado. Agora entre no grupo para acompanhar as informações e os descontos deste lançamento.
        </small>
      </section>
    </main>
  );
}
