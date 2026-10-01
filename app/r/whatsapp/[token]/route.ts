import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const token = (await params).token;
  if (!/^[a-zA-Z0-9_-]{20,80}$/.test(token))
    return new Response(null, { status: 404 });
  const job = await prisma.waMessageJob.findUnique({
    where: { clickToken: token },
    include: { campaign: { select: { snapshot: true } } },
  });
  const config = (job?.campaign.snapshot as any)?.config;
  if (!job?.acceptedAt || !config?.trackClicks)
    return new Response(null, { status: 404 });
  let target: URL;
  try {
    target = new URL(config.ctaUrl);
    if (target.protocol !== "https:") throw new Error();
  } catch {
    return new Response(null, { status: 404 });
  }
  await prisma.waMessageJob.update({
    where: { id: job.id },
    data: {
      clickedAt: job.clickedAt ?? new Date(),
      clickCount: { increment: 1 },
    },
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.href,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
