import Link from "next/link";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { getUnlockRequestById } from "@/features/protection-unlock/unlock-request.service";

export const dynamic = "force-dynamic";

type UnlockPartnerPageProps = {
  params: Promise<{
    unlockRequestId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UnlockPartnerPage({ params, searchParams }: UnlockPartnerPageProps) {
  const { unlockRequestId } = await params;
  const request = await getUnlockRequestById(unlockRequestId);
  const urlParams = searchParams ? await searchParams : {};
  const presetCode = typeof urlParams.code === "string" ? urlParams.code : "";
  const error = typeof urlParams.error === "string" ? urlParams.error : null;
  const success = urlParams.success === "1";
  const denied = urlParams.denied === "1";

  if (!request) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
        <h1>Solicitação não encontrada</h1>
        <p>Esse pedido de desbloqueio não existe mais ou foi removido.</p>
      </main>
    );
  }

  const statusLabel =
    request.status === "PENDING"
      ? "Pendente"
      : request.status === "APPROVED"
        ? "Aprovada"
        : request.status === "EXPIRED"
          ? "Expirada"
          : request.status === "DENIED"
            ? "Negada"
            : "Encerrada";

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 32 }}>
      <div className="card" style={{ padding: 24 }}>
        <span className="eyebrow">Parceiro de responsabilidade</span>
        <h1 style={{ marginTop: 8 }}>Aprovação supervisionada</h1>
        <p>
          {request.user.name} solicitou autorização para <strong>{request.actionType}</strong>.
        </p>
        <p>Status atual: <strong>{statusLabel}</strong></p>
        <p>
          Expira em:{" "}
          <strong>
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(request.expiresAt)}
          </strong>
        </p>
        <p>Dispositivo: <strong>{request.device?.nickname || request.device?.platform || "Não informado"}</strong></p>
        <p>Motivo informado: <strong>{request.reason || "Não informado"}</strong></p>

        {error ? <ErrorNotice message={error} className="spacedSection" /> : null}
        {success ? <div className="successBox" style={{ marginTop: 20 }}>Desbloqueio aprovado com sucesso.</div> : null}
        {denied ? <div className="successBox" style={{ marginTop: 20 }}>Solicitação negada com sucesso.</div> : null}

        {request.status === "PENDING" ? (
          <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
            <form method="post" action={`/unlock/${request.id}/approve`} style={{ display: "grid", gap: 12 }}>
              <label className="field">
                <span>Código de aprovação</span>
                <input name="approvalCode" defaultValue={presetCode} placeholder="Digite o código recebido por e-mail" required />
              </label>
              <button className="button" type="submit">
                Aprovar desbloqueio
              </button>
            </form>
            <form method="post" action={`/unlock/${request.id}/deny`} style={{ display: "grid", gap: 12 }}>
              <label className="field">
                <span>Motivo da negativa</span>
                <textarea name="note" rows={3} placeholder="Opcional: explique por que você não quer aprovar." />
              </label>
              <button className="secondaryButton" type="submit">
                Negar solicitação
              </button>
            </form>
          </div>
        ) : (
          <div className="successBox" style={{ marginTop: 24 }}>
            Essa solicitação já foi processada e não aceita novas aprovações.
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <Link href="/" className="secondaryButton">
            Voltar
          </Link>
        </div>
      </div>
    </main>
  );
}
