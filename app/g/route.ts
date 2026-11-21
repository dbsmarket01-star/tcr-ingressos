import { NextResponse } from "next/server";

export function GET(request: Request) {
  const destination = new URL("/evento/a2-imergidos-gramado-2027", request.url);
  if (!["a2imergidos.com.br", "www.a2imergidos.com.br"].includes(destination.hostname)) {
    return new NextResponse("Página não encontrada.", { status: 404 });
  }

  destination.searchParams.set("utm_source", "instagram");
  destination.searchParams.set("utm_medium", "organic_social");
  destination.searchParams.set("utm_campaign", "bio_a2_gramado_2027");
  destination.searchParams.set("utm_content", "perfil_a2");

  return NextResponse.redirect(destination, {
    status: 307,
    headers: { "Cache-Control": "no-store" }
  });
}
