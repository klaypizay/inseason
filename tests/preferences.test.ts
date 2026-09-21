import { expect, it } from "vitest";
import {
  formatDate,
  formatDateText,
  formatTime,
  formatTimeText,
} from "../src/domain/preferences";
it("formats calendar dates without timezone shifts", () => {
  expect(formatDate("2028-02-29")).toBe("02/29/2028");
  expect(formatDate("2027-01-04 23:00:00+00", "DD/MM/YYYY")).toBe("04/01/2027");
  expect(formatDate("2027-01-04", "YYYY-MM-DD")).toBe("2027-01-04");
  expect(formatDateText("Move 2027-01-04 to 2027-02-05", "MM/DD/YYYY")).toBe(
    "Move 01/04/2027 to 02/05/2027",
  );
});
it("formats local times without changing the hour or applying a timezone", () => {
  expect(formatTime("00:00")).toBe("12:00 AM");
  expect(formatTime("00:15")).toBe("12:15 AM");
  expect(formatTime("09:05")).toBe("9:05 AM");
  expect(formatTime("12:00")).toBe("12:00 PM");
  expect(formatTime("18:30")).toBe("6:30 PM");
  expect(formatTime("23:59")).toBe("11:59 PM");
  expect(formatTime("00:15", "24-hour")).toBe("00:15");
  expect(formatTime("18:30", "24-hour")).toBe("18:30");
  expect(formatTime("")).toBe("");
  expect(formatTime(null)).toBe("");
  expect(formatTime("25:00")).toBe("25:00");
  expect(formatTime("6:30 PM")).toBe("6:30 PM");
});
it("formats schedule warnings while leaving existing AM/PM times alone", () => {
  const warning = "Session 2027-01-04 18:30 conflicts with a 07:00 PM game.";
  expect(formatTimeText(warning, "12-hour")).toBe(
    "Session 2027-01-04 6:30 PM conflicts with a 07:00 PM game.",
  );
  expect(formatTimeText(warning, "24-hour")).toBe(warning);
});
