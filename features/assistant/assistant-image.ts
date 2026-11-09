import { fileTypeFromBuffer } from "file-type";

export type AssistantImage = {
  name: string;
  mime: "image/jpeg" | "image/png" | "image/webp";
  data: string;
};

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const SUPPORTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function prepareAssistantImage(file: File): Promise<AssistantImage> {
  if (!file.size || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Envie uma imagem de até 2 MB. Se o print for maior, recorte a área importante.");
  }
  if (!SUPPORTED_MIME.has(file.type)) {
    throw new Error("Envie um print ou foto em JPG, PNG ou WEBP.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(bytes);
  if (!detected || detected.mime !== file.type) {
    throw new Error("O arquivo não corresponde ao formato de imagem informado.");
  }
  // Keep the original bytes. Native Sharp binaries may be unavailable in the
  // deployed function, and compression is not required by the vision API.
  return { name: file.name.slice(0, 120) || "imagem.jpg", mime: detected.mime as AssistantImage["mime"], data: bytes.toString("base64") };
}
