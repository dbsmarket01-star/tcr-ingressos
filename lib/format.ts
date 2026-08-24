export const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

export function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valueInCents / 100);
}

export function formatCpf(value?: string | null) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return "Não informado";
  }

  const digits = normalizedValue.replace(/\D/g, "");

  if (digits.length !== 11) {
    return normalizedValue;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: BRAZIL_TIME_ZONE
  }).format(new Date(value));
}

export function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BRAZIL_TIME_ZONE
  }).format(new Date(value));
}

export function formatLongDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: BRAZIL_TIME_ZONE
  }).format(new Date(value));
}

export function formatDateTimeInput(value?: string | Date | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offsetInMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetInMs).toISOString().slice(0, 16);
}

export function formatDateInput(value?: string | Date | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offsetInMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetInMs).toISOString().slice(0, 10);
}
