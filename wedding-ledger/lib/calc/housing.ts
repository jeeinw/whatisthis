import { isNum } from "../format";
import {
  BANK_JEONSE,
  BUTTIMOK,
  LTV,
  MAX_BUY_SEARCH,
  REGULATED_PRICE_CAPS,
  SEOUL_INCOME_TIERS,
  SEOUL_JEONSE,
} from "../rules";
import type { Home, JeonseProductKey, Ledger, Settings } from "../types";
import { acqTax, brokerage } from "./tax";
import { budgetCalc } from "./wedding";

/** 원리금균등 월 상환 계수 (원금 1원당 월 납입). */
export function pmtFactor(ratePct: number, years: number): number {
  const r = ratePct / 100 / 12;
  const n = years * 12;
  return r === 0 ? 1 / n : r / (1 - Math.pow(1 + r, -n));
}

/** DSR 심사 소득: J + (합산 시) D. */
export function incomeFor(s: Settings): number {
  const f = s.fin;
  return (f.jIncome || 0) + (f.combineIncome ? f.dIncome || 0 : 0);
}

export interface Equity {
  base: number;
  /** 결혼식 실부담 (비용 − 축의금, 0 미만이면 0) */
  wc: number;
  /** 신혼집 세팅비 */
  sc: number;
  /** 집에 쓸 수 있는 돈 */
  avail: number;
}

export function equity(ledger: Ledger, s: Settings): Equity {
  const f = s.fin;
  const base = (f.jAsset || 0) + (f.dAsset || 0) + (f.jParents || 0) + (f.dParents || 0) + (f.other || 0);
  const need = f.subtractWedding || f.subtractSetup;
  const B = need ? budgetCalc(ledger, s) : null;
  const wc = f.subtractWedding && B ? Math.max(0, B.wedding - (isNum(s.giftIncome) ? s.giftIncome : 0)) : 0;
  const sc = f.subtractSetup && B ? B.houseSetup : 0;
  return { base, wc, sc, avail: base - wc - sc };
}

/* ---------- 매매 ---------- */

export type BindReason = "DSR (소득)" | "주택가격별 한도" | "LTV";

export interface BuyLimit {
  ltv: number;
  ltvRate: number;
  cap: number;
  dsr: number;
  lim: number;
  bind: BindReason;
}

export function regulatedCap(price: number): number {
  return (REGULATED_PRICE_CAPS.find((t) => price <= t.upTo) ?? REGULATED_PRICE_CAPS[REGULATED_PRICE_CAPS.length - 1]).cap;
}

/** 매매 대출한도 = min(LTV, 가격별 한도, DSR 한도). */
export function buyLimit(price: number, s: Settings): BuyLimit {
  const h = s.house;
  const ltvRate = h.firstHome ? LTV.firstHome : h.regulated ? LTV.regulated : LTV.unregulated;
  const ltv = price * ltvRate;
  const cap = h.regulated ? regulatedCap(price) : Infinity;
  const annual = incomeFor(s) * (h.dsr / 100) - (s.fin.existingAnnual || 0);
  const dsr = annual > 0 ? annual / 12 / pmtFactor(h.rate + h.stress, h.years) : 0;
  const lim = Math.max(0, Math.min(ltv, cap, dsr));
  const bind: BindReason = lim === dsr ? "DSR (소득)" : lim === cap ? "주택가격별 한도" : "LTV";
  return { ltv, ltvRate, cap, dsr, lim, bind };
}

export interface BuyCalc {
  price: number;
  L: BuyLimit;
  tax: number;
  fee: number;
  reg: number;
  cost: number;
  cashNeed: number;
  eq: Equity;
  gap: number;
  monthly: number;
}

export function buyCalc(price: number, ledger: Ledger, s: Settings, eq: Equity = equity(ledger, s)): BuyCalc {
  const h = s.house;
  const L = buyLimit(price, s);
  const tax = acqTax(price, h.area85, h.firstHome);
  const fee = brokerage(price, "buy");
  const reg = h.regFee || 0;
  const cashNeed = price + tax + fee + reg - L.lim;
  return { price, L, tax, fee, reg, cost: tax + fee + reg, cashNeed, eq, gap: eq.avail - cashNeed, monthly: L.lim * pmtFactor(h.rate, h.years) };
}

/** 필요현금 ≤ 가용자금이 되는 최대 매매가 (이분탐색, 100만 원 단위 내림). 1억도 안 되면 null. */
export function maxBuyPrice(ledger: Ledger, s: Settings): number | null {
  const eq = equity(ledger, s);
  let lo: number = MAX_BUY_SEARCH.lo;
  let hi: number = MAX_BUY_SEARCH.hi;
  if (buyCalc(lo, ledger, s, eq).gap < 0) return null;
  for (let i = 0; i < MAX_BUY_SEARCH.iterations; i++) {
    const mid = (lo + hi) / 2;
    if (buyCalc(mid, ledger, s, eq).gap >= 0) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo / MAX_BUY_SEARCH.roundTo) * MAX_BUY_SEARCH.roundTo;
}

/* ---------- 전세 ---------- */

export interface JeonseProduct {
  label: string;
  ok: boolean;
  why: string;
  cap: number;
  rate: number;
  note: string;
}

export function seoulIncomeTier(income: number): number {
  return SEOUL_INCOME_TIERS.find((t) => income <= t.upTo)?.sub ?? 0;
}

/** 전세대출 상품별 자격·한도·실금리. 소득은 (합산 여부와 무관하게) 부부합산. */
export function jeonseProducts(dep: number, s: Settings): Record<JeonseProductKey, JeonseProduct> {
  const h = s.house;
  const inc = (s.fin.jIncome || 0) + (s.fin.dIncome || 0);
  const tier = seoulIncomeTier(inc);
  const seoulSub = tier + (tier > 0 ? SEOUL_JEONSE.preMarriedBonus : 0);
  return {
    seoul: {
      label: "서울시 신혼부부 임차보증금 이자지원",
      ok: dep <= SEOUL_JEONSE.maxDeposit && inc <= SEOUL_JEONSE.maxIncome,
      why: dep > SEOUL_JEONSE.maxDeposit ? "보증금 7억 초과" : inc > SEOUL_JEONSE.maxIncome ? "부부합산 소득 1.3억 초과" : "",
      cap: Math.min(SEOUL_JEONSE.loanCap, dep * SEOUL_JEONSE.loanRatio),
      rate: Math.max(0, h.seoulBase - seoulSub),
      note: `대출금리 ${h.seoulBase}% − 서울시 지원 ${seoulSub.toFixed(1)}%p (소득 구간 ${tier}%p + 예비신혼 0.2%p)`,
    },
    buttimok: {
      label: "신혼부부 전용 버팀목",
      ok: dep <= BUTTIMOK.maxDeposit && inc <= BUTTIMOK.maxIncome,
      why: dep > BUTTIMOK.maxDeposit ? "수도권 보증금 4억 초과" : inc > BUTTIMOK.maxIncome ? "부부합산 소득 7,500만 초과" : "",
      cap: Math.min(BUTTIMOK.loanCap, dep * BUTTIMOK.loanRatio),
      rate: h.buttimokRate,
      note: "소득·보증금 구간별 연 1.5~2.7%",
    },
    bank: {
      label: "시중은행 전세대출 (HF 보증)",
      ok: true,
      why: "",
      cap: Math.min(h.bankCap, dep * BANK_JEONSE.loanRatio),
      rate: h.bankRate,
      note: "보증금 80% 이내, 한도는 은행·보증기관별 상이",
    },
  };
}

export interface JeonseCalc {
  dep: number;
  P: Record<JeonseProductKey, JeonseProduct>;
  /** 실제 적용 상품 (선택 상품이 불가하면 seoul → buttimok → bank 순으로 자동 전환) */
  pk: JeonseProductKey;
  p: JeonseProduct;
  fee: number;
  cost: number;
  eq: Equity;
  needLoan: number;
  loan: number;
  gap: number;
  monthlyInterest: number;
}

export function jeonseCalc(dep: number, ledger: Ledger, s: Settings, eq: Equity = equity(ledger, s)): JeonseCalc {
  const P = jeonseProducts(dep, s);
  const chosen = s.house.product;
  const pk: JeonseProductKey = P[chosen] && P[chosen].ok ? chosen : P.seoul.ok ? "seoul" : P.buttimok.ok ? "buttimok" : "bank";
  const p = P[pk];
  const fee = brokerage(dep, "lease");
  const needLoan = Math.max(0, dep + fee - eq.avail);
  const loan = Math.min(needLoan, p.cap);
  const gap = eq.avail + p.cap - dep - fee;
  return { dep, P, pk, p, fee, cost: fee, eq, needLoan, loan, gap, monthlyInterest: (loan * p.rate) / 100 / 12 };
}

/** 요약 카드용 신혼집 여유/부족. */
export function houseSummary(ledger: Ledger, s: Settings) {
  if (s.house.mode === "buy") {
    const c = buyCalc(s.house.price, ledger, s);
    return { gap: c.gap, loan: c.L.lim, mode: "buy" as const, productLabel: null };
  }
  const c = jeonseCalc(s.house.deposit, ledger, s);
  return { gap: c.gap, loan: c.loan, mode: "jeonse" as const, productLabel: c.P[c.pk].label };
}

/** 임장 후보 한 건의 자금 판정. 가격 정보가 없으면 null. */
export function homeCalc(r: Omit<Home, "id">, ledger: Ledger, s: Settings, eq: Equity = equity(ledger, s)) {
  if (r.kind === "전세") {
    const dep = r.jeonse || r.price;
    if (!isNum(dep)) return null;
    const c = jeonseCalc(dep, ledger, s, eq);
    return { ok: c.gap >= 0, gap: c.gap, monthly: c.monthlyInterest, loan: c.loan, bind: null as BindReason | null };
  }
  const price = r.price || r.kb;
  if (!isNum(price)) return null;
  const c = buyCalc(price, ledger, s, eq);
  return { ok: c.gap >= 0, gap: c.gap, monthly: c.monthly, loan: c.L.lim, bind: c.L.bind as BindReason | null };
}
