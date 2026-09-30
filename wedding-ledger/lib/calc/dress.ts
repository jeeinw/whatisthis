import { DRESS_PLANNERS } from "../constants";
import { isNum } from "../format";
import type { Ledger, PriceList, PriceListRow, Vendor } from "../types";
import { listOf } from "./wedding";

export interface DressShop {
  key: string;
  name: string;
  /** 플래너 이름 → 그 플래너 가격표의 행 */
  p: Record<string, PriceListRow>;
}

/** 플래너별 드레스 가격표를 샵 key 기준으로 합친다 (legacy dressPriceIndex). */
export function dressPriceIndex(ledger: Pick<Ledger, "priceLists">) {
  const lists = listOf<PriceList>(ledger.priceLists).filter((l) => l.cat === "dress");
  const by: Record<string, DressShop> = {};
  lists.forEach((l) =>
    (l.rows || []).forEach((r) => {
      (by[r.key] = by[r.key] || { key: r.key, name: r.shop, p: {} }).p[l.planner] = r;
    }),
  );
  return { lists, by };
}

/** 샵 이름 정규화: 공백·괄호 제거, 끝의 '웨딩' 제거. 내 후보 드레스샵 매칭용. */
export const normShop = (n: string) => n.replace(/\s|\(.*\)/g, "").replace(/웨딩$/, "");

export function myDressKeys(ledger: Pick<Ledger, "vendors">): Set<string> {
  return new Set(listOf<Vendor>(ledger.vendors).filter((v) => v.cat === "dress").map((v) => normShop(v.name)));
}

/** 샵 한 곳의 플래너별 최저가 (없으면 Infinity). */
export function minPrice(shop: DressShop, k: "main" | "combo"): number {
  return Math.min(...DRESS_PLANNERS.map((p) => (shop.p[p] && isNum(shop.p[p][k]) ? (shop.p[p][k] as number) : Infinity)));
}
