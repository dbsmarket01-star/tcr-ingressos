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

type SavedTemplate = {
  id: string;
  subject: string;
  body: string;
};

type LeadBroadcastTemplatesProps = {
  savedTemplates?: SavedTemplate[];
  deleteAction?: (formData: FormData) => void | Promise<void>;
};

export function LeadBroadcastTemplates({ savedTemplates = [], deleteAction }: LeadBroadcastTemplatesProps) {
  function applyTemplate(
    event: MouseEvent<HTMLButtonElement>,
    payload?: { subject: string; body: string; ctaLabel?: string }
  ) {
    const button = event.currentTarget;
    const template =
      payload ||
      TEMPLATES.find((item) => item.key === button.dataset.template);

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

    if (ctaLabelInput && template.ctaLabel) {
      ctaLabelInput.value = template.ctaLabel;
      ctaLabelInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  return (
    <div className="leadTemplateStack">
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

      {savedTemplates.length > 0 ? (
        <div className="savedTemplateGrid">
          {savedTemplates.map((template) => (
            <div key={template.id} className="savedTemplateCard">
              <div>
                <strong>{template.subject}</strong>
                <small>{template.body.slice(0, 120)}{template.body.length > 120 ? "..." : ""}</small>
              </div>
              <div className="savedTemplateActions">
                <button
                  className="secondaryButton smallButton"
                  onClick={(event) => applyTemplate(event, { subject: template.subject, body: template.body })}
                  type="button"
                >
                  Usar
                </button>
                <button
                  className="ghostButton smallButton"
                  formAction={deleteAction}
                  name="templateId"
                  type="submit"
                  value={template.id}
                >
                  Apagar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
