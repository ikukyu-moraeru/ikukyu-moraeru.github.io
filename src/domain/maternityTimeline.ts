import { addDays, format, parseISO, subDays } from "date-fns";
import type { DateISO } from "./types";

/**
 * 出産予定日と単胎/多胎の別から、産休・育休関連の主要な日付を算出する。
 *
 * - 産前休業: 出産予定日を含めて 42 日間（多胎 98 日間）。法定の最長期間。
 *   出産予定日を期間に含むため、開始日は予定日の 41 日前（多胎 97 日前）=
 *   `予定日 - (期間日数 - 1)`。労基法 65 条・出産手当金「出産日以前 42 日」と整合する。
 * - 産後休業: 出産日翌日から 56 日（労基法 65 条）。本ヘルパーでは
 *   出産予定日 = 実出産日と仮定して算出する（実出産日が前後すれば自動的にずれる）。
 * - 育休開始日 = 出産日 + 産後 56 日 + 翌日 = 出産日 + 57 日。
 *   この日が「育休開始日前 2 年間に 11 日以上の完全月が 12 か月」要件の基準日となるため、
 *   給付金の判定対象期間 (`scanWindow`) の終端が決まる起点。
 *
 * `judgeEligibility` 内部の計算と整合する。Step1 の入力フィードバックと
 * Step5 の詳細表示で同じ値を見せるためにここを単一の真実の源とする。
 *
 * `overrides` で産休期間を手動指定できる:
 * - `maternityStart` 指定時は `prenatalLeaveStart` をそれで上書き。
 * - `maternityEnd` 指定時は `postnatalLeaveEnd` をそれで上書きし、
 *   `childCareStart` はその翌日に追従する（カスタム終了日 + 1 日）。
 * - 各 override は undefined なら従来どおり自動（法定最長）で算出する。
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
  overrides?: { maternityStart?: DateISO; maternityEnd?: DateISO },
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
  // 出産予定日を含めた期間なので開始日は (期間日数 - 1) 日前。
  const prenatalLeaveStart =
    overrides?.maternityStart ?? fmt(subDays(exp, prenatalDays - 1));
  const postnatalLeaveEnd =
    overrides?.maternityEnd ?? fmt(addDays(exp, POSTNATAL_DAYS));
  return {
    expectedBirthDate,
    isMultipleBirth,
    prenatalDays,
    prenatalLeaveStart,
    postnatalDays: POSTNATAL_DAYS,
    postnatalLeaveEnd,
    // 育休開始日は産後休業終了日の翌日（カスタム終了日に追従）。
    childCareStart: fmt(addDays(parseISO(postnatalLeaveEnd), 1)),
  };
}
