import type { LoanMethod } from "../types";

export interface Amortization {
  /** 첫 달 납입액 (만기일시는 이자만) */
  first: number | null;
  /** 거치 종료 후 첫 납입액 (거치가 없으면 null) */
  afterGrace: number | null;
  /** 총 이자 */
  total: number;
  /** 연말 잔액 (마지막 달이 12의 배수가 아니면 마지막 달 잔액 포함) */
  yearly: number[];
}

/** 원리금균등 / 원금균등 / 만기일시 상환 스케줄. 거치(년) 지원 (만기일시는 거치 무시). */
export function amort(P: number, rate: number, years: number, method: LoanMethod, grace: number): Amortization {
  const r = rate / 100 / 12;
  const n = Math.max(1, Math.round(years * 12));
  const g = method === "bullet" ? 0 : Math.min(Math.round((grace || 0) * 12), n - 1);
  let bal = P;
  let total = 0;
  let first: number | null = null;
  let after: number | null = null;
  const yearly: number[] = [];
  const k = n - g;
  const pay = r === 0 ? P / k : (P * r) / (1 - Math.pow(1 + r, -k));
  for (let m = 1; m <= n; m++) {
    const int = bal * r;
    let prin: number;
    if (method === "bullet") prin = m === n ? bal : 0;
    else if (m <= g) prin = 0;
    else if (method === "equal") prin = pay - int;
    else prin = P / k;
    prin = Math.min(prin, bal);
    bal -= prin;
    total += int;
    if (m === 1) first = method === "bullet" ? int : int + prin;
    if (g > 0 && m === g + 1) after = int + prin;
    if (m % 12 === 0 || (m === n && n % 12 !== 0)) yearly.push(Math.max(0, bal));
  }
  return { first, afterGrace: after, total, yearly };
}

/** 금리 민감도: 기준 금리 ±(−1.0 ~ +1.5)%p, 최저 0.1%. */
export const SENSITIVITY_DELTAS = [-1, -0.5, 0, 0.5, 1, 1.5];

export function sensitivity(P: number, rate: number, years: number, method: LoanMethod, grace: number) {
  return SENSITIVITY_DELTAS.map((d) => {
    const x = Math.max(0.1, rate + d);
    const a = amort(P, x, years, method, grace);
    return { rate: x, first: a.first, total: a.total, isBase: Math.abs(x - rate) < 1e-9 };
  });
}
