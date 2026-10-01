"use client";
import { SCORE, V_STATUS } from "@/lib/constants";
import { avgScore, extrasTotal, listOf, mainQuote, quoteTotal } from "@/lib/calc/wedding";
import { isNum, signed, won } from "@/lib/format";
import type { Extra, LineupKey, Planner as PlannerT } from "@/lib/types";
import { useStore } from "../store";
import { AvgCell, blogLink, ScoreSelect, StatusSelect, statusRank, TextCell, useDraft, useSort } from "../shared";

export function Planner() {
  const { ledger, s, create, setDrawer } = useStore();
  const { rows, th } = useSort("planner", listOf<PlannerT>(ledger.planners), {
    name: (r) => r.name,
    kind: (r) => r.kind,
    avg: (r) => avgScore(r.scores, "planner"),
    status: statusRank,
  });
  const q = mainQuote(ledger, s);
  const qid = q ? Object.keys(ledger.quotes).find((k) => ledger.quotes[k] === q) : undefined;

  return (
    <>
      <h2>플래너</h2>
      <p className="lead">업체명을 누르면 연락처, 혜택, 메모를 모두 편집할 수 있어요.</p>
      <div className="filters">
        <span className="spacer" />
        <button className="btn" onClick={() => setDrawer({ col: "planners", id: create("planners", { name: "새 플래너", kind: "동행 플래너", status: "관심", scores: {}, memo: "" }) })}>
          플래너 추가
        </button>
      </div>
      <div className="tablebox cards">
        <table className="sheet">
          <thead>
            <tr>
              {th("name", "플래너")}
              {th("kind", "유형")}
              <th>담당·연락처</th><th>특징</th><th>혜택</th>
              {SCORE.planner.map(([k, l]) => <th key={k} className="sc">{l}</th>)}
              {th("avg", "평균", "sc")}
              {th("status", "상태")}
              <th>링크</th><th>메모</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="name"><button onClick={() => setDrawer({ col: "planners", id: r.id })}>{r.name}</button></td>
                <td>{r.kind}</td>
                <td className="small">{r.manager}{r.phone && <><br /><span className="muted">{r.phone}</span></>}</td>
                <td className="wrap small">{r.features}</td>
                <td className="wrap small">{r.benefits}</td>
                {SCORE.planner.map(([k]) => <td key={k}><ScoreSelect col="planners" id={r.id} kind="planner" k={k} val={r.scores?.[k]} /></td>)}
                <td><AvgCell a={avgScore(r.scores, "planner")} /></td>
                <td><StatusSelect col="planners" id={r.id} val={r.status} opts={V_STATUS} /></td>
                <td className="links">
                  {r.insta && <a href={r.insta} target="_blank" rel="noopener">인스타</a>}
                  {r.blog && <a href={r.blog} target="_blank" rel="noopener">사이트</a>}
                  <a href={blogLink(r.name)} target="_blank" rel="noopener">블로그 후기</a>
                </td>
                <td className="wrap small">{r.memo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {q && qid && <Quote qid={qid} />}
    </>
  );
}

function Quote({ qid }: { qid: string }) {
  const { ledger, write, create, remove } = useStore();
  const q = ledger.quotes[qid];
  const qt = quoteTotal(q);
  const o = q.options || {};
  const sel = q.selected || {};
  const extras = listOf<Extra>(ledger.extras).sort((a, b) => (a.order || 0) - (b.order || 0));
  const ex = extrasTotal(ledger.extras);

  const lineup = (k: LineupKey, label: string) => (
    <label>
      {label}
      <select value={sel[k] || 0} onChange={(e) => write("quotes", qid, { selected: { [k]: Number(e.target.value) } })}>
        {(o[k] || []).map((op, i) => (
          <option key={i} value={i}>{op.name} {op.delta ? `(${signed(op.delta)})` : "(기준)"}</option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="quote-head">
        <div>
          <h2>{q.title || "견적"}</h2>
          <div className="muted small">계약일 {q.contractDate || ""} · {q.manager || ""}</div>
        </div>
        <dl className="kv">
          <dt>계약 총액</dt><dd><b>{won(q.contractTotal)}</b></dd>
          <dt>계약금</dt><dd>{won(q.deposit)}</dd>
          <dt>잔금</dt><dd>{q.balance || ""}</dd>
        </dl>
      </div>
      <div className="tablebox">
        <table className="sheet">
          <thead><tr><th>품목</th><th>업체</th><th>상품</th><th>판매가</th><th>할인가</th><th>합계 반영</th></tr></thead>
          <tbody>
            {(q.items || []).map((it, i) => (
              <tr key={i}>
                <td>{it.cat}</td><td>{it.vendor}</td><td className="wrap">{it.product}</td>
                <td className="num">{won(it.list)}</td><td className="num"><b>{won(it.sale)}</b></td>
                <td>{it.count === false ? <span className="muted small">미반영 (피팅비 대납)</span> : "반영"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 style={{ marginTop: 18 }}>라인업 바꿔보기</h3>
      <p className="muted small" style={{ margin: 0 }}>플래너가 제시한 대안 업체의 추가금을 반영해 총액을 다시 계산해요. 결과는 전체 예산의 스드메 항목에 바로 들어가요.</p>
      <div className="sim">{lineup("studio", "스튜디오")}{lineup("dress", "드레스")}{lineup("makeup", "메이크업")}</div>
      <div className="simtotal">
        <span className="muted">스드메 총액</span>
        <span className="big">{qt ? won(qt.total) : "—"}</span>
        <span className="small muted">계약 기준 {won(qt?.base)} {qt?.delta ? signed(qt.delta) : ""}</span>
      </div>
      <div className="note small">{q.notes || ""}</div>
      <h3 style={{ marginTop: 18 }}>계약서 밖에서 추가될 수 있는 비용</h3>
      <p className="muted small" style={{ margin: "0 0 8px" }}>체크하고 예상 금액을 넣으면 전체 예산의 ‘스드메 추가비용’에 더해져요.</p>
      <div className="tablebox extras cards">
        <table className="sheet">
          <thead><tr><th>반영</th><th>구분</th><th>항목</th><th>범위</th><th>예상 금액 (원)</th><th></th></tr></thead>
          <tbody>
            {extras.map((x) => (
              <tr key={x.id}>
                <td><input type="checkbox" aria-label={`${x.name} 반영`} checked={!!x.include} onChange={(e) => write("extras", x.id, { include: e.target.checked })} /></td>
                <td>{x.cat}</td>
                <td><TextCell className="cell memo" value={x.name} label="항목" onChange={(v) => write("extras", x.id, { name: v })} /></td>
                <td className="muted">{x.range}</td>
                <td>
                  <WonInput value={x.amount} label={`${x.name} 예상 금액`} onChange={(v) => write("extras", x.id, { amount: v })} />
                </td>
                <td><button className="linkbtn" aria-label={`${x.name} 삭제`} onClick={() => confirm(`'${x.name}'을(를) 삭제할까요?`) && remove("extras", x.id)}>삭제</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={4} style={{ textAlign: "right" }} className="muted">체크한 합계</td><td className="num"><b>{won(ex)}</b></td><td></td></tr></tfoot>
        </table>
      </div>
      <div style={{ marginTop: 10 }}>
        <button className="btn small" onClick={() => create("extras", { name: "새 항목", range: "", cat: "기타", amount: null, include: true, order: 999 })}>항목 추가</button>
      </div>
    </section>
  );
}

/** 원 단위 숫자 입력 (추가비용 표 — legacy와 같이 원으로 입력). */
function WonInput({ value, label, onChange }: { value: unknown; label: string; onChange: (v: number | null) => void }) {
  const { draft, setDraft, bind } = useDraft(isNum(value) ? String(value) : "");
  return (
    <input
      type="number"
      step={10000}
      min={0}
      aria-label={label}
      value={draft}
      {...bind}
      onChange={(e) => (setDraft(e.target.value), onChange(e.target.value === "" ? null : Number(e.target.value)))}
    />
  );
}
