export function normalizeBrazilianPhone(value?: string | null) {
  if (!value) {
    return undefined;
  }

  let digits = value.replace(/\D/g, "").replace(/^0+/, "");

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  return digits.length === 10 || digits.length === 11 ? digits : undefined;
}

export function isValidBrazilianPhone(value?: string | null) {
  if (!value?.trim()) {
    return true;
  }

  return Boolean(normalizeBrazilianPhone(value));
}
