import { unsubscribeEventLeadFromCampaignEmails } from "@/features/leads/lead.service";

function renderHtml(message: string, changed: boolean) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preferências de e-mail</title>
  </head>
  <body style="margin:0;padding:32px 16px;background:#f3f6fb;font-family:Arial,sans-serif;color:#1d2430;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e0e7f0;border-radius:24px;padding:28px;box-shadow:0 20px 60px rgba(10,34,26,.08);">
      <p style="margin:0 0 8px;color:#607089;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Preferências de e-mail</p>
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;color:#1d2430;">${changed ? "Descadastro concluído" : "Preferência registrada"}</h1>
      <p style="margin:0;color:#425066;font-size:16px;line-height:1.6;">${message}</p>
    </div>
  </body>
</html>`;
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ campaignId: string; leadId: string }> }
) {
  const { campaignId, leadId } = await params;
  const result = await unsubscribeEventLeadFromCampaignEmails(campaignId, leadId);

  let body = "";

  if (!result.found) {
    body = renderHtml(
      "Não encontramos esse vínculo de campanha. Se quiser, fale com o organizador para revisar seu cadastro.",
      false
    );
  } else if (result.changed) {
    body = renderHtml(
      "Seu e-mail foi retirado dos próximos disparos de campanha deste evento.",
      true
    );
  } else {
    body = renderHtml(
      "Seu e-mail já estava descadastrado para os próximos disparos de campanha deste evento.",
      false
    );
  }

  return new Response(body, {
    status: result.found ? 200 : 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ campaignId: string; leadId: string }> }
) {
  return GET(request, context);
}
