import { format } from "date-fns";
import { pl } from "date-fns/locale";

export function formatDocumentDate(value: string | Date): string {
  const isoDate = typeof value === "string"
    ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    : null;
  const year = isoDate ? Number(isoDate[1]) : null;
  const month = isoDate ? Number(isoDate[2]) : null;
  const day = isoDate ? Number(isoDate[3]) : null;
  const date = year != null && month != null && day != null
    ? new Date(year, month - 1, day)
    : value instanceof Date
      ? value
      : new Date(value);

  if (
    year != null &&
    month != null &&
    day != null &&
    (date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day)
  ) {
    return "—";
  }

  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd.MM.yyyy", { locale: pl });
}

export function formatDocumentDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(date);
}
