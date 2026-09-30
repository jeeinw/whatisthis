"use client";
import { DRESS_PLANNERS as P } from "@/lib/constants";
import { dressPriceIndex, minPrice, myDressKeys, normShop, type DressShop } from "@/lib/calc/dress";
import { isNum, man } from "@/lib/format";
import { useStore } from "../store";
import { useSort } from "../shared";

export function DressPrices() {
  const { ledger, ui, setUI, setDrawer, create, toast } = useStore();
  const { lists, by } = dressPriceIndex(ledger);
  const mineN = myDressKeys(ledger);
  const mine = (k: string) => mineN.has(normShop(k));
  const f = ui.price;
  let rows = Object.values(by);
  if (f.q) rows = rows.filter((r) => r.name.toLowerCase().includes(f.q.toLowerCase()));
  if (f.only === "multi") rows = rows.filter((r) => Object.keys(r.p).length > 1);
  if (f.only === "mine") rows = rows.filter((r) => mine(r.key));
  if (P.includes(f.only)) rows = rows.filter((r) => r.p[f.only]);
  const nz = (m: number) => (m === Infinity ? null : m);
  const sorted = useSort("dprice", rows, { name: (r) => r.name, main: (r) => nz(minPrice(r, "main")), combo: (r) => nz(minPrice(r, "combo")), n: (r) => Object.keys(r.p).length });
  const { th, sortProps } = sorted;
  if (!lists.length) return null;

  const cell = (r: DressShop, p: string, k: "main" | "combo") => {
    const x = r.p[p];
    if (!x || !isNum(x[k])) return <td key={p + k} className="num muted">—</td>;
    const mx = k === "main" ? x.mainMax : x.comboMax;
    const cheap = Object.keys(r.p).length > 1 && x[k] === minPrice(r, k);
    return <td key={p + k} className={`num ${cheap ? "cheapest" : ""}`}>{man(x[k])}{mx ? "~" + man(mx) : ""}</td>;
  };
  const addCandidate = (r: DressShop) => {
    const x = r.p["제이웨딩"] || r.p["다이렉트"] || r.p["베리굿"];
    const src = Object.keys(r.p).find((k) => r.p[k] === x);
    create("vendors", {
      cat: "dress", name: r.name, planner: Object.keys(r.p).join("·"), location: "", features: "", price: null, listPrice: x.main,
      listNote: `본식 정가 (${src})`, quoteDelta: null, priceNote: "", extraFees: `헬퍼 ${x.helper || ""} / 피팅비 ${x.fitting || ""}`,
      insta: "", blog: "", blogSummary: "", status: "관심", scores: {}, memo: "", photo: "", source: "플래너 가격표",
    });
    toast(`${r.name}을(를) 드레스 후보에 추가했어요`);
  };
  const setF = (k: "q" | "only", v: string) => setUI((u) => ({ ...u, price: { ...u.price, [k]: v } }));
  const cand = Object.values(by).filter((r) => mine(r.key));
  const nameBtn = (r: DressShop) => <button onClick={() => setDrawer({ col: "dprice", key: r.key })}>{r.name}</button>;

  return (
    <section>
      <h2>드레스 견적 비교</h2>
      <div className="cards" style={{ margin: "10px 0 18px" }}>
        {lists.map((l) => (
          <div className="stat" key={l.id}><div className="k">{l.planner} 견적 엑셀</div><div className="v">{(l.rows || []).length}곳</div><div className="s">{l.asOf}</div></div>
        ))}
      </div>
      {cand.length > 0 && (
        <>
          <h3>우리 후보 드레스샵</h3>
          <div className="tablebox" style={{ marginBottom: 18 }}>
            <table className="sheet">
              <thead>
                <tr><th>드레스샵</th>{P.map((p) => <th key={p} colSpan={2} style={{ textAlign: "center" }}>{p}</th>)}</tr>
                <tr><th></th>{P.map((p) => [<th key={p + "m"}>본식</th>, <th key={p + "c"}>촬영+본식</th>])}</tr>
              </thead>
              <tbody>
                {cand.map((r) => <tr key={r.key}><td className="name">{nameBtn(r)}</td>{P.map((p) => [cell(r, p, "main"), cell(r, p, "combo")])}</tr>)}
              </tbody>
            </table>
          </div>
        </>
      )}
      <h3>전체 드레스샵 ({Object.keys(by).length}곳)</h3>
      <p className="lead">받은 세 파일(제이웨딩·다이렉트·베리굿)의 가격표를 샵 기준으로 합쳤어요. 여러 곳에 있는 샵은 가장 싼 값을 초록색으로 표시해요. 표에 적힌 값은 할인 전 정가라 실제 계약가는 더 낮아요.</p>
      <div className="filters">
        <input type="search" placeholder="드레스샵 검색" value={f.q} onChange={(e) => setF("q", e.target.value)} aria-label="드레스샵 검색" />
        <select value={f.only} onChange={(e) => setF("only", e.target.value)} aria-label="보기">
          <option value="">전체 {Object.keys(by).length}곳</option>
          <option value="multi">2곳 이상에 있는 샵</option>
          <option value="mine">내 후보만</option>
          {P.map((p) => <option key={p}>{p}</option>)}
        </select>
        <span className="spacer" />
        <span className="muted small">{rows.length}곳</span>
      </div>
      <div className="tablebox" style={{ maxHeight: "64vh", overflow: "auto" }}>
        <table className="sheet">
          <thead>
            <tr>
              {th("name", "드레스샵")}{th("n", "취급")}
              {P.map((p) => <th key={p} colSpan={2} style={{ textAlign: "center" }}>{p}</th>)}
              <th>헬퍼 (본식 1회)</th><th>피팅비</th><th>디자인 추가금</th><th></th>
            </tr>
            <tr>
              <th></th><th></th>
              {P.map((p) => [<th key={p + "m"} {...sortProps("main")}>본식</th>, <th key={p + "c"} {...sortProps("combo")}>촬영+본식</th>])}
              <th></th><th></th><th></th><th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.rows.map((r) => {
              const any = P.map((p) => r.p[p]).find(Boolean) ?? Object.values(r.p)[0];
              return (
                <tr key={r.key}>
                  <td className="name">{nameBtn(r)}{mine(r.key) && <> <span className="pill src">후보</span></>}</td>
                  <td className="small">{Object.keys(r.p).length}곳</td>
                  {P.map((p) => [cell(r, p, "main"), cell(r, p, "combo")])}
                  <td className="small">{any.helper || ""}</td>
                  <td className="small">{(r.p["제이웨딩"] || r.p["베리굿"] || any).fitting || ""}</td>
                  <td className="wrap small">{((r.p["제이웨딩"] || any).design || "").replace(/\n/g, " / ")}</td>
                  <td>{mine(r.key) ? "" : <button className="btn small" onClick={() => addCandidate(r)}>후보 추가</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="why">
        {lists.map((l) => <div key={l.id}><b>{l.planner}</b> {l.asOf} — {l.unitNote}</div>)}
      </div>
    </section>
  );
}
