/**
 * 국토교통부 실거래가 OpenAPI (공공데이터포털) — 요청 URL·파싱·집계 순수 함수.
 *
 * 명세 출처 (2026-10 확인, 각 페이지에 내장된 Swagger 2.0 스펙):
 * - 아파트 매매 실거래가 상세 자료 (15126468)
 *   GET https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev
 *   params: serviceKey, LAWD_CD(법정동코드 앞 5자리), DEAL_YMD(YYYYMM), pageNo, numOfRows — 응답 XML
 *   item: aptNm, umdNm, jibun, excluUseAr, dealYear, dealMonth, dealDay, dealAmount(만원), floor,
 *         buildYear, aptSeq, cdealType(해제여부), cdealDay, dealingGbn, aptDong …
 * - 아파트 전월세 실거래가 자료 (15126474)
 *   GET https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent
 *   params: serviceKey, LAWD_CD, DEAL_YMD — 응답 XML
 *   item: aptNm, umdNm, jibun, excluUseAr, dealYear, dealMonth, dealDay, deposit(만원), monthlyRent(만원),
 *         floor, buildYear, contractTerm, contractType, useRRRight, preDeposit, preMonthlyRent
 */

export const RTMS = {
  trade: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
  rent: "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent",
} as const;

/** 서울 25개 구 법정동코드 앞 5자리 (행정표준코드). 서울 밖은 homes.lawdCd 에 직접 입력. */
export const SEOUL_LAWD: Record<string, string> = {
  종로구: "11110", 중구: "11140", 용산구: "11170", 성동구: "11200", 광진구: "11215",
  동대문구: "11230", 중랑구: "11260", 성북구: "11290", 강북구: "11305", 도봉구: "11320",
  노원구: "11350", 은평구: "11380", 서대문구: "11410", 마포구: "11440", 양천구: "11470",
  강서구: "11500", 구로구: "11530", 금천구: "11545", 영등포구: "11560", 동작구: "11590",
  관악구: "11620", 서초구: "11650", 강남구: "11680", 송파구: "11710", 강동구: "11740",
};

export function resolveLawd(h: { lawdCd?: string | null; gu?: string | null }): string | null {
  const own = (h.lawdCd || "").trim();
  if (/^\d{5}$/.test(own)) return own;
  const gu = (h.gu || "").trim();
  if (!gu) return null;
  return SEOUL_LAWD[gu] ?? SEOUL_LAWD[gu.endsWith("구") ? gu : gu + "구"] ?? null;
}

/** 최근 n개월 계약년월 (이번 달 포함, 최신순). */
export function recentMonths(n: number, now = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export function rtmsUrl(kind: "trade" | "rent", key: string, lawd: string, ymd: string, pageNo = 1, numOfRows = 1000): string {
  // 포털은 Encoding/Decoding 두 형태의 키를 준다. 어느 쪽을 넣어도 한 번만 인코딩되게.
  let k = key.trim();
  if (/%[0-9A-Fa-f]{2}/.test(k)) {
    try {
      k = decodeURIComponent(k);
    } catch {}
  }
  const q = new URLSearchParams({ serviceKey: k, LAWD_CD: lawd, DEAL_YMD: ymd, pageNo: String(pageNo), numOfRows: String(numOfRows) });
  return `${RTMS[kind]}?${q.toString()}`;
}

/* ---------- XML 파싱 (평평한 구조라 정규식으로 충분) ---------- */

const unescapeXml = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? unescapeXml(m[1]) : null;
}

export interface RtmsPage {
  ok: boolean;
  code: string | null;
  msg: string | null;
  totalCount: number;
  items: Record<string, string>[];
}

export function parseRtmsXml(xml: string): RtmsPage {
  const code = tag(xml, "resultCode");
  const msg = tag(xml, "resultMsg");
  // 게이트웨이 오류(인증키 등)는 OpenAPI_ServiceResponse/cmmMsgHeader 형식으로 온다
  const gwErr = tag(xml, "returnAuthMsg") || tag(xml, "errMsg");
  const items: Record<string, string>[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const o: Record<string, string> = {};
    for (const f of m[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) o[f[1]] = unescapeXml(f[2]);
    items.push(o);
  }
  const ok = !gwErr && (code == null ? items.length > 0 || /<body>/.test(xml) : /^0+$/.test(code));
  return { ok, code: code ?? null, msg: gwErr || msg, totalCount: Number(tag(xml, "totalCount") ?? items.length) || 0, items };
}

/* ---------- 정규화 ---------- */

const num = (s: string | undefined) => {
  if (s == null) return null;
  const v = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : null;
};
const ymd = (it: Record<string, string>) =>
  `${it.dealYear}-${String(it.dealMonth ?? "").padStart(2, "0")}-${String(it.dealDay ?? "").padStart(2, "0")}`;

export interface Trade {
  apt: string;
  dong: string;
  area: number;
  date: string;
  /** 원 단위 */
  price: number;
  floor: number | null;
  canceled: boolean;
}

export interface Rent {
  apt: string;
  dong: string;
  area: number;
  date: string;
  /** 원 단위 */
  deposit: number;
  /** 원 단위 (0이면 전세) */
  monthly: number;
  floor: number | null;
  contractType: string;
}

export function toTrade(it: Record<string, string>): Trade | null {
  const price = num(it.dealAmount);
  const area = num(it.excluUseAr);
  if (price == null || area == null) return null;
  return { apt: it.aptNm ?? "", dong: it.umdNm ?? "", area, date: ymd(it), price: price * 10000, floor: num(it.floor), canceled: !!(it.cdealType && it.cdealType.trim()) };
}

export function toRent(it: Record<string, string>): Rent | null {
  const deposit = num(it.deposit);
  const area = num(it.excluUseAr);
  if (deposit == null || area == null) return null;
  return { apt: it.aptNm ?? "", dong: it.umdNm ?? "", area, date: ymd(it), deposit: deposit * 10000, monthly: (num(it.monthlyRent) ?? 0) * 10000, floor: num(it.floor), contractType: it.contractType ?? "" };
}

/** 단지명 비교용: 공백·괄호·'아파트' 제거, 소문자. */
export const normApt = (s: string) => s.replace(/\(.*?\)|\s|아파트$/g, "").toLowerCase();

export function matchesApt(itemApt: string, target: string, itemDong?: string, targetDong?: string): boolean {
  const a = normApt(itemApt), t = normApt(target);
  if (!a || !t) return false;
  const nameOk = a === t || a.includes(t) || t.includes(a);
  if (!nameOk) return false;
  if (targetDong && itemDong) return itemDong.replace(/\s/g, "") === targetDong.replace(/\s/g, "");
  return true;
}

/* ---------- 전용면적별 집계 ---------- */

export interface AreaStat {
  /** 전용면적 (㎡, 소수 첫째 자리 반올림) */
  area: number;
  trade: { count: number; latest: Trade | null; avg: number | null; min: number | null; max: number | null };
  jeonse: { count: number; latest: Rent | null; avg: number | null };
  wolseCount: number;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const byDateDesc = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export function summarize(trades: Trade[], rents: Rent[]): AreaStat[] {
  const live = trades.filter((t) => !t.canceled);
  const areas = [...new Set([...live.map((t) => round1(t.area)), ...rents.map((r) => round1(r.area))])].sort((a, b) => a - b);
  return areas.map((area) => {
    const ts = live.filter((t) => round1(t.area) === area).sort(byDateDesc);
    const rs = rents.filter((r) => round1(r.area) === area).sort(byDateDesc);
    const js = rs.filter((r) => r.monthly === 0);
    const prices = ts.map((t) => t.price);
    return {
      area,
      trade: { count: ts.length, latest: ts[0] ?? null, avg: avg(prices), min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null },
      jeonse: { count: js.length, latest: js[0] ?? null, avg: avg(js.map((r) => r.deposit)) },
      wolseCount: rs.length - js.length,
    };
  });
}

/** 임장 후보의 전용면적에 가장 가까운 면적 그룹 (±3㎡ 이내). */
export function closestArea(stats: AreaStat[], area: number | null | undefined): AreaStat | null {
  if (area == null || !stats.length) return null;
  const best = stats.reduce((a, b) => (Math.abs(b.area - area) < Math.abs(a.area - area) ? b : a));
  return Math.abs(best.area - area) <= 3 ? best : null;
}
