import type { CollectionName, DeepPartial, Ledger, Settings } from "./types";
import { COLLECTIONS } from "./types";

/** 앱 컬렉션 이름 → Postgres 테이블 이름 (snake_case). */
export const TABLE: Record<CollectionName | "settings", string> = {
  planners: "planners",
  vendors: "vendors",
  quotes: "quotes",
  extras: "extras",
  halls: "halls",
  dresses: "dresses",
  budget: "budget",
  homes: "homes",
  priceLists: "price_lists",
  settings: "settings",
};

export const SETTINGS_ID = "main";

export interface Row {
  id: string;
  data: Record<string, unknown>;
}

/** 아티팩트 DB 내보내기 {docId: doc} → 테이블 행. `id` 필드가 문서 안에 있으면 떼어낸다. */
export function docsToRows(docs: Record<string, unknown>): Row[] {
  return Object.entries(docs).map(([id, d]) => {
    if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error(`문서 형식 오류: ${id}`);
    const { id: _drop, ...data } = d as Record<string, unknown>;
    void _drop;
    return { id, data };
  });
}

/** 테이블 행 → {id: doc} 맵. */
export function rowsToDocs<T>(rows: Row[]): Record<string, T> {
  return Object.fromEntries(rows.map((r) => [r.id, r.data as T]));
}

export type LedgerRows = Partial<Record<CollectionName, Row[]>> & { settings?: Row[] };

/** DB에서 읽은 테이블별 행 묶음 → 계산용 Ledger. */
export function rowsToLedger(rows: LedgerRows): Ledger {
  const L = {} as Ledger;
  for (const c of COLLECTIONS) (L as unknown as Record<string, unknown>)[c] = rowsToDocs(rows[c] ?? []);
  const s = (rows.settings ?? []).find((r) => r.id === SETTINGS_ID);
  L.settings = (s?.data ?? {}) as DeepPartial<Settings>;
  return L;
}
