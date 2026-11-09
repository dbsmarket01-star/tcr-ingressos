import { fileTypeFromBuffer } from "file-type";

export type AssistantImage = {
  name: string;
  mime: "image/jpeg";
  data: string;
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_STORED_BYTES = 1024 * 1024;
const SUPPORTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function prepareAssistantImage(file: File): Promise<AssistantImage> {
  if (!file.size || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Envie uma imagem de até 5 MB.");
  }
  if (!SUPPORTED_MIME.has(file.type)) {
    throw new Error("Envie um print ou foto em JPG, PNG ou WEBP.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(bytes);
  if (!detected || detected.mime !== file.type) {
    throw new Error("O arquivo não corresponde ao formato de imagem informado.");
  }
  const { default: sharp } = await import("sharp");
  const image = sharp(bytes, { limitInputPixels: 30_000_000 });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Imagem inválida.");
  let normalized = await image.rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  if (normalized.length > MAX_STORED_BYTES) {
    normalized = await sharp(bytes, { limitInputPixels: 30_000_000 }).rotate()
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 70, mozjpeg: true }).toBuffer();
  }
  if (normalized.length > MAX_STORED_BYTES) throw new Error("A imagem é complexa demais. Envie um recorte menor.");
  return { name: file.name.slice(0, 120) || "imagem.jpg", mime: "image/jpeg", data: normalized.toString("base64") };
}
