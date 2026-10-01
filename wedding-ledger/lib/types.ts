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
  /** 저장된 원본 설정 (부분일 수 있음). 계산 시 DEF_SETTINGS와 병합한다. */
  settings: DeepPartial<Settings>;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export const COLLECTIONS = [
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
export type CollectionName = (typeof COLLECTIONS)[number];
