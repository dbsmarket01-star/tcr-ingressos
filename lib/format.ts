export const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

export function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valueInCents / 100);
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
