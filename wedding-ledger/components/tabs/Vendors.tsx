"use client";
import { CAT_LABEL, SCORE, V_STATUS } from "@/lib/constants";
import { avgScore, listOf } from "@/lib/calc/wedding";
import { isNum, signed, won } from "@/lib/format";
import type { Vendor } from "@/lib/types";
import { useStore } from "../store";
import { AvgCell, blogLink, Photo, ScoreSelect, StatusSelect, statusRank, stripParen, usePickPhoto, useSort } from "../shared";

export function Vendors({ cat, go }: { cat: "studio" | "dress" | "makeup"; go: (tab: string) => void }) {
  const { ledger, ui, setUI, create, setDrawer } = useStore();
  const pick = usePickPhoto();
  const f = ui.vendor;
  const label = CAT_LABEL[cat];
  let rows = listOf<Vendor>(ledger.vendors).filter((v) => v.cat === cat);
  if (f.q) rows = rows.filter((r) => `${r.name} ${r.features || ""} ${r.planner || ""} ${r.location || ""}`.toLowerCase().includes(f.q.toLowerCase()));
  if (f.status) rows = rows.filter((r) => r.status === f.status);
  const sorted = useSort(cat, rows, {
    name: (r) => r.name,
    price: (r) => r.price,
    list: (r) => r.listPrice,
    delta: (r) => r.quoteDelta,
    avg: (r) => avgScore(r.scores, cat),
    status: statusRank,
    planner: (r) => r.planner,
  });
  const th = sorted.th;
  const setF = (k: "q" | "status", v: string) => setUI((u) => ({ ...u, vendor: { ...u.vendor, [k]: v } }));

  return (
    <>
      <h2>{label}</h2>
      <p className="lead">대표 사진은 인스타그램 캡처를 사진 칸에 올려 두면 돼요. 블로그 링크는 네이버 블로그 검색으로 열려요.</p>
      {cat === "dress" && Object.keys(ledger.priceLists).length > 0 && (
        <div className="note small">
          플래너 3곳(제이웨딩·다이렉트·베리굿) 드레스 견적 엑셀은 <button className="linkbtn" onClick={() => go("dprice")}>드레스 견적 비교</button> 탭에 정리돼 있어요.
        </div>
      )}
      <div className="filters">
        <input type="search" placeholder="업체·특징·위치 검색" value={f.q} onChange={(e) => setF("q", e.target.value)} aria-label="검색" />
        <select value={f.status} onChange={(e) => setF("status", e.target.value)} aria-label="상태 필터">
          <option value="">모든 상태</option>
          {V_STATUS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="spacer" />
        <button
          className="btn"
          onClick={() => setDrawer({ col: "vendors", id: create("vendors", { name: "새 업체", cat, planner: "", status: "관심", scores: {}, memo: "", price: null, quoteDelta: null }) })}
        >
          {label} 추가
        </button>
      </div>
      {sorted.rows.length ? (
        <div className="tablebox">
          <table className="sheet">
            <thead>
              <tr>
                <th>사진</th>
                {th("name", "업체")}{th("planner", "제휴 플래너")}<th>특징</th><th>위치</th>{th("price", "견적가")}{th("list", "정가")}{th("delta", "견적 대비")}<th>추가금·조건</th>
                {SCORE[cat].map(([k, l]) => <th key={k} className="sc">{l}</th>)}
                {th("avg", "평균", "sc")}{th("status", "상태")}<th>링크</th><th>메모</th>
              </tr>
            </thead>
            <tbody>
              {sorted.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.photo ? (
                      <Photo className="thumb" path={r.photo} alt={`${r.name} 대표 사진`} />
                    ) : (
                      <button className="thumb empty" onClick={() => pick("vendors", r.id)} aria-label={`${r.name} 사진 올리기`}>사진</button>
                    )}
                  </td>
                  <td className="name"><button onClick={() => setDrawer({ col: "vendors", id: r.id })}>{r.name}</button></td>
                  <td className="small">{r.planner}</td>
                  <td className="wrap small">{r.features}</td>
                  <td className="wrap small" style={{ minWidth: 140 }}>{r.location}</td>
                  <td className="num">{isNum(r.price) ? <b>{won(r.price)}</b> : "—"}</td>
                  <td className="num">{isNum(r.listPrice) ? won(r.listPrice) : "—"}{r.listNote && <><br /><span className="muted small">{r.listNote}</span></>}</td>
                  <td className={`num ${isNum(r.quoteDelta) ? (r.quoteDelta > 0 ? "delta-plus" : "delta-zero") : ""}`}>{isNum(r.quoteDelta) ? signed(r.quoteDelta) : "—"}</td>
                  <td className="wrap small">{r.extraFees}{r.priceNote && <><br /><span className="muted">{r.priceNote}</span></>}</td>
                  {SCORE[cat].map(([k]) => <td key={k}><ScoreSelect col="vendors" id={r.id} kind={cat} k={k} val={r.scores?.[k]} /></td>)}
                  <td><AvgCell a={avgScore(r.scores, cat)} /></td>
                  <td><StatusSelect col="vendors" id={r.id} val={r.status} opts={V_STATUS} /></td>
                  <td className="links">
                    {r.insta ? <a href={r.insta} target="_blank" rel="noopener">인스타</a> : <span className="muted small">인스타 미입력 </span>}
                    {r.blog && <a href={r.blog} target="_blank" rel="noopener">저장한 후기</a>}
                    <a href={blogLink(stripParen(r.name))} target="_blank" rel="noopener">블로그 검색</a>
                  </td>
                  <td className="wrap small">{r.memo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state panel">조건에 맞는 업체가 없어요.</div>
      )}
    </>
  );
}
