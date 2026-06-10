import { describe, expect, it } from "vitest";
import { judgeEligibility } from "../eligibility";
import type {
  DailyAttendance,
  InsuredEmploymentSegment,
  LeavePeriod,
  UserInput,
} from "../types";

/**
 * `judgeEligibility` 経由で、非公開関数 `adjustMaternityForBirthDate` の
 * 「出産日候補ごとの産休シフト」ロジックを検証するテスト。
 *
 * 前提となる計算ルール（eligibility.ts より）:
 *  - 予定日 = scanRange の中央日（deriveExpectedFromScanRange）
 *  - delta  = 候補出産日 - 予定日
 *  - type==="産休" の leavePeriod は:
 *      end   → end + delta（customMaternityEnd 指定時はシフトしない）
 *      start → min(登録上の start, 候補出産日)
 *      （end < start になる不整合時はその期間を触らない）
 *  - シフト後の産休に重なる attendances は集計から除外
 *  - 産休以外の type（病気休職など）はシフトされない
 *  - 基準日（育休開始日）= customChildCareStart ?? (customMaternityEnd+1) ?? (候補+57)
 *  - baseWindow = [基準日-2年, 基準日-1日]
 *  - relaxationDays = baseWindow と重なる「賃金なし休業（連続30日以上）」日数
 */

const fullCoverageSegment: InsuredEmploymentSegment = {
  id: "seg1",
  start: "2020-01-01",
  end: null,
};

function makeInput(overrides: Partial<UserInput> = {}): UserInput {
  return {
    isMultipleBirth: false,
    scanRange: { start: "2026-02-17", end: "2026-02-17" },
    insuredSegments: [fullCoverageSegment],
    leavePeriods: [],
    attendances: [],
    ...overrides,
  };
}

/** 賃金なし産休の LeavePeriod を作る（auto相当: 予定日-42 〜 予定日+56）。 */
function maternity(start: string, end: string): LeavePeriod {
  return {
    id: "mat1",
    type: "産休",
    start,
    end,
    hasWageDuringLeave: false,
  };
}

describe("出産日候補による産休シフト", () => {
  // 育休開始日（基準日）を固定して、出産日候補が変わっても月区切り・baseWindow が
  // 動かないようにするための共通値。
  // customChildCareStart = 2026-04-15 → baseWindow = 2024-04-15 .. 2026-04-14
  const FIXED_CHILDCARE_START = "2026-04-15";
  const BASE_WINDOW_START = "2024-04-15";
  const BASE_WINDOW_END = "2026-04-14";

  it("ケース1: 育休開始日固定でも、出産日が遅いほど産休が伸びて緩和加算が増える", () => {
    // 予定日 = scanRange 中央 = 2025-06-01
    // 産休登録(auto相当) = 予定日-42 .. 予定日+56 = 2025-04-20 .. 2025-07-27（全長 99 日）
    // この産休は baseWindow(2024-04-15 .. 2026-04-14) に完全に収まるのでクリップされない。
    const EXPECTED = "2025-06-01"; // 出産予定日
    const MAT_START = "2025-04-20"; // 2025-06-01 - 42 日
    const MAT_END = "2025-07-27"; // 2025-06-01 + 56 日

    const base = makeInput({
      scanRange: { start: EXPECTED, end: EXPECTED }, // 中央 = 予定日
      customChildCareStart: FIXED_CHILDCARE_START,
      leavePeriods: [maternity(MAT_START, MAT_END)],
    });

    // 候補 = 予定日どおり（delta = 0）
    //   シフトなし: 産休 2025-04-20 .. 2025-07-27（99 日）が丸ごと baseWindow 内
    //   relaxationDays = 99
    const onTime = judgeEligibility(base, EXPECTED);
    expect(onTime.baseWindowStart).toBe(BASE_WINDOW_START);
    expect(onTime.scanWindow.end).toBe(BASE_WINDOW_END);
    expect(onTime.relaxationDays).toBe(99);

    // 候補 = 予定日 + 14 日 = 2025-06-15（delta = +14）
    //   end は +14 シフト → 2025-07-27 + 14 = 2025-08-10
    //   start は min(2025-04-20, 2025-06-15) = 2025-04-20（変わらず）
    //   シフト後産休 = 2025-04-20 .. 2025-08-10（99 + 14 = 113 日）すべて baseWindow 内
    //   relaxationDays = 113
    const CANDIDATE_LATE = "2025-06-15";
    const late = judgeEligibility(base, CANDIDATE_LATE);
    expect(late.relaxationDays).toBe(113);

    // 遅いほど産休が長くなり、緩和加算が大きくなる
    expect(late.relaxationDays).toBeGreaterThan(onTime.relaxationDays);
    expect(late.relaxationDays - onTime.relaxationDays).toBe(14);
  });

  it("ケース2: 予定より大きく早く生まれると、出勤予定だった日が除外され月のカウントが落ちる", () => {
    // 予定日 = 2026-02-17（既定）。産休登録 = 2026-01-06 .. 2026-04-14。
    // customChildCareStart = 2026-04-15 で月区切りを固定:
    //   m4(index 4): 2025-12-15 .. 2026-01-14（産休開始 2026-01-06 を含む完全月）
    const EXPECTED = "2026-02-17";
    const MAT_START = "2026-01-06"; // 2026-02-17 - 42 日
    const MAT_END = "2026-04-14"; // 2026-02-17 + 56 日

    // m4 内にちょうど 11 日の出勤を配置する。
    // うち 4 日（12/29, 12/30, 12/31, 01/02）は「産休開始予定日 2026-01-06 より前」だが、
    // 早産候補日 2025-12-29 以降なので、早産時にはシフト後産休に飲み込まれて除外される。
    const ATTENDANCE_DATES = [
      "2025-12-18",
      "2025-12-19",
      "2025-12-22",
      "2025-12-23",
      "2025-12-24",
      "2025-12-25",
      "2025-12-26", // ここまで 7 日（早産候補日 2025-12-29 より前 → 常に残る）
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-02", // この 4 日が早産時に除外対象
    ];
    const attendances: DailyAttendance[] = ATTENDANCE_DATES.map((date) => ({
      date,
      status: "work",
    }));

    const base = makeInput({
      scanRange: { start: EXPECTED, end: EXPECTED },
      customChildCareStart: FIXED_CHILDCARE_START,
      leavePeriods: [maternity(MAT_START, MAT_END)],
      attendances,
    });

    // m4(start = 2025-12-15) を range.start で特定するヘルパー。
    const findM4 = (
      result: ReturnType<typeof judgeEligibility>,
    ): (typeof result.monthBreakdown)[number] => {
      const m = result.monthBreakdown.find(
        (j) => j.range.start === "2025-12-15",
      );
      if (!m) throw new Error("m4 (2025-12-15) が monthBreakdown に存在しない");
      return m;
    };

    // 候補 = 予定日どおり（delta = 0）
    //   シフト後産休 = min(2026-01-06, 2026-02-17)=2026-01-06 .. 2026-04-14
    //   m4 の出勤(12/18..01/02)はすべて 2026-01-06 より前 → 除外されず 11 日 → counted = 1
    const onTime = judgeEligibility(base, EXPECTED);
    const m4OnTime = findM4(onTime);
    expect(m4OnTime.attendance?.basicWageDays).toBe(11);
    expect(m4OnTime.counted).toBe(1);
    expect(m4OnTime.reason).toBe("11日以上");

    // 候補 = 予定日 - 50 日 = 2025-12-29（産休開始予定日 2026-01-06 より前に出産）
    //   delta = -50 → end = 2026-04-14 - 50 = 2026-02-23
    //   start = min(2026-01-06, 2025-12-29) = 2025-12-29
    //   シフト後産休 = 2025-12-29 .. 2026-02-23
    //   → m4 の出勤のうち 12/29, 12/30, 12/31, 01/02 の 4 日が除外 → 11 - 4 = 7 日
    //   7 日 < 11 → counted = 0
    const EARLY_CANDIDATE = "2025-12-29";
    const early = judgeEligibility(base, EARLY_CANDIDATE);
    const m4Early = findM4(early);
    expect(m4Early.attendance?.basicWageDays).toBe(7);
    expect(m4Early.counted).toBe(0);
    expect(m4Early.reason).toBe("条件未達");
  });

  it("ケース3: customMaternityEnd 指定時は終了日がシフトせず、緩和加算が候補で変わらない", () => {
    // ケース1 と同じ予定日・産休だが、終了日を customMaternityEnd で固定する。
    // 開始のクランプが効かない範囲（候補が産休開始 2025-04-20 より後＝早産でない）の
    // 2 候補で relaxationDays が一致することを確認する。
    const EXPECTED = "2025-06-01";
    const MAT_START = "2025-04-20";
    const MAT_END = "2025-07-27";

    const base = makeInput({
      scanRange: { start: EXPECTED, end: EXPECTED },
      // customMaternityEnd を指定すると基準日が end+1 に追従するが、
      // ここでは customChildCareStart を固定して baseWindow を固定する。
      customChildCareStart: FIXED_CHILDCARE_START,
      customMaternityEnd: MAT_END,
      leavePeriods: [maternity(MAT_START, MAT_END)],
    });

    // 候補 = 予定日（delta = 0）: 産休 2025-04-20 .. 2025-07-27 → relax = 99
    const onTime = judgeEligibility(base, EXPECTED);
    expect(onTime.relaxationDays).toBe(99);

    // 候補 = 予定日 + 14（delta = +14）: customMaternityEnd 指定のため end は 2025-07-27 で固定。
    //   start も min(2025-04-20, 2025-06-15) = 2025-04-20 で変わらず。
    //   → 産休は 2025-04-20 .. 2025-07-27 のまま → relax = 99（変わらない）
    const CANDIDATE_LATE = "2025-06-15";
    const late = judgeEligibility(base, CANDIDATE_LATE);
    expect(late.relaxationDays).toBe(99);

    expect(late.relaxationDays).toBe(onTime.relaxationDays);
  });

  it("ケース4: 産休以外の休業（病気休職）はシフトされず、候補を変えても緩和加算が変わらない", () => {
    // 病気休職（賃金なし・60 日）を baseWindow 内に登録。産休は登録しない。
    // 病気休職は出産日と無関係なのでシフトされず、候補を変えても relaxationDays は一定。
    // 病気休職 = 2025-01-01 .. 2025-03-01（differenceInCalendarDays + 1 = 60 日 ≥ 30）
    const SICK_START = "2025-01-01";
    const SICK_END = "2025-03-01";
    const sickLeave: LeavePeriod = {
      id: "sick1",
      type: "病気休職",
      start: SICK_START,
      end: SICK_END,
      hasWageDuringLeave: false,
    };

    const base = makeInput({
      scanRange: { start: "2026-02-17", end: "2026-02-17" },
      customChildCareStart: FIXED_CHILDCARE_START, // baseWindow 固定
      leavePeriods: [sickLeave],
    });

    // 病気休職は baseWindow(2024-04-15 .. 2026-04-14) に完全に収まる → relax = 60
    // 候補 = 予定日どおり
    const onTime = judgeEligibility(base, "2026-02-17");
    expect(onTime.relaxationDays).toBe(60);

    // 候補 = 早い / 遅い いずれでも病気休職はシフトされない → relax = 60 のまま
    const earlier = judgeEligibility(base, "2026-01-01");
    const later = judgeEligibility(base, "2026-04-01");
    expect(earlier.relaxationDays).toBe(60);
    expect(later.relaxationDays).toBe(60);
  });

  it("ケース5: 回帰 — 候補日 = 予定日（delta=0）なら産休は登録どおりに使われる", () => {
    // scanRange 中央 = 候補日 のとき delta=0 → シフトは実質無効。
    // 産休登録(2025-04-20 .. 2025-07-27, 99 日)がそのまま baseWindow と重なる。
    const EXPECTED = "2025-06-01";
    const MAT_START = "2025-04-20";
    const MAT_END = "2025-07-27";

    const input = makeInput({
      scanRange: { start: EXPECTED, end: EXPECTED },
      customChildCareStart: FIXED_CHILDCARE_START,
      leavePeriods: [maternity(MAT_START, MAT_END)],
    });

    // 候補 = 予定日 → 登録期間そのまま → relax = 産休 99 日（baseWindow に完全内包）
    const result = judgeEligibility(input, EXPECTED);
    expect(result.relaxationDays).toBe(99);
    // baseWindow も従来どおり
    expect(result.baseWindowStart).toBe(BASE_WINDOW_START);
    expect(result.scanWindow.end).toBe(BASE_WINDOW_END);
  });

  it("ケース6: customMaternityStart より早い出産日候補では leaveStartDate = 出産日になる", () => {
    // customMaternityStart = 2025-04-25 を指定。
    // leaveStartDate = min(customMaternityStart, 出産日)。
    const EXPECTED = "2025-06-01";
    const CUSTOM_MAT_START = "2025-04-25";

    const input = makeInput({
      scanRange: { start: EXPECTED, end: EXPECTED },
      customMaternityStart: CUSTOM_MAT_START,
      customChildCareStart: FIXED_CHILDCARE_START,
    });

    // 候補 = 予定日（customMaternityStart より後）→ leaveStartDate = customMaternityStart
    const onTime = judgeEligibility(input, EXPECTED);
    expect(onTime.leaveStartDate).toBe(CUSTOM_MAT_START);

    // 候補 = 2025-04-10（customMaternityStart 2025-04-25 より早い出産）
    //   → leaveStartDate = min(2025-04-25, 2025-04-10) = 2025-04-10（出産日）
    const EARLY_CANDIDATE = "2025-04-10";
    const early = judgeEligibility(input, EARLY_CANDIDATE);
    expect(early.leaveStartDate).toBe(EARLY_CANDIDATE);
  });
});
