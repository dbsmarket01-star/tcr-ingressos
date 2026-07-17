export const REPORT_TIME_ZONE = "America/Sao_Paulo";

type ReportPeriodOptions = {
  defaultDaysBack: number;
  endDate?: string;
  startDate?: string;
};

function parseDateInput(value: string | undefined, boundary: "start" | "end") {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const suffix = boundary === "start" ? "T00:00:00.000-03:00" : "T23:59:59.999-03:00";
  const date = new Date(`${value}${suffix}`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatReportDateInput(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function getReportPeriod({ defaultDaysBack, endDate, startDate }: ReportPeriodOptions) {
  const defaultEnd = new Date();
  const parsedEnd = parseDateInput(endDate, "end") ?? new Date(
    `${formatReportDateInput(defaultEnd)}T23:59:59.999-03:00`
  );
  const defaultStart = new Date(parsedEnd);
  defaultStart.setDate(defaultStart.getDate() - defaultDaysBack);

  let start = parseDateInput(startDate, "start") ?? new Date(`${formatReportDateInput(defaultStart)}T00:00:00.000-03:00`);
  let end = parsedEnd;

  if (start > end) {
    const originalStart = start;
    start = parseDateInput(formatReportDateInput(end), "start") ?? end;
    end = parseDateInput(formatReportDateInput(originalStart), "end") ?? originalStart;
  }

  return {
    start,
    end,
    startDateInput: formatReportDateInput(start),
    endDateInput: formatReportDateInput(end)
  };
}
