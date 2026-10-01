import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildSheets } from "../export";
import { resolveSettings } from "../settings";
import { realLedger, sampleLedger } from "./fixtures";

// legacy exportBtn 과 같은 시트 순서 + 웹앱에서 추가한 4개
const LEGACY_SHEETS = ["전체예산", "플래너", "스드메견적", "추가비용", "스튜디오", "드레스", "메이크업", "드레스정가", "웨딩홀", "신혼집후보", "드레스보드", "하객명단", "축의금", "지불일정", "준비체크리스트"];

describe("엑셀 내보내기", () => {
  for (const [name, L] of [["합성 데이터", sampleLedger()], ["실제 데이터", realLedger()]] as const) {
    if (!L) continue;
    it(`${name}: 시트 15개 (legacy 11 + 새 4), 행 수, xlsx 왕복`, () => {
      const s = resolveSettings(L.settings);
      const sheets = buildSheets(L, s);
      expect(sheets.map((x) => x.name)).toEqual(LEGACY_SHEETS);
      const budgetRows = Object.values(L.budget).reduce((a, it) => a + 1 + (it.subs?.length ?? 0), 0);
      expect(sheets[0].rows.length).toBe(budgetRows);
      expect(sheets.find((x) => x.name === "웨딩홀")!.rows.length).toBe(Object.keys(L.halls).length);

      const wb = XLSX.utils.book_new();
      for (const sh of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sh.rows.length ? sh.rows : [{}]), sh.name);
      const back = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
      expect(back.SheetNames).toEqual(LEGACY_SHEETS);
      const hallRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(back.Sheets["웨딩홀"]);
      expect(Object.keys(hallRows[0] ?? {})).toContain(`예상총액(${s.guests}명)`);
    });
  }
});
