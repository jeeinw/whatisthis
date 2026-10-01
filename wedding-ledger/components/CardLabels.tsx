"use client";
// 좁은 화면 카드 보기용: .tablebox.cards 표의 각 칸에 머리글 이름(data-label)을 붙인다.
import { useEffect } from "react";

function label(root: ParentNode) {
  root.querySelectorAll<HTMLTableElement>(".tablebox.cards table").forEach((t) => {
    const heads: string[] = [];
    t.querySelectorAll<HTMLTableCellElement>("thead tr:last-child th").forEach((th) => {
      const txt = (th.innerText || th.textContent || "").replace(/\s+/g, " ").replace(/[▲▼↑↓]/g, "").trim();
      for (let i = 0; i < (th.colSpan || 1); i++) heads.push(txt);
    });
    t.querySelectorAll<HTMLTableRowElement>("tbody tr, tfoot tr").forEach((tr) => {
      let c = 0;
      for (const td of Array.from(tr.cells)) {
        const l = td.colSpan > 1 ? "" : (heads[c] ?? "");
        if (td.dataset.label !== l) td.dataset.label = l;
        c += td.colSpan || 1;
      }
    });
  });
}

export function CardLabels() {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => label(main));
    };
    run();
    const mo = new MutationObserver(run);
    mo.observe(main, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
