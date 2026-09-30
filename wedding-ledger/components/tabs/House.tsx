"use client";
import { CHECKS, HOME_STATUS, SCORE } from "@/lib/constants";
import { buyCalc, equity, homeCalc, incomeFor, jeonseCalc, maxBuyPrice } from "@/lib/calc/housing";
import { amort, sensitivity } from "@/lib/calc/loan";
import { avgScore, listOf } from "@/lib/calc/wedding";
import { eok, isNum, won } from "@/lib/format";
import type { Home, LoanMethod, Settings } from "@/lib/types";
import { useStore } from "../store";
import { AvgCell, blogLink, Chk, ManInput, naverQ, NumInput, ScoreSelect, StatusSelect, statusRank, stripParen, useSort } from "../shared";

const METHOD_LABEL: Record<LoanMethod, string> = { equal: "원리금균등", principal: "원금균등", bullet: "만기일시" };

export function House() {
  const { ledger, s, setSettings } = useStore();
  const f = s.fin, h = s.house;
  const eq = equity(ledger, s);

  let autoP = 0, autoR = 0;
  let houseOut: React.ReactNode;
  if (h.mode === "buy") {
    const c = buyCalc(h.price, ledger, s, eq);
    const mx = maxBuyPrice(ledger, s);
    autoP = c.L.lim;
    autoR = h.rate;
    houseOut = (
      <>
        <div className="cards">
          <div className="stat"><div className="k">대출 가능액</div><div className="v">{eok(c.L.lim)}</div><div className="s">묶이는 기준: <b>{c.L.bind}</b></div></div>
          <div className="stat"><div className="k">필요한 현금</div><div className="v">{eok(c.cashNeed)}</div><div className="s">취득세 {eok(c.tax)} · 중개 {eok(c.fee)} · 등기 {eok(c.reg)}</div></div>
          <div className="stat"><div className="k">{c.gap < 0 ? "부족한 돈" : "남는 돈"}</div><div className={`v ${c.gap < 0 ? "bad" : "good"}`}>{eok(Math.abs(c.gap))}</div><div className="s">집에 쓸 수 있는 돈 {eok(c.eq.avail)}</div></div>
          <div className="stat"><div className="k">월 상환 (원리금균등)</div><div className="v">{won(Math.round(c.monthly))}</div><div className="s">{h.rate}% · {h.years}년</div></div>
          <div className="stat"><div className="k">이 조건으로 살 수 있는 최고가</div><div className="v">{mx ? eok(mx) : "—"}</div><div className="s">현금·대출 한도를 모두 맞추는 가격</div></div>
        </div>
        <div className="why">
          LTV {Math.round(c.L.ltvRate * 100)}% → {eok(c.L.ltv)} · 가격별 한도 → {isFinite(c.L.cap) ? eok(c.L.cap) : "없음"} · DSR {h.dsr}% (금리 {h.rate}%+스트레스 {h.stress}%p, 소득 {eok(incomeFor(s))}) → {eok(c.L.dsr)}.<br />
          서울은 전역이 규제지역이라 일반 LTV 40%, 생애최초는 70%이고, 15억 이하 6억·15~25억 4억·25억 초과 2억의 가격별 한도가 따로 붙어요. 취득세는 1주택 기준 추정치(생애최초 12억 이하 200만 원 감면 가정)예요.
        </div>
      </>
    );
  } else {
    const c = jeonseCalc(h.deposit, ledger, s, eq);
    autoP = c.loan;
    autoR = c.p.rate;
    houseOut = (
      <>
        <div className="cards">
          <div className="stat"><div className="k">필요한 대출</div><div className="v">{eok(c.needLoan)}</div><div className="s">보증금 + 중개보수 {eok(c.fee)} − 쓸 수 있는 돈</div></div>
          <div className="stat"><div className="k">선택 상품 한도</div><div className="v">{eok(c.p.cap)}</div><div className="s">{c.p.label}</div></div>
          <div className="stat"><div className="k">{c.gap < 0 ? "부족한 돈" : "남는 돈"}</div><div className={`v ${c.gap < 0 ? "bad" : "good"}`}>{eok(Math.abs(c.gap))}</div><div className="s">한도까지 빌렸을 때</div></div>
          <div className="stat"><div className="k">월 이자</div><div className="v">{won(Math.round(c.monthlyInterest))}</div><div className="s">대출 {eok(c.loan)} × {c.p.rate.toFixed(2)}%</div></div>
        </div>
        <div className="tablebox" style={{ marginTop: 12 }}>
          <table className="sheet">
            <thead><tr><th>상품</th><th>자격</th><th>한도</th><th>실금리</th><th>근거</th></tr></thead>
            <tbody>
              {Object.entries(c.P).map(([k, p]) => (
                <tr key={k}>
                  <td>{k === c.pk ? <><b>{p.label}</b> ✓</> : p.label}</td>
                  <td>{p.ok ? <span className="ok">가능</span> : <><span className="no">불가</span> <span className="small muted">{p.why}</span></>}</td>
                  <td className="num">{eok(p.cap)}</td>
                  <td className="num">{p.rate.toFixed(2)}%</td>
                  <td className="small muted wrap">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="why">
          서울시 신혼부부 이자지원은 보증금 7억 이하·부부합산 1.3억 이하가 조건이고, 최대 3억(보증금 90%)까지 대출에 소득 구간별 이자를 서울시가 대신 내줘요. 버팀목은 수도권 보증금 4억·소득 7,500만 원 이하일 때만 돼요. 무주택자 전세대출에는 DSR이 적용되지 않는다고 가정했어요.
        </div>
      </>
    );
  }

  return (
    <>
      <h2>신혼집 자금과 대출</h2>
      <p className="lead">금액은 만원 단위로 적어요. 적는 즉시 아래 결과와 임장 후보표가 다시 계산돼요. 대출 규정은 2026년 9월 기준 공개 자료를 바탕으로 한 추정이라, 실제 한도는 은행 사전 조회로 꼭 확인해 주세요.</p>
      <div className="grid2">
        <section className="panel">
          <h3>우리 자금</h3>
          <div className="formgrid">
            <ManInput path="fin.jAsset" value={f.jAsset} label="J 모은 돈" />
            <ManInput path="fin.dAsset" value={f.dAsset} label="D 모은 돈" />
            <ManInput path="fin.jParents" value={f.jParents} label="J 부모님 지원" />
            <ManInput path="fin.dParents" value={f.dParents} label="D 부모님 지원" hint="미정이면 비워두기" />
            <ManInput path="fin.other" value={f.other} label="기타 (청약·퇴직금 등)" />
          </div>
          <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
            <Chk path="fin.subtractWedding" value={f.subtractWedding} label="결혼식 비용(축의금 뺀 실부담)을 먼저 빼기" />
            <Chk path="fin.subtractSetup" value={f.subtractSetup} label="신혼집 세팅 비용(가전·가구·이사)도 빼기" />
          </div>
          <div className="lines" style={{ marginTop: 10 }}>
            <div className="row"><span className="k">모은 돈 + 지원 합계</span><b>{eok(eq.base)}</b></div>
            {f.subtractWedding && <div className="row"><span className="k">결혼식 실부담</span><b>− {eok(eq.wc)}</b></div>}
            {f.subtractSetup && <div className="row"><span className="k">신혼집 세팅</span><b>− {eok(eq.sc)}</b></div>}
            <div className="row"><span className="k">집에 쓸 수 있는 돈</span><b className="ok">{eok(eq.avail)}</b></div>
          </div>
        </section>
        <section className="panel">
          <h3>소득 (DSR 계산용)</h3>
          <div className="formgrid">
            <ManInput path="fin.jIncome" value={f.jIncome} label="J 연소득 (세전)" />
            <ManInput path="fin.dIncome" value={f.dIncome} label="D 연소득 (세전)" />
            <ManInput path="fin.existingAnnual" value={f.existingAnnual} label="기존 대출 연 상환액" hint="없으면 0" />
          </div>
          <div style={{ marginTop: 8 }}>
            <Chk path="fin.combineIncome" value={f.combineIncome} label="부부 소득 합산해서 심사 (혼인신고 후 공동 차주 기준)" />
          </div>
          <div className="why">은행은 복지포인트 같은 비과세 항목을 인정소득에서 빼는 경우가 많아요. 원천징수영수증의 총급여 기준으로 넣는 게 안전해요.</div>
        </section>
      </div>

      <section className="section">
        <div className="seg" role="group" aria-label="전세 또는 매매">
          <button aria-pressed={h.mode !== "buy"} onClick={() => setSettings({ house: { mode: "jeonse" } })}>전세</button>
          <button aria-pressed={h.mode === "buy"} onClick={() => setSettings({ house: { mode: "buy" } })}>매매</button>
        </div>
        {h.mode === "buy" ? (
          <div className="panel">
            <div className="formgrid">
              <ManInput path="house.price" value={h.price} label="매매가" />
              <NumInput path="house.rate" value={h.rate} label="대출 금리" unit="% (연)" step={0.05} />
              <NumInput path="house.years" value={h.years} label="대출 기간" unit="년" step={1} />
              <NumInput path="house.stress" value={h.stress} label="스트레스 가산금리" unit="%p" step={0.1} />
              <NumInput path="house.dsr" value={h.dsr} label="DSR 한도" unit="% (은행 40)" step={1} />
              <ManInput path="house.regFee" value={h.regFee} label="등기·법무 비용" />
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Chk path="house.regulated" value={h.regulated} label="규제지역 (서울 전역)" />
              <Chk path="house.firstHome" value={h.firstHome} label="생애최초 주택구입" />
              <Chk path="house.area85" value={h.area85} label="전용 85㎡ 초과" />
            </div>
          </div>
        ) : (
          <div className="panel">
            <div className="formgrid">
              <ManInput path="house.deposit" value={h.deposit} label="전세 보증금" />
              <label>
                전세대출 상품
                <select value={h.product} onChange={(e) => setSettings({ house: { product: e.target.value } })}>
                  <option value="seoul">서울시 신혼부부 이자지원</option>
                  <option value="buttimok">신혼부부 버팀목</option>
                  <option value="bank">시중은행 (HF 보증)</option>
                </select>
                <span className="hint">조건이 안 맞으면 되는 상품으로 자동 전환</span>
              </label>
              <NumInput path="house.seoulBase" value={h.seoulBase} label="서울시 협약대출 금리 (지원 전)" unit="% · COFIX+1.45" step={0.01} />
              <NumInput path="house.bankRate" value={h.bankRate} label="시중은행 전세대출 금리" unit="%" step={0.05} />
              <ManInput path="house.bankCap" value={h.bankCap} label="시중은행 한도" />
            </div>
          </div>
        )}
        <div style={{ marginTop: 14 }}>{houseOut}</div>
      </section>

      <LoanSim s={s} autoP={autoP} autoR={autoR} />

      <section className="section">
        <h2>임장 후보</h2>
        <p className="lead">단지를 추가하고 호가·KB시세·전세가를 적으면, 위 자금 조건으로 살 수 있는지(또는 전세로 들어갈 수 있는지) 바로 계산해요. 단지명을 누르면 임장 체크리스트가 열려요.</p>
        <HomesTable />
      </section>
    </>
  );
}

function LoanSim({ s, autoP, autoR }: { s: Settings; autoP: number; autoR: number }) {
  const { setSettings } = useStore();
  const ls = s.loanSim;
  const P = ls.auto ? autoP || 0 : ls.principal || 0;
  const r = ls.auto ? autoR || 0 : ls.rate || 0;
  const method: LoanMethod = ls.auto && s.house.mode !== "buy" ? "bullet" : ls.method;
  const yrs = ls.auto ? (s.house.mode === "buy" ? s.house.years : 2) : ls.years || 30;
  const a = amort(P, r, yrs, method, ls.grace || 0);
  const inc = incomeFor(s);
  const maxB = Math.max(P, 1);
  const n = Math.max(1, a.yearly.length);

  return (
    <section className="section">
      <h2>대출 이자 시뮬레이터</h2>
      <div className="panel">
        <div className="formgrid">
          <label className="chk"><input type="checkbox" checked={ls.auto} onChange={(e) => setSettings({ loanSim: { auto: e.target.checked } })} /> 위 계산 결과 대출금·금리 그대로 쓰기</label>
          <ManInput path="loanSim.principal" value={ls.principal} label="대출 원금" />
          <NumInput path="loanSim.rate" value={ls.rate} label="금리" unit="% (연)" step={0.05} />
          <NumInput path="loanSim.years" value={ls.years} label="기간" unit="년" step={1} />
          <label>
            상환 방식
            <select value={ls.method} onChange={(e) => setSettings({ loanSim: { method: e.target.value } })}>
              <option value="equal">원리금균등</option>
              <option value="principal">원금균등</option>
              <option value="bullet">만기일시 (전세대출)</option>
            </select>
          </label>
          <NumInput path="loanSim.grace" value={ls.grace} label="거치 기간" unit="년" step={1} />
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="cards">
            <div className="stat"><div className="k">원금 · 금리</div><div className="v">{eok(P)}</div><div className="s">{r.toFixed(2)}% · {yrs}년 · {METHOD_LABEL[method]}</div></div>
            <div className="stat">
              <div className="k">첫 달 납입</div>
              <div className="v">{won(Math.round(a.first || 0))}</div>
              <div className="s">{a.afterGrace ? `거치 후 ${won(Math.round(a.afterGrace))}` : inc ? `월소득 대비 ${(((a.first || 0) / (inc / 12)) * 100).toFixed(1)}%` : ""}</div>
            </div>
            <div className="stat"><div className="k">총 이자</div><div className="v">{eok(a.total)}</div><div className="s">{method === "bullet" ? `${yrs}년 동안 이자만 낼 때` : "만기까지 다 갚을 때"}</div></div>
          </div>
          <svg className="chart" viewBox="0 0 1000 190" role="img" aria-label="연차별 대출 잔액">
            <line x1="30" y1="170" x2="970" y2="170" stroke="var(--line)" />
            {a.yearly.map((b, i) => {
              const x = 30 + i * (940 / n);
              const w = Math.max(1, 940 / n - 3);
              const hgt = (b / maxB) * 150;
              return (
                <rect key={i} x={x.toFixed(1)} y={(170 - hgt).toFixed(1)} width={w.toFixed(1)} height={hgt.toFixed(1)} fill="var(--ribbon)" opacity=".75">
                  <title>{`${i + 1}년 차 잔액 ${eok(b)}`}</title>
                </rect>
              );
            })}
            <text x="30" y="186" fontSize="12" fill="var(--muted)">1년</text>
            <text x="945" y="186" fontSize="12" fill="var(--muted)">{yrs}년</text>
            <text x="30" y="14" fontSize="12" fill="var(--muted)">연말 잔액 (최대 {eok(P)})</text>
          </svg>
          <div className="tablebox" style={{ marginTop: 10 }}>
            <table className="sheet">
              <thead><tr><th>금리</th><th>첫 달 납입</th><th>총 이자</th></tr></thead>
              <tbody>
                {sensitivity(P, r, yrs, method, ls.grace || 0).map((x) => (
                  <tr key={x.rate} style={x.isBase ? { fontWeight: 600 } : undefined}>
                    <td>{x.rate.toFixed(2)}%</td><td className="num">{won(Math.round(x.first || 0))}</td><td className="num">{eok(x.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

const CHECK_TOTAL = CHECKS.reduce((a, g) => a + g[1].length, 0);

function HomesTable() {
  const { ledger, s, create, setDrawer } = useStore();
  const eq = equity(ledger, s);
  const calc = (r: Home) => homeCalc(r, ledger, s, eq);
  const { rows, th } = useSort("home", listOf<Home>(ledger.homes), {
    name: (r) => r.name, price: (r) => r.price, avg: (r) => avgScore(r.scores, "home"), status: statusRank, gap: (r) => calc(r)?.gap,
  });
  const add = () =>
    setDrawer({ col: "homes", id: create("homes", { name: "새 단지", kind: s.house.mode === "buy" ? "매매" : "전세", gu: "", dong: "", status: "관심", scores: {}, checks: {}, memo: "" }) });

  return (
    <>
      <div className="filters">
        <span className="links small">
          시세 확인: <a href="https://kbland.kr/" target="_blank" rel="noopener">KB부동산</a>
          <a href="https://rt.molit.go.kr/" target="_blank" rel="noopener">국토부 실거래가</a>
          <a href="https://new.land.naver.com/" target="_blank" rel="noopener">네이버부동산</a>
          <a href="https://hogangnono.com/" target="_blank" rel="noopener">호갱노노</a>
          <a href="https://asil.kr/" target="_blank" rel="noopener">아실</a>
          <a href="https://www.iros.go.kr/" target="_blank" rel="noopener">인터넷등기소</a>
        </span>
        <span className="spacer" />
        <button className="btn" onClick={add}>단지 추가</button>
      </div>
      {!rows.length ? (
        <div className="empty-state panel">아직 후보 단지가 없어요. ‘단지 추가’로 첫 후보를 넣어 보세요.</div>
      ) : (
        <div className="tablebox">
          <table className="sheet">
            <thead>
              <tr>
                {th("name", "단지")}<th>지역</th><th>유형</th><th>전용</th>{th("price", "호가")}<th>KB시세</th><th>실거래</th><th>전세가</th><th>전세가율</th><th>세대·연식</th><th>역</th>{th("gap", "자금 판정")}<th>월 부담</th>
                {SCORE.home.map(([k, l]) => <th key={k} className="sc">{l}</th>)}
                {th("avg", "평균", "sc")}{th("status", "상태")}<th>임장일</th><th>링크</th><th>메모</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = calc(r);
                const base = r.kb || r.price;
                const jr = isNum(r.jeonse) && isNum(base) ? Math.round((r.jeonse / base) * 100) : null;
                const done = Object.values(r.checks || {}).filter(Boolean).length;
                return (
                  <tr key={r.id}>
                    <td className="name"><button onClick={() => setDrawer({ col: "homes", id: r.id })}>{r.name}</button><br /><span className="unit">체크 {done}/{CHECK_TOTAL}</span></td>
                    <td className="small">{r.gu} {r.dong}</td>
                    <td>{r.kind || "매매"}</td>
                    <td className="num">{isNum(r.area) ? r.area + "㎡" : "—"}</td>
                    <td className="num">{isNum(r.price) ? eok(r.price) : "—"}</td>
                    <td className="num">{isNum(r.kb) ? eok(r.kb) : "—"}</td>
                    <td className="num">{isNum(r.recent) ? eok(r.recent) : "—"}</td>
                    <td className="num">{isNum(r.jeonse) ? eok(r.jeonse) : "—"}</td>
                    <td className={`num ${jr != null && jr >= 70 ? "no" : ""}`}>{jr != null ? jr + "%" : "—"}</td>
                    <td className="small">{isNum(r.units) ? r.units + "세대" : ""}{isNum(r.year) && <><br />{r.year}년</>}</td>
                    <td className="small">{r.station}{isNum(r.walk) ? " " + r.walk + "분" : ""}</td>
                    <td className="num">
                      {c ? (
                        <>
                          <span className={c.ok ? "ok" : "no"}>{c.ok ? "가능" : "부족"} {eok(Math.abs(c.gap))}</span><br />
                          <span className="unit">대출 {eok(c.loan)}{c.bind ? ` (${c.bind})` : ""}</span>
                        </>
                      ) : <span className="muted">가격 입력</span>}
                    </td>
                    <td className="num">{c ? won(Math.round(c.monthly)) : "—"}</td>
                    {SCORE.home.map(([k]) => <td key={k}><ScoreSelect col="homes" id={r.id} kind="home" k={k} val={r.scores?.[k]} /></td>)}
                    <td><AvgCell a={avgScore(r.scores, "home")} /></td>
                    <td><StatusSelect col="homes" id={r.id} val={r.status} opts={HOME_STATUS} /></td>
                    <td className="small">{r.visit}</td>
                    <td className="links">
                      <a href={naverQ(r.name + " KB시세")} target="_blank" rel="noopener">KB시세</a>
                      <a href={naverQ(r.name + " 실거래가")} target="_blank" rel="noopener">실거래</a>
                      <a href={blogLink(stripParen(r.name) + " 임장")} target="_blank" rel="noopener">임장기</a>
                    </td>
                    <td className="wrap small">{r.memo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
