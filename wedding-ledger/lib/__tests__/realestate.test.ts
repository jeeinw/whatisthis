import { describe, expect, it } from "vitest";
import { closestArea, matchesApt, parseRtmsXml, recentMonths, resolveLawd, rtmsUrl, summarize, toRent, toTrade } from "../realestate";

// 명세(Swagger)의 필드 이름으로 만든 응답 샘플
const TRADE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>
<item><aptNm>래미안 퍼스티지</aptNm><umdNm>반포동</umdNm><excluUseAr>84.93</excluUseAr><dealYear>2026</dealYear><dealMonth>8</dealMonth><dealDay>3</dealDay><dealAmount>   480,000</dealAmount><floor>12</floor><cdealType> </cdealType></item>
<item><aptNm>래미안퍼스티지</aptNm><umdNm>반포동</umdNm><excluUseAr>84.93</excluUseAr><dealYear>2026</dealYear><dealMonth>9</dealMonth><dealDay>21</dealDay><dealAmount>495,000</dealAmount><floor>20</floor><cdealType></cdealType></item>
<item><aptNm>래미안퍼스티지</aptNm><umdNm>반포동</umdNm><excluUseAr>84.93</excluUseAr><dealYear>2026</dealYear><dealMonth>9</dealMonth><dealDay>25</dealDay><dealAmount>300,000</dealAmount><floor>3</floor><cdealType>O</cdealType></item>
<item><aptNm>반포자이</aptNm><umdNm>반포동</umdNm><excluUseAr>59.98</excluUseAr><dealYear>2026</dealYear><dealMonth>9</dealMonth><dealDay>1</dealDay><dealAmount>320,000</dealAmount><floor>8</floor></item>
</items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>4</totalCount></body></response>`;

const RENT_XML = `<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>
<item><aptNm>래미안퍼스티지</aptNm><umdNm>반포동</umdNm><excluUseAr>84.93</excluUseAr><dealYear>2026</dealYear><dealMonth>9</dealMonth><dealDay>2</dealDay><deposit>150,000</deposit><monthlyRent>0</monthlyRent><floor>5</floor><contractType>신규</contractType></item>
<item><aptNm>래미안퍼스티지</aptNm><umdNm>반포동</umdNm><excluUseAr>84.93</excluUseAr><dealYear>2026</dealYear><dealMonth>7</dealMonth><dealDay>11</dealDay><deposit>140,000</deposit><monthlyRent>0</monthlyRent><floor>9</floor><contractType>갱신</contractType></item>
<item><aptNm>래미안퍼스티지</aptNm><umdNm>반포동</umdNm><excluUseAr>84.93</excluUseAr><dealYear>2026</dealYear><dealMonth>9</dealMonth><dealDay>5</dealDay><deposit>50,000</deposit><monthlyRent>300</monthlyRent><floor>7</floor><contractType></contractType></item>
</items><totalCount>3</totalCount></body></response>`;

const GW_ERROR = `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;

describe("실거래가 API", () => {
  it("요청 URL: 명세의 파라미터, 인코딩 키는 한 번만 인코딩", () => {
    const u = new URL(rtmsUrl("trade", "abc%2Bdef%3D%3D", "11650", "202609"));
    expect(u.origin + u.pathname).toBe("https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev");
    expect(u.searchParams.get("serviceKey")).toBe("abc+def==");
    expect(u.searchParams.get("LAWD_CD")).toBe("11650");
    expect(u.searchParams.get("DEAL_YMD")).toBe("202609");
    expect(new URL(rtmsUrl("rent", "abc+def==", "11650", "202609")).searchParams.get("serviceKey")).toBe("abc+def==");
  });

  it("법정동코드: 직접 입력 우선, 서울 구 이름 자동", () => {
    expect(resolveLawd({ gu: "서초구" })).toBe("11650");
    expect(resolveLawd({ gu: "서초" })).toBe("11650");
    expect(resolveLawd({ gu: "분당구", lawdCd: "41135" })).toBe("41135");
    expect(resolveLawd({ gu: "분당구" })).toBeNull();
  });

  it("최근 n개월", () => {
    expect(recentMonths(3, new Date(2026, 0, 15))).toEqual(["202601", "202512", "202511"]);
  });

  it("XML 파싱 + 금액은 만원→원, 쉼표·공백 처리", () => {
    const p = parseRtmsXml(TRADE_XML);
    expect(p.ok).toBe(true);
    expect(p.totalCount).toBe(4);
    const t = toTrade(p.items[0])!;
    expect(t).toMatchObject({ apt: "래미안 퍼스티지", area: 84.93, date: "2026-08-03", price: 4_800_000_000, floor: 12, canceled: false });
    expect(toTrade(p.items[2])!.canceled).toBe(true);
    const r = toRent(parseRtmsXml(RENT_XML).items[2])!;
    expect(r).toMatchObject({ deposit: 500_000_000, monthly: 3_000_000 });
  });

  it("게이트웨이 인증 오류는 ok=false + 사유", () => {
    const p = parseRtmsXml(GW_ERROR);
    expect(p.ok).toBe(false);
    expect(p.msg).toBe("SERVICE_KEY_IS_NOT_REGISTERED_ERROR");
  });

  it("단지명 매칭: 공백 무시, 다른 단지 제외, 동 지정 시 동까지", () => {
    expect(matchesApt("래미안 퍼스티지", "래미안퍼스티지")).toBe(true);
    expect(matchesApt("반포자이", "래미안퍼스티지")).toBe(false);
    expect(matchesApt("래미안퍼스티지", "래미안퍼스티지", "반포동", "잠원동")).toBe(false);
  });

  it("전용면적별 집계: 해제 거래 제외, 전세/월세 구분, 최신순", () => {
    const trades = parseRtmsXml(TRADE_XML).items.map(toTrade).filter((x) => x && matchesApt(x.apt, "래미안퍼스티지")) as NonNullable<ReturnType<typeof toTrade>>[];
    const rents = parseRtmsXml(RENT_XML).items.map(toRent).filter(Boolean) as NonNullable<ReturnType<typeof toRent>>[];
    const s = summarize(trades, rents);
    expect(s).toHaveLength(1);
    expect(s[0].area).toBe(84.9);
    expect(s[0].trade).toMatchObject({ count: 2, avg: 4_875_000_000, min: 4_800_000_000, max: 4_950_000_000 });
    expect(s[0].trade.latest!.date).toBe("2026-09-21");
    expect(s[0].jeonse).toMatchObject({ count: 2, avg: 1_450_000_000 });
    expect(s[0].jeonse.latest!.date).toBe("2026-09-02");
    expect(s[0].wolseCount).toBe(1);
    expect(closestArea(s, 84)?.area).toBe(84.9);
    expect(closestArea(s, 59)).toBeNull();
  });
});
