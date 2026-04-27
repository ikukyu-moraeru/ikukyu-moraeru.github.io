import { describe, expect, it } from "vitest";
import { summarizeScan } from "../summary";
import type { EligibilityResult } from "../types";

function fakeResult(
  birthDate: string,
  countedMonths: number,
): EligibilityResult {
  return {
    birthDate,
    leaveStartDate: birthDate,
    childCareStartDate: birthDate,
    scanWindow: { start: birthDate, end: birthDate },
    baseWindowStart: birthDate,
    relaxationDays: 0,
    countedMonths,
    isEligible: countedMonths >= 12,
    shortage: Math.max(0, 12 - countedMonths),
    monthBreakdown: [],
  };
}

describe("summarizeScan", () => {
  it("空配列入力は既定値で返す", () => {
    const s = summarizeScan([]);
    expect(s).toEqual({
      totalDays: 0,
      passDays: 0,
      borderDays: 0,
      failDays: 0,
      shortfallMin: 0,
      bestBirthDate: null,
      worstBirthDate: null,
      firstPassDate: null,
      lastPassDate: null,
      passStreaks: [],
      failStreaks: [],
    });
  });

  it("全充足: passDays = totalDays, passStreaks 1 つ・failStreaks なし", () => {
    const results = [
      fakeResult("2026-09-01", 24),
      fakeResult("2026-09-02", 24),
      fakeResult("2026-09-03", 24),
    ];
    const s = summarizeScan(results);
    expect(s.totalDays).toBe(3);
    expect(s.passDays).toBe(3);
    expect(s.failDays).toBe(0);
    expect(s.shortfallMin).toBe(0);
    expect(s.firstPassDate).toBe("2026-09-01");
    expect(s.lastPassDate).toBe("2026-09-03");
    expect(s.passStreaks).toEqual([
      { start: "2026-09-01", end: "2026-09-03", days: 3 },
    ]);
    expect(s.failStreaks).toEqual([]);
  });

  it("全不足: failStreaks 1 つ・passStreaks なし", () => {
    const results = [
      fakeResult("2026-09-01", 8),
      fakeResult("2026-09-02", 9),
      fakeResult("2026-09-03", 10),
    ];
    const s = summarizeScan(results);
    expect(s.passDays).toBe(0);
    expect(s.failDays).toBe(3);
    expect(s.shortfallMin).toBe(2); // 12 - 10
    expect(s.firstPassDate).toBeNull();
    expect(s.lastPassDate).toBeNull();
    expect(s.passStreaks).toEqual([]);
    expect(s.failStreaks).toEqual([
      { start: "2026-09-01", end: "2026-09-03", days: 3 },
    ]);
  });

  it("pass→fail→pass の縞模様: passStreaks 2 つ・failStreaks 1 つ", () => {
    const results = [
      fakeResult("2026-09-01", 12),
      fakeResult("2026-09-02", 12),
      fakeResult("2026-09-03", 11),
      fakeResult("2026-09-04", 10),
      fakeResult("2026-09-05", 12),
    ];
    const s = summarizeScan(results);
    expect(s.passDays).toBe(3);
    expect(s.failDays).toBe(2);
    expect(s.passStreaks).toEqual([
      { start: "2026-09-01", end: "2026-09-02", days: 2 },
      { start: "2026-09-05", end: "2026-09-05", days: 1 },
    ]);
    expect(s.failStreaks).toEqual([
      { start: "2026-09-03", end: "2026-09-04", days: 2 },
    ]);
    expect(s.shortfallMin).toBe(1);
    expect(s.firstPassDate).toBe("2026-09-01");
    expect(s.lastPassDate).toBe("2026-09-05");
  });

  it("fail→pass→fail の縞模様: failStreaks 2 つ", () => {
    const results = [
      fakeResult("2026-09-01", 8),
      fakeResult("2026-09-02", 14),
      fakeResult("2026-09-03", 9),
    ];
    const s = summarizeScan(results);
    expect(s.failStreaks).toEqual([
      { start: "2026-09-01", end: "2026-09-01", days: 1 },
      { start: "2026-09-03", end: "2026-09-03", days: 1 },
    ]);
    expect(s.passStreaks).toEqual([
      { start: "2026-09-02", end: "2026-09-02", days: 1 },
    ]);
  });

  it("border 判定: 11.5 ≤ counted < 12.5", () => {
    const results = [
      fakeResult("2026-09-01", 11.5), // border
      fakeResult("2026-09-02", 12), // pass + border
      fakeResult("2026-09-03", 12.5), // pass, not border
      fakeResult("2026-09-04", 11.0), // not border
      fakeResult("2026-09-05", 12.499), // border
    ];
    const s = summarizeScan(results);
    expect(s.borderDays).toBe(3);
  });

  it("best / worst: countedMonths 最大・最小（同値は最初の出現を採用）", () => {
    const results = [
      fakeResult("2026-09-01", 10),
      fakeResult("2026-09-02", 24),
      fakeResult("2026-09-03", 24),
      fakeResult("2026-09-04", 8),
      fakeResult("2026-09-05", 8),
    ];
    const s = summarizeScan(results);
    expect(s.bestBirthDate).toBe("2026-09-02");
    expect(s.worstBirthDate).toBe("2026-09-04");
  });
});
