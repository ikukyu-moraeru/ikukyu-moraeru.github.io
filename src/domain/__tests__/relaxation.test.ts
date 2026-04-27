import { describe, expect, it } from "vitest";
import { computeRelaxationDays } from "../relaxation";
import type { LeavePeriod } from "../types";

function makeLeave(
  start: string,
  end: string,
  hasWageDuringLeave = false,
  type: LeavePeriod["type"] = "産休",
  id = `${type}-${start}`,
): LeavePeriod {
  return { id, type, start, end, hasWageDuringLeave };
}

describe("computeRelaxationDays (Rule §3-4)", () => {
  const windowStart = "2024-04-15";
  const windowEnd = "2026-04-14";

  it("産休 98 日連続（賃金なし） → 98 日加算", () => {
    // 産前 42 + 産後 56 = 98 日連続
    const leave = makeLeave("2025-06-01", "2025-09-06"); // 98 日
    expect(
      computeRelaxationDays([leave], windowStart, windowEnd),
    ).toBe(98);
  });

  it("30 日未満の細切れは加算なし", () => {
    const leaves = [
      makeLeave("2025-01-01", "2025-01-20", false, "病気休職"), // 20 日
      makeLeave("2025-03-01", "2025-03-29", false, "病気休職"), // 29 日
    ];
    expect(
      computeRelaxationDays(leaves, windowStart, windowEnd),
    ).toBe(0);
  });

  it("30 日丁度のブロックは加算対象", () => {
    const leave = makeLeave("2025-06-01", "2025-06-30", false, "病気休職"); // 30 日
    expect(
      computeRelaxationDays([leave], windowStart, windowEnd),
    ).toBe(30);
  });

  it("賃金あり休業（hasWageDuringLeave=true）は加算対象外", () => {
    const leave = makeLeave("2025-06-01", "2025-09-06", true);
    expect(
      computeRelaxationDays([leave], windowStart, windowEnd),
    ).toBe(0);
  });

  it("800 日連続は 730 日にクランプ", () => {
    // 2024-05-01 から 800 日 = 2026-07-08（windowEnd 超過）
    // window 内は 2024-05-01 から windowEnd=2026-04-14 まで → 約714日
    // クランプ確認のため、window を広げて 800 日全部入るように
    const wideStart = "2023-01-01";
    const wideEnd = "2026-12-31";
    const leave = makeLeave("2024-01-01", "2026-03-10"); // 800 日
    expect(
      computeRelaxationDays([leave], wideStart, wideEnd),
    ).toBe(730);
  });

  it("window 外の休業期間は無視（クリップ後 30 日未満なら加算なし）", () => {
    // window: 2024-04-15..2026-04-14
    // 休業: 2024-03-01..2024-04-30（重なりは 4/15..4/30 = 16 日 → 30 日未満 → 0）
    const leave = makeLeave("2024-03-01", "2024-04-30");
    expect(
      computeRelaxationDays([leave], windowStart, windowEnd),
    ).toBe(0);
  });

  it("window でクリップされても 30 日以上残るブロックは加算", () => {
    // window: 2024-04-15..2026-04-14
    // 休業: 2024-03-01..2024-05-31 → クリップ後 2024-04-15..2024-05-31 = 47 日
    const leave = makeLeave("2024-03-01", "2024-05-31");
    expect(
      computeRelaxationDays([leave], windowStart, windowEnd),
    ).toBe(47);
  });

  it("隣接する複数 LeavePeriod の和集合で 30 日連続を判定", () => {
    // 個別では 20 + 15 日だが日単位で連続するので連続 35 日とみなす
    const leaves = [
      makeLeave("2025-06-01", "2025-06-20", false, "病気休職"), // 20 日
      makeLeave("2025-06-21", "2025-07-05", false, "病気休職"), // 15 日
    ];
    expect(
      computeRelaxationDays(leaves, windowStart, windowEnd),
    ).toBe(35);
  });

  it("重複する複数 LeavePeriod は和集合化して二重カウントしない", () => {
    const leaves = [
      makeLeave("2025-06-01", "2025-07-15"), // 45 日
      makeLeave("2025-07-01", "2025-07-31"), // 31 日（重複あり）
    ];
    // 和集合: 2025-06-01..2025-07-31 = 61 日
    expect(
      computeRelaxationDays(leaves, windowStart, windowEnd),
    ).toBe(61);
  });

  it("連続しない複数の 30 日以上ブロックはそれぞれ加算", () => {
    const leaves = [
      makeLeave("2025-01-01", "2025-02-09"), // 40 日
      makeLeave("2025-06-01", "2025-07-30"), // 60 日
    ];
    expect(
      computeRelaxationDays(leaves, windowStart, windowEnd),
    ).toBe(100);
  });

  it("LeavePeriod が空配列なら 0", () => {
    expect(computeRelaxationDays([], windowStart, windowEnd)).toBe(0);
  });
});
