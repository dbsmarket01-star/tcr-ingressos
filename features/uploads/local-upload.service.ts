import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_IMAGE_SIZE_MB = Number(process.env.UPLOAD_MAX_IMAGE_MB || 10);
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function extensionFromName(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function extensionFromType(type: string) {
  if (type === "image/jpeg") {
    return "jpg";
  }

  if (type === "image/png") {
    return "png";
  }

  if (type === "image/webp") {
    return "webp";
  }

  if (type === "image/gif") {
    return "gif";
  }

  return "bin";
}

function isAllowedImage(file: File) {
  const extension = extensionFromName(file.name);
  return ALLOWED_IMAGE_TYPES.has(file.type) || ALLOWED_IMAGE_EXTENSIONS.has(extension);
}

function extensionForFile(file: File) {
  const extension = extensionFromName(file.name);

  if (ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }

  return extensionFromType(file.type);
}

function cleanSupabaseUrl() {
  return process.env.SUPABASE_URL?.replace(/\/$/, "") || "";
}

function safeLocalFolder(folder: string) {
  return folder.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
}

function safeStorageFolder(folder: string) {
  return folder
    .split("/")
    .map((part) => part.replace(/[^a-z0-9-]/gi, "-").toLowerCase())
    .filter(Boolean)
    .join("/");
}

function shouldUseSupabaseStorage() {
  return process.env.UPLOAD_STORAGE_PROVIDER === "SUPABASE_STORAGE";
}

async function saveSupabaseStorageImage(file: File, folder: string) {
  const supabaseUrl = cleanSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "event-media";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase Storage nao configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }

  const safeFolder = safeStorageFolder(folder);
  const fileName = `${Date.now()}-${randomBytes(8).toString("hex")}.${extensionForFile(file)}`;
  const objectPath = `${safeFolder}/${fileName}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "cache-control": "31536000",
      "content-type": file.type || "application/octet-stream",
      "x-upsert": "false"
    },
    body: Buffer.from(await file.arrayBuffer())
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Nao foi possivel enviar imagem para o Supabase Storage. ${message}`.trim());
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
}

export async function savePublicImageUpload(file: File | null | undefined, folder: string) {
  if (!file || file.size === 0) {
    return null;
  }

  if (!isAllowedImage(file)) {
    throw new Error("Envie uma imagem JPG, PNG, WEBP ou GIF.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`A imagem deve ter no maximo ${MAX_IMAGE_SIZE_MB}MB.`);
  }

  if (shouldUseSupabaseStorage()) {
    return saveSupabaseStorageImage(file, folder);
  }

  const safeFolder = safeLocalFolder(folder);
  const uploadsDir = path.join(process.cwd(), "public", "uploads", safeFolder);
  const fileName = `${Date.now()}-${randomBytes(8).toString("hex")}.${extensionForFile(file)}`;
  const filePath = path.join(uploadsDir, fileName);

  await mkdir(uploadsDir, { recursive: true });
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  return `/uploads/${safeFolder}/${fileName}`;
}
