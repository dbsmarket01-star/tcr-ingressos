"use client";

type WhatsAppGroupRedirectProps = {
  buttonText: string;
  url: string;
};

export function WhatsAppGroupRedirect({ buttonText, url }: WhatsAppGroupRedirectProps) {
  return (
    <div className="leadThankYouAction">
      <a className="button fullButton whatsappGroupButton whatsappGroupButtonLarge" href={url}>
        {buttonText}
      </a>
      <small className="leadThankYouRedirectNote">
        Toque no botão para entrar no grupo oficial e receber as próximas informações do evento.
      </small>
    </div>
  );
}
