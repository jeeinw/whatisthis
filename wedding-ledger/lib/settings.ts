import type { DeepPartial, Settings } from "./types";

export const DEF_SETTINGS: Settings = {
  guests: 200,
  mainHall: "",
  mainQuote: "",
  weddingDate: "",
  target: 40000000,
  giftIncome: null,
  fin: {
    jAsset: null,
    dAsset: null,
    jParents: null,
    dParents: null,
    other: null,
    subtractWedding: true,
    subtractSetup: true,
    jIncome: null,
    dIncome: null,
    combineIncome: true,
    existingAnnual: 0,
  },
  house: {
    mode: "jeonse",
    deposit: 700000000,
    product: "seoul",
    seoulBase: 3.95,
    bankRate: 4.2,
    bankCap: 444000000,
    buttimokRate: 2.7,
    price: 1100000000,
    regulated: true,
    firstHome: true,
    area85: false,
    rate: 4.3,
    years: 30,
    stress: 3.0,
    dsr: 40,
    regFee: 2000000,
  },
  loanSim: { auto: true, principal: null, rate: null, years: 30, method: "equal", grace: 0 },
};

type Obj = Record<string, unknown>;

function isPlainObject(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** legacy deepMerge와 같은 규칙: 객체는 재귀 병합, 나머지(배열·null 포함)는 덮어쓰기. */
export function deepMerge<T extends Obj>(target: T, patch: Obj): T {
  const t = target as Obj;
  for (const k in patch) {
    const v = patch[k];
    if (isPlainObject(v)) {
      if (!isPlainObject(t[k])) t[k] = {};
      deepMerge(t[k] as Obj, v);
    } else {
      t[k] = v;
    }
  }
  return target;
}

export function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o == null ? {} : o));
}

/** 저장된 설정을 기본값 위에 병합 (legacy `S()`). */
export function resolveSettings(stored: DeepPartial<Settings> | null | undefined): Settings {
  return deepMerge(clone(DEF_SETTINGS) as unknown as Obj, clone(stored ?? {}) as Obj) as unknown as Settings;
}
