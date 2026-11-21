import { NextResponse } from "next/server";

export function GET(request: Request) {
  const destination = new URL("/", request.url);
  const isA2 = ["a2imergidos.com.br", "www.a2imergidos.com.br"].includes(destination.hostname);
  destination.searchParams.set("utm_source", "instagram");
  destination.searchParams.set("utm_medium", "organic_social");
  destination.searchParams.set("utm_campaign", isA2 ? "bio_a2_geral" : "bio_tcr");
  destination.searchParams.set("utm_content", isA2 ? "perfil_a2" : "perfil");

  return NextResponse.redirect(destination, {
    status: 307,
    headers: { "Cache-Control": "no-store" }
  });
}
