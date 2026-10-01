"use client";
import { PAYERS, WEDDING_GROUPS } from "@/lib/constants";
import { houseSummary } from "@/lib/calc/housing";
import { avgScore, budgetCalc, extrasTotal, hallEstimate, listOf, mainQuote, quoteTotal } from "@/lib/calc/wedding";
import { eok, isNum, manWon } from "@/lib/format";
import type { Hall, Home, Planner, ScoreKind, Vendor } from "@/lib/types";
import { useStore } from "../store";
import { Recent } from "../Recent";
import { ManInput } from "../shared";

type Scored = { id: string; name: string; status?: string; scores?: Record<string, number | null | undefined> };

export function Summary({ go }: { go: (tab: string) => void }) {
  const { ledger, s, setSettings, setDrawer } = useStore();
  const B = budgetCalc(ledger, s);
  const target = s.target || 0;
  const gift = isNum(s.giftIncome) ? s.giftIncome : 0;
  const pct = target ? Math.min(100, (B.wedding / target) * 100) : 0;
  const over = !!target && B.wedding > target;
  const maxG = Math.max(1, ...WEDDING_GROUPS.map((g) => (B.groups[g] || { total: 0 }).total));
  const qt = quoteTotal(mainQuote(ledger, s));
  const mh = ledger.halls[s.mainHall];
  const mhEst = mh ? hallEstimate(mh, s.guests) : null;
  const hc = houseSummary(ledger, s);
  const hcLine = hc.mode === "buy" ? `${eok(s.house.price)} 기준, 대출 ${eok(hc.loan)}` : `보증금 ${eok(s.house.deposit)}, ${(hc.productLabel || "").replace(/\s*\(.*\)/, "")}`;
  const vendors = listOf<Vendor>(ledger.vendors);

  const top = (rows: Scored[], kind: ScoreKind, n = 3) =>
    rows
      .filter((r) => r.status !== "제외")
      .map((r) => ({ r, a: avgScore(r.scores, kind) }))
      .filter((x): x is { r: Scored; a: number } => x.a != null)
      .sort((a, b) => b.a - a.a)
      .slice(0, n);

  const pickBox = (title: string, rows: Scored[], kind: ScoreKind, col: "planners" | "vendors" | "halls" | "homes", tab: string) => {
    const t = top(rows, kind);
    return (
      <div className="pick" key={title}>
        <h3>{title}</h3>
        {t.length ? (
          <ol>
            {t.map(({ r, a }) => (
              <li key={r.id}>
                <button onClick={() => setDrawer({ col, id: r.id })}>{r.name}</button> <span className="muted small">{a.toFixed(1)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="muted small">
            아직 점수가 없어요. <button className="btn small" onClick={() => go(tab)}>점수 매기기</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <section className="ledger">
        <div className="panel">
          <div className="muted small">결혼식 비용 예상 (신혼집 제외)</div>
          <div className="total">
            {Math.round(B.wedding / 10000).toLocaleString("ko-KR")}
            <small>만 원</small>
          </div>
          <div className={`progress ${over ? "over" : ""}`}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className={`small ${over ? "no" : "muted"}`}>
            목표 {manWon(target)} {target ? (over ? `· ${manWon(B.wedding - target)} 초과` : `· ${manWon(target - B.wedding)} 남음`) : ""}
          </div>
          <div className="lines" style={{ marginTop: 12 }}>
            <div className="row"><span className="k">확정·지불 완료</span><b>{manWon(B.confirmed)}</b></div>
            <div className="row"><span className="k">지불 완료</span><b>{manWon(B.paid)}</b></div>
            <div className="row"><span className="k">예상 축의금</span><b>{gift ? "− " + manWon(gift) : "—"}</b></div>
            <div className="row"><span className="k">축의금 뺀 실부담</span><b>{manWon(B.wedding - gift)}</b></div>
            <div className="row"><span className="k">신혼집 세팅 (가전·가구·이사 등)</span><b>{manWon(B.houseSetup)}</b></div>
          </div>
          <div className="formgrid" style={{ marginTop: 14 }}>
            <ManInput path="target" value={s.target} label="결혼식 예산 목표" />
            <ManInput path="giftIncome" value={s.giftIncome} label="예상 축의금" hint="모르면 비워두기" />
            <label>
              예식일
              <input type="date" value={s.weddingDate} onChange={(e) => setSettings({ weddingDate: e.target.value })} />
              <span className="hint">입력하면 D-day가 떠요</span>
            </label>
          </div>
        </div>
        <div>
          <h2>어디에 쓰이나</h2>
          <p className="lead">금액을 모르는 항목은 상한선이 대신 들어가요. 웨딩홀·스드메는 선택한 홀과 견적 라인업에 따라 자동으로 바뀌어요.</p>
          <div className="gbars">
            {WEDDING_GROUPS.map((g) => {
              const t = (B.groups[g] || { total: 0 }).total;
              return (
                <div className="gbar" key={g}>
                  <span>{g}</span>
                  <span className="track"><i style={{ width: `${(t / maxG) * 100}%` }} /></span>
                  <b>{manWon(t)}</b>
                </div>
              );
            })}
          </div>
          <div className="cards" style={{ marginTop: 16 }}>
            <div className="stat">
              <div className="k">웨딩홀{mh ? ` · ${mh.name}` : ""}</div>
              <div className="v">{mhEst != null ? manWon(mhEst) : "—"}</div>
              <div className="s">{mh ? `하객 ${s.guests}명 기준` : <button className="linkbtn" onClick={() => go("hall")}>기준 홀 고르기</button>}</div>
            </div>
            <div className="stat">
              <div className="k">스드메 (라인업 반영)</div>
              <div className="v">{qt ? manWon(qt.total) : "—"}</div>
              <div className="s">추가비용 체크분 {manWon(extrasTotal(ledger.extras))}</div>
            </div>
            <div className="stat">
              <div className="k">신혼집 · {s.house.mode === "buy" ? "매매" : "전세"}</div>
              <div className={`v ${hc.gap < 0 ? "bad" : "good"}`}>{hc.gap < 0 ? "부족 " + eok(-hc.gap) : "여유 " + eok(hc.gap)}</div>
              <div className="s">{hcLine} <button className="linkbtn" onClick={() => go("house")}>자세히</button></div>
            </div>
          </div>
          {B.capless.length > 0 && (
            <div className="note small">
              <b>상한선이 비어 있는 항목 {B.capless.length}개</b> — 합계에 0원으로 들어가 있어요:{" "}
              {B.capless.slice(0, 8).map((i) => i.name.replace(/\s*\(.*\)/, "")).join(", ")}
              {B.capless.length > 8 ? " 외" : ""} <button className="linkbtn" onClick={() => go("budget")}>상한선 정하기</button>
            </div>
          )}
          {PAYERS.some((p) => B.payer[p]) && (
            <>
              <h3 style={{ marginTop: 16 }}>누가 내나</h3>
              <div className="lines">
                {PAYERS.filter((p) => B.payer[p]).map((p) => (
                  <div className="row" key={p}><span className="k">{p}</span><b>{manWon(B.payer[p])}</b></div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
      <section className="section">
        <h2>점수 상위</h2>
        <div className="picks" style={{ marginTop: 8 }}>
          {pickBox("플래너", listOf<Planner>(ledger.planners), "planner", "planners", "planner")}
          {pickBox("스튜디오", vendors.filter((v) => v.cat === "studio"), "studio", "vendors", "studio")}
          {pickBox("드레스", vendors.filter((v) => v.cat === "dress"), "dress", "vendors", "dress")}
          {pickBox("메이크업", vendors.filter((v) => v.cat === "makeup"), "makeup", "vendors", "makeup")}
          {pickBox("웨딩홀", listOf<Hall>(ledger.halls), "hall", "halls", "hall")}
          {pickBox("신혼집 후보", listOf<Home>(ledger.homes), "home", "homes", "house")}
        </div>
      </section>
      <Recent go={go} />
    </>
  );
}

