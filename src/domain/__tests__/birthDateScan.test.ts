import { describe, expect, it } from "vitest";
import { scanBirthDates } from "../birthDateScan";
import type { UserInput } from "../types";

const baseInput: UserInput = {
  isMultipleBirth: false,
  scanRange: { start: "2026-09-01", end: "2026-09-03" },
  insuredSegments: [{ id: "s1", start: "2020-01-01", end: null }],
  leavePeriods: [],
  attendances: [],
};

describe("scanBirthDates", () => {
  it("scanRange の各日について判定結果を返す (inclusive)", () => {
    const results = scanBirthDates(baseInput);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.birthDate)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
  });

  it("単日指定でも 1 件返す", () => {
    const results = scanBirthDates({
      ...baseInput,
      scanRange: { start: "2026-09-01", end: "2026-09-01" },
    });
    expect(results).toHaveLength(1);
    expect(results[0].birthDate).toBe("2026-09-01");
  });

  it("start > end は空配列", () => {
    const results = scanBirthDates({
      ...baseInput,
      scanRange: { start: "2026-09-10", end: "2026-09-01" },
    });
    expect(results).toEqual([]);
  });

  it("scanRange が未設定（空文字）なら空配列", () => {
    const results = scanBirthDates({
      ...baseInput,
      scanRange: { start: "", end: "" },
    });
    expect(results).toEqual([]);
  });
});
