// UI 표기용 포맷터. 저장값은 항상 원 단위.

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const won = (n: unknown) => (isNum(n) ? Math.round(n).toLocaleString("ko-KR") + "원" : "—");

export const man = (n: unknown) => {
  if (!isNum(n)) return "—";
  return (Math.round((n / 10000) * 10) / 10).toLocaleString("ko-KR") + "만";
};

export const manWon = (n: unknown) => (isNum(n) ? Math.round(n / 10000).toLocaleString("ko-KR") + "만 원" : "—");

export function eok(n: unknown): string {
  if (!isNum(n)) return "—";
  const neg = n < 0;
  const a = Math.abs(n);
  const e = Math.floor(a / 1e8);
  const m = Math.round((a % 1e8) / 1e4);
  let t = e ? e + "억" : "";
  if (m) t += (t ? " " : "") + m.toLocaleString("ko-KR") + "만";
  if (!t) t = "0";
  return (neg ? "−" : "") + t + " 원";
}

export const signed = (n: unknown) =>
  !isNum(n) ? "—" : (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n / 10000).toLocaleString("ko-KR") + "만";
