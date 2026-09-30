import {
  ACQ_TAX,
  BROKERAGE_BUY,
  BROKERAGE_LEASE,
} from "../rules";
import type { HouseSettings } from "../types";

/** 취득세 + 지방교육세 + (85㎡ 초과) 농특세 − 생애최초 감면. 1주택 추정. */
export function acqTax(price: number, area85: boolean, firstHome: boolean): number {
  const e = price / 1e8;
  let r: number;
  if (price <= ACQ_TAX.lowUpTo) r = ACQ_TAX.lowRate;
  else if (price <= ACQ_TAX.midUpTo) r = ((e * 2) / 3 - 3) / 100;
  else r = ACQ_TAX.highRate;
  const edu = r * ACQ_TAX.eduRatio;
  const farm = area85 ? ACQ_TAX.farmRateOver85 : 0;
  let tax = price * (r + edu + farm);
  if (firstHome && price <= ACQ_TAX.firstHomeUpTo) tax = Math.max(0, tax - ACQ_TAX.firstHomeRelief);
  return tax;
}

/** 중개보수 (상한 요율 × 가격, 저가 구간은 한도액 적용). */
export function brokerage(price: number, kind: "buy" | "lease"): number {
  const tiers = kind === "buy" ? BROKERAGE_BUY : BROKERAGE_LEASE;
  const t = tiers.find((x) => price < x.below) ?? tiers[tiers.length - 1];
  return Math.min(price * t.rate, t.cap ?? Infinity);
}

/** 예산 `houseCosts` 링크: 매매면 취득세+중개+등기, 전세면 중개보수. */
export function houseCosts(h: HouseSettings): number {
  return h.mode === "buy"
    ? acqTax(h.price, h.area85, h.firstHome) + brokerage(h.price, "buy") + (h.regFee || 0)
    : brokerage(h.deposit, "lease");
}
