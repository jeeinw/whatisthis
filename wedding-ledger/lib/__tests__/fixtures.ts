// 테스트 픽스처. seed/, private/ 는 git에 없으므로 저장소에 있는 합성 데이터만 쓴다.
// (로컬에 seed/가 있으면 legacy-parity 테스트가 실제 데이터로도 한 번 더 돈다.)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DeepPartial, Ledger, Settings } from "../types";

export const ROOT = join(__dirname, "../..");

export function emptyLedger(): Ledger {
  return { planners: {}, vendors: {}, quotes: {}, extras: {}, halls: {}, dresses: {}, budget: {}, homes: {}, priceLists: {}, guests: {}, gifts: {}, payments: {}, tasks: {}, settings: {} };
}

/** 예산 구조를 흉내 낸 합성 데이터 (subs, link, cap, payer, 신혼집 그룹 포함). */
export function sampleLedger(settings: DeepPartial<Settings> = {}): Ledger {
  const L = emptyLedger();
  L.halls = {
    h1: { name: "테스트홀A", mealMin: 69000, mealMax: 160000, rental: 6000000, minGuests: 100, flowerFee: null, productionFee: 3300000, snapFee: null, status: "관심", scores: { loc: 4, mood: 5, food: null } },
    h2: { name: "테스트홀B", mealMin: 88000, mealMax: null, rental: null, minGuests: 250, flowerFee: 2200000, snapFee: 990000, status: "제외" },
    h3: { name: "식대없음", mealMin: null, mealMax: null, rental: 5000000 },
  };
  L.quotes = {
    q1: {
      title: "테스트 견적",
      items: [
        { cat: "스튜디오", vendor: "A", product: "p", list: 1060000, sale: 760000, count: true },
        { cat: "드레스", vendor: "B", product: "p", list: 950000, sale: 710000 },
        { cat: "혜택", vendor: "C", product: "피팅비", list: -110000, sale: -110000, count: false },
        { cat: "혜택", vendor: "C", product: "현장할인", list: -100000, sale: -100000, count: true },
        { cat: "혜택", vendor: "D", product: "null", list: null, sale: null, count: true },
      ],
      options: {
        studio: [{ name: "기준", delta: 0 }, { name: "오후", delta: 220000 }],
        dress: [{ name: "기준", delta: 0 }, { name: "상위", delta: 350000 }],
        makeup: [{ name: "기준", delta: 0 }],
      },
      selected: { studio: 1, dress: 1, makeup: 0 },
    },
  };
  L.extras = {
    e1: { name: "헬퍼", amount: 350000, include: true, order: 1 },
    e2: { name: "혼주", amount: 220000, include: false, order: 2 },
    e3: { name: "금액없음", amount: null, include: true, order: 3 },
  };
  L.budget = {
    hall: { group: "예식", name: "웨딩홀", link: "hall", amount: null, cap: 20000000, payer: "공동", status: "견적", order: 0 },
    sdm: { group: "스드메", name: "스드메", link: "sdm", amount: null, cap: null, payer: "공동", status: "확정", order: 10 },
    sdmx: { group: "스드메", name: "추가", link: "sdmExtras", amount: null, cap: null, payer: "공동", status: "견적", order: 11 },
    snap: { group: "예식", name: "스냅", link: "", amount: 1500000, cap: 2000000, payer: "J", status: "지불 완료", order: 2 },
    mc: { group: "예식", name: "사회자", link: "", amount: null, cap: 500000, payer: "D", status: "미정", order: 4 },
    song: { group: "예식", name: "축가", link: "", amount: null, cap: null, payer: "공동", status: "미정", order: 5 },
    chungmo: {
      group: "인사·모임", name: "청모", link: "", amount: null, cap: 800000, payer: "공동", status: "미정", order: 23,
      subs: [{ name: "a", amount: null, cap: null }, { name: "b", amount: null, cap: null }],
    },
    honeymoon: {
      group: "신혼여행", name: "신혼여행", link: "", amount: null, cap: null, payer: "J 부모님", status: "확정", order: 25,
      subs: [{ name: "항공", amount: 2400000, cap: 3000000 }, { name: "숙소", amount: null, cap: 2500000 }, { name: "기타", amount: null, cap: null }],
      meta: { destination: "리스본", nights: "6박 8일" },
    },
    ring: {
      group: "예물·예복", name: "반지", link: "", amount: null, cap: null, payer: "공동", status: "미정", order: 14,
      subs: [{ name: "x", amount: null, cap: 1200000 }],
    },
    houseCosts: { group: "신혼집·살림", name: "집 거래 비용", link: "houseCosts", amount: null, cap: null, payer: "공동", status: "견적", order: 26 },
    appliances: { group: "신혼집·살림", name: "가전", link: "", amount: 8000000, cap: null, payer: "공동", status: "미정", order: 27 },
    furniture: { group: "신혼집·살림", name: "가구", link: "", amount: null, cap: 5000000, payer: "공동", status: "미정", order: 28 },
  };
  L.homes = {
    a: { name: "매매후보", kind: "매매", price: 1150000000, kb: 1100000000 },
    b: { name: "KB만", kind: "매매", price: null, kb: 900000000 },
    c: { name: "전세후보", kind: "전세", jeonse: 450000000, price: 1000000000 },
    d: { name: "가격없음", kind: "전세", jeonse: null, price: null },
  };
  L.settings = {
    guests: 150,
    mainHall: "h1",
    mainQuote: "q1",
    target: 40000000,
    giftIncome: 12000000,
    fin: {
      jAsset: 130000000, dAsset: 100000000, jParents: 200000000, dParents: null, other: null,
      subtractWedding: true, subtractSetup: true, jIncome: 70000000, dIncome: 50000000, combineIncome: true, existingAnnual: 0,
    },
    ...settings,
  } as DeepPartial<Settings>;
  return L;
}

/** 로컬에 이관 데이터가 있으면 실제 Ledger를 만든다 (CI/공개 저장소에서는 null). */
export function realLedger(): Ledger | null {
  const seedDir = join(ROOT, "seed");
  if (!existsSync(join(seedDir, "budget.json"))) return null;
  const L = emptyLedger();
  for (const c of Object.keys(L) as (keyof Ledger)[]) {
    if (c === "settings") continue;
    const f = join(seedDir, `${c}.json`);
    if (existsSync(f)) (L as unknown as Record<string, unknown>)[c] = JSON.parse(readFileSync(f, "utf8"));
  }
  const sf = join(ROOT, "private/settings.json");
  if (existsSync(sf)) L.settings = JSON.parse(readFileSync(sf, "utf8"));
  return L;
}
