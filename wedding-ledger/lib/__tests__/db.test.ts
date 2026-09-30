import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSeedPlan } from "../../scripts/seed-data";
import { docsToRows, rowsToLedger } from "../db";
import { budgetCalc } from "../calc/wedding";
import { resolveSettings } from "../settings";
import { sampleLedger } from "./fixtures";

describe("DB 행 변환", () => {
  it("docs → rows → Ledger 왕복 시 계산 결과가 같다", () => {
    const L = sampleLedger();
    const rows = {
      budget: docsToRows(L.budget),
      halls: docsToRows(L.halls),
      quotes: docsToRows(L.quotes),
      extras: docsToRows(L.extras),
      settings: [{ id: "main", data: L.settings as Record<string, unknown> }],
    };
    const back = rowsToLedger(rows);
    const s = resolveSettings(back.settings);
    expect(budgetCalc(back, s).wedding).toBe(budgetCalc(L, resolveSettings(L.settings)).wedding);
    expect(back.homes).toEqual({});
  });

  it("문서 안의 id 필드는 떼어낸다", () => {
    expect(docsToRows({ a: { id: "x", name: "n" } })).toEqual([{ id: "a", data: { name: "n" } }]);
  });

  it("문서가 객체가 아니면 거부", () => {
    expect(() => docsToRows({ a: [1] })).toThrow();
  });
});

describe("seed 적재 계획", () => {
  function tempRoot() {
    const root = mkdtempSync(join(tmpdir(), "wl-seed-"));
    mkdirSync(join(root, "seed"));
    return root;
  }

  it("_empty_collections.json 으로 빈 컬렉션을 채우고, 건수 차이는 경고", () => {
    const root = tempRoot();
    writeFileSync(join(root, "seed/budget.json"), JSON.stringify({ a: { group: "예식", name: "x" } }));
    writeFileSync(join(root, "seed/_empty_collections.json"), JSON.stringify({ homes: {}, dresses: {} }));
    const plan = buildSeedPlan(root);
    const byTable = Object.fromEntries(plan.tables.map((t) => [t.table, t.rows.length]));
    expect(byTable).toMatchObject({ budget: 1, homes: 0, dresses: 0 });
    expect(plan.warnings.some((w) => w.includes("budget: 1건"))).toBe(true);
    expect(plan.warnings.some((w) => w.includes("halls.json 이 없어"))).toBe(true);
    expect(plan.warnings.some((w) => w.includes("settings.json"))).toBe(true);
  });

  it("priceLists 는 price_lists 테이블로, settings 는 main 1행으로", () => {
    const root = tempRoot();
    mkdirSync(join(root, "private"));
    writeFileSync(join(root, "seed/priceLists.json"), JSON.stringify({ p: { planner: "제이웨딩", rows: [] } }));
    writeFileSync(join(root, "private/settings.json"), JSON.stringify({ guests: 150 }));
    const plan = buildSeedPlan(root);
    expect(plan.tables.find((t) => t.collection === "priceLists")?.table).toBe("price_lists");
    expect(plan.tables.find((t) => t.table === "settings")?.rows).toEqual([{ id: "main", data: { guests: 150 } }]);
  });

  it("형식이 틀린 파일은 에러", () => {
    const root = tempRoot();
    writeFileSync(join(root, "seed/halls.json"), "[1,2]");
    expect(() => buildSeedPlan(root)).toThrow(/halls/);
  });
});
