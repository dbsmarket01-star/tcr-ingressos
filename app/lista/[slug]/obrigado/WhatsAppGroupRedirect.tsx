"use client";

import { useEffect, useState } from "react";

type WhatsAppGroupRedirectProps = {
  buttonText: string;
  url: string;
};

export function WhatsAppGroupRedirect({ buttonText, url }: WhatsAppGroupRedirectProps) {
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    const countdownInterval = window.setInterval(() => {
      setCountdown((current) => (current > 1 ? current - 1 : current));
    }, 1000);

    const redirectTimer = window.setTimeout(() => {
      window.location.assign(url);
    }, 1800);

    return () => {
      window.clearInterval(countdownInterval);
      window.clearTimeout(redirectTimer);
    };
  }, [url]);

  return (
    <div className="leadThankYouAction">
      <a className="button fullButton whatsappGroupButton whatsappGroupButtonLarge" href={url}>
        {buttonText}
      </a>
      <small className="leadThankYouRedirectNote">
        Redirecionando para o grupo em {countdown} segundo{countdown === 1 ? "" : "s"}. Se não abrir sozinho, toque no botão.
      </small>
    </div>
  );
}
