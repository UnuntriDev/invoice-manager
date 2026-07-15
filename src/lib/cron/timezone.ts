export const CRON_TIME_ZONE = "Europe/Warsaw";

export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function getZonedDateTimeParts(
  date: Date,
  timeZone = CRON_TIME_ZONE
): ZonedDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  };
}

export function formatZonedIsoDate(
  date: Date,
  timeZone = CRON_TIME_ZONE
): string {
  const parts = getZonedDateTimeParts(date, timeZone);
  return [parts.year, parts.month, parts.day]
    .map((part, index) =>
      index === 0 ? String(part) : String(part).padStart(2, "0")
    )
    .join("-");
}

export function getPreviousCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}
