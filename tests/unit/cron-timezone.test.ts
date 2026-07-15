import {
  CRON_TIME_ZONE,
  formatZonedIsoDate,
  getZonedDateTimeParts,
} from "@/lib/cron/timezone";

describe("cron timezone", () => {
  it("uses Europe/Warsaw explicitly", () => {
    expect(CRON_TIME_ZONE).toBe("Europe/Warsaw");
  });

  it("applies Warsaw winter and summer offsets", () => {
    expect(
      getZonedDateTimeParts(new Date("2026-01-15T08:00:00.000Z"))
    ).toMatchObject({ hour: 9, minute: 0 });
    expect(
      getZonedDateTimeParts(new Date("2026-07-15T08:00:00.000Z"))
    ).toMatchObject({ hour: 10, minute: 0 });
  });

  it("formats the business date independently from the server timezone", () => {
    expect(formatZonedIsoDate(new Date("2026-07-14T22:30:00.000Z"))).toBe(
      "2026-07-15"
    );
  });
});
