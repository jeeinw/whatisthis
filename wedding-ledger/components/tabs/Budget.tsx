"use client";
import { Fragment } from "react";
import { B_STATUS, HOUSE_GROUP, PAYERS, WEDDING_GROUPS } from "@/lib/constants";
import { budgetCalc, type BudgetRow } from "@/lib/calc/wedding";
import { clone } from "@/lib/settings";
import { isNum, man, manWon } from "@/lib/format";
import type { BudgetSub } from "@/lib/types";
import { useStore } from "../store";
import { ManCell, TextCell } from "../shared";

const GROUP_ORDER = [...WEDDING_GROUPS.slice(0, 4), "신혼여행", HOUSE_GROUP, "관리", "기타"];

export function Budget({ go }: { go: (tab: string) => void }) {
  const { ledger, s, write, create, remove, ui, setUI } = useStore();
  const B = budgetCalc(ledger, s);
  const setSubs = (id: string, fn: (subs: BudgetSub[]) => void) => {
    const subs = clone(ledger.budget[id]?.subs || []);
    fn(subs);
    write("budget", id, { subs });
  };
  const toggle = (id: string) => setUI((u) => ({ ...u, open: { ...u.open, [id]: !u.open[id] } }));

  const row = (it: BudgetRow) => {
    const e = it.e;
    const over = isNum(it.cap) && isNum(e.amount) && e.amount > it.cap;
    const open = !!ui.open[it.id];
    return (
      <Fragment key={it.id}>
        <tr>
          <td className="wrap" style={{ minWidth: 200 }}>
            {it.link ? <b>{it.name}</b> : <TextCell className="cell name-edit" value={it.name} label="항목 이름" onChange={(v) => write("budget", it.id, { name: v })} />}
            {it.link && <> <span className="pill">자동</span></>}
            {it.subs && (
              <> <button className="linkbtn" onClick={() => toggle(it.id)}>{open ? "세부 접기" : `세부 ${it.subs.length}개`}</button></>
            )}
            {it.meta && <div className="small muted">{[it.meta.destination, it.meta.nights].filter(Boolean).join(" · ")}</div>}
          </td>
          <td>
            <select aria-label="상태" value={it.status ?? "미정"} onChange={(ev) => write("budget", it.id, { status: ev.target.value })}>
              {B_STATUS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </td>
          <td className="num">
            {e.auto ? (
              <>
                <span className="auto">{isNum(e.amount) ? man(e.amount) : "—"}</span>{" "}
                <button className="linkbtn" onClick={() => go(it.link === "hall" ? "hall" : it.link === "houseCosts" ? "house" : "planner")}>바꾸기</button>
              </>
            ) : it.subs ? (
              <span>{isNum(e.amount) ? man(e.amount) : "—"}</span>
            ) : (
              <ManCell value={it.amount} label={`${it.name} 금액(만원)`} onChange={(v) => write("budget", it.id, { amount: v })} />
            )}
          </td>
          <td className="num">
            <ManCell value={it.cap} label={`${it.name} 상한선(만원)`} placeholder="상한" onChange={(v) => write("budget", it.id, { cap: v })} />
            {over && <span className="overcap">상한 {man((e.amount as number) - (it.cap as number))} 초과</span>}
          </td>
          <td className="num">
            <b>{man(e.eff)}</b>
            {e.fromCap && e.eff ? <><br /><span className="unit">상한 기준</span></> : null}
          </td>
          <td>
            <select aria-label="부담" value={it.payer || "공동"} onChange={(ev) => write("budget", it.id, { payer: ev.target.value })}>
              {PAYERS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </td>
          <td>
            <TextCell value={it.memo} label="메모" placeholder="메모" onChange={(v) => write("budget", it.id, { memo: v })} />
            {/* 자동 항목(웨딩홀·스드메 등)은 다른 탭과 연결돼 있어 지우지 않는다 */}
            {!it.link && (
              <button className="linkbtn" style={{ marginLeft: 6 }} aria-label={`${it.name} 삭제`} onClick={() => confirm(`'${it.name}'을(를) 삭제할까요?`) && remove("budget", it.id)}>
                삭제
              </button>
            )}
          </td>
        </tr>
        {it.subs && open && (
          <>
            {it.subs.map((x, i) => (
              <tr className="sub" key={i}>
                <td><TextCell value={x.name} label="세부 항목명" onChange={(v) => setSubs(it.id, (a) => (a[i].name = v))} /></td>
                <td></td>
                <td className="num"><ManCell value={x.amount} label={`${x.name} 금액`} placeholder="금액" onChange={(v) => setSubs(it.id, (a) => (a[i].amount = v))} /></td>
                <td className="num"><ManCell value={x.cap} label={`${x.name} 상한`} placeholder="상한" onChange={(v) => setSubs(it.id, (a) => (a[i].cap = v))} /></td>
                <td className="num">{man(isNum(x.amount) ? x.amount : isNum(x.cap) ? x.cap : 0)}</td>
                <td colSpan={2}><button className="linkbtn" onClick={() => setSubs(it.id, (a) => a.splice(i, 1))}>삭제</button></td>
              </tr>
            ))}
            <tr className="sub">
              <td colSpan={7}>
                <button className="btn small" onClick={() => setSubs(it.id, (a) => a.push({ name: "새 세부 항목", amount: null, cap: null }))}>세부 항목 추가</button>
                {it.meta && (
                  <>
                    {" "}
                    <label className="small muted" style={{ marginLeft: 10 }}>
                      여행지 <TextCell value={it.meta.destination} label="여행지" onChange={(v) => write("budget", it.id, { meta: { destination: v } })} />
                    </label>{" "}
                    <label className="small muted">
                      일정 <TextCell value={it.meta.nights} label="일정" style={{ width: 110 }} placeholder="예: 6박 8일" onChange={(v) => write("budget", it.id, { meta: { nights: v } })} />
                    </label>
                  </>
                )}
              </td>
            </tr>
          </>
        )}
      </Fragment>
    );
  };

  return (
    <>
      <div className="budget-bar">
        <div><div className="muted small">결혼식 비용 예상</div><span className="big">{manWon(B.wedding)}</span></div>
        <div><div className="muted small">목표</div><b>{manWon(s.target)}</b></div>
        <div>
          <div className="muted small">{B.wedding > s.target ? "초과" : "남은 여유"}</div>
          <b className={B.wedding > s.target ? "no" : "ok"}>{manWon(Math.abs(s.target - B.wedding))}</b>
        </div>
        <div><div className="muted small">신혼집 세팅</div><b>{manWon(B.houseSetup)}</b></div>
      </div>
      <p className="lead">
        금액은 만원 단위로 적어요. 아직 모르는 항목은 <b>상한선</b>만 적어두면 그 금액이 합계에 들어가요. <span className="pill">자동</span> 항목은 웨딩홀·스드메·신혼집 탭에서 고른 대로 바뀌어요. 청모와 신혼여행은 세부 항목을 펼쳐서 적을 수 있어요.
      </p>
      {GROUP_ORDER.map((g) => {
        const G = B.groups[g];
        if (!G) return null;
        return (
          <div className="bgroup" key={g}>
            <div className="bgroup-head"><h3>{g}</h3><span className="gt">{manWon(G.total)}</span></div>
            <div className="tablebox cards">
              <table className="sheet">
                <thead>
                  <tr>
                    <th>항목</th><th>상태</th><th>금액 <span className="unit">만원</span></th><th>상한선 <span className="unit">만원</span></th><th>반영액</th><th>부담</th><th>메모</th>
                  </tr>
                </thead>
                <tbody>{G.items.map(row)}</tbody>
              </table>
            </div>
            <div style={{ marginTop: 6 }}>
              <button
                className="btn small ghost"
                onClick={() => create("budget", { group: g, name: "새 항목", link: "", status: "미정", amount: null, cap: null, payer: "공동", memo: "", order: 900 + Object.keys(ledger.budget).length })}
              >
                {g}에 항목 추가
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
