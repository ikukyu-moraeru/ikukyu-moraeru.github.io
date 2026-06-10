import { describe, expect, it } from "vitest";
import { mergeInsuredSegments } from "../carryOver";
import type { InsuredEmploymentSegment } from "../types";

function seg(
  id: string,
  start: string,
  end: string | null,
  opts: {
    employerName?: string;
    claimedBasicAllowanceAfterEnd?: boolean;
  } = {},
): InsuredEmploymentSegment {
  return {
    id,
    start,
    end,
    employerName: opts.employerName,
    ...(opts.claimedBasicAllowanceAfterEnd !== undefined
      ? { claimedBasicAllowanceAfterEnd: opts.claimedBasicAllowanceAfterEnd }
      : {}),
  };
}

describe("mergeInsuredSegments (Rule §4-2)", () => {
  it("空配列なら空配列を返す", () => {
    expect(mergeInsuredSegments([])).toEqual([]);
  });

  it("セグメント 1 件はそのまま返す", () => {
    const s = seg("a", "2024-01-01", null);
    expect(mergeInsuredSegments([s])).toEqual([s]);
  });

  it("離職翌日に再就職（ギャップ 0 日）→ 連結せず両セグメント残す（区切りは資格ごと・50103/50104）", () => {
    const segments = [
      seg("a", "2023-01-01", "2024-06-30", { employerName: "Co A" }),
      seg("b", "2024-07-01", null, { employerName: "Co B" }),
    ];
    const result = mergeInsuredSegments(segments);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("30 日空白・基本手当受給なし → 前職と通算（両セグメント残る）", () => {
    const segments = [
      seg("a", "2023-01-01", "2023-12-31", { employerName: "Co A" }),
      seg("b", "2024-01-31", null, { employerName: "Co B" }),
    ];
    const result = mergeInsuredSegments(segments);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("365 日丁度の空白は通算（境界値、両セグメント残る）", () => {
    const segments = [
      seg("a", "2022-01-01", "2023-01-01"),
      seg("b", "2024-01-02", null),
    ];
    const result = mergeInsuredSegments(segments);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("366 日空白 → 前職リセット（後職のみ残る）", () => {
    const segments = [
      seg("a", "2022-01-01", "2023-01-01"),
      seg("b", "2024-01-03", null),
    ];
    const result = mergeInsuredSegments(segments);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b");
    expect(result[0].start).toBe("2024-01-03");
  });

  it("前職に claimedBasicAllowanceAfterEnd=true → 前職リセット", () => {
    const segments = [
      seg("a", "2023-01-01", "2023-12-31", {
        claimedBasicAllowanceAfterEnd: true,
      }),
      seg("b", "2024-02-01", null),
    ];
    const result = mergeInsuredSegments(segments);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b");
  });

  it("前職に claimedBasicAllowanceAfterEnd=false → 通算可", () => {
    const segments = [
      seg("a", "2023-01-01", "2023-12-31", {
        claimedBasicAllowanceAfterEnd: false,
      }),
      seg("b", "2024-02-01", null),
    ];
    const result = mergeInsuredSegments(segments);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("前職に claim フラグ未設定（undefined）も通算可", () => {
    const segments = [
      seg("a", "2023-01-01", "2023-12-31"),
      seg("b", "2024-02-01", null),
    ];
    const result = mergeInsuredSegments(segments);
    expect(result).toHaveLength(2);
  });

  it("3 連続転職、すべてのギャップで通算可 → 3 件残る", () => {
    const segments = [
      seg("a", "2020-01-01", "2020-12-31", { employerName: "Co A" }),
      seg("b", "2021-06-01", "2022-05-31", { employerName: "Co B" }),
      seg("c", "2022-08-01", null, { employerName: "Co C" }),
    ];
    const result = mergeInsuredSegments(segments);
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("中間ギャップでリセット → 後続のみ生き残る", () => {
    const segments = [
      seg("a", "2020-01-01", "2020-12-31"),
      seg("b", "2021-06-01", "2022-05-31"),
      seg("c", "2023-11-01", null),
    ];
    const result = mergeInsuredSegments(segments);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c");
    expect(result[0].start).toBe("2023-11-01");
  });

  it("入力順がランダムでも時系列でソートされる", () => {
    const segments = [
      seg("c", "2024-01-01", null),
      seg("a", "2020-01-01", "2020-12-31"),
      seg("b", "2022-06-01", "2023-05-31"),
    ];
    const result = mergeInsuredSegments(segments);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(["b", "c"]);
  });

  it("重複するセグメントは end を伸ばして 1 つに集約", () => {
    const segments = [
      seg("a", "2023-01-01", "2023-12-31"),
      seg("b", "2023-06-01", "2024-06-30"),
    ];
    const result = mergeInsuredSegments(segments);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "a",
      start: "2023-01-01",
      end: "2024-06-30",
    });
  });
});
