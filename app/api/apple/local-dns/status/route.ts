import { NextResponse } from "next/server";
import { readAppleLocalDnsStatus } from "@/features/apple-local-dns/apple-local-dns-status.service";

export async function GET() {
  const state = readAppleLocalDnsStatus();
  return NextResponse.json(state, { status: state.error ? 500 : 200 });
}
