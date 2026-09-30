// seed/*.json + private/settings.json → 테이블별 행. 파일 읽기와 검증만 하고 DB는 건드리지 않는다.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { docsToRows, SETTINGS_ID, TABLE, type Row } from "../lib/db";
import { COLLECTIONS, type CollectionName } from "../lib/types";

/** 아티팩트 DB 내보내기 기준 건수 (CLAUDE.md). 다르면 경고만 한다 — 이관 직전 재내보내기로 바뀔 수 있음. */
export const EXPECTED: Record<CollectionName, number> = {
  planners: 6,
  vendors: 8,
  quotes: 1,
  extras: 15,
  halls: 193,
  dresses: 0,
  budget: 38,
  homes: 0,
  priceLists: 3,
};

export interface SeedPlan {
  tables: { table: string; collection: CollectionName | "settings"; rows: Row[] }[];
  warnings: string[];
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`${path} 를 읽지 못했어요: ${(e as Error).message}`);
  }
}

function isDocMap(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function buildSeedPlan(root: string): SeedPlan {
  const seedDir = join(root, "seed");
  const warnings: string[] = [];
  if (!existsSync(seedDir)) throw new Error(`seed/ 폴더가 없어요 (${seedDir})`);

  // homes·dresses처럼 비어 있는 컬렉션은 _empty_collections.json 한 파일로 올 수 있다
  const emptyFile = join(seedDir, "_empty_collections.json");
  const empties = existsSync(emptyFile) ? readJson(emptyFile) : {};
  if (!isDocMap(empties)) throw new Error("_empty_collections.json 형식 오류");

  const tables: SeedPlan["tables"] = [];
  for (const c of COLLECTIONS) {
    const file = join(seedDir, `${c}.json`);
    let docs: unknown;
    if (existsSync(file)) docs = readJson(file);
    else if (c in empties) docs = empties[c];
    else {
      warnings.push(`${c}.json 이 없어 건너뜀`);
      continue;
    }
    if (!isDocMap(docs)) throw new Error(`${c}.json 은 {docId: 문서} 객체여야 해요`);
    const rows = docsToRows(docs);
    if (rows.length !== EXPECTED[c]) warnings.push(`${c}: ${rows.length}건 (기준 ${EXPECTED[c]}건)`);
    tables.push({ table: TABLE[c], collection: c, rows });
  }

  const settingsFile = join(root, "private/settings.json");
  if (existsSync(settingsFile)) {
    const s = readJson(settingsFile);
    if (!isDocMap(s)) throw new Error("private/settings.json 형식 오류");
    tables.push({ table: TABLE.settings, collection: "settings", rows: [{ id: SETTINGS_ID, data: s }] });
  } else {
    warnings.push("private/settings.json 이 없어 설정은 건너뜀 (앱 기본값 사용)");
  }

  return { tables, warnings };
}
