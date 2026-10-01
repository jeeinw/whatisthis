// 아티팩트 DB 문서 구조를 그대로 옮긴 타입. 금액은 전부 원 단위 정수(또는 null).

export type Won = number | null;
export type Scores = Record<string, number | null | undefined>;

export type ScoreKind = "planner" | "studio" | "dress" | "makeup" | "hall" | "home";

export interface Planner {
  id: string;
  name: string;
  photo?: string;
  kind?: string;
  manager?: string;
  phone?: string;
  address?: string;
  features?: string;
  benefits?: string;
  fee?: string;
  insta?: string;
  blog?: string;
  source?: string;
  scores?: Scores;
  status?: string;
  memo?: string;
}

export type VendorCat = "studio" | "dress" | "makeup" | "snap" | "etc";

export interface Vendor {
  id: string;
  cat: VendorCat;
  name: string;
  planner?: string;
  location?: string;
  features?: string;
  price?: Won;
  listPrice?: Won;
  listNote?: string;
  quoteDelta?: Won;
  priceNote?: string;
  extraFees?: string;
  insta?: string;
  blog?: string;
  blogSummary?: string;
  source?: string;
  scores?: Scores;
  status?: string;
  photo?: string;
  /** 상담·투어 사진 (Storage 경로) */
  photos?: string[];
  memo?: string;
}

export interface QuoteItem {
  cat: string;
  vendor: string;
  product: string;
  list: Won;
  sale: Won;
  count?: boolean;
}

export interface QuoteOption {
  name: string;
  delta: Won;
}

export type LineupKey = "studio" | "dress" | "makeup";

export interface Quote {
  id: string;
  title?: string;
  planner?: string;
  contractDate?: string;
  manager?: string;
  items?: QuoteItem[];
  contractTotal?: Won;
  deposit?: Won;
  balance?: string;
  options?: Partial<Record<LineupKey, QuoteOption[]>>;
  selected?: Partial<Record<LineupKey, number>>;
  notes?: string;
}

export interface Extra {
  id: string;
  name: string;
  range?: string;
  cat?: string;
  amount: Won;
  include: boolean;
  order?: number;
}

export interface Hall {
  id: string;
  name: string;
  zone?: string;
  gu?: string;
  dong?: string;
  type?: string;
  mealType?: string;
  mealMin?: Won;
  mealMax?: Won;
  rental?: Won;
  rentalNote?: string;
  /** 가격을 마지막으로 확인한 날 (YYYY-MM-DD) */
  checkedAt?: string;
  minGuests?: number | null;
  maxGuests?: number | null;
  times?: string;
  interval?: number | null;
  flowerFee?: Won;
  productionFee?: Won;
  snapFee?: Won;
  otherOptions?: string;
  includes?: string;
  station?: string;
  walk?: number | null;
  parking?: number | null;
  split?: boolean | null;
  exclusive?: boolean | null;
  address?: string;
  phone?: string;
  homepage?: string;
  insta?: string;
  naverPlace?: string;
  blog?: string;
  tags?: string[];
  mood?: string[];
  plannerQuote?: { src?: string; cat?: string } | null;
  hallCount?: number | null;
  outdoor?: boolean | null;
  simul?: boolean | null;
  scores?: Scores;
  status?: string;
  source?: string;
  memo?: string;
  photo?: string;
  /** 투어 사진 (Storage 경로) */
  photos?: string[];
}

export interface PriceListRow {
  shop: string;
  key: string;
  main?: Won;
  mainMax?: Won;
  combo?: Won;
  comboMax?: Won;
  helper?: string;
  design?: string;
  firstWear?: string;
  extraDress?: string;
  fitting?: string;
  refit?: string;
  penalty?: string;
  extras?: string;
  notes?: string;
}

export interface PriceList {
  id: string;
  planner: string;
  cat?: string;
  asOf?: string;
  unitNote?: string;
  rows?: PriceListRow[];
}

export type BudgetLink = "" | "hall" | "sdm" | "sdmExtras" | "houseCosts";

export interface BudgetSub {
  name: string;
  amount: Won;
  cap: Won;
}

export interface BudgetItem {
  id: string;
  group: string;
  name: string;
  link?: BudgetLink;
  status?: string;
  amount?: Won;
  cap?: Won;
  payer?: string;
  memo?: string;
  order?: number;
  subs?: BudgetSub[];
  meta?: { destination?: string; nights?: string };
}

export interface Home {
  id: string;
  name: string;
  kind?: "매매" | "전세";
  gu?: string;
  dong?: string;
  area?: number | null;
  price?: Won;
  kb?: Won;
  recent?: Won;
  jeonse?: Won;
  units?: number | null;
  year?: number | null;
  station?: string;
  walk?: number | null;
  school?: string;
  visit?: string;
  agent?: string;
  link?: string;
  scores?: Scores;
  checks?: Record<string, boolean>;
  status?: string;
  memo?: string;
  photo?: string;
  /** 임장 현장 사진 (Storage 경로) */
  photos?: string[];
  /** 국토부 실거래 단지명 (비우면 name) */
  aptNm?: string;
  /** 법정동코드 앞 5자리 (서울은 gu 로 자동) */
  lawdCd?: string;
  /** 지번 (실거래 조회에서 담은 경우) — 지도 위치 찾기용 */
  jibun?: string;
  /** 지도 좌표 (한 번 찾으면 저장) */
  lat?: number | null;
  lng?: number | null;
  /** 좌표를 찾을 때 쓴 이름·위치 (바뀌면 다시 찾음) */
  geoKey?: string;
}

export type Side = "J" | "D" | "공동";

/** 하객 명단 — 한 줄이 한 사람 또는 한 가족(count 명) */
export interface Guest {
  id: string;
  name: string;
  side?: Side;
  group?: string;
  count?: number | null;
  invite?: boolean;
  rsvp?: "미정" | "참석" | "불참";
  phone?: string;
  memo?: string;
}

/** 축의금 장부 */
export interface Gift {
  id: string;
  name: string;
  side?: Side;
  relation?: string;
  amount?: Won;
  method?: string;
  guestId?: string;
  thanks?: boolean;
  memo?: string;
}

export type PayStage = "계약금" | "중도금" | "잔금" | "기타";

/** 지불 일정 — 업체별 계약금·중도금·잔금 */
export interface Payment {
  id: string;
  title: string;
  vendor?: string;
  budgetId?: string;
  stage?: PayStage;
  amount?: Won;
  due?: string;
  paid?: boolean;
  paidDate?: string;
  payer?: string;
  memo?: string;
}

/** D-day 준비 체크리스트 — dday(결혼식 n일 전) 또는 due(날짜) 중 하나로 마감 */
export interface Task {
  id: string;
  title: string;
  cat?: string;
  dday?: number | null;
  due?: string;
  done?: boolean;
  doneAt?: string;
  memo?: string;
}

export interface Dress {
  id: string;
  photo?: string;
  shop?: string;
  silhouette?: string;
  use?: string;
  rating?: number;
  memo?: string;
  createdAt?: number;
}

export interface Fin {
  jAsset: Won;
  dAsset: Won;
  jParents: Won;
  dParents: Won;
  other: Won;
  subtractWedding: boolean;
  subtractSetup: boolean;
  jIncome: Won;
  dIncome: Won;
  combineIncome: boolean;
  existingAnnual: Won;
}

export type JeonseProductKey = "seoul" | "buttimok" | "bank";

export interface HouseSettings {
  mode: "jeonse" | "buy";
  deposit: number;
  product: JeonseProductKey;
  seoulBase: number;
  bankRate: number;
  bankCap: number;
  buttimokRate: number;
  price: number;
  regulated: boolean;
  firstHome: boolean;
  area85: boolean;
  rate: number;
  years: number;
  stress: number;
  dsr: number;
  regFee: Won;
}

export type LoanMethod = "equal" | "principal" | "bullet";

export interface LoanSim {
  auto: boolean;
  principal: Won;
  rate: number | null;
  years: number;
  method: LoanMethod;
  grace: number;
}

export interface Settings {
  guests: number;
  mainHall: string;
  mainQuote: string;
  weddingDate: string;
  target: number;
  giftIncome: Won;
  fin: Fin;
  house: HouseSettings;
  loanSim: LoanSim;
}

/** 계산에 필요한 전체 데이터. 컬렉션은 {id: doc} 맵 (아티팩트 DB와 같은 모양). */
export interface Ledger {
  planners: Record<string, Omit<Planner, "id">>;
  vendors: Record<string, Omit<Vendor, "id">>;
  quotes: Record<string, Omit<Quote, "id">>;
  extras: Record<string, Omit<Extra, "id">>;
  halls: Record<string, Omit<Hall, "id">>;
  dresses: Record<string, Omit<Dress, "id">>;
  budget: Record<string, Omit<BudgetItem, "id">>;
  homes: Record<string, Omit<Home, "id">>;
  priceLists: Record<string, Omit<PriceList, "id">>;
  guests: Record<string, Omit<Guest, "id">>;
  gifts: Record<string, Omit<Gift, "id">>;
  payments: Record<string, Omit<Payment, "id">>;
  tasks: Record<string, Omit<Task, "id">>;
  /** 저장된 원본 설정 (부분일 수 있음). 계산 시 DEF_SETTINGS와 병합한다. */
  settings: DeepPartial<Settings>;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** 아티팩트 DB에서 옮겨 온 컬렉션 (seed import 대상) */
export const SEED_COLLECTIONS = [
  "planners",
  "vendors",
  "quotes",
  "extras",
  "halls",
  "dresses",
  "budget",
  "homes",
  "priceLists",
] as const;
export type SeedCollection = (typeof SEED_COLLECTIONS)[number];

/** 웹앱에서 새로 생긴 컬렉션 (0002 마이그레이션) */
export const NEW_COLLECTIONS = ["guests", "gifts", "payments", "tasks"] as const;

export const COLLECTIONS = [...SEED_COLLECTIONS, ...NEW_COLLECTIONS] as const;
export type CollectionName = (typeof COLLECTIONS)[number];
