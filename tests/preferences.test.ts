import { expect, it } from "vitest";
import { formatDate, formatDateText } from "../src/domain/preferences";
it("formats calendar dates without timezone shifts", () => {
  expect(formatDate("2028-02-29")).toBe("02/29/2028");
  expect(formatDate("2027-01-04 23:00:00+00", "DD/MM/YYYY")).toBe("04/01/2027");
  expect(formatDate("2027-01-04", "YYYY-MM-DD")).toBe("2027-01-04");
  expect(formatDateText("Move 2027-01-04 to 2027-02-05", "MM/DD/YYYY")).toBe(
    "Move 01/04/2027 to 02/05/2027",
  );
});
