import { describe, expect, it } from "vitest";
import { geoKeyOf } from "../../components/KakaoMap";

describe("지도 좌표를 찾을 근거", () => {
  it("이름만 있고 구·코드가 없으면 찾지 않는다 (엉뚱한 지역 방지)", () => {
    expect(geoKeyOf({ name: "새 단지", gu: "", dong: "" })).toBeNull();
    expect(geoKeyOf({ name: "래미안퍼스티지", gu: "", dong: "" })).toBeNull();
  });
  it("구나 법정동코드가 있으면 찾고, 위치 정보가 바뀌면 키도 바뀐다", () => {
    const a = geoKeyOf({ name: "래미안퍼스티지", gu: "서초구", dong: "반포동" });
    expect(a).toBeTruthy();
    expect(geoKeyOf({ name: "래미안퍼스티지", gu: "서초구", dong: "잠원동" })).not.toBe(a);
    expect(geoKeyOf({ name: "판교푸르지오", lawdCd: "41135" })).toBeTruthy();
  });
});
