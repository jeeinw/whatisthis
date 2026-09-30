import type { ScoreKind } from "./types";

// legacy/wedding-ledger.html 의 상수를 그대로 옮김.

export const TABS = [
  { id: "summary", label: "요약" },
  { id: "budget", label: "전체 예산" },
  { id: "planner", label: "플래너·견적" },
  { id: "studio", label: "스튜디오" },
  { id: "dress", label: "드레스" },
  { id: "dprice", label: "드레스 견적 비교" },
  { id: "makeup", label: "메이크업" },
  { id: "hall", label: "웨딩홀" },
  { id: "board", label: "드레스 보드" },
  { id: "house", label: "신혼집·임장" },
] as const;

export const SCORE: Record<ScoreKind, ReadonlyArray<readonly [string, string]>> = {
  planner: [["resp", "응대·소통"], ["price", "가격"], ["lineup", "제휴 라인업"], ["trans", "견적 투명성"], ["care", "일정 관리"]],
  studio: [["quality", "결과물"], ["taste", "취향 일치"], ["price", "가격"], ["access", "접근성"], ["review", "후기"]],
  dress: [["design", "디자인"], ["fit", "체형 핏"], ["price", "가격"], ["trans", "추가금 투명성"], ["service", "응대"]],
  makeup: [["style", "스타일"], ["skin", "피부 표현"], ["price", "가격"], ["review", "후기"], ["service", "응대"]],
  hall: [["loc", "위치·교통"], ["mood", "홀 분위기"], ["food", "식사"], ["price", "가격"], ["park", "주차"], ["flow", "동선·단독성"]],
  home: [["transit", "교통·출퇴근"], ["life", "생활 편의"], ["school", "학군"], ["complex", "단지·관리"], ["light", "채광·향"], ["noise", "소음·주변"], ["future", "미래가치"]],
};

export const V_STATUS = ["관심", "상담예정", "견적받음", "투어완료", "계약", "보류", "제외"];
export const H_STATUS = ["미정", "관심", "투어예정", "투어완료", "가계약", "계약", "제외"];
export const HOME_STATUS = ["관심", "임장예정", "임장완료", "협상중", "계약", "제외"];
export const B_STATUS = ["미정", "알아보는 중", "견적", "확정", "지불 완료"];
export const PAYERS = ["공동", "J", "D", "J 부모님", "D 부모님"];

const RANK: Record<string, number> = {
  계약: 6, 가계약: 5, 협상중: 5, 투어완료: 4, 임장완료: 4, 견적받음: 3.5,
  투어예정: 3, 임장예정: 3, 상담예정: 2.5, 관심: 2, 미정: 1, 보류: 0.5, 제외: 0,
};
export const rank = (s: string | undefined) => (s != null && RANK[s] != null ? RANK[s] : 1);

export const ZONES = ["강남권", "도심권", "서남권", "서북권", "동북권", "기타"];
export const HALL_TYPES = ["컨벤션", "호텔", "하우스", "채플"];
export const SILHOUETTES = ["", "A라인", "벨라인", "머메이드", "슬림·시스", "엠파이어", "볼가운", "미니"];
export const USES = ["", "리허설 촬영", "본식", "2부", "미정"];
export const CAT_LABEL: Record<string, string> = { studio: "스튜디오", dress: "드레스", makeup: "메이크업", snap: "본식스냅", etc: "기타" };
export const WEDDING_GROUPS = ["예식", "스드메", "예물·예복", "인사·모임", "신혼여행", "관리", "기타"];
export const HOUSE_GROUP = "신혼집·살림";
export const DRESS_PLANNERS = ["제이웨딩", "다이렉트", "베리굿"];

export const CHECKS: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]> = [
  ["출발 전", [["rt", "국토부 실거래가·KB시세 최근 3개월 확인"], ["reg", "등기부등본 (근저당·가압류·소유자)"], ["bld", "건축물대장 (위반건축물 여부)"], ["sch", "배정 초·중학교, 학원가 거리"], ["plan", "재건축·교통 호재, 주변 개발 계획"], ["fee", "관리비 수준 (겨울철 포함)"]]],
  ["단지 밖", [["walk", "역까지 실제 도보 시간·경사"], ["noise", "큰길·철도·학교 소음"], ["infra", "마트·병원·공원·편의시설"], ["bad", "유흥·유해시설, 밤길 분위기"]]],
  ["단지 안", [["park", "밤 9시 이후 주차 여유"], ["dong", "동 간 거리·향·조망"], ["comm", "커뮤니티·관리 상태·청결"], ["elev", "엘리베이터·분리수거·택배"]]],
  ["집 안", [["sun", "시간대별 채광"], ["leak", "누수·곰팡이·결로 흔적"], ["water", "수압·배수·보일러"], ["window", "샷시·단열"], ["floor", "층간소음 (윗집 생활 시간대)"]]],
  ["전세라면", [["senior", "선순위 채권 + 보증금 ≤ 시세 70%"], ["ratio", "전세가율 (높으면 위험)"], ["tax", "집주인 국세·지방세 체납 확인"], ["guar", "전세보증보험 가입 가능 여부"], ["fix", "잔금일 전입신고·확정일자 동선"]]],
];
