import { NextResponse } from "next/server";
import { handleWhatsAppMetaWebhook } from "@/features/whatsapp/whatsapp.service";

export const dynamic = "force-dynamic";
export const preferredRegion = "gru1";
export const maxDuration = 30;

function getVerifyToken() {
  return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expectedToken = getVerifyToken();

  if (!expectedToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "Token de verificacao do WhatsApp nao configurado."
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store"
      }
    });
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Verificacao invalida."
    },
    {
      status: 403,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const result = await handleWhatsAppMetaWebhook(payload);

    return NextResponse.json(
      {
        ok: true,
        ...result
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("[WhatsApp] Falha ao processar webhook da Meta", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Nao foi possivel processar o webhook do WhatsApp."
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
