import { describe, expect, it } from "vitest";
import type { UserInput } from "../types";
import { validateUserInput } from "../validate";

const okInput: UserInput = {
  isMultipleBirth: false,
  scanRange: { start: "2026-09-01", end: "2026-09-29" },
  insuredSegments: [
    { id: "s1", start: "2024-01-01", end: null, employerName: "Co" },
  ],
  nonInsuredGaps: [],
  leavePeriods: [],
  attendances: [
    { date: "2024-01-15", status: "work", hours: 8 },
    { date: "2024-01-16", status: "work", hours: 8 },
  ],
};

describe("validateUserInput", () => {
  it("正常入力は issues なし", () => {
    expect(validateUserInput(okInput)).toEqual([]);
  });

  describe("scanRange", () => {
    it("start > end は error", () => {
      const issues = validateUserInput({
        ...okInput,
        scanRange: { start: "2026-10-01", end: "2026-09-01" },
      });
      expect(
        issues.some(
          (i) => i.severity === "error" && /スキャン範囲/.test(i.message),
        ),
      ).toBe(true);
    });

    it("start = end（単日）は OK", () => {
      const issues = validateUserInput({
        ...okInput,
        scanRange: { start: "2026-09-15", end: "2026-09-15" },
      });
      expect(issues).toEqual([]);
    });
  });

  describe("LeavePeriod", () => {
    it("start > end は error（itemId 付き）", () => {
      const issues = validateUserInput({
        ...okInput,
        leavePeriods: [
          {
            id: "L1",
            type: "病気休職",
            start: "2025-08-01",
            end: "2025-07-01",
            hasWageDuringLeave: false,
          },
        ],
      });
      const target = issues.find((i) => i.itemId === "L1");
      expect(target?.severity).toBe("error");
    });

    it("正常な期間 1 件は issues なし", () => {
      const issues = validateUserInput({
        ...okInput,
        leavePeriods: [
          {
            id: "L1",
            type: "病気休職",
            start: "2025-06-01",
            end: "2025-07-30",
            hasWageDuringLeave: false,
          },
        ],
      });
      expect(issues).toEqual([]);
    });

    it("同一カテゴリ内の期間重複は warning", () => {
      const issues = validateUserInput({
        ...okInput,
        leavePeriods: [
          {
            id: "L1",
            type: "病気休職",
            start: "2025-06-01",
            end: "2025-07-30",
            hasWageDuringLeave: false,
          },
          {
            id: "L2",
            type: "産休",
            start: "2025-07-15",
            end: "2025-08-15",
            hasWageDuringLeave: false,
          },
        ],
      });
      const overlap = issues.find(
        (i) => i.severity === "warning" && i.itemId === "L2",
      );
      expect(overlap).toBeDefined();
    });
  });

  describe("NonInsuredGap", () => {
    it("start > end は error", () => {
      const issues = validateUserInput({
        ...okInput,
        nonInsuredGaps: [
          {
            id: "G1",
            start: "2025-04-01",
            end: "2025-03-01",
            reason: "転職の空白",
            basicAllowanceClaimed: false,
          },
        ],
      });
      const target = issues.find((i) => i.itemId === "G1");
      expect(target?.severity).toBe("error");
    });

    it("同一カテゴリ内の重複は warning", () => {
      const issues = validateUserInput({
        ...okInput,
        nonInsuredGaps: [
          {
            id: "G1",
            start: "2025-03-01",
            end: "2025-04-30",
            reason: "転職の空白",
            basicAllowanceClaimed: false,
          },
          {
            id: "G2",
            start: "2025-04-15",
            end: "2025-05-15",
            reason: "退職後無職",
            basicAllowanceClaimed: false,
          },
        ],
      });
      const overlap = issues.find(
        (i) => i.severity === "warning" && i.itemId === "G2",
      );
      expect(overlap).toBeDefined();
    });
  });

  describe("Segment / Gap の重複", () => {
    it("被保険者セグメントと未加入期間が重複していたら warning", () => {
      const issues = validateUserInput({
        ...okInput,
        insuredSegments: [
          { id: "S1", start: "2024-01-01", end: "2025-12-31" },
        ],
        nonInsuredGaps: [
          {
            id: "G1",
            start: "2025-06-01",
            end: "2025-06-30",
            reason: "短時間労働で未加入",
            basicAllowanceClaimed: false,
          },
        ],
      });
      const overlap = issues.find(
        (i) =>
          i.severity === "warning" &&
          i.itemId === "G1" &&
          /時間軸で重複/.test(i.message),
      );
      expect(overlap).toBeDefined();
    });

    it("セグメントとギャップが時間軸で重ならないなら issues なし", () => {
      const issues = validateUserInput({
        ...okInput,
        insuredSegments: [
          { id: "S1", start: "2024-01-01", end: "2024-12-31" },
        ],
        nonInsuredGaps: [
          {
            id: "G1",
            start: "2025-01-01",
            end: "2025-03-31",
            reason: "退職後無職",
            basicAllowanceClaimed: false,
          },
        ],
      });
      expect(issues).toEqual([]);
    });
  });

  describe("attendances", () => {
    it("date 重複は error", () => {
      const issues = validateUserInput({
        ...okInput,
        attendances: [
          { date: "2024-01-15", status: "work", hours: 8 },
          { date: "2024-01-15", status: "paid_leave" },
        ],
      });
      const dup = issues.find(
        (i) => i.severity === "error" && /同一日/.test(i.message),
      );
      expect(dup).toBeDefined();
    });

    it("hours が負の値は error", () => {
      const issues = validateUserInput({
        ...okInput,
        attendances: [{ date: "2024-01-15", status: "work", hours: -1 }],
      });
      const neg = issues.find(
        (i) => i.severity === "error" && /労働時間/.test(i.message),
      );
      expect(neg).toBeDefined();
    });

    it("hours が NaN は error", () => {
      const issues = validateUserInput({
        ...okInput,
        attendances: [{ date: "2024-01-15", status: "work", hours: NaN }],
      });
      const nan = issues.find(
        (i) => i.severity === "error" && /労働時間/.test(i.message),
      );
      expect(nan).toBeDefined();
    });

    it("hours 未設定は OK", () => {
      const issues = validateUserInput({
        ...okInput,
        attendances: [{ date: "2024-01-15", status: "work" }],
      });
      expect(issues).toEqual([]);
    });
  });
});
