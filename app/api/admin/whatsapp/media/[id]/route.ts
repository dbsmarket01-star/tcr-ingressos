import { campaignAdmin } from "@/features/whatsapp/campaigns/auth";
import { appendUpload } from "@/features/whatsapp/campaigns/media";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await campaignAdmin(request);
    if (Number(request.headers.get("content-length") ?? 0) > 2 * 1024 * 1024)
      return Response.json({ error: "Bloco muito grande" }, { status: 413 });
    const buffer = Buffer.from(await request.arrayBuffer());
    const offset = Number(request.headers.get("x-upload-offset"));
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new Error("Posição inválida.");
    return Response.json(
      await appendUpload(
        admin.organizationId,
        admin.id,
        (await params).id,
        offset,
        buffer,
      ),
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Falha no upload" },
      { status: e instanceof Error && e.message === "FORBIDDEN" ? 403 : 400 },
    );
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await campaignAdmin();
    const file = await prisma.waMedia.findFirstOrThrow({
      where: {
        id: (await params).id,
        organizationId: admin.organizationId,
        ready: true,
      },
    });
    if ((file.metadata as any).kind === "list")
      return new Response(null, { status: 404 });
    const bytes = new Uint8Array(file.data);
    const range = request.headers.get("range")?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0,
      end = range
        ? Math.min(Number(range[2] || bytes.length - 1), bytes.length - 1)
        : bytes.length - 1;
    if (start > end || start >= bytes.length)
      return new Response(null, { status: 416 });
    let offset = start;
    const body = new ReadableStream({
      pull(controller) {
        if (offset > end) {
          controller.close();
          return;
        }
        const next = Math.min(offset + 65536, end + 1);
        controller.enqueue(bytes.slice(offset, next));
        offset = next;
      },
    });
    return new Response(body, {
      status: range ? 206 : 200,
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(range
          ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` }
          : {}),
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
