function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toTitleCase(value: string) {
  const particles = new Set(["de", "da", "do", "das", "dos", "e"]);

  return value
    .split(" ")
    .filter(Boolean)
    .map((part, index, array) => {
      const lower = part.toLowerCase();

      if (index > 0 && index < array.length - 1 && particles.has(lower)) {
        return lower;
      }

      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function countAccentedCharacters(value: string) {
  return Array.from(value).filter((char) => stripAccents(char) !== char).length;
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
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const [bestMatch] = cleaned
    .slice()
    .sort((left, right) => {
      const accentDiff = countAccentedCharacters(right) - countAccentedCharacters(left);

      if (accentDiff !== 0) {
        return accentDiff;
      }

      const countDiff = (counts.get(right) ?? 0) - (counts.get(left) ?? 0);

      if (countDiff !== 0) {
        return countDiff;
      }

      const lengthDiff = right.length - left.length;

      if (lengthDiff !== 0) {
        return lengthDiff;
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
