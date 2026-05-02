"use client";

type WhatsAppGroupRedirectProps = {
  buttonText: string;
  url: string;
};

export function WhatsAppGroupRedirect({ buttonText, url }: WhatsAppGroupRedirectProps) {
  return (
    <div className="leadThankYouAction">
      <a className="button fullButton whatsappGroupButton whatsappGroupButtonLarge" href={url}>
        <span className="whatsappGroupButtonIcon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.16 1.6 5.97L0 24l6.3-1.65a11.9 11.9 0 0 0 5.76 1.47h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.16-3.45-8.44Zm-8.45 18.3h-.01a9.95 9.95 0 0 1-5.07-1.39l-.36-.21-3.74.98 1-3.64-.24-.37a9.9 9.9 0 0 1-1.53-5.25c0-5.48 4.46-9.94 9.95-9.94a9.87 9.87 0 0 1 7.03 2.91 9.86 9.86 0 0 1 2.9 7.03c0 5.48-4.46 9.94-9.93 9.94Zm5.46-7.46c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.21-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.49s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span>{buttonText}</span>
      </a>
      <small className="leadThankYouRedirectNote">
        Toque no botão para entrar no grupo oficial e receber as próximas informações do evento.
      </small>
    </div>
  );
}
