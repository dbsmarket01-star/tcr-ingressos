"use client";

import type { MouseEvent } from "react";

const TEMPLATES = [
  {
    key: "grupo",
    label: "Entrar no grupo agora",
    subject: "Entre agora no grupo e garanta até 30% de desconto",
    body:
      "Olá!\n\nSeu acesso ao grupo oficial já está liberado.\n\nEntre agora para garantir o desconto especial, receber o aviso de abertura e acompanhar as próximas informações do evento.",
    ctaLabel: "Entrar no grupo agora"
  },
  {
    key: "ultimas-vagas",
    label: "Últimas vagas",
    subject: "Últimas vagas no grupo com desconto especial",
    body:
      "Olá!\n\nEstamos nas últimas vagas do grupo oficial.\n\nEntrando agora, você recebe o desconto especial e garante prioridade antes da abertura oficial.",
    ctaLabel: "Garantir minha vaga"
  },
  {
    key: "abertura",
    label: "Abertura liberada",
    subject: "Abertura liberada para quem estiver no grupo oficial",
    body:
      "Olá!\n\nA abertura está prestes a acontecer.\n\nEntre no grupo oficial para receber o link certo, as condições especiais e as próximas orientações do evento.",
    ctaLabel: "Receber acesso no grupo"
  }
] as const;

export function LeadBroadcastTemplates() {
  function applyTemplate(event: MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    const template = TEMPLATES.find((item) => item.key === button.dataset.template);

    if (!template) {
      return;
    }

    const form = button.closest("form");

    if (!form) {
      return;
    }

    const subjectInput = form.querySelector<HTMLInputElement>('input[name="subject"]');
    const bodyInput = form.querySelector<HTMLTextAreaElement>('textarea[name="body"]');
    const ctaLabelInput = form.querySelector<HTMLInputElement>('input[name="ctaLabel"]');

    if (subjectInput) {
      subjectInput.value = template.subject;
      subjectInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (bodyInput) {
      bodyInput.value = template.body;
      bodyInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (ctaLabelInput) {
      ctaLabelInput.value = template.ctaLabel;
      ctaLabelInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  return (
    <div className="templateButtonRow">
      {TEMPLATES.map((template) => (
        <button
          key={template.key}
          className="secondaryButton smallButton"
          data-template={template.key}
          onClick={applyTemplate}
          type="button"
        >
          {template.label}
        </button>
      ))}
    </div>
  );
}
