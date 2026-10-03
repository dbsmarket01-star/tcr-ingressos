/** Canonical transport MIME names; the server still verifies bytes and codecs. */
export function canonicalMime(value: string) {
  const mime = value.toLowerCase().split(";")[0].trim();
  return (
    (
      {
        "audio/x-m4a": "audio/mp4",
        "audio/mp3": "audio/mpeg",
        "image/jpg": "image/jpeg",
        "audio/x-aac": "audio/aac",
      } as Record<string, string>
    )[mime] ?? mime
  );
}
export function uploadMime(name: string, browserMime: string) {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const types: Record<string, string> = {
    csv: "text/csv",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    amr: "audio/amr",
    ogg: "audio/ogg",
    mp4: "video/mp4",
    "3gp": "video/3gpp",
  };
  if (["csv", "xlsx", "m4a"].includes(ext)) return types[ext];
  return canonicalMime(
    browserMime && browserMime !== "application/octet-stream"
      ? browserMime
      : (types[ext] ?? ""),
  );
}
