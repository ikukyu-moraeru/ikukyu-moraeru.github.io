import { describe, expect, it } from "vitest";
import { buildCompleteMonths } from "../completeMonth";

describe("buildCompleteMonths", () => {
  it("Rule.md §3-2 の例: 育休開始 2026-04-15 / 窓口 2024-04-15 → 24完全月・端数なし", () => {
    const { completeMonths, fragment } = buildCompleteMonths(
      "2026-04-15",
      "2024-04-15",
    );
    expect(completeMonths).toHaveLength(24);
    expect(completeMonths[0]).toEqual({
      index: 1,
      start: "2026-03-15",
      end: "2026-04-14",
    });
    expect(completeMonths[1]).toEqual({
      index: 2,
      start: "2026-02-15",
      end: "2026-03-14",
    });
    expect(completeMonths[23]).toEqual({
      index: 24,
      start: "2024-04-15",
      end: "2024-05-14",
    });
    expect(fragment).toBeNull();
  });

  it("窓口がさらに前の場合は端数月が生成される", () => {
    const { completeMonths, fragment } = buildCompleteMonths(
      "2026-04-15",
      "2024-04-01",
    );
    expect(completeMonths).toHaveLength(24);
    expect(fragment).toEqual({
      start: "2024-04-01",
      end: "2024-04-14",
      days: 14,
    });
  });

  it("月末応当日のクランプ: 育休開始 2026-03-31", () => {
    const { completeMonths } = buildCompleteMonths("2026-03-31", "2024-03-01");
    // 完全月1: 2026-02-28 〜 2026-03-30
    expect(completeMonths[0]).toEqual({
      index: 1,
      start: "2026-02-28",
      end: "2026-03-30",
    });
    // 完全月2: 2026-01-31 〜 2026-02-27
    expect(completeMonths[1]).toEqual({
      index: 2,
      start: "2026-01-31",
      end: "2026-02-27",
    });
  });

  it("窓口 = 育休開始日 のとき完全月ゼロ", () => {
    const { completeMonths, fragment } = buildCompleteMonths(
      "2026-04-15",
      "2026-04-15",
    );
    expect(completeMonths).toHaveLength(0);
    expect(fragment).toBeNull();
  });

  it("端数月の日数計算が正しい (15日丁度のケース)", () => {
    const { fragment } = buildCompleteMonths("2026-04-15", "2024-04-01");
    expect(fragment?.days).toBe(14);

    // 15日ちょうどの端数を作るには窓口を 2024-04-01 → 2024-03-31 に
    const r2 = buildCompleteMonths("2026-04-15", "2024-03-31");
    expect(r2.fragment).toEqual({
      start: "2024-03-31",
      end: "2024-04-14",
      days: 15,
    });
  });
});
