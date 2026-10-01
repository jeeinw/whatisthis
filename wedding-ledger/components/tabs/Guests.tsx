"use client";
// 하객 명단 + 축의금 장부
import { useState } from "react";
import { GUEST_GROUPS, RSVP, SIDES, giftStats, guestStats, guestsWithoutGift, parseGuestLines } from "@/lib/calc/guests";
import { listOf } from "@/lib/calc/wedding";
import { isNum, man, manWon } from "@/lib/format";
import type { Gift, Guest, Side } from "@/lib/types";
import { useStore } from "../store";
import { ManCell, TextCell, useDraft } from "../shared";

const GIFT_METHODS = ["현금", "계좌이체", "기타"];

/** 정수 입력 칸 (인원 등) */
function IntCell({ value, label, onChange }: { value: unknown; label: string; onChange: (v: number | null) => void }) {
  const { draft, setDraft, bind } = useDraft(isNum(value) ? String(value) : "");
  return (
    <input
      className="cell"
      style={{ width: 56 }}
      type="number"
      inputMode="numeric"
      min={1}
      aria-label={label}
      placeholder="1"
      value={draft}
      {...bind}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(e.target.value === "" ? null : Math.max(1, Math.round(Number(e.target.value))));
      }}
    />
  );
}

export function Guests({ go }: { go: (tab: string) => void }) {
  return (
    <>
      <GuestList go={go} />
      <GiftBook />
    </>
  );
}

function GuestList({ go }: { go: (tab: string) => void }) {
  const { ledger, s, write, create, remove, setSettings, toast } = useStore();
  const all = listOf<Guest>(ledger.guests);
  const st = guestStats(all);
  const [q, setQ] = useState("");
  const [side, setSide] = useState("");
  const [rsvp, setRsvp] = useState("");
  const [bulk, setBulk] = useState(false);
  const [text, setText] = useState("");
  const [bulkSide, setBulkSide] = useState<Side>("J");
  const [bulkGroup, setBulkGroup] = useState("친구");

  const rows = all
    .filter((g) => (!side || (g.side || "공동") === side) && (!rsvp || (g.rsvp || "미정") === rsvp) && (!q || `${g.name} ${g.group ?? ""} ${g.memo ?? ""}`.includes(q)))
    .sort((a, b) => SIDES.indexOf(a.side || "공동") - SIDES.indexOf(b.side || "공동") || (a.group || "").localeCompare(b.group || "") || a.name.localeCompare(b.name));

  function addBulk() {
    const list = parseGuestLines(text, bulkSide, bulkGroup);
    list.forEach((g) => create("guests", g as unknown as Record<string, unknown>));
    toast(`${list.length}명을 추가했어요`);
    setText("");
    setBulk(false);
  }

  return (
    <section>
      <h2>하객 명단</h2>
      <p className="lead">한 줄에 한 사람(또는 한 가족)을 적고 인원을 넣어요. 불참을 뺀 인원이 예상 하객 수가 되고, 버튼 한 번으로 웨딩홀 견적에 반영돼요.</p>
      <div className="cards">
        <div className="stat"><div className="k">예상 하객 (불참 제외)</div><div className="v">{st.expected}명</div><div className="s">참석 확정 {st.confirmed} · 미정 {st.pending} · 불참 {st.declined}</div></div>
        <div className="stat"><div className="k">측별</div><div className="v" style={{ fontSize: 16 }}>{SIDES.filter((x) => st.bySide[x]).map((x) => `${x} ${st.bySide[x]}`).join(" · ") || "—"}</div><div className="s">청첩장 보낸 인원 {st.invited}명</div></div>
        <div className="stat">
          <div className="k">웨딩홀 견적 하객 수</div>
          <div className={`v ${st.expected && st.expected !== s.guests ? "bad" : ""}`}>{s.guests}명</div>
          <div className="s">
            {st.expected && st.expected !== s.guests ? (
              <button className="linkbtn" onClick={() => (setSettings({ guests: st.expected }), toast(`웨딩홀 하객 수를 ${st.expected}명으로 바꿨어요`))}>
                명단 기준 {st.expected}명으로 맞추기
              </button>
            ) : (
              <button className="linkbtn" onClick={() => go("hall")}>웨딩홀 탭에서 보기</button>
            )}
          </div>
        </div>
      </div>
      {Object.keys(st.byGroup).length > 0 && (
        <p className="muted small" style={{ margin: "8px 0 0" }}>그룹별: {Object.entries(st.byGroup).sort((a, b) => b[1] - a[1]).map(([g, c]) => `${g} ${c}`).join(" · ")}</p>
      )}

      <div className="filters" style={{ marginTop: 14 }}>
        <input placeholder="이름·그룹·메모" value={q} onChange={(e) => setQ(e.target.value)} aria-label="하객 검색" />
        <select value={side} onChange={(e) => setSide(e.target.value)} aria-label="측">
          <option value="">양쪽</option>
          {SIDES.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={rsvp} onChange={(e) => setRsvp(e.target.value)} aria-label="참석 여부">
          <option value="">참석 여부 전체</option>
          {RSVP.map((x) => <option key={x}>{x}</option>)}
        </select>
        <span className="spacer" />
        <span className="muted small">{rows.length}줄</span>
        <button className="btn ghost" onClick={() => setBulk((b) => !b)}>{bulk ? "붙여넣기 닫기" : "여러 명 붙여넣기"}</button>
        <button className="btn" onClick={() => create("guests", { name: "", side: side || "J", group: "", count: 1, invite: false, rsvp: "미정", memo: "" })}>한 명 추가</button>
      </div>
      {bulk && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <p className="muted small" style={{ marginTop: 0 }}>한 줄에 하나씩. <code>이름</code>, <code>이름 2</code>(인원), <code>이름, 2, 그룹</code> 형식 모두 돼요. 카톡·엑셀에서 복사해 붙여넣으세요.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} style={{ width: "100%" }} aria-label="하객 붙여넣기" placeholder={"김철수\n박영희 2\n이민호, 3, 친구"} />
          <div className="filters" style={{ marginTop: 8, marginBottom: 0 }}>
            <select value={bulkSide} onChange={(e) => setBulkSide(e.target.value as Side)} aria-label="붙여넣을 측">{SIDES.map((x) => <option key={x}>{x}</option>)}</select>
            <select value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)} aria-label="기본 그룹">{GUEST_GROUPS.map((x) => <option key={x}>{x}</option>)}</select>
            <button className="btn primary" disabled={!text.trim()} onClick={addBulk}>{parseGuestLines(text, bulkSide, bulkGroup).length}명 추가</button>
          </div>
        </div>
      )}
      <datalist id="guest-groups">{GUEST_GROUPS.map((g) => <option key={g} value={g} />)}</datalist>

      {!all.length ? (
        <div className="empty-state panel">아직 하객이 없어요. ‘여러 명 붙여넣기’로 한 번에 넣어 보세요.</div>
      ) : (
        <div className="tablebox cards">
          <table className="sheet">
            <thead>
              <tr><th>이름</th><th>측</th><th>그룹</th><th>인원</th><th>청첩장</th><th>참석</th><th>연락처</th><th>메모</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className={g.rsvp === "불참" ? "muted" : undefined}>
                  <td><TextCell className="cell memo" style={{ width: 120 }} value={g.name} label="이름" placeholder="이름" onChange={(v) => write("guests", g.id, { name: v })} /></td>
                  <td>
                    <select aria-label="측" value={g.side || "공동"} onChange={(e) => write("guests", g.id, { side: e.target.value })}>{SIDES.map((x) => <option key={x}>{x}</option>)}</select>
                  </td>
                  <td><TextCell className="cell memo" style={{ width: 96 }} list="guest-groups" value={g.group} label="그룹" placeholder="그룹" onChange={(v) => write("guests", g.id, { group: v })} /></td>
                  <td><IntCell value={g.count} label={`${g.name} 인원`} onChange={(v) => write("guests", g.id, { count: v })} /></td>
                  <td><input type="checkbox" aria-label={`${g.name} 청첩장 보냄`} checked={!!g.invite} onChange={(e) => write("guests", g.id, { invite: e.target.checked })} /></td>
                  <td>
                    <select aria-label="참석 여부" value={g.rsvp || "미정"} onChange={(e) => write("guests", g.id, { rsvp: e.target.value })}>{RSVP.map((x) => <option key={x}>{x}</option>)}</select>
                  </td>
                  <td><TextCell className="cell memo" style={{ width: 120 }} value={g.phone} label="연락처" placeholder="010-" onChange={(v) => write("guests", g.id, { phone: v })} /></td>
                  <td><TextCell value={g.memo} label="메모" placeholder="메모" onChange={(v) => write("guests", g.id, { memo: v })} /></td>
                  <td><button className="linkbtn" aria-label={`${g.name || "하객"} 삭제`} onClick={() => confirm(`'${g.name || "이 하객"}'을(를) 삭제할까요?`) && remove("guests", g.id)}>삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GiftBook() {
  const { ledger, s, write, create, remove, setSettings, toast } = useStore();
  const gifts = listOf<Gift>(ledger.gifts).sort((a, b) => (a.side || "").localeCompare(b.side || "") || a.name.localeCompare(b.name));
  const guests = listOf<Guest>(ledger.guests);
  const st = giftStats(gifts);
  const missing = guestsWithoutGift(guests, gifts);

  function fromGuests() {
    missing.forEach((g) => create("gifts", { name: g.name, side: g.side || "공동", relation: g.group || "", amount: null, method: "", guestId: g.id, thanks: false, memo: "" }));
    toast(`하객 ${missing.length}명을 장부에 넣었어요`);
  }

  return (
    <section className="section">
      <h2>축의금 장부</h2>
      <p className="lead">받은 축의금을 적으면 합계가 나와요. 오른쪽 ‘장부 합계로 반영’을 누르면 요약 탭의 축의금(실부담 계산)에 들어가요.</p>
      <div className="cards">
        <div className="stat"><div className="k">받은 축의금</div><div className="v">{manWon(st.total)}</div><div className="s">{st.count}건{st.avg ? ` · 평균 ${man(st.avg)}` : ""}</div></div>
        <div className="stat"><div className="k">측별</div><div className="v" style={{ fontSize: 16 }}>{SIDES.filter((x) => st.bySide[x]).map((x) => `${x} ${man(st.bySide[x])}`).join(" · ") || "—"}</div><div className="s">감사 인사 남은 {st.thanksLeft}건</div></div>
        <div className="stat">
          <div className="k">예산의 축의금 예상</div>
          <div className="v">{manWon(isNum(s.giftIncome) ? s.giftIncome : 0)}</div>
          <div className="s">
            {st.total > 0 && st.total !== s.giftIncome ? (
              <button className="linkbtn" onClick={() => (setSettings({ giftIncome: st.total }), toast("축의금 예상을 장부 합계로 바꿨어요"))}>장부 합계로 반영 ({manWon(st.total)})</button>
            ) : (
              "장부 합계와 같아요"
            )}
          </div>
        </div>
      </div>
      <div className="filters" style={{ marginTop: 14 }}>
        <span className="spacer" />
        {missing.length > 0 && <button className="btn ghost" onClick={fromGuests}>하객 명단에서 {missing.length}명 불러오기</button>}
        <button className="btn" onClick={() => create("gifts", { name: "", side: "J", relation: "", amount: null, method: "", thanks: false, memo: "" })}>한 건 추가</button>
      </div>
      {!gifts.length ? (
        <div className="empty-state panel">아직 기록이 없어요. 하객 명단이 있으면 ‘하객 명단에서 불러오기’로 이름을 한 번에 채울 수 있어요.</div>
      ) : (
        <div className="tablebox cards">
          <table className="sheet">
            <thead>
              <tr><th>이름</th><th>측</th><th>관계</th><th>금액 <span className="unit">만원</span></th><th>방법</th><th>감사 인사</th><th>메모</th><th></th></tr>
            </thead>
            <tbody>
              {gifts.map((g) => (
                <tr key={g.id}>
                  <td><TextCell className="cell memo" style={{ width: 120 }} value={g.name} label="이름" placeholder="이름" onChange={(v) => write("gifts", g.id, { name: v })} /></td>
                  <td><select aria-label="측" value={g.side || "공동"} onChange={(e) => write("gifts", g.id, { side: e.target.value })}>{SIDES.map((x) => <option key={x}>{x}</option>)}</select></td>
                  <td><TextCell className="cell memo" style={{ width: 96 }} list="guest-groups" value={g.relation} label="관계" placeholder="관계" onChange={(v) => write("gifts", g.id, { relation: v })} /></td>
                  <td className="num"><ManCell value={g.amount} label={`${g.name} 축의금(만원)`} placeholder="만원" onChange={(v) => write("gifts", g.id, { amount: v })} /></td>
                  <td><select aria-label="방법" value={g.method || ""} onChange={(e) => write("gifts", g.id, { method: e.target.value })}><option value="">—</option>{GIFT_METHODS.map((x) => <option key={x}>{x}</option>)}</select></td>
                  <td><input type="checkbox" aria-label={`${g.name} 감사 인사 완료`} checked={!!g.thanks} onChange={(e) => write("gifts", g.id, { thanks: e.target.checked })} /></td>
                  <td><TextCell value={g.memo} label="메모" placeholder="메모" onChange={(v) => write("gifts", g.id, { memo: v })} /></td>
                  <td><button className="linkbtn" aria-label={`${g.name || "기록"} 삭제`} onClick={() => confirm(`'${g.name || "이 기록"}'을(를) 삭제할까요?`) && remove("gifts", g.id)}>삭제</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3} style={{ textAlign: "right" }} className="muted">합계</td><td className="num"><b>{manWon(st.total)}</b></td><td colSpan={4}></td></tr></tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
