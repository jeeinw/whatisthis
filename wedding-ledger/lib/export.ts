// 엑셀 내보내기 시트 구성 (legacy exportBtn 핸들러와 같은 시트·컬럼). 파일 생성은 컴포넌트에서 SheetJS로.
import { CAT_LABEL, SCORE } from "./constants";
import { dressPriceIndex } from "./calc/dress";
import { equity, homeCalc } from "./calc/housing";
import { avgScore, budgetCalc, hallEstimate, listOf, mainQuote } from "./calc/wedding";
import { isNum } from "./format";
import type { Dress, Extra, Hall, Home, Ledger, Planner, ScoreKind, Scores, Settings, Vendor } from "./types";

export type SheetRow = Record<string, string | number | boolean | null | undefined>;
export interface Sheet {
  name: string;
  rows: SheetRow[];
}

const sc = (scores: Scores | undefined, kind: ScoreKind): SheetRow =>
  Object.fromEntries(SCORE[kind].map(([k, l]) => [l, scores && scores[k] != null ? scores[k] : ""]));
const or = (v: unknown) => (v ?? "") as string | number;

export function buildSheets(ledger: Ledger, s: Settings): Sheet[] {
  const sheets: Sheet[] = [];
  const add = (name: string, rows: SheetRow[]) => sheets.push({ name, rows });

  const B = budgetCalc(ledger, s);
  const brows: SheetRow[] = [];
  B.items.forEach((it) => {
    brows.push({ 그룹: it.group, 항목: it.name, 세부: "", 상태: it.status, 금액: isNum(it.e.amount) ? Math.round(it.e.amount) : "", 상한선: or(it.cap), 반영액: Math.round(it.e.eff), 부담: it.payer, 메모: it.memo });
    (it.subs || []).forEach((x) =>
      brows.push({ 그룹: it.group, 항목: it.name, 세부: x.name, 상태: "", 금액: or(x.amount), 상한선: or(x.cap), 반영액: isNum(x.amount) ? x.amount : or(x.cap), 부담: "", 메모: "" }),
    );
  });
  add("전체예산", brows);

  add(
    "플래너",
    listOf<Planner>(ledger.planners).map((r) => ({
      플래너: r.name, 유형: r.kind, 담당: r.manager, 연락처: r.phone, 특징: r.features, 혜택: r.benefits, 조건: r.fee,
      ...sc(r.scores, "planner"), 평균: or(avgScore(r.scores, "planner")), 상태: r.status, 메모: r.memo,
    })),
  );

  const q = mainQuote(ledger, s);
  if (q) add("스드메견적", (q.items || []).map((i) => ({ 품목: i.cat, 업체: i.vendor, 상품: i.product, 판매가: i.list, 할인가: i.sale, 합계반영: i.count === false ? "X" : "O" })));

  add("추가비용", listOf<Extra>(ledger.extras).map((x) => ({ 구분: x.cat, 항목: x.name, 범위: x.range, 예상금액: or(x.amount), 반영: x.include ? "O" : "" })));

  const vendors = listOf<Vendor>(ledger.vendors);
  (["studio", "dress", "makeup"] as const).forEach((c) =>
    add(
      CAT_LABEL[c],
      vendors.filter((v) => v.cat === c).map((r) => ({
        업체: r.name, 제휴플래너: r.planner, 위치: r.location, 특징: r.features, 견적가: or(r.price), 정가: or(r.listPrice), 견적대비: or(r.quoteDelta), 추가금: r.extraFees, 인스타: r.insta, 후기링크: r.blog,
        ...sc(r.scores, c), 평균: or(avgScore(r.scores, c)), 상태: r.status, 메모: r.memo,
      })),
    ),
  );

  const dp: SheetRow[] = [];
  Object.values(dressPriceIndex(ledger).by).forEach((r) =>
    Object.entries(r.p).forEach(([p, x]) =>
      dp.push({ 드레스샵: r.name, 플래너: p, 본식: x.main, 본식최대: or(x.mainMax), 촬영본식: x.combo, 촬영본식최대: or(x.comboMax), 헬퍼: x.helper, 피팅비: x.fitting, 디자인추가금: x.design, 위약금: x.penalty }),
    ),
  );
  add("드레스정가", dp);

  const g = s.guests || 0;
  add(
    "웨딩홀",
    listOf<Hall>(ledger.halls).map((r) => {
      const est = hallEstimate(r, g);
      return {
        웨딩홀: r.name, 권역: r.zone, 구: r.gu, 동: r.dong, 유형: r.type, 식대최소: or(r.mealMin), 식대최대: or(r.mealMax), 대관료: or(r.rental), 대관료비고: r.rentalNote,
        최소보증: or(r.minGuests), 최대: or(r.maxGuests), [`예상총액(${g}명)`]: est != null ? Math.round(est) : "", 가능시간대: r.times,
        꽃장식: or(r.flowerFee), 연출: or(r.productionFee), 본식스냅: or(r.snapFee), 기타옵션: r.otherOptions, 역: r.station, 도보분: or(r.walk), 주차: or(r.parking), 주소: r.address, 전화: r.phone,
        ...sc(r.scores, "hall"), 평균: or(avgScore(r.scores, "hall")), 상태: r.status, 메모: r.memo, 출처: r.source,
      };
    }),
  );

  const eq = equity(ledger, s);
  add(
    "신혼집후보",
    listOf<Home>(ledger.homes).map((r) => {
      const c = homeCalc(r, ledger, s, eq);
      return {
        단지: r.name, 유형: r.kind, 구: r.gu, 동: r.dong, 전용: or(r.area), 호가: or(r.price), KB시세: or(r.kb), 실거래: or(r.recent), 전세가: or(r.jeonse),
        자금판정: c ? (c.ok ? "가능" : "부족") : "", 차액: c ? Math.round(c.gap) : "", 월부담: c ? Math.round(c.monthly) : "",
        ...sc(r.scores, "home"), 평균: or(avgScore(r.scores, "home")), 상태: r.status, 임장일: r.visit, 메모: r.memo,
      };
    }),
  );

  add("드레스보드", listOf<Dress>(ledger.dresses).map((r) => ({ 샵: r.shop, 실루엣: r.silhouette, 용도: r.use, 하트: r.rating, 메모: r.memo })));
  return sheets;
}
