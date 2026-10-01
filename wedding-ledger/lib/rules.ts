/**
 * 대출·세금·중개보수 규제 상수.
 *
 * 기준일: 2026-09 (legacy/wedding-ledger.html 과 같은 값 — 공개 자료 기반 추정)
 * 규정이 바뀌면 이 파일만 고치고 `npm test`로 영향 범위를 확인한다.
 * 단, legacy 동등성 테스트는 이 값이 legacy와 같다는 전제이므로
 * 규정을 갱신할 때는 해당 테스트의 기대값도 함께 바꿔야 한다.
 *
 * 출처 메모
 * - LTV·주택가격별 대출한도: 2025.10.15 주택시장 안정화 대책 (서울 전역 규제지역) 기준 추정
 * - 스트레스 DSR: 3단계(수도권 3.0%p) 가정
 * - 취득세: 지방세법 1주택 세율 + 생애최초 감면 (≤12억, 200만 원 한도)
 * - 중개보수: 서울시 주택 중개보수 요율표
 * - 서울시 신혼부부 임차보증금 이자지원 / 신혼부부 전용 버팀목: 2026년 공고 기준 추정
 */

/** 규정 기준일 — 화면에 표시하고, 6개월이 지나면 갱신 안내를 띄운다. 규정을 고치면 같이 바꿀 것. */
export const RULES_AS_OF = "2026-09-01";

/** 기준일로부터 지난 개월 수 */
export function rulesAgeMonths(today = new Date()): number {
  const [y, m] = RULES_AS_OF.split("-").map(Number);
  return (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
}

const EOK = 1e8;
const MAN = 1e4;

/* ---------- 매매 대출 ---------- */

export const LTV = {
  firstHome: 0.7,
  regulated: 0.4,
  unregulated: 0.7,
} as const;

/** 규제지역 주택가격별 주담대 한도. 위에서부터 price ≤ upTo 이면 cap. */
export const REGULATED_PRICE_CAPS: ReadonlyArray<{ upTo: number; cap: number }> = [
  { upTo: 15 * EOK, cap: 6 * EOK },
  { upTo: 25 * EOK, cap: 4 * EOK },
  { upTo: Infinity, cap: 2 * EOK },
];

/* ---------- 취득세 (1주택 추정) ---------- */

export const ACQ_TAX = {
  lowUpTo: 6 * EOK, // 이하 1%
  lowRate: 0.01,
  midUpTo: 9 * EOK, // 6~9억: (억 × 2/3 − 3)%
  highRate: 0.03, // 9억 초과 3%
  eduRatio: 0.1, // 지방교육세 = 세율 × 0.1
  farmRateOver85: 0.002, // 전용 85㎡ 초과 농특세
  firstHomeUpTo: 12 * EOK,
  firstHomeRelief: 200 * MAN,
} as const;

/* ---------- 중개보수 ---------- */

export interface BrokerageTier {
  below: number; // price < below
  rate: number;
  cap?: number; // 한도액 (원)
}

export const BROKERAGE_BUY: ReadonlyArray<BrokerageTier> = [
  { below: 5000 * MAN, rate: 0.006, cap: 25 * MAN },
  { below: 2 * EOK, rate: 0.005, cap: 80 * MAN },
  { below: 9 * EOK, rate: 0.004 },
  { below: 12 * EOK, rate: 0.005 },
  { below: 15 * EOK, rate: 0.006 },
  { below: Infinity, rate: 0.007 },
];

export const BROKERAGE_LEASE: ReadonlyArray<BrokerageTier> = [
  { below: 5000 * MAN, rate: 0.005, cap: 20 * MAN },
  { below: 1 * EOK, rate: 0.004, cap: 30 * MAN },
  { below: 6 * EOK, rate: 0.003 },
  { below: 12 * EOK, rate: 0.004 },
  { below: 15 * EOK, rate: 0.005 },
  { below: Infinity, rate: 0.006 },
];

/* ---------- 전세대출 상품 ---------- */

/** 서울시 신혼부부 임차보증금 이자지원: 부부합산 소득 구간별 지원 %p (소득 ≤ upTo). */
export const SEOUL_INCOME_TIERS: ReadonlyArray<{ upTo: number; sub: number }> = [
  { upTo: 3000 * MAN, sub: 3.0 },
  { upTo: 6000 * MAN, sub: 2.5 },
  { upTo: 9000 * MAN, sub: 2.0 },
  { upTo: 11000 * MAN, sub: 1.5 },
  { upTo: 13000 * MAN, sub: 1.0 },
];

export const SEOUL_JEONSE = {
  maxDeposit: 7 * EOK,
  maxIncome: 13000 * MAN,
  loanCap: 3 * EOK,
  loanRatio: 0.9,
  preMarriedBonus: 0.2, // 예비신혼 추가 지원 %p (소득 구간 지원이 있을 때만)
} as const;

export const BUTTIMOK = {
  maxDeposit: 4 * EOK, // 수도권
  maxIncome: 7500 * MAN,
  loanCap: 3 * EOK,
  loanRatio: 0.8,
} as const;

export const BANK_JEONSE = {
  loanRatio: 0.8,
} as const;

/* ---------- 최대 매수가 탐색 범위 ---------- */

export const MAX_BUY_SEARCH = {
  lo: 1 * EOK,
  hi: 40 * EOK,
  iterations: 40,
  roundTo: 100 * MAN,
} as const;
