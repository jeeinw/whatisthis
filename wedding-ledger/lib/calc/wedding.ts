import { HOUSE_GROUP, SCORE } from "../constants";
import { isNum } from "../format";
import type {
  BudgetItem,
  Extra,
  Hall,
  Ledger,
  Quote,
  ScoreKind,
  Scores,
  Settings,
} from "../types";
import { houseCosts } from "./tax";

/** {id: doc} 맵 → id가 붙은 배열 (legacy `list`). */
export function listOf<T>(col: Record<string, Omit<T, "id">>): T[] {
  return Object.entries(col).map(([id, d]) => Object.assign({ id }, d) as T);
}

/** 채워진 점수만으로 평균. 없으면 null. */
export function avgScore(scores: Scores | undefined, kind: ScoreKind): number | null {
  const v = SCORE[kind].map(([k]) => scores?.[k]).filter(isNum);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/* ---------- 스드메 견적 ---------- */

export function mainQuote(ledger: Ledger, s: Pick<Settings, "mainQuote">): Omit<Quote, "id"> | null {
  return ledger.quotes[s.mainQuote] || Object.values(ledger.quotes)[0] || null;
}

export function quoteTotal(q: Omit<Quote, "id"> | null | undefined) {
  if (!q) return null;
  const base = (q.items || []).filter((i) => i.count !== false).reduce((a, i) => a + (isNum(i.sale) ? i.sale : 0), 0);
  let delta = 0;
  const o = q.options || {};
  const sel = q.selected || {};
  (["studio", "dress", "makeup"] as const).forEach((k) => {
    const opt = (o[k] || [])[sel[k] || 0];
    if (opt && isNum(opt.delta)) delta += opt.delta;
  });
  return { base, delta, total: base + delta };
}

export function extrasTotal(extras: Ledger["extras"]): number {
  return listOf<Extra>(extras)
    .filter((x) => x.include && isNum(x.amount))
    .reduce((a, x) => a + (x.amount as number), 0);
}

/* ---------- 웨딩홀 ---------- */

export function hallMeal(h: Omit<Hall, "id">): number | null {
  if (isNum(h.mealMin) && isNum(h.mealMax)) return (h.mealMin + h.mealMax) / 2;
  if (isNum(h.mealMin)) return h.mealMin;
  if (isNum(h.mealMax)) return h.mealMax;
  return null;
}

/** 평균식대 × max(하객, 최소보증) + 대관료 + 꽃 + 연출 + 스냅. 식대가 없으면 null. */
export function hallEstimate(h: Omit<Hall, "id">, guests: number): number | null {
  const g = Math.max(guests || 0, h.minGuests || 0);
  const meal = hallMeal(h);
  if (meal == null) return null;
  const n = (v: unknown) => (isNum(v) ? v : 0);
  return meal * g + n(h.rental) + n(h.flowerFee) + n(h.productionFee) + n(h.snapFee);
}

/* ---------- 예산 ---------- */

export function linkedAmount(it: Pick<BudgetItem, "link">, ledger: Ledger, s: Settings): number | null {
  switch (it.link) {
    case "hall": {
      const h = ledger.halls[s.mainHall];
      return h ? hallEstimate(h, s.guests) : null;
    }
    case "sdm": {
      const q = quoteTotal(mainQuote(ledger, s));
      return q ? q.total : null;
    }
    case "sdmExtras":
      return extrasTotal(ledger.extras);
    case "houseCosts":
      return houseCosts(s.house);
    default:
      return null;
  }
}

export interface ItemEff {
  /** 실제 입력(또는 자동 계산) 금액. 없으면 null. */
  amount: number | null;
  /** 합계에 반영되는 금액 (amount ?? cap ?? 0). */
  eff: number;
  auto: boolean;
  fromCap: boolean;
}

export function itemEff(it: Omit<BudgetItem, "id">, ledger: Ledger, s: Settings): ItemEff {
  if (it.subs && it.subs.length) {
    const any = it.subs.some((x) => isNum(x.amount) || isNum(x.cap));
    const sum = it.subs.reduce((a, x) => a + (isNum(x.amount) ? x.amount : isNum(x.cap) ? x.cap : 0), 0);
    const hasAmt = it.subs.some((x) => isNum(x.amount));
    const amt = hasAmt ? it.subs.reduce((a, x) => a + (isNum(x.amount) ? x.amount : 0), 0) : null;
    return { amount: amt, eff: any ? sum : isNum(it.cap) ? it.cap : 0, auto: false, fromCap: !hasAmt };
  }
  if (it.link) {
    const a = linkedAmount(it, ledger, s);
    return { amount: a, eff: isNum(a) ? a : isNum(it.cap) ? it.cap : 0, auto: true, fromCap: !isNum(a) };
  }
  const amount = isNum(it.amount) ? it.amount : null;
  return { amount, eff: isNum(it.amount) ? it.amount : isNum(it.cap) ? it.cap : 0, auto: false, fromCap: !isNum(it.amount) };
}

export type BudgetRow = BudgetItem & { e: ItemEff };

export interface BudgetSummary {
  items: BudgetRow[];
  groups: Record<string, { items: BudgetRow[]; total: number }>;
  /** 결혼식 비용 = 신혼집·살림 그룹 제외 합계 */
  wedding: number;
  /** 신혼집 세팅 = 신혼집·살림 그룹에서 houseCosts 제외 */
  houseSetup: number;
  confirmed: number;
  paid: number;
  /** 부담 주체별 합계 (결혼식 비용만) */
  payer: Record<string, number>;
  /** 반영액 0원이면서 자동 항목이 아닌 것 (상한선 미설정 경고) */
  capless: BudgetRow[];
}

export function budgetCalc(ledger: Ledger, s: Settings): BudgetSummary {
  const items = listOf<BudgetItem>(ledger.budget).sort((a, b) => (a.order || 0) - (b.order || 0));
  const groups: BudgetSummary["groups"] = {};
  const payer: Record<string, number> = {};
  const capless: BudgetRow[] = [];
  let wedding = 0, houseSetup = 0, confirmed = 0, paid = 0;
  const rows: BudgetRow[] = items.map((it) => {
    const e = itemEff(it, ledger, s);
    const row: BudgetRow = Object.assign(it, { e });
    (groups[it.group] = groups[it.group] || { items: [], total: 0 }).items.push(row);
    groups[it.group].total += e.eff;
    const inWedding = it.group !== HOUSE_GROUP;
    if (inWedding) wedding += e.eff;
    else if (it.link !== "houseCosts") houseSetup += e.eff;
    if (it.status === "확정" || it.status === "지불 완료") confirmed += e.eff;
    if (it.status === "지불 완료") paid += e.eff;
    const p = it.payer || "공동";
    payer[p] = (payer[p] || 0) + (inWedding ? e.eff : 0);
    if (e.eff === 0 && !e.auto) capless.push(row);
    return row;
  });
  return { items: rows, groups, wedding, houseSetup, confirmed, paid, payer, capless };
}
