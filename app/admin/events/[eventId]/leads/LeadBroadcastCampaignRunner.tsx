"use client";

import { useEffect, useMemo, useState } from "react";
import { getFriendlyError } from "@/lib/friendly-error";

type CampaignState = {
  id: string;
  subject: string;
  status: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  createdAt: string;
  processingStartedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
};

type LeadBroadcastCampaignRunnerProps = {
  initialCampaign: CampaignState;
};

const ACTIVE_STATUSES = new Set(["QUEUED", "PROCESSING"]);

function getStatusLabel(status: string) {
  switch (status) {
    case "QUEUED":
      return "Na fila";
    case "PROCESSING":
      return "Enviando";
    case "COMPLETED":
      return "Concluído";
    case "COMPLETED_WITH_ERRORS":
      return "Concluído com falhas";
    case "FAILED":
      return "Falhou";
    default:
      return status;
  }
}

export function LeadBroadcastCampaignRunner({ initialCampaign }: LeadBroadcastCampaignRunnerProps) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [requestError, setRequestError] = useState<string | null>(null);
  const displayError = campaign.lastError || requestError;
  const friendlyError = displayError ? getFriendlyError(displayError) : null;

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function parseCampaignResponse(response: Response) {
      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const text = await response.text();

        return {
          error: text || "O servidor retornou uma resposta inválida para a campanha."
        } as { campaign?: CampaignState; error?: string };
      }

      return (await response.json()) as { campaign?: CampaignState; error?: string };
    }

    async function tick(delayMs: number) {
      timeoutId = setTimeout(async () => {
        try {
          const response = await fetch(`/api/admin/lead-email-campaigns/${campaign.id}/process`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            cache: "no-store"
          });
          const payload = await parseCampaignResponse(response);

          if (cancelled) {
            return;
          }

          if (payload.campaign) {
            setCampaign(payload.campaign);
          }

          setRequestError(payload.error ?? null);

          if (payload.campaign && ACTIVE_STATUSES.has(payload.campaign.status)) {
            tick(response.ok ? 600 : 2500);
          }
        } catch (error) {
          if (cancelled) {
            return;
          }

          setRequestError(error instanceof Error ? error.message : "Falha ao atualizar o progresso da campanha.");
          tick(2500);
        }
      }, delayMs);
    }

    if (initialCampaign.status === "QUEUED") {
      fetch(`/api/admin/lead-email-campaigns/${campaign.id}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      })
        .catch((error) => {
          if (!cancelled) {
            setRequestError(
              error instanceof Error ? error.message : "Falha ao iniciar o processamento da campanha."
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            tick(400);
          }
        });
    } else if (ACTIVE_STATUSES.has(initialCampaign.status)) {
      tick(400);
    }

    return () => {
      cancelled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [campaign.id, initialCampaign.status]);

  const progressPercentage = useMemo(() => {
    if (campaign.totalCount <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalCount) * 100)
    );
  }, [campaign.failedCount, campaign.sentCount, campaign.totalCount]);

  return (
    <section className="leadCampaignRunnerCard">
      <div className="leadCampaignRunnerHeader">
        <div>
          <strong>Campanha em processamento</strong>
          <small>{campaign.subject}</small>
        </div>
        <span className={`leadCampaignStatusBadge leadCampaignStatus-${campaign.status.toLowerCase()}`}>
          {getStatusLabel(campaign.status)}
        </span>
      </div>
      <div className="leadCampaignProgressBar" aria-hidden="true">
        <span style={{ width: `${progressPercentage}%` }} />
      </div>
      <div className="leadCampaignStats">
        <div>
          <span>Total</span>
          <strong>{campaign.totalCount}</strong>
        </div>
        <div>
          <span>Enviados</span>
          <strong>{campaign.sentCount}</strong>
        </div>
        <div>
          <span>Falhados</span>
          <strong>{campaign.failedCount}</strong>
        </div>
        <div>
          <span>Pendentes</span>
          <strong>{campaign.pendingCount}</strong>
        </div>
        <div>
          <span>Progresso</span>
          <strong>{progressPercentage}%</strong>
        </div>
      </div>
      {friendlyError ? (
        <div className="errorNotice inlineFeedbackBox" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>{friendlyError.title}</strong>
            <p>{friendlyError.message}</p>
          </div>
        </div>
      ) : null}
      {campaign.status === "COMPLETED" || campaign.status === "COMPLETED_WITH_ERRORS" ? (
        <div className="successBox inlineFeedbackBox">
          Campanha finalizada com {campaign.sentCount} envio(s) concluído(s)
          {campaign.failedCount > 0 ? ` e ${campaign.failedCount} falha(s).` : "."}
        </div>
      ) : (
        <small className="muted">
          O servidor está processando essa campanha em segundo plano, em lotes seguros. Você pode acompanhar o progresso por aqui sem depender da aba ficar aberta.
        </small>
      )}
    </section>
  );
}
