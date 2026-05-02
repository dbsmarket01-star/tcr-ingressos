function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeMunicipalityKey(value?: string | null) {
  const text = (value ?? "").trim().replace(/\s+/g, " ");

  if (!text) {
    return "nao-informado";
  }

  return stripAccents(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getMunicipalityGroupLabel(values: Array<string | null | undefined>) {
  const cleaned = values
    .map((value) => (value ?? "").trim().replace(/\s+/g, " "))
    .filter(Boolean);

  if (cleaned.length === 0) {
    return "Não informado";
  }

  const counts = new Map<string, number>();

  for (const value of cleaned) {
    const key = stripAccents(value).toLowerCase();
    counts.set(value, (counts.get(value) ?? 0) + 1);
    counts.set(key, counts.get(key) ?? 0);
  }

  const [bestMatch] = cleaned
    .slice()
    .sort((left, right) => {
      const countDiff = (counts.get(right) ?? 0) - (counts.get(left) ?? 0);

      if (countDiff !== 0) {
        return countDiff;
      }

      return left.localeCompare(right, "pt-BR");
    });

  return toTitleCase(bestMatch);
}

export function getMunicipalityRanking(values: Array<string | null | undefined>) {
  const groups = values.reduce(
    (acc, value) => {
      const key = normalizeMunicipalityKey(value);
      const entry = acc.get(key) ?? { count: 0, labels: [] as Array<string | null | undefined> };
      entry.count += 1;
      entry.labels.push(value);
      acc.set(key, entry);
      return acc;
    },
    new Map<string, { count: number; labels: Array<string | null | undefined> }>()
  );

  return Array.from(groups.entries())
    .map(([, entry]) => ({
      label: getMunicipalityGroupLabel(entry.labels),
      count: entry.count
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "pt-BR"));
}
