"use client";
import { useRef, useState } from "react";
import { SILHOUETTES, USES } from "@/lib/constants";
import { dressPriceIndex } from "@/lib/calc/dress";
import { listOf } from "@/lib/calc/wedding";
import type { Dress, Vendor } from "@/lib/types";
import { useStore } from "../store";
import { Photo, TextCell, usePickPhoto, useUploadPhoto } from "../shared";

export function Board() {
  const { ledger, write, create, remove, toast } = useStore();
  const upload = useUploadPhoto();
  const pick = usePickPhoto();
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);

  const rows = listOf<Dress>(ledger.dresses).sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.createdAt || 0) - (a.createdAt || 0));
  const shops = [...new Set(listOf<Vendor>(ledger.vendors).filter((v) => v.cat === "dress").map((v) => v.name).concat(Object.values(dressPriceIndex(ledger).by).map((r) => r.name)))];

  async function addFiles(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    setBusy((n) => n + imgs.length);
    for (const f of imgs) {
      // 문서를 먼저 만들고 그 id 폴더에 사진을 올린다
      const id = create("dresses", { shop: "", silhouette: "", use: "", rating: 0, memo: "", createdAt: Date.now(), photo: "" });
      const path = await upload("dresses", id, f);
      if (path) write("dresses", id, { photo: path });
      else remove("dresses", id);
      setBusy((n) => n - 1);
    }
    if (imgs.length) toast(`사진 ${imgs.length}장을 올렸어요`);
  }

  return (
    <>
      <h2>드레스 보드</h2>
      <p className="lead">마음에 든 드레스 사진을 모아 두고, 샵·실루엣·용도를 붙여 비교해요. 하트 수 순으로 정렬돼요.</p>
      <div
        className={`drop ${over ? "over" : ""}`}
        tabIndex={0}
        role="button"
        aria-label="드레스 사진 올리기"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          addFiles([...e.dataTransfer.files]);
        }}
      >
        {busy > 0 ? `사진 올리는 중… (${busy}장 남음)` : "사진을 여기로 끌어 놓거나 눌러서 여러 장 올리기"}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles([...(e.target.files || [])]);
          e.target.value = "";
        }}
      />
      <div className="board" style={{ marginTop: 16 }}>
        {rows.map((r) => (
          <div className="card" key={r.id}>
            {r.photo ? (
              <Photo path={r.photo} alt={`${r.shop || ""} 드레스`} />
            ) : (
              <div className="thumb empty" style={{ width: "100%", aspectRatio: "3/4", height: "auto" }}>사진 없음</div>
            )}
            <div className="body">
              <div className="hearts" role="group" aria-label="선호도">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={(r.rating || 0) >= n ? "on" : ""} aria-label={`${n}점`} onClick={() => write("dresses", r.id, { rating: r.rating === n ? n - 1 : n })}>
                    ♥
                  </button>
                ))}
              </div>
              <TextCell className="" list="shopList" placeholder="드레스샵" value={r.shop} label="드레스샵" onChange={(v) => write("dresses", r.id, { shop: v })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <select aria-label="실루엣" value={r.silhouette || ""} onChange={(e) => write("dresses", r.id, { silhouette: e.target.value })}>
                  {SILHOUETTES.map((x) => <option key={x} value={x}>{x || "실루엣"}</option>)}
                </select>
                <select aria-label="용도" value={r.use || ""} onChange={(e) => write("dresses", r.id, { use: e.target.value })}>
                  {USES.map((x) => <option key={x} value={x}>{x || "용도"}</option>)}
                </select>
              </div>
              <TextCell className="" placeholder="메모 (소재, 라인명, 느낌)" value={r.memo} label="메모" onChange={(v) => write("dresses", r.id, { memo: v })} />
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn small" onClick={() => pick("dresses", r.id)}>사진 바꾸기</button>
                <button className="btn small danger" onClick={() => confirm("이 드레스를 보드에서 지울까요?") && remove("dresses", r.id)}>삭제</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <datalist id="shopList">
        {shops.map((x) => <option key={x} value={x} />)}
      </datalist>
    </>
  );
}
