"use client";

import { useState } from "react";

type QuickAccessSignupProps = {
  supportEmail?: string | null;
};

export function QuickAccessSignup({ supportEmail }: QuickAccessSignupProps) {
  const [email, setEmail] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supportEmail) {
      return;
    }

    const normalized = email.trim();
    const body = normalized
      ? `Olá, quero receber novidades e promoções.%0A%0AE-mail: ${encodeURIComponent(normalized)}`
      : "Olá, quero receber novidades e promoções.";

    window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent("Quero receber novidades")}&body=${body}`;
  };

  return (
    <form className="tcrQuickSignupForm" onSubmit={handleSubmit}>
      <input
        aria-label="Seu melhor e-mail"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Seu melhor e-mail"
        type="email"
        value={email}
      />
      <button className="button" type="submit">
        Quero receber
      </button>
    </form>
  );
}
