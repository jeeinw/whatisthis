"use client";
// 휴지통 (30일 보관) + 지금 데이터 JSON으로 내려받기
import { useEffect, useState } from "react";
import { useStore, type TrashItem } from "./store";

const LABEL: Record<string, string> = {
  planners: "플래너",
  vendors: "업체",
  quotes: "견적",
  extras: "추가비용",
  halls: "웨딩홀",
  dresses: "드레스 보드",
  budget: "예산 항목",
  homes: "임장 후보",
  price_lists: "드레스 가격표",
  guests: "하객",
  gifts: "축의금",
  payments: "지불 일정",
  tasks: "준비 체크리스트",
};

export const nameOf = (d: Record<string, unknown>) => String(d.name || d.title || d.shop || d.vendor || d.planner || "(이름 없음)");

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return days <= 0 ? "오늘" : `${days}일 전`;
}

export function TrashPanel({ onClose }: { onClose: () => void }) {
  const { supabase, restore, ledger, toast } = useStore();
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase
      .from("trash")
      .select("id,tbl,doc_id,data,deleted_at,deleted_email")
      .order("deleted_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setItems(data as TrashItem[]);
      });
  }, [supabase]);

  function download() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...ledger }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `결혼준비_백업_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("백업 파일을 내려받았어요");
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="휴지통">
        <header>
          <h2>휴지통</h2>
          <button className="btn small" onClick={onClose}>닫기</button>
        </header>
        <div className="content">
          <p className="muted small" style={{ margin: 0 }}>지운 항목은 30일 동안 여기 남아요. 30일이 지나면 사진과 함께 완전히 지워져요.</p>
          {err ? (
            <p className="note small">{/function|relation|trash/.test(err) ? "휴지통을 쓰려면 Supabase에서 0002 마이그레이션을 먼저 실행해 주세요." : err}</p>
          ) : !items ? (
            <p className="muted">불러오는 중…</p>
          ) : !items.length ? (
            <p className="muted">비어 있어요.</p>
          ) : (
            <div className="tablebox">
              <table className="sheet">
                <thead>
                  <tr><th>종류</th><th>이름</th><th>지운 때</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id}>
                      <td className="small">{LABEL[t.tbl] ?? t.tbl}</td>
                      <td>{nameOf(t.data)}</td>
                      <td className="small muted">{ago(t.deleted_at)}{t.deleted_email ? ` · ${t.deleted_email.split("@")[0]}` : ""}</td>
                      <td>
                        <button
                          className="btn small"
                          onClick={async () => {
                            await restore(t);
                            setItems((x) => x?.filter((y) => y.id !== t.id) ?? null);
                          }}
                        >
                          되살리기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 style={{ marginTop: 16 }}>백업</h3>
          <p className="muted small" style={{ margin: 0 }}>서버가 매일 새벽 자동으로 백업해요. 지금 상태를 직접 저장해 두고 싶으면 아래 버튼을 누르세요.</p>
          <div>
            <button className="btn" onClick={download}>지금 데이터 JSON으로 내려받기</button>
          </div>
        </div>
      </aside>
    </>
  );
}
