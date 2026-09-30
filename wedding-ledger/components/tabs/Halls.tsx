"use client";
import { useRef, useState } from "react";
import { H_STATUS, HALL_TYPES, SCORE, ZONES } from "@/lib/constants";
import { avgScore, hallEstimate, listOf } from "@/lib/calc/wedding";
import { isNum, man } from "@/lib/format";
import type { Hall } from "@/lib/types";
import { useStore, type UIState } from "../store";
import { AvgCell, blogLink, ScoreSelect, StatusSelect, statusRank, stripParen, useSort } from "../shared";

const yn = (v: unknown) => (v === true ? "O" : v === false ? "X" : "—");

export function Halls() {
  const { ledger, s, ui, setUI, setSettings, create, setDrawer } = useStore();
  const f = ui.hall;
  const g = s.guests || 0;
  const all = listOf<Hall>(ledger.halls);
  const gus = [...new Set(all.filter((h) => !f.zone || h.zone === f.zone).map((h) => h.gu).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "ko"));
  let rows = all;
  if (f.hideExcluded) rows = rows.filter((r) => r.status !== "제외");
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter((r) => [r.name, r.dong, r.station, (r.tags || []).join(" "), (r.mood || []).join(" ")].join(" ").toLowerCase().includes(q));
  }
  if (f.zone) rows = rows.filter((r) => r.zone === f.zone);
  if (f.gu) rows = rows.filter((r) => r.gu === f.gu);
  if (f.type) rows = rows.filter((r) => r.type === f.type);
  if (f.status) rows = rows.filter((r) => r.status === f.status);
  if (f.src === "planner") rows = rows.filter((r) => r.plannerQuote);
  if (f.maxMeal) rows = rows.filter((r) => isNum(r.mealMin) && r.mealMin <= Number(f.maxMeal));
  const { rows: sorted, th } = useSort(
    "hall",
    rows,
    {
      name: (r) => r.name, gu: (r) => r.gu, type: (r) => r.type, meal: (r) => r.mealMin, rental: (r) => r.rental, min: (r) => r.minGuests,
      est: (r) => hallEstimate(r, g), walk: (r) => r.walk, park: (r) => r.parking, avg: (r) => avgScore(r.scores, "hall"), status: statusRank,
    },
    { key: "status", dir: "desc" },
  );
  const pq = all.filter((h) => h.plannerQuote).length;
  const setF = (patch: Partial<UIState["hall"]>) => setUI((u) => ({ ...u, hall: { ...u.hall, ...patch } }));

  // 하객 수는 입력이 멈춘 뒤 500ms에 반영 (legacy와 같음)
  const [guestDraft, setGuestDraft] = useState<string | null>(null);
  const guestTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onGuests = (v: string) => {
    setGuestDraft(v);
    clearTimeout(guestTimer.current);
    guestTimer.current = setTimeout(() => {
      setSettings({ guests: v === "" ? 0 : Number(v) });
      setGuestDraft(null);
    }, 500);
  };

  return (
    <>
      <h2>웨딩홀</h2>
      <p className="lead">
        서울 {all.length}곳. 기본값은 이너웨딩 공개 데이터(2026년 7월)이고, 플래너 자료(2026년 9월 정상가)가 있는 {pq}곳은 그 금액으로 바꿔 두었어요. 예상 총액은 하객 {g}명 기준이에요. 이름을 눌러 기준 홀로 지정하면 전체 예산에 반영돼요.
      </p>
      <div className="filters">
        <input type="search" placeholder="홀 이름·동·역·태그" value={f.q} onChange={(e) => setF({ q: e.target.value })} aria-label="검색" />
        <select value={f.zone} onChange={(e) => setF({ zone: e.target.value, gu: "" })} aria-label="권역">
          <option value="">전체 권역</option>
          {ZONES.map((z) => <option key={z}>{z}</option>)}
        </select>
        <select value={f.gu} onChange={(e) => setF({ gu: e.target.value })} aria-label="구">
          <option value="">전체 구</option>
          {gus.map((z) => <option key={z}>{z}</option>)}
        </select>
        <select value={f.type} onChange={(e) => setF({ type: e.target.value })} aria-label="홀 유형">
          <option value="">전체 유형</option>
          {HALL_TYPES.map((z) => <option key={z}>{z}</option>)}
        </select>
        <select value={f.status} onChange={(e) => setF({ status: e.target.value })} aria-label="상태">
          <option value="">모든 상태</option>
          {H_STATUS.map((z) => <option key={z}>{z}</option>)}
        </select>
        <select value={f.src} onChange={(e) => setF({ src: e.target.value })} aria-label="자료">
          <option value="">모든 홀</option>
          <option value="planner">플래너 추천 {pq}곳</option>
        </select>
        <label>식대 상한 <input type="number" step={5000} min={0} style={{ width: 96 }} value={f.maxMeal} onChange={(e) => setF({ maxMeal: e.target.value })} placeholder="예: 90000" /></label>
        <label><input type="checkbox" checked={f.hideExcluded} onChange={(e) => setF({ hideExcluded: e.target.checked })} /> 제외 숨기기</label>
        <label>하객 <input type="number" min={0} step={10} style={{ width: 72 }} value={guestDraft ?? String(g)} onChange={(e) => onGuests(e.target.value)} /> 명</label>
        <span className="spacer" />
        <span className="muted small">{rows.length}곳</span>
        <button
          className="btn"
          onClick={() => setDrawer({ col: "halls", id: create("halls", { name: "새 웨딩홀", zone: "강남권", gu: "", dong: "", type: "", status: "관심", scores: {}, memo: "", tags: [], mood: [], source: "직접 입력" }) })}
        >
          웨딩홀 추가
        </button>
      </div>
      <div className="tablebox" style={{ maxHeight: "72vh", overflow: "auto" }}>
        <table className="sheet">
          <thead>
            <tr>
              {th("name", "웨딩홀")}<th>기준</th>{th("gu", "지역")}{th("type", "유형")}{th("meal", "식대(1인)")}{th("rental", "대관료")}{th("min", "최소보증")}{th("est", "예상 총액")}
              <th>가능 시간대</th><th>옵션비용</th>{th("walk", "교통")}{th("park", "주차")}<th>분리/단독</th><th>특징</th>
              {SCORE.hall.map(([k, l]) => <th key={k} className="sc">{l}</th>)}
              {th("avg", "평균", "sc")}{th("status", "상태")}<th>링크</th><th>메모</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const est = hallEstimate(r, g);
              const opt = [isNum(r.flowerFee) ? "꽃 " + man(r.flowerFee) : "", isNum(r.productionFee) ? "연출 " + man(r.productionFee) : "", isNum(r.snapFee) ? "스냅 " + man(r.snapFee) : "", r.otherOptions || ""].filter(Boolean).join(" · ");
              return (
                <tr key={r.id}>
                  <td className="name">
                    <button onClick={() => setDrawer({ col: "halls", id: r.id })}>{r.name}</button>
                    {r.plannerQuote && <><br /><span className="pill src">{r.plannerQuote.cat}</span></>}
                  </td>
                  <td><input type="radio" name="mainHall" checked={s.mainHall === r.id} onChange={() => setSettings({ mainHall: r.id })} aria-label={`${r.name} 기준 홀로 지정`} /></td>
                  <td className="small">{r.gu} {r.dong}<br /><span className="muted">{r.zone}</span></td>
                  <td>{r.type}</td>
                  <td className="num">{isNum(r.mealMin) ? (r.mealMax && r.mealMax !== r.mealMin ? `${man(r.mealMin)}~${man(r.mealMax)}` : man(r.mealMin)) : <span className="muted">상담</span>}</td>
                  <td className="num" title={r.rentalNote}>{isNum(r.rental) ? man(r.rental) : <span className="muted">상담</span>}{r.plannerQuote && <><br /><span className="unit">꽃장식 포함</span></>}</td>
                  <td className="num">{isNum(r.minGuests) ? r.minGuests + "명" : "—"}{isNum(r.maxGuests) && <><br /><span className="muted small">~{r.maxGuests}</span></>}</td>
                  <td className="num"><b>{est != null ? man(Math.round(est)) : "—"}</b>{est != null && !isNum(r.rental) && <><br /><span className="muted small">대관료 제외</span></>}</td>
                  <td className="wrap small" style={{ minWidth: 120 }}>{r.times || <span className="muted">{isNum(r.interval) ? r.interval + "분 간격" : "입력"}</span>}</td>
                  <td className="wrap small" style={{ minWidth: 120 }}>{opt || <span className="muted">{r.includes || "입력"}</span>}</td>
                  <td className="small">{r.station}{isNum(r.walk) ? ` ${r.walk}분` : ""}</td>
                  <td className="num">{isNum(r.parking) ? r.parking + "대" : "—"}</td>
                  <td className="small">분리 {yn(r.split)} / 단독 {yn(r.exclusive)}</td>
                  <td className="wrap small">{(r.mood || []).concat((r.tags || []).slice(0, 4)).slice(0, 6).map((t, i) => <span className="tag" key={i}>{t}</span>)}</td>
                  {SCORE.hall.map(([k]) => <td key={k}><ScoreSelect col="halls" id={r.id} kind="hall" k={k} val={r.scores?.[k]} /></td>)}
                  <td><AvgCell a={avgScore(r.scores, "hall")} /></td>
                  <td><StatusSelect col="halls" id={r.id} val={r.status} opts={H_STATUS} /></td>
                  <td className="links">
                    {r.homepage && <a href={r.homepage} target="_blank" rel="noopener">홈페이지</a>}
                    {r.insta && <a href={r.insta} target="_blank" rel="noopener">인스타</a>}
                    {r.naverPlace && <a href={r.naverPlace} target="_blank" rel="noopener">플레이스</a>}
                    <a href={blogLink(stripParen(r.name))} target="_blank" rel="noopener">블로그</a>
                  </td>
                  <td className="wrap small">{r.memo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
