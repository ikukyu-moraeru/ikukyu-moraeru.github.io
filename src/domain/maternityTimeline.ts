import { addDays, format, parseISO, subDays } from "date-fns";
import type { DateISO } from "./types";

/**
 * 出産予定日と単胎/多胎の別から、産休・育休関連の主要な日付を算出する。
 *
 * - 産前休業: 出産予定日基準で 42 日（多胎 98 日）。法定の最長期間。
 * - 産後休業: 出産日翌日から 56 日（労基法 65 条）。本ヘルパーでは
 *   出産予定日 = 実出産日と仮定して算出する（実出産日が前後すれば自動的にずれる）。
 * - 育休開始日 = 出産日 + 産後 56 日 + 翌日 = 出産日 + 57 日。
 *   この日が「育休開始日前 2 年間に 11 日以上の完全月が 12 か月」要件の基準日となるため、
 *   給付金の判定対象期間 (`scanWindow`) の終端が決まる起点。
 *
 * `judgeEligibility` 内部の計算と整合する。Step1 の入力フィードバックと
 * Step5 の詳細表示で同じ値を見せるためにここを単一の真実の源とする。
 */
export interface MaternityTimeline {
  expectedBirthDate: DateISO;
  isMultipleBirth: boolean;
  prenatalDays: number;
  prenatalLeaveStart: DateISO;
  postnatalDays: number;
  postnatalLeaveEnd: DateISO;
  childCareStart: DateISO;
}

const PRENATAL_DAYS_SINGLE = 42;
const PRENATAL_DAYS_MULTIPLE = 98;
const POSTNATAL_DAYS = 56;

const fmt = (d: Date): DateISO => format(d, "yyyy-MM-dd");

export function computeMaternityTimeline(
  expectedBirthDate: DateISO,
  isMultipleBirth: boolean,
): MaternityTimeline | null {
  if (!expectedBirthDate) return null;
  let exp: Date;
  try {
    exp = parseISO(expectedBirthDate);
    if (Number.isNaN(exp.getTime())) return null;
  } catch {
    return null;
  }
  const prenatalDays = isMultipleBirth
    ? PRENATAL_DAYS_MULTIPLE
    : PRENATAL_DAYS_SINGLE;
  return {
    expectedBirthDate,
    isMultipleBirth,
    prenatalDays,
    prenatalLeaveStart: fmt(subDays(exp, prenatalDays)),
    postnatalDays: POSTNATAL_DAYS,
    postnatalLeaveEnd: fmt(addDays(exp, POSTNATAL_DAYS)),
    childCareStart: fmt(addDays(exp, POSTNATAL_DAYS + 1)),
  };
}
