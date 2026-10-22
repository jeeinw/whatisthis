"use client";
// 일정: 지불 일정 + D-day 준비 체크리스트 + 캘린더 내보내기
import { Fragment, useState } from "react";
import { PAYERS } from "@/lib/constants";
import { DEFAULT_TASKS, PAY_STAGES, byDue, daysBetween, ddayLabel, payStats, taskBucket, taskDue, todayYmd, type TaskBucket } from "@/lib/calc/schedule";
import { budgetCalc, listOf } from "@/lib/calc/wedding";
import { buildIcs, gcalUrl, type CalEvent } from "@/lib/calendar";
import { isNum, man, manWon } from "@/lib/format";
import type { BudgetItem, Ledger, Payment, Settings, Task } from "@/lib/types";
import { useStore } from "../store";
import { ManCell, TextCell } from "../shared";

export function Schedule({ go }: { go: (tab: string) => void }) {
  const { s, setSettings } = useStore();
  return (
    <>
      {!s.weddingDate && (
        <div className="note">
          결혼식 날짜를 넣으면 체크리스트 마감일과 D-day가 계산돼요.{" "}
          <input type="date" aria-label="결혼식 날짜" onChange={(e) => e.target.value && setSettings({ weddingDate: e.target.value })} />
        </div>
      )}
      <Payments go={go} />
      <Tasks />
      <CalendarExport />
    </>
  );
}

/** 구글 캘린더 '일정 추가' 링크 */
function GcalLink({ title, date, details }: { title: string; date?: string | null; details?: string }) {
  if (!date) return null;
  return (
    <a href={gcalUrl({ title, date, details })} target="_blank" rel="noopener" title="구글 캘린더에 추가">
      캘린더
    </a>
  );
}

/* ---------------- 지불 일정 ---------------- */

function Payments({ go }: { go: (tab: string) => void }) {
  const { ledger, s, write, create, remove, toast } = useStore();
  const today = todayYmd();
  const rows = listOf<Payment>(ledger.payments).sort(byDue);
  const st = payStats(rows, today);
  const budget = listOf<BudgetItem>(ledger.budget).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const B = budgetCalc(ledger, s);
  const eff = Object.fromEntries(B.items.map((it) => [it.id, it.e.eff]));
  const [from, setFrom] = useState("");

  function addFromBudget(id: string) {
    const b = ledger.budget[id];
    if (!b) return;
    create("payments", { title: b.name, budgetId: id, stage: "계약금", amount: null, due: "", paid: false, payer: b.payer || "공동", memo: "" });
    setFrom("");
  }

  function setPaid(p: Payment, paid: boolean) {
    write("payments", p.id, { paid, paidDate: paid ? today : "" });
    if (!p.budgetId || !paid) return;
    // 이 예산 항목의 지불이 모두 끝났으면 예산 상태도 '지불 완료'로
    const others = rows.filter((x) => x.budgetId === p.budgetId && x.id !== p.id);
    const b = ledger.budget[p.budgetId];
    if (b && others.every((x) => x.paid) && b.status !== "지불 완료") {
      write("budget", p.budgetId, { status: "지불 완료" });
      toast(`‘${b.name}’ 지불이 모두 끝나 예산 상태를 ‘지불 완료’로 바꿨어요`);
    }
  }

  return (
    <section>
      <h2>지불 일정</h2>
      <p className="lead">업체별 계약금·중도금·잔금 날짜와 금액을 적어 두면, 다가오는 지불과 밀린 지불을 한눈에 봐요. 예산 항목과 연결하면 마지막 지불을 체크할 때 예산 상태가 ‘지불 완료’로 바뀌어요.</p>
      <div className="cards">
        <div className="stat"><div className="k">남은 지불</div><div className="v">{manWon(st.left)}</div><div className="s">전체 {manWon(st.total)} 중 {manWon(st.paid)} 지불</div></div>
        <div className="stat"><div className="k">30일 안에 낼 돈</div><div className="v">{manWon(st.next30)}</div><div className="s">{st.nextDue ? `다음: ${st.nextDue.title} ${ddayLabel(st.nextDue.due as string, today)}` : "예정 없음"}</div></div>
        <div className="stat"><div className="k">날짜 지난 미지불</div><div className={`v ${st.overdue ? "bad" : ""}`}>{manWon(st.overdue)}</div><div className="s">{st.overdue ? "지불했으면 체크해 주세요" : "밀린 지불 없음"}</div></div>
      </div>
      <div className="filters" style={{ marginTop: 14 }}>
        <select value={from} onChange={(e) => (setFrom(e.target.value), e.target.value && addFromBudget(e.target.value))} aria-label="예산 항목에서 추가">
          <option value="">예산 항목에서 추가…</option>
          {budget.map((b) => <option key={b.id} value={b.id}>{b.group} · {b.name}</option>)}
        </select>
        <span className="spacer" />
        <button className="btn" onClick={() => create("payments", { title: "", stage: "계약금", amount: null, due: "", paid: false, payer: "공동", memo: "" })}>직접 추가</button>
      </div>
      {!rows.length ? (
        <div className="empty-state panel">아직 지불 일정이 없어요. 계약한 업체부터 ‘예산 항목에서 추가’로 넣어 보세요.</div>
      ) : (
        <div className="tablebox cards">
          <table className="sheet">
            <thead>
              <tr><th>항목</th><th>단계</th><th>날짜</th><th>금액 <span className="unit">만원</span></th><th>지불</th><th>부담</th><th>예산 연결</th><th>메모</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const late = !p.paid && p.due && daysBetween(today, p.due) < 0;
                const linked = p.budgetId ? ledger.budget[p.budgetId] : null;
                return (
                  <tr key={p.id} className={p.paid ? "muted" : undefined}>
                    <td><TextCell className="cell memo" style={{ width: 150 }} value={p.title} label="지불 항목" placeholder="예: 웨딩홀" onChange={(v) => write("payments", p.id, { title: v })} /></td>
                    <td><select aria-label="단계" value={p.stage || "기타"} onChange={(e) => write("payments", p.id, { stage: e.target.value })}>{PAY_STAGES.map((x) => <option key={x}>{x}</option>)}</select></td>
                    <td>
                      <input type="date" aria-label="지불 날짜" value={p.due || ""} onChange={(e) => write("payments", p.id, { due: e.target.value })} />
                      {p.due && !p.paid && <div className={`small ${late ? "no" : "muted"}`}>{ddayLabel(p.due, today)}</div>}
                    </td>
                    <td className="num"><ManCell value={p.amount} label={`${p.title} 금액(만원)`} placeholder="만원" onChange={(v) => write("payments", p.id, { amount: v })} /></td>
                    <td>
                      <label className="chk"><input type="checkbox" checked={!!p.paid} onChange={(e) => setPaid(p, e.target.checked)} aria-label={`${p.title} 지불함`} /> {p.paid ? (p.paidDate || "완료").slice(5).replace("-", "/") : ""}</label>
                    </td>
                    <td><select aria-label="부담" value={p.payer || "공동"} onChange={(e) => write("payments", p.id, { payer: e.target.value })}>{PAYERS.map((x) => <option key={x}>{x}</option>)}</select></td>
                    <td className="small">
                      <select aria-label="예산 항목" value={p.budgetId || ""} onChange={(e) => write("payments", p.id, { budgetId: e.target.value })} style={{ maxWidth: 150 }}>
                        <option value="">연결 안 함</option>
                        {budget.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      {linked && isNum(eff[p.budgetId as string]) && <div className="muted">예산 {man(eff[p.budgetId as string])} <button className="linkbtn" onClick={() => go("budget")}>보기</button></div>}
                    </td>
                    <td><TextCell value={p.memo} label="메모" placeholder="계좌·메모" onChange={(v) => write("payments", p.id, { memo: v })} /></td>
                    <td className="links">
                      {!p.paid && <GcalLink title={`[지불] ${p.title} ${p.stage ?? ""}${isNum(p.amount) ? ` ${man(p.amount)}` : ""}`} date={p.due} details={p.memo} />}
                      <button className="linkbtn" aria-label={`${p.title || "지불"} 삭제`} onClick={() => confirm(`'${p.title || "이 지불"}'을(를) 삭제할까요?`) && remove("payments", p.id)}>삭제</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------------- D-day 체크리스트 ---------------- */

const BUCKETS: [TaskBucket, string][] = [
  ["overdue", "마감 지남"],
  ["soon", "30일 안"],
  ["later", "그 뒤"],
  ["nodate", "날짜 없음"],
  ["done", "완료"],
];

function Tasks() {
  const { ledger, s, write, create, remove, toast } = useStore();
  const today = todayYmd();
  const all = listOf<Task>(ledger.tasks);
  const [showDone, setShowDone] = useState(false);
  const done = all.filter((t) => t.done).length;
  const withDue = all.map((t) => ({ ...t, _due: taskDue(t, s.weddingDate) }));
  const missingDefaults = DEFAULT_TASKS.filter((d) => !all.some((t) => t.title === d.title));

  function loadDefaults() {
    missingDefaults.forEach((d) => create("tasks", { title: d.title, cat: d.cat, dday: d.dday, due: "", done: false, memo: "" }));
    toast(`기본 항목 ${missingDefaults.length}개를 넣었어요`);
  }

  return (
    <section className="section">
      <h2>D-day 준비 체크리스트</h2>
      <p className="lead">
        ‘D-n’으로 적은 항목은 결혼식 날짜에서 거꾸로 마감일을 계산해요{s.weddingDate ? ` (결혼식 ${s.weddingDate}, ${ddayLabel(s.weddingDate, today)})` : ""}. 날짜를 직접 고르면 그 날짜가 우선이에요.
      </p>
      <div className="filters">
        <span className="muted small">{all.length ? `${done} / ${all.length} 완료` : ""}</span>
        {all.length > 0 && (
          <div className="progress" style={{ flex: "0 1 200px" }} aria-label="진행률">
            <i style={{ width: `${(done / all.length) * 100}%` }} />
          </div>
        )}
        <span className="spacer" />
        {missingDefaults.length > 0 && <button className="btn ghost" onClick={loadDefaults}>{all.length ? `기본 항목 ${missingDefaults.length}개 더 넣기` : "기본 체크리스트 불러오기"}</button>}
        <button className="btn" onClick={() => create("tasks", { title: "", cat: "", dday: null, due: "", done: false, memo: "" })}>항목 추가</button>
      </div>
      {!all.length ? (
        <div className="empty-state panel">‘기본 체크리스트 불러오기’를 누르면 상견례부터 감사 인사까지 {DEFAULT_TASKS.length}개 항목이 들어와요. 필요 없는 건 지우고, 날짜는 우리 일정에 맞게 고치면 돼요.</div>
      ) : (
        <div className="tablebox cards">
          <table className="sheet">
            <thead>
              <tr><th>할 일</th><th>완료</th><th>분류</th><th>D-n</th><th>마감일</th><th>메모</th><th></th></tr>
            </thead>
            <tbody>
              {BUCKETS.map(([b, label]) => {
                const list = withDue.filter((t) => taskBucket(t, s.weddingDate, today) === b).sort((x, y) => (x._due || "9999").localeCompare(y._due || "9999"));
                if (!list.length) return null;
                if (b === "done" && !showDone)
                  return (
                    <tr key={b} className="sub">
                      <td colSpan={7}><button className="linkbtn" onClick={() => setShowDone(true)}>완료한 {list.length}개 보기</button></td>
                    </tr>
                  );
                return (
                  <Fragment key={b}>
                    <tr className="sub">
                      <td colSpan={7}><b className={b === "overdue" ? "no" : undefined}>{label}</b> <span className="muted">{list.length}</span>{b === "done" && <> <button className="linkbtn" onClick={() => setShowDone(false)}>접기</button></>}</td>
                    </tr>
                    {list.map((t) => (
                      <tr key={t.id} className={t.done ? "muted" : undefined}>
                        <td><TextCell className="cell memo" style={{ width: 220 }} value={t.title} label="할 일" placeholder="할 일" onChange={(v) => write("tasks", t.id, { title: v })} /></td>
                        <td><input type="checkbox" aria-label={`${t.title} 완료`} checked={!!t.done} onChange={(e) => write("tasks", t.id, { done: e.target.checked, doneAt: e.target.checked ? today : "" })} /></td>
                        <td><TextCell className="cell memo" style={{ width: 80 }} value={t.cat} label="분류" placeholder="분류" onChange={(v) => write("tasks", t.id, { cat: v })} /></td>
                        <td>
                          <input
                            className="cell"
                            style={{ width: 64 }}
                            type="number"
                            aria-label="결혼식 며칠 전"
                            placeholder="D-n"
                            value={isNum(t.dday) ? t.dday : ""}
                            onChange={(e) => write("tasks", t.id, { dday: e.target.value === "" ? null : Number(e.target.value), due: "" })}
                          />
                        </td>
                        <td>
                          <input type="date" aria-label="마감일" value={t._due || ""} onChange={(e) => write("tasks", t.id, { due: e.target.value })} />
                          {t._due && !t.done && <div className={`small ${b === "overdue" ? "no" : "muted"}`}>{ddayLabel(t._due, today)}</div>}
                        </td>
                        <td><TextCell value={t.memo} label="메모" placeholder="메모" onChange={(v) => write("tasks", t.id, { memo: v })} /></td>
                        <td className="links">
                          {!t.done && <GcalLink title={`[준비] ${t.title}`} date={t._due} details={t.memo} />}
                          <button className="linkbtn" aria-label={`${t.title || "항목"} 삭제`} onClick={() => confirm(`'${t.title || "이 항목"}'을(를) 삭제할까요?`) && remove("tasks", t.id)}>삭제</button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------------- 캘린더 ---------------- */

/** 캘린더로 보낼 일정: 결혼식 + 안 낸 지불 + 안 끝난 체크리스트 */
export function calendarEvents(ledger: Ledger, s: Settings): CalEvent[] {
  const ev: CalEvent[] = [];
  if (s.weddingDate) ev.push({ uid: "wedding", title: "[결혼식] J & D", date: s.weddingDate });
  for (const p of listOf<Payment>(ledger.payments)) {
    if (p.paid || !p.due) continue;
    ev.push({ uid: `pay-${p.id}`, title: `[지불] ${p.title || "지불"} ${p.stage ?? ""}${isNum(p.amount) ? ` ${man(p.amount)}` : ""}`.trim(), date: p.due, details: p.memo || undefined });
  }
  for (const t of listOf<Task>(ledger.tasks)) {
    const due = taskDue(t, s.weddingDate);
    if (t.done || !due) continue;
    ev.push({ uid: `task-${t.id}`, title: `[준비] ${t.title || "할 일"}`, date: due, details: t.memo || undefined });
  }
  return ev.sort((a, b) => a.date.localeCompare(b.date));
}

function CalendarExport() {
  const { ledger, s, toast } = useStore();
  const ev = calendarEvents(ledger, s);

  function download() {
    const blob = new Blob([buildIcs(ev)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `결혼준비_일정_${todayYmd()}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`일정 ${ev.length}개를 캘린더 파일로 만들었어요`);
  }

  return (
    <section className="section">
      <h2>구글 캘린더로 보내기</h2>
      <div className="panel">
        <p style={{ marginTop: 0 }}>
          결혼식 날짜, 아직 안 낸 지불, 남은 체크리스트 <b>{ev.length}개</b>를 한 파일로 내려받아 구글 캘린더에 한 번에 넣을 수 있어요. 항목 하나만 넣을 땐 표의 <b>캘린더</b> 링크를 누르면 돼요.
        </p>
        <button className="btn primary" onClick={download} disabled={!ev.length}>캘린더 파일(.ics) 내려받기</button>
        <ol className="small muted" style={{ marginBottom: 0 }}>
          <li>PC에서 구글 캘린더 → 오른쪽 위 톱니바퀴 → <b>설정</b> → 왼쪽 <b>가져오기 및 내보내기</b></li>
          <li>내려받은 .ics 파일을 고르고, 넣을 캘린더(예: 둘이 같이 보는 캘린더)를 선택 → <b>가져오기</b></li>
          <li>같은 파일을 다시 가져오면 일정이 겹칠 수 있어요. 처음 한 번만 파일로 넣고, 이후 새로 생긴 항목은 표의 캘린더 링크로 넣는 걸 추천해요.</li>
        </ol>
      </div>
    </section>
  );
}

/** 요약 탭: 30일 안(또는 밀린) 지불·할 일 */
export function Upcoming({ go }: { go: (tab: string) => void }) {
  const { ledger, s } = useStore();
  const today = todayYmd();
  const items = calendarEvents(ledger, s)
    .filter((e) => e.uid !== "wedding" && daysBetween(today, e.date) <= 30)
    .slice(0, 8);
  if (!items.length) return null;
  return (
    <section className="section">
      <h2>다가오는 일정</h2>
      <ul className="recent" style={{ marginTop: 8 }}>
        {items.map((e) => {
          const d = daysBetween(today, e.date);
          return (
            <li key={e.uid}>
              <button onClick={() => go("schedule")}>{e.title}</button>
              <span className={`small ${d < 0 ? "no" : "muted"}`} style={{ whiteSpace: "nowrap" }}>{e.date.slice(5).replace("-", "/")} · {ddayLabel(e.date, today)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
