import { createHash } from "node:crypto";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import mediaInfoFactory from "mediainfo.js";
import { prisma } from "@/lib/prisma";
import { json } from "./meta";
import { transaction } from "./service";
const limits: Record<string, number> = {
  "image/jpeg": 5,
  "image/png": 5,
  "audio/aac": 16,
  "audio/amr": 16,
  "audio/mpeg": 16,
  "audio/mp4": 16,
  "audio/ogg": 16,
  "video/mp4": 16,
  "video/3gpp": 16,
  "text/csv": 10,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": 10,
};
export function uploadLimit(mime: string) {
  return (limits[mime] ?? 0) * 1024 * 1024;
}
export async function inspectMedia(bytes: Buffer, mime: string, name: string) {
  if (mime === "text/csv" && name.toLowerCase().endsWith(".csv"))
    return { kind: "list", receivedSize: bytes.length };
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
    name.toLowerCase().endsWith(".xlsx")
  ) {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
      throw new Error("Planilha XLSX inválida.");
    return { kind: "list", receivedSize: bytes.length };
  }
  const detected = await fileTypeFromBuffer(bytes);
  if (!detected || detected.mime !== mime)
    throw new Error(
      "O conteúdo do arquivo não corresponde ao formato informado.",
    );
  if (mime.startsWith("image/")) {
    // Sharp ships native binaries. Load it only for an actual image upload so
    // the campaign list/API can start even when no media processing is needed.
    const { default: sharp } = await import("sharp");
    const data = await sharp(bytes, { limitInputPixels: 40000000 }).metadata();
    if (!data.width || !data.height) throw new Error("Imagem inválida.");
    return {
      kind: "image",
      width: data.width,
      height: data.height,
      receivedSize: bytes.length,
    };
  }
  const parser = await mediaInfoFactory({
    format: "object",
    locateFile: () => path.join(process.cwd(), "node_modules/mediainfo.js/dist/MediaInfoModule.wasm"),
  });
  try {
    const result = await parser.analyzeData(
      bytes.length,
      (size, offset) => new Uint8Array(bytes.subarray(offset, offset + size)),
    );
    const tracks = result.media?.track ?? [];
    const video = tracks.filter((t) => t["@type"] === "Video") as any[],
      audio = tracks.filter((t) => t["@type"] === "Audio") as any[];
    const general = tracks.find((t) => t["@type"] === "General") as any;
    const duration = Number(
      general?.Duration ?? audio[0]?.Duration ?? video[0]?.Duration,
    );
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error("Não foi possível verificar a duração da mídia.");
    if (
      mime.startsWith("video/") &&
      (video.length !== 1 ||
        video[0].Format !== "AVC" ||
        audio.length > 1 ||
        audio.some((t) => t.Format !== "AAC"))
    )
      throw new Error(
        "O vídeo precisa usar H.264 e, quando houver áudio, uma única faixa AAC.",
      );
    if (
      mime.startsWith("audio/") &&
      (!audio.length ||
        video.length ||
        (mime === "audio/ogg" && audio.some((t) => t.Format !== "Opus")))
    )
      throw new Error("Formato de áudio incompatível. OGG precisa usar Opus.");
    return {
      kind: mime.startsWith("video/") ? "video" : "audio",
      duration,
      width: video[0]?.Width ? Number(video[0].Width) : null,
      height: video[0]?.Height ? Number(video[0].Height) : null,
      videoCodec: video[0]?.Format ?? null,
      audioCodec: audio[0]?.Format ?? null,
      receivedSize: bytes.length,
    };
  } finally {
    parser.close();
  }
}
export async function beginUpload(
  org: string,
  actor: string,
  name: string,
  mime: string,
  size: number,
) {
  if (
    !name ||
    name.length > 240 ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > uploadLimit(mime)
  )
    throw new Error("Formato ou tamanho de arquivo não permitido.");
  return prisma.waMedia.create({
    data: {
      organizationId: org,
      createdBy: actor,
      name,
      mime,
      size,
      sha256: "",
      data: new Uint8Array(),
      metadata: { receivedSize: 0 },
      ready: false,
    },
    select: { id: true, size: true, uploadVersion: true },
  });
}
export async function appendUpload(
  org: string,
  actor: string,
  id: string,
  offset: number,
  chunk: Buffer,
) {
  if (!chunk.length || chunk.length > 2 * 1024 * 1024)
    throw new Error("Bloco de upload inválido.");
  const media = await prisma.waMedia.findFirstOrThrow({
    where: { id, organizationId: org, createdBy: actor },
  });
  if (media.ready) throw new Error("Upload já concluído.");
  if (media.data.length !== offset || offset + chunk.length > media.size)
    throw new Error("A posição do upload mudou. Recomece o envio.");
  const data = Buffer.concat([Buffer.from(media.data), chunk]);
  const ready = data.length === media.size;
  const metadata = ready
    ? await inspectMedia(data, media.mime, media.name)
    : { receivedSize: data.length };
  const sha256 = ready ? createHash("sha256").update(data).digest("hex") : "";
  return transaction(async (tx) => {
    const updated = await tx.waMedia.updateMany({
      where: {
        id,
        organizationId: org,
        uploadVersion: media.uploadVersion,
        ready: false,
      },
      data: {
        data: new Uint8Array(data),
        ready,
        metadata: json(metadata),
        sha256,
        uploadVersion: { increment: 1 },
      },
    });
    if (!updated.count)
      throw new Error("Conflito durante o upload. Recomece o envio.");
    return {
      id,
      name: media.name,
      mime: media.mime,
      size: media.size,
      ready,
      metadata,
      receivedSize: data.length,
    };
  });
}
