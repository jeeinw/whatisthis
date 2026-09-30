import { describe, expect, it } from "vitest";
import { amort } from "../calc/loan";
import {
  buyCalc,
  buyLimit,
  equity,
  homeCalc,
  incomeFor,
  jeonseCalc,
  jeonseProducts,
  maxBuyPrice,
  pmtFactor,
} from "../calc/housing";
import { acqTax, brokerage, houseCosts } from "../calc/tax";
import {
  avgScore,
  budgetCalc,
  extrasTotal,
  hallEstimate,
  itemEff,
  linkedAmount,
  mainQuote,
  quoteTotal,
} from "../calc/wedding";
import { resolveSettings } from "../settings";
import type { DeepPartial, Ledger, LoanMethod, Settings } from "../types";
import { realLedger, sampleLedger } from "./fixtures";
import { loadLegacy } from "./legacy";

type Fn = (...a: unknown[]) => unknown;
const EOK = 1e8;

/** legacy 결과를 JSON 비교 가능한 형태로 (Infinity 보존, 소수 오차 흡수). */
function norm(v: unknown): unknown {
  return JSON.parse(
    JSON.stringify(v, (_k, x) => (typeof x === "number" ? (Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : String(x)) : x)),
  );
}

function scenario(name: string, ledger: Ledger) {
  describe(`legacy 동등성 — ${name}`, () => {
    const L = loadLegacy(ledger);
    const f = L as unknown as Record<string, Fn>;
    const s = resolveSettings(ledger.settings);

    it("설정 병합 결과가 같다", () => {
      expect(norm(s)).toEqual(norm(f.S()));
    });

    it("스드메 총액·추가비용·기준 견적", () => {
      expect(norm(quoteTotal(mainQuote(ledger, s)))).toEqual(norm(f.quoteTotal(f.mainQuote())));
      expect(extrasTotal(ledger.extras)).toBe(f.extrasTotal());
    });

    it("웨딩홀 예상액 (모든 홀 × 하객 수)", () => {
      for (const h of Object.values(ledger.halls)) {
        for (const g of [0, 80, 150, 300]) expect(hallEstimate(h, g)).toBe(f.hallEstimate(h, g));
      }
    });

    it("점수 평균", () => {
      const kinds = { planners: "planner", halls: "hall", homes: "home" } as const;
      for (const [col, kind] of Object.entries(kinds)) {
        for (const d of Object.values(ledger[col as keyof typeof kinds])) expect(avgScore(d.scores, kind)).toBe(f.avg(d.scores, kind));
      }
      for (const v of Object.values(ledger.vendors)) {
        const kind = (["studio", "dress", "makeup"].includes(v.cat) ? v.cat : "studio") as "studio";
        expect(avgScore(v.scores, kind)).toBe(f.avg(v.scores, kind));
      }
    });

    it("예산 항목별 반영액·링크", () => {
      for (const it of Object.values(ledger.budget)) {
        expect(norm(itemEff(it, ledger, s))).toEqual(norm({ amount: null, ...(f.itemEff(it) as object) }));
        if (it.link) expect(linkedAmount(it, ledger, s)).toBe(f.linkedAmount(it));
      }
    });

    it("예산 합계 (결혼식·세팅·확정·지불·부담주체·상한 미설정)", () => {
      const a = budgetCalc(ledger, s);
      const b = f.budgetCalc() as ReturnType<typeof budgetCalc> & { items: { id: string }[]; capless: { id: string }[] };
      expect(a.wedding).toBeCloseTo(b.wedding, 6);
      expect(a.houseSetup).toBeCloseTo(b.houseSetup, 6);
      expect(a.confirmed).toBeCloseTo(b.confirmed, 6);
      expect(a.paid).toBeCloseTo(b.paid, 6);
      expect(norm(a.payer)).toEqual(norm(b.payer));
      expect(a.items.map((x) => x.id)).toEqual(b.items.map((x) => x.id));
      expect(a.capless.map((x) => x.id)).toEqual(b.capless.map((x) => x.id));
      expect(norm(Object.fromEntries(Object.entries(a.groups).map(([k, g]) => [k, g.total])))).toEqual(
        norm(Object.fromEntries(Object.entries(b.groups).map(([k, g]) => [k, g.total]))),
      );
    });

    it("가용 자금·소득", () => {
      expect(norm(equity(ledger, s))).toEqual(norm(f.equity(s)));
      expect(incomeFor(s)).toBe(f.incomeFor(s));
    });

    it("매매: 대출한도·필요현금 (가격 그리드)", () => {
      for (let p = 1 * EOK; p <= 30 * EOK; p += 0.25 * EOK) {
        expect(norm(buyLimit(p, s))).toEqual(norm(f.buyLimit(p, s)));
        const a = buyCalc(p, ledger, s);
        const b = f.buyCalc(p, s) as typeof a;
        expect(norm({ ...a, eq: undefined })).toEqual(norm({ ...b, eq: undefined }));
      }
    });

    it("매매: 최대 매수 가능가", () => {
      expect(maxBuyPrice(ledger, s)).toBe(f.maxBuyPrice(s));
    });

    it("전세: 상품 자격·자동 전환 (보증금 그리드)", () => {
      for (let d = 0.5 * EOK; d <= 12 * EOK; d += 0.25 * EOK) {
        expect(norm(jeonseProducts(d, s))).toEqual(norm(f.jeonseProducts(d, s)));
        const a = jeonseCalc(d, ledger, s);
        const b = f.jeonseCalc(d, s) as typeof a;
        expect(norm({ ...a, eq: undefined })).toEqual(norm({ ...b, eq: undefined }));
      }
    });

    it("집 거래 비용 링크", () => {
      expect(houseCosts(s.house)).toBe(f.houseCosts());
    });

    it("임장 후보 자금 판정", () => {
      for (const h of Object.values(ledger.homes)) {
        const a = homeCalc(h, ledger, s);
        const b = f.homeCalc(h, s) as { ok: boolean; gap: number; monthly: number } | null;
        if (b == null) expect(a).toBeNull();
        else expect(norm({ ok: a!.ok, gap: a!.gap, monthly: a!.monthly })).toEqual(norm({ ok: b.ok, gap: b.gap, monthly: b.monthly }));
      }
    });
  });
}

/* ---------- 설정 조합별 시나리오 ---------- */

const variants: Array<[string, DeepPartial<Settings>]> = [
  ["기본 (전세·서울시 상품)", {}],
  ["매매·생애최초·규제", { house: { mode: "buy", firstHome: true, regulated: true } }],
  ["매매·일반·규제·85㎡ 초과", { house: { mode: "buy", firstHome: false, regulated: true, area85: true } }],
  ["매매·비규제·기존대출", { house: { mode: "buy", firstHome: false, regulated: false, price: 7.5 * EOK }, fin: { existingAnnual: 12000000 } }],
  ["소득 비합산·DSR 30%", { fin: { combineIncome: false }, house: { mode: "buy", dsr: 30, stress: 1.5 } }],
  ["저소득 → 버팀목 선택", { fin: { jIncome: 40000000, dIncome: 30000000 }, house: { product: "buttimok", deposit: 3.5 * EOK } }],
  ["버팀목 불가 → 자동 전환", { house: { product: "buttimok", deposit: 6 * EOK } }],
  ["고소득 → 서울시 불가", { fin: { jIncome: 90000000, dIncome: 60000000 }, house: { product: "seoul" } }],
  ["차감 끔·축의금 큼", { giftIncome: 90000000, fin: { subtractWedding: false, subtractSetup: false } }],
  ["기준 홀·견적 없음", { mainHall: "없음", mainQuote: "없음" }],
];

for (const [name, patch] of variants) {
  const base = sampleLedger();
  const L = sampleLedger();
  L.settings = JSON.parse(JSON.stringify(base.settings));
  // 얕은 스프레드로는 fin/house가 덮이므로 legacy deepMerge 방식으로 합친다
  const merged = resolveSettings(base.settings);
  L.settings = JSON.parse(JSON.stringify(Object.assign(merged, {
    ...patch,
    fin: { ...merged.fin, ...(patch.fin ?? {}) },
    house: { ...merged.house, ...(patch.house ?? {}) },
  })));
  scenario(name, L);
}

scenario("빈 데이터", sampleLedger({ mainHall: "", mainQuote: "" }));
{
  const empty = sampleLedger();
  empty.budget = {};
  empty.quotes = {};
  empty.halls = {};
  empty.settings = {};
  scenario("완전 빈 장부 (기본 설정)", empty);
}

const real = realLedger();
if (real) scenario("실제 이관 데이터 (로컬 seed/ + private/)", real);

/* ---------- 순수 함수 그리드 ---------- */

describe("legacy 동등성 — 세금·중개보수·상환", () => {
  const f = loadLegacy(sampleLedger()) as unknown as Record<string, Fn>;

  it("취득세", () => {
    for (let p = 0.5 * EOK; p <= 20 * EOK; p += 0.1 * EOK) {
      for (const area85 of [false, true]) for (const first of [false, true]) expect(acqTax(p, area85, first)).toBe(f.acqTax(p, area85, first));
    }
  });

  it("중개보수 (저가 구간 한도 포함)", () => {
    const prices = [1e7, 4.99e7, 5e7, 1e8, 1.99e8, 2e8, 5.99e8, 6e8, 8.99e8, 9e8, 11.99e8, 12e8, 14.99e8, 15e8, 30e8];
    for (const p of prices) for (const k of ["buy", "lease"] as const) expect(brokerage(p, k)).toBe(f.brokerage(p, k));
  });

  it("원리금균등 계수", () => {
    for (const r of [0, 2.5, 4.3, 7.3]) for (const y of [10, 30, 40]) expect(pmtFactor(r, y)).toBe(f.pmtFactor(r, y));
  });

  it("상환 스케줄 (방식 × 거치 × 금리)", () => {
    const methods: LoanMethod[] = ["equal", "principal", "bullet"];
    for (const m of methods) for (const g of [0, 1, 3]) for (const r of [0, 3.95, 4.3]) for (const y of [2, 2.5, 30]) {
      expect(norm(amort(3 * EOK, r, y, m, g))).toEqual(norm(f.amort(3 * EOK, r, y, m, g)));
    }
  });
});
