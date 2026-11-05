import { NextResponse } from "next/server";

export function GET(request: Request) {
  const destination = new URL("/", request.url);
  destination.searchParams.set("utm_source", "instagram");
  destination.searchParams.set("utm_medium", "organic_social");
  destination.searchParams.set("utm_campaign", "bio_tcr");
  destination.searchParams.set("utm_content", "perfil");

  return NextResponse.redirect(destination, {
    status: 307,
    headers: { "Cache-Control": "no-store" }
  });
}
