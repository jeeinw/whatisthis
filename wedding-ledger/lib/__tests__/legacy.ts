// legacy/wedding-ledger.html 의 계산 코드를 그대로 잘라내 Node에서 실행하는 하네스.
// lib/ 의 TS 구현과 같은 입력으로 결과를 비교하기 위해서만 쓴다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Ledger } from "../types";

const HTML = readFileSync(join(__dirname, "../../legacy/wedding-ledger.html"), "utf8");

function between(start: string, end: string): string {
  const a = HTML.indexOf(start);
  const b = HTML.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`legacy 구간을 찾지 못함: ${start} … ${end}`);
  return HTML.slice(a, b);
}

// 상수, 상태/기본설정, 유틸, 계산 구간. (DOM·localStorage를 건드리는 코드는 제외)
const constants = between("/* ================= constants", "/* ================= state");
const stateDecl = between("const state=", "const ui=loadUI();");
const utils = between("/* ================= utils", "/* ================= storage");
const calc = between("/* ================= calculations", "/* ================= shared view helpers");
const homeCalc = between("function homeCalc(r,s){", "function homesTable(s){");

const EXPORTS = [
  "state", "S", "avg", "quoteTotal", "extrasTotal", "hallMeal", "hallEstimate", "acqTax", "brokerage",
  "pmtFactor", "incomeFor", "equity", "buyLimit", "buyCalc", "maxBuyPrice", "jeonseProducts",
  "jeonseCalc", "houseCosts", "amort", "linkedAmount", "itemEff", "budgetCalc", "homeCalc", "mainQuote",
];

const factory = new Function(
  `"use strict";\n${constants}\n${stateDecl}\n${utils}\n${calc}\n${homeCalc}\nreturn {${EXPORTS.join(",")}};`,
) as () => Record<string, (...a: unknown[]) => unknown> & { state: Record<string, unknown> };

/** legacy 계산 함수 묶음. 매번 새 state로 만든다. */
export function loadLegacy(ledger: Ledger) {
  const L = factory();
  const data = JSON.parse(JSON.stringify(ledger)) as Ledger;
  Object.assign(L.state, data);
  return L;
}
