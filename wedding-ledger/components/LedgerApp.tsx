"use client";
import { useMemo } from "react";
import { TABS } from "@/lib/constants";
import { dressPriceIndex } from "@/lib/calc/dress";
import { listOf } from "@/lib/calc/wedding";
import type { Vendor } from "@/lib/types";
import { StoreProvider, useStore } from "./store";
import { Drawer } from "./Drawer";
import { Summary } from "./tabs/Summary";
import { Budget } from "./tabs/Budget";
import { Planner } from "./tabs/Planner";
import { Vendors } from "./tabs/Vendors";
import { DressPrices } from "./tabs/DressPrices";
import { Halls } from "./tabs/Halls";
import { Board } from "./tabs/Board";
import { House } from "./tabs/House";

export function LedgerApp() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function DDay({ date }: { date: string }) {
  if (!date) return null;
  const d = Math.ceil((new Date(date + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);
  return <span className="dday">{d > 0 ? "D-" + d : d === 0 ? "D-DAY" : "D+" + -d}</span>;
}

function Shell() {
  const { ledger, s, sync, ui, setUI } = useStore();
  const counts = useMemo(() => {
    const v = listOf<Vendor>(ledger.vendors);
    const vc = (c: string) => v.filter((x) => x.cat === c).length;
    return {
      planner: Object.keys(ledger.planners).length,
      studio: vc("studio"),
      dress: vc("dress"),
      makeup: vc("makeup"),
      hall: Object.keys(ledger.halls).length,
      board: Object.keys(ledger.dresses).length,
      house: Object.keys(ledger.homes).length,
      budget: Object.keys(ledger.budget).length,
      dprice: Object.keys(dressPriceIndex(ledger).by).length,
    } as Record<string, number>;
  }, [ledger]);

  const tab = ui.tab;
  const go = (id: string) => {
    setUI((u) => ({ ...u, tab: id }));
    window.scrollTo(0, 0);
  };

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="initials" aria-label="J와 D">
            J<span className="amp">&amp;</span>D
            <DDay date={s.weddingDate} />
          </div>
          <div className="sub">결혼 준비 장부</div>
        </div>
        <div className="top-actions">
          <span className="sync">{sync}</span>
          <form action="/auth/signout" method="post">
            <button className="btn small ghost">로그아웃</button>
          </form>
        </div>
      </header>
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => go(t.id)}>
            {t.label}
            {counts[t.id] != null && <span className="count">{counts[t.id]}</span>}
          </button>
        ))}
      </nav>
      <main>
        {tab === "summary" ? <Summary go={go} /> :
         tab === "budget" ? <Budget go={go} /> :
         tab === "planner" ? <Planner /> :
         tab === "hall" ? <Halls /> :
         tab === "board" ? <Board /> :
         tab === "house" ? <House /> :
         tab === "dprice" ? <DressPrices /> :
         <Vendors cat={tab as "studio" | "dress" | "makeup"} go={go} />}
      </main>
      <Drawer />
    </div>
  );
}
