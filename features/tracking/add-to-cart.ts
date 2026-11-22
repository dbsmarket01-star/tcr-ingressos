export function buildAddToCartPayload(formData: FormData, eventTitle: string) {
  const contents: Array<{ id: string; quantity: number }> = [];

  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("quantity_")) continue;
    const id = name.slice("quantity_".length);
    const quantity = Number(value);
    if (!id || !Number.isSafeInteger(quantity) || quantity <= 0) continue;
    contents.push({ id, quantity });
  }

  if (contents.length === 0) return null;

  return {
    content_name: eventTitle,
    content_type: "product",
    content_ids: contents.map((item) => item.id),
    contents,
    num_items: contents.reduce((total, item) => total + item.quantity, 0),
    currency: "BRL"
  };
}
