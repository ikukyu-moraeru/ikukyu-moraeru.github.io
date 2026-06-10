import { addDays, eachDayOfInterval, format, parseISO } from "date-fns";
import { describe, expect, it } from "vitest";
import { scanBirthDates } from "../birthDateScan";
import { judgeEligibility } from "../eligibility";
import type {
  DailyAttendance,
  InsuredEmploymentSegment,
  LeavePeriod,
  UserInput,
} from "../types";

/**
 * 自動モード（育休開始日が customChildCareStart 未設定・customMaternityEnd 未設定）の
 * 出産日スキャンに対する結合テスト。
 *
 * eligibility.maternityShift.test.ts は customChildCareStart を固定して
 * 「基準日（育休開始日）を動かさない」前提でシフト挙動だけを切り出していた。
 * 本ファイルはその補集合で、自動モード特有の
 *   - 基準日（育休開始日）= 出産日 + 産後 56 日 + 1 日（= 出産日 + 57）が候補ごとに動く
 *   - scanWindow.end = baseWindowEnd = 基準日 - 1 = 出産日 + 56 も候補ごとに動く
 *   - 月区切り（buildCompleteMonths）が基準日前日から遡るため候補ごとに 1 日ずつずれる
 *   - 産休シフト（end = 実出産 + 56 に追従、start = min(登録 start, 出産日)）が同時に効く
 * という複合挙動を scanBirthDates で複数候補を走査して検証する。
 *
 * 計算ルール（eligibility.ts / completeMonth.ts より）:
 *  - PRENATAL_DAYS_SINGLE = 42, POSTNATAL_DAYS = 56
 *  - childCareStartDate = birthDate + 57
 *  - baseWindowStart = childCareStartDate - 2 年, baseWindowEnd = childCareStartDate - 1
 *  - 完全月 index=1 は基準日前日を末尾に、そこから月単位で遡る
 *  - 予定日（産休シフトの delta 基準）= scanRange の中央日
 */

const fmt = (d: Date): string => format(d, "yyyy-MM-dd");

function makeInput(overrides: Partial<UserInput> = {}): UserInput {
  return {
    isMultipleBirth: false,
    scanRange: { start: "2026-03-15", end: "2026-03-15" },
    insuredSegments: [{ id: "seg1", start: "2020-01-01", end: null }],
    leavePeriods: [],
    attendances: [],
    ...overrides,
  };
}

/** 連続 n 日分の work 出勤を生成する。 */
function workRun(startDate: string, n: number): DailyAttendance[] {
  const out: DailyAttendance[] = [];
  for (let k = 0; k < n; k++) {
    out.push({ date: fmt(addDays(parseISO(startDate), k)), status: "work" });
  }
  return out;
}

describe("自動モードの出産日スキャン（結合）", () => {
  it("テスト1: 基準日と判定窓の終端が候補ごとに動く（childCareStart = 出産日+57, scanWindow.end = 出産日+56）", () => {
    // 休業も出勤も無い素の入力で 5 候補（2026-03-01 .. 2026-03-05）を走査する。
    // 自動モードでは候補出産日 birthDate に対し:
    //   childCareStartDate = birthDate + 57（産後 56 日 + 1）
    //   scanWindow.end     = baseWindowEnd = childCareStartDate - 1 = birthDate + 56
    // が成り立つことを全候補で確認する。
    const input = makeInput({
      scanRange: { start: "2026-03-01", end: "2026-03-05" },
    });

    const results = scanBirthDates(input);
    expect(results).toHaveLength(5); // 03-01 .. 03-05 の 5 日（inclusive）

    for (const r of results) {
      const bd = parseISO(r.birthDate);
      expect(r.childCareStartDate).toBe(fmt(addDays(bd, 57)));
      expect(r.scanWindow.end).toBe(fmt(addDays(bd, 56)));
      // scanWindow.end と childCareStartDate は常に隣接（前日関係）
      expect(r.scanWindow.end).toBe(
        fmt(addDays(parseISO(r.childCareStartDate), -1)),
      );
    }
  });

  it("テスト2: 雇用保険加入ぎりぎりの入力で、候補により isEligible / countedMonths が分かれる", () => {
    // 産休・休業なし → relaxationDays = 0、判定窓 = [基準日-2年, 基準日-1]。
    // 予定日（= scanRange 中央）は産休が無いので delta に影響せず無関係。
    //
    // 設計のねらい:
    //   出勤データを「最新側 11 完全月（idx1..11）＋最古完全月（idx24）」だけに 11 日ずつ置く。
    //   → 加入が足りれば 12 か月、最古月が未加入なら 11 か月、で eligible/not が分かれる。
    //
    // 月区切りは基準日前日から遡るので候補が 1 日後ろにずれると全月境界も 1 日後ろにずれる。
    // 各完全月の出勤は「月 start + 9 日（= 中央付近）」開始の 11 日連続に置き、
    // ±2 日程度の候補ずれでも同じ月の内側に留まるようにする（境界は月 start 付近）。
    //
    // 予定日（中央）= 2026-03-15。これを基準に各完全月の絶対日付を決める。
    const PIVOT_BIRTH = "2026-03-15";
    const pivotChildCare = fmt(addDays(parseISO(PIVOT_BIRTH), 57)); // 2026-05-11
    // 基準となる完全月割り（PIVOT_BIRTH のもの）を作って出勤を配置する。
    const pivot = judgeEligibility(
      makeInput({ scanRange: { start: PIVOT_BIRTH, end: PIVOT_BIRTH } }),
      PIVOT_BIRTH,
    );
    expect(pivot.childCareStartDate).toBe(pivotChildCare);
    // 基準割りの monthBreakdown は index 昇順（1 が最新）。idx1..11 と idx24 を使う。
    const monthByIndex = (idx: number) => {
      const m = pivot.monthBreakdown.find((j) => j.range.index === idx);
      if (!m) throw new Error(`idx ${idx} が monthBreakdown に存在しない`);
      return m.range;
    };

    const attendances: DailyAttendance[] = [];
    // 最新側 11 完全月（idx1..11）: 各月 start+9 日（≒ 20 日始まり）に 11 日連続。
    for (const idx of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      const m = monthByIndex(idx);
      attendances.push(...workRun(fmt(addDays(parseISO(m.start), 9)), 11));
    }
    // 最古完全月（idx24, 基準割りで 2024-05-11 .. 2024-06-10）にも 11 日。
    // この月の加入可否を seg.start で制御し、候補で分岐させる。
    const m24 = monthByIndex(24);
    attendances.push(...workRun(fmt(addDays(parseISO(m24.start), 9)), 11));

    // seg.start = 2024-05-12。
    //   基準割り idx24 の start は 2024-05-11（< seg.start）→ この候補では idx24 は未加入。
    //   候補が後ろにずれて idx24 の start が 2024-05-12 以上になると加入に転じる。
    //   idx24.start = 基準日 - 2年 近傍。基準日 = birthDate+57 なので
    //   birthDate を 1 日後ろにすると idx24.start も 1 日後ろにずれる。
    //     birthDate 2026-03-15 → idx24.start 2024-05-11（未加入）
    //     birthDate 2026-03-16 → idx24.start 2024-05-12（加入）
    const SEG_START = "2024-05-12";
    const input = makeInput({
      // scanRange 中央が 2026-03-15（= PIVOT_BIRTH）になる範囲。03-13..03-17 の 5 候補。
      scanRange: { start: "2026-03-13", end: "2026-03-17" },
      insuredSegments: [{ id: "seg1", start: SEG_START, end: null }],
      attendances,
    });

    const results = scanBirthDates(input);
    expect(results).toHaveLength(5);

    // 期待値（手計算）:
    //   2026-03-13 / 03-14 / 03-15: idx24.start < seg.start → 完全月は seg.start で
    //     打ち切られ 23 か月。idx24 の出勤 11 日は先頭の端数（15 日以上）に入り +0.5。
    //     → counted = 11.5（idx1..11 の 11 か月 + 端数 0.5）→ not eligible
    //   2026-03-16 / 03-17: idx24.start ≥ seg.start → idx24 が完全月として成立
    //     → counted = 12 → eligible
    const byBirth = Object.fromEntries(results.map((r) => [r.birthDate, r]));

    expect(byBirth["2026-03-13"].countedMonths).toBe(11.5);
    expect(byBirth["2026-03-13"].isEligible).toBe(false);
    expect(byBirth["2026-03-14"].countedMonths).toBe(11.5);
    expect(byBirth["2026-03-14"].isEligible).toBe(false);
    expect(byBirth["2026-03-15"].countedMonths).toBe(11.5);
    expect(byBirth["2026-03-15"].isEligible).toBe(false);
    expect(byBirth["2026-03-16"].countedMonths).toBe(12);
    expect(byBirth["2026-03-16"].isEligible).toBe(true);
    expect(byBirth["2026-03-17"].countedMonths).toBe(12);
    expect(byBirth["2026-03-17"].isEligible).toBe(true);

    // 受け取れる日と受け取れない日が混在していること（スキャンの意義）
    const eligibles = results.filter((r) => r.isEligible);
    expect(eligibles.length).toBeGreaterThan(0);
    expect(eligibles.length).toBeLessThan(results.length);
  });

  it("テスト3: 産休シフトとの複合 — 遅い候補ほど産休が長くなり relaxationDays が単調増加する", () => {
    // 自動モードでは産休 end も baseWindowEnd も候補ごとに動く。導出:
    //   予定日（中央）= 2025-06-01。産休登録 = 予定日-42 .. 予定日+56 = 2025-04-20 .. 2025-07-27。
    //   delta = 候補 - 予定日。
    //   シフト後産休 end   = (予定日+56) + delta = 候補 + 56
    //   シフト後産休 start = min(登録 start 2025-04-20, 候補)
    //       → ここで扱う候補（05-28..06-05）はすべて 2025-04-20 より後なので start = 2025-04-20 固定
    //   baseWindowEnd = childCareStart - 1 = (候補+57) - 1 = 候補 + 56
    //       → 産休 end (= 候補+56) は baseWindowEnd とちょうど一致し、判定窓に完全内包される
    //   baseWindowStart = 候補 + 57 - 2年。産休 start 2025-04-20 はこれより十分新しく内包される。
    //   よって relaxationDays = 産休の長さ = (候補+56) - (2025-04-20) + 1 = delta + 99。
    //   delta が 1 増えるごとに relaxationDays が 1 増える単調増加になる。
    const EXPECTED = "2025-06-01"; // scanRange 中央 = 予定日
    const MAT_START = "2025-04-20"; // 2025-06-01 - 42
    const MAT_END = "2025-07-27"; // 2025-06-01 + 56
    const maternity: LeavePeriod = {
      id: "mat1",
      type: "産休",
      start: MAT_START,
      end: MAT_END,
      hasWageDuringLeave: false,
    };
    const segment: InsuredEmploymentSegment = {
      id: "seg1",
      start: "2020-01-01",
      end: null,
    };

    const input = makeInput({
      // 中央 = (05-28 + 06-05)/2 = 06-01 = 予定日。delta = -4 .. +4 の 9 候補。
      scanRange: { start: "2025-05-28", end: "2025-06-05" },
      insuredSegments: [segment],
      leavePeriods: [maternity],
    });

    const results = scanBirthDates(input);
    expect(results).toHaveLength(9); // 05-28 .. 06-05

    // 期待 relaxationDays = delta + 99（Node 手計算検証済み: 95,96,...,103）
    for (const r of results) {
      const delta =
        (parseISO(r.birthDate).getTime() - parseISO(EXPECTED).getTime()) /
        86400000;
      expect(r.relaxationDays).toBe(delta + 99);
    }

    // 単調増加: 候補を 1 日後ろにずらすと relaxationDays が必ず 1 増える
    for (let i = 1; i < results.length; i++) {
      expect(results[i].relaxationDays).toBe(results[i - 1].relaxationDays + 1);
    }

    // 端の値も明示確認
    const first = results[0]; // 2025-05-28, delta=-4
    const last = results[results.length - 1]; // 2025-06-05, delta=+4
    expect(first.birthDate).toBe("2025-05-28");
    expect(first.relaxationDays).toBe(95);
    expect(last.birthDate).toBe("2025-06-05");
    expect(last.relaxationDays).toBe(103);
  });

  it("テスト4: 単調性（プロパティ的）— 出勤固定でも候補前進で childCareStart と scanWindow.end が 1 日ずつ後退する", () => {
    // 出勤データを固定したまま、連続した候補範囲を走査する。
    // 自動モードでは候補日が 1 日進むと基準日（出産日+57）と判定窓終端（出産日+56）が
    // ともに必ず 1 日ずつ後ろにずれる（出勤データの中身に依存しない構造的性質）。
    // 全候補ペア（隣接）でこの単調性が成り立つことを確認する。
    const attendances = workRun("2025-01-06", 11); // 適当な固定出勤（影響を見るためだけ）
    const input = makeInput({
      scanRange: { start: "2026-02-10", end: "2026-02-20" },
      attendances,
    });

    const results = scanBirthDates(input);
    const expectedDays = eachDayOfInterval({
      start: parseISO("2026-02-10"),
      end: parseISO("2026-02-20"),
    });
    expect(results).toHaveLength(expectedDays.length); // 11 候補

    // 各候補で基準日・窓終端が birthDate+57 / +56 であること（テスト1 の再確認）
    for (const r of results) {
      const bd = parseISO(r.birthDate);
      expect(r.childCareStartDate).toBe(fmt(addDays(bd, 57)));
      expect(r.scanWindow.end).toBe(fmt(addDays(bd, 56)));
    }

    // 隣接ペアの単調性: 1 日進むごとに childCareStart / scanWindow.end が +1 日
    for (let i = 1; i < results.length; i++) {
      const prevCc = parseISO(results[i - 1].childCareStartDate);
      const curCc = parseISO(results[i].childCareStartDate);
      expect(curCc.getTime() - prevCc.getTime()).toBe(86400000); // 1 日 = 86400000ms

      const prevEnd = parseISO(results[i - 1].scanWindow.end);
      const curEnd = parseISO(results[i].scanWindow.end);
      expect(curEnd.getTime() - prevEnd.getTime()).toBe(86400000);
    }
  });
});
