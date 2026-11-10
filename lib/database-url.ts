/** Never inherit a pooled connection's previous schema when the URL omits it. */
export function databaseUrlWithExplicitSchema(value: string | undefined) {
  if (!value) return undefined;
  const url = new URL(value);
  if (!url.searchParams.get("schema")) url.searchParams.set("schema", "public");
  return url.toString();
}
