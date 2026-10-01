import { timingSafeEqual } from "node:crypto";
import { workerTick } from "@/features/whatsapp/campaigns/worker";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (
    !expected ||
    !supplied ||
    Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await workerTick(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "[wa-campaign-worker]",
      error instanceof Error ? error.name : "failure",
    );
    return Response.json({ error: "Worker indisponível" }, { status: 500 });
  }
}
