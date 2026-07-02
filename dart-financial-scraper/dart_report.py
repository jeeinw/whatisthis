#!/usr/bin/env python3
"""
DART(전자공시시스템, https://dart.fss.or.kr) Open API를 이용해
- 원하는 기업 / 원하는 기간의 연결·별도 재무제표(재무상태표·손익계산서·포괄손익계산서·현금흐름표)
- 재무제표 특이사항(전년대비 급변동, 부호반전, 자본잠식, 부채비율/유동비율 경고 등) 자동 탐지
- 사업보고서 원문 주석 텍스트 키워드 스캔(우발부채/소송/담보/특수관계자 등 설명 첨부)
- 최대주주 현황/변동, 소액주주 현황, 5% 대량보유·임원 및 주요주주 지분보고
- 사업부문(세그먼트) 관련 원문 발췌(공식 구조화 API가 없어 텍스트 검색으로 보완)
를 한 번에 수집해 엑셀 파일로 정리하는 스크립트.

사전 설치 없이 실행: `python dart_report.py ...` 를 실행하면 필요한 패키지(requests,
pandas, openpyxl, beautifulsoup4)를 스크립트가 자동으로 설치합니다. 인터넷 연결과
DART Open API 인증키(무료, https://opendart.fss.or.kr 에서 발급)만 있으면 됩니다.

사용 예:
    export DART_API_KEY=발급받은키
    python dart_report.py --corp 삼성전자 --start-year 2021 --end-year 2023

자세한 사용법은 같은 폴더의 README.md 를 참고하세요.
"""

import argparse
import importlib
import io
import json
import os
import re
import subprocess
import sys
import time
import zipfile
from pathlib import Path


def _ensure_packages():
    pkgs = {"requests": "requests", "pandas": "pandas", "openpyxl": "openpyxl", "bs4": "beautifulsoup4"}
    missing = [pip_name for mod, pip_name in pkgs.items() if importlib.util.find_spec(mod) is None]
    if missing:
        print(f"[setup] 필요한 패키지를 설치합니다: {', '.join(missing)} (인터넷 연결 필요)")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", *missing])


_ensure_packages()

import requests  # noqa: E402
import pandas as pd  # noqa: E402
from bs4 import BeautifulSoup  # noqa: E402


BASE_URL = "https://opendart.fss.or.kr/api"
CACHE_DIR = Path(__file__).resolve().parent / ".dart_cache"
CACHE_DIR.mkdir(exist_ok=True)

REPRT_CODES = {
    "11011": "사업보고서(연간)",
    "11012": "반기보고서",
    "11013": "1분기보고서",
    "11014": "3분기보고서",
}
SJ_NAMES = {"BS": "재무상태표", "IS": "손익계산서", "CIS": "포괄손익계산서", "CF": "현금흐름표", "SCE": "자본변동표"}
FS_NAMES = {"CFS": "연결", "OFS": "별도"}

STATUS_MESSAGES = {
    "000": "정상",
    "013": "조회된 데이터가 없습니다",
    "020": "요청 제한(사용한도) 초과",
    "100": "필드의 부적절한 값",
    "800": "시스템 점검 중",
    "900": "정의되지 않은 오류",
    "901": "사용할 수 없는 키",
}

# 재무제표 주석에서 자주 리스크 요인으로 다뤄지는 키워드 -> 사람이 읽을 설명
NOTE_KEYWORDS = {
    "우발부채": "소송·지급보증 등 아직 확정되지 않은 채무가 존재할 가능성",
    "소송": "진행 중인 소송에 따른 잠재적 손실 가능성",
    "담보": "차입 등을 위해 자산을 담보로 제공했을 가능성(재무적 제약)",
    "지급보증": "계열사 등 타인을 위한 지급보증 부담",
    "특수관계자": "계열사 등 특수관계자와의 자금거래·내부거래",
    "대손충당금": "매출채권 등 회수 불확실성에 대비한 충당금 설정",
    "손상차손": "보유 자산(영업권·유형자산 등) 가치 하락 인식",
    "자본잠식": "자본총계가 자본금보다 작아지는 재무건전성 이슈",
    "계속기업": "계속기업으로서 존속 능력에 대한 감사인의 불확실성 의견",
    "회계정책의 변경": "회계처리 방법 변경에 따른 기간별 비교가능성 이슈",
    "중요한 회계추정": "경영진 판단이 많이 개입되는 추정치(공정가치 평가 등)",
    "전환사채": "주식 전환 시 지분 희석 가능성이 있는 채무",
    "신주인수권": "행사 시 지분 희석 가능성",
    "유상증자": "자본 조달을 위한 신주 발행",
    "무상감자": "결손보전 등을 위한 자본금 감소",
}

KEY_RATIO_ACCOUNTS = ["자산총계", "부채총계", "자본총계", "유동자산", "유동부채", "매출액", "영업이익", "당기순이익"]
YOY_THRESHOLD = 0.3  # 30% 이상 변동 시 특이사항으로 표시


class DartApiError(Exception):
    pass


class DartClient:
    def __init__(self, api_key: str, sleep_sec: float = 0.15):
        self.api_key = api_key
        self.sleep_sec = sleep_sec
        self.session = requests.Session()

    def _get(self, endpoint: str, params: dict, retries: int = 3):
        req_params = {**params, "crtfc_key": self.api_key}
        url = f"{BASE_URL}/{endpoint}"
        last_err = None
        for attempt in range(1, retries + 1):
            try:
                resp = self.session.get(url, params=req_params, timeout=20)
                resp.raise_for_status()
                time.sleep(self.sleep_sec)
                if endpoint.endswith(".json"):
                    data = resp.json()
                    status = data.get("status")
                    if status != "000":
                        msg = STATUS_MESSAGES.get(status, data.get("message", "알 수 없는 오류"))
                        print(f"  [DART {status}] {endpoint} {params}: {msg}")
                    return data
                return resp.content
            except (requests.RequestException, json.JSONDecodeError) as exc:
                last_err = exc
                wait = 2 ** attempt
                print(f"  [경고] {endpoint} 요청 실패({exc}), {wait}s 후 재시도")
                time.sleep(wait)
        raise DartApiError(f"{endpoint} 요청이 반복적으로 실패했습니다: {last_err}")

    # ---- 기업 고유번호 ----
    def load_corp_codes(self, force_refresh: bool = False) -> pd.DataFrame:
        cache_file = CACHE_DIR / "corp_codes.json"
        if cache_file.exists() and not force_refresh:
            age_days = (time.time() - cache_file.stat().st_mtime) / 86400
            if age_days < 7:
                return pd.read_json(cache_file, dtype={"corp_code": str, "stock_code": str})
        print("[정보] 전체 기업 고유번호 목록을 DART에서 내려받는 중...")
        content = self._get("corpCode.xml", {})
        import xml.etree.ElementTree as ET

        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            xml_bytes = zf.read("CORPCODE.xml")
        root = ET.fromstring(xml_bytes)
        rows = [
            {
                "corp_code": (node.findtext("corp_code") or "").strip(),
                "corp_name": (node.findtext("corp_name") or "").strip(),
                "stock_code": (node.findtext("stock_code") or "").strip(),
                "modify_date": (node.findtext("modify_date") or "").strip(),
            }
            for node in root.findall("list")
        ]
        df = pd.DataFrame(rows)
        df.to_json(cache_file, force_ascii=False, orient="records")
        return df

    def find_corp_code(self, name_or_code: str) -> dict:
        if re.fullmatch(r"\d{8}", name_or_code):
            df = self.load_corp_codes()
            hit = df[df["corp_code"] == name_or_code]
            if not hit.empty:
                return hit.iloc[0].to_dict()
        df = self.load_corp_codes()
        exact = df[df["corp_name"] == name_or_code]
        listed = exact[exact["stock_code"] != ""]
        if not listed.empty:
            return listed.iloc[0].to_dict()
        if not exact.empty:
            return exact.iloc[0].to_dict()
        contains = df[df["corp_name"].str.contains(re.escape(name_or_code), na=False)]
        listed = contains[contains["stock_code"] != ""]
        if not listed.empty:
            if len(listed) > 1:
                print(f"[안내] '{name_or_code}' 검색 결과가 여러 건입니다. 첫 번째 상장사를 사용합니다:")
                print(listed[["corp_name", "stock_code", "corp_code"]].head(10).to_string(index=False))
            return listed.iloc[0].to_dict()
        if not contains.empty:
            return contains.iloc[0].to_dict()
        raise ValueError(f"'{name_or_code}' 에 해당하는 기업을 DART 고유번호 목록에서 찾을 수 없습니다.")

    # ---- 기업 개황 ----
    def get_company(self, corp_code: str) -> dict:
        return self._get("company.json", {"corp_code": corp_code})

    # ---- 재무제표 ----
    def get_financials(self, corp_code, bsns_year, reprt_code, fs_div):
        data = self._get(
            "fnlttSinglAcntAll.json",
            {"corp_code": corp_code, "bsns_year": str(bsns_year), "reprt_code": reprt_code, "fs_div": fs_div},
        )
        return data.get("list", []) if data.get("status") == "000" else []

    # ---- 공시 검색 / 원문 ----
    def search_disclosures(self, corp_code, bgn_de, end_de, pblntf_ty="A"):
        data = self._get(
            "list.json",
            {"corp_code": corp_code, "bgn_de": bgn_de, "end_de": end_de, "pblntf_ty": pblntf_ty, "page_count": 100},
        )
        return data.get("list", []) if data.get("status") == "000" else []

    def download_document_texts(self, rcept_no: str) -> dict:
        content = self._get("document.xml", {"rcept_no": rcept_no})
        texts = {}
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                for name in zf.namelist():
                    raw = zf.read(name)
                    text = None
                    for enc in ("utf-8", "cp949", "euc-kr"):
                        try:
                            text = raw.decode(enc)
                            break
                        except UnicodeDecodeError:
                            continue
                    if text is None:
                        continue
                    texts[name] = BeautifulSoup(text, "html.parser").get_text(" ", strip=True)
        except zipfile.BadZipFile:
            print(f"  [경고] rcept_no={rcept_no} 문서를 압축 해제할 수 없습니다.")
        return texts

    # ---- 지분 관련 ----
    def get_largest_shareholder_status(self, corp_code, bsns_year, reprt_code):
        data = self._get("hyslrSttus.json", {"corp_code": corp_code, "bsns_year": str(bsns_year), "reprt_code": reprt_code})
        return data.get("list", []) if data.get("status") == "000" else []

    def get_largest_shareholder_changes(self, corp_code, bsns_year, reprt_code):
        data = self._get(
            "hyslrChgSttus.json", {"corp_code": corp_code, "bsns_year": str(bsns_year), "reprt_code": reprt_code}
        )
        return data.get("list", []) if data.get("status") == "000" else []

    def get_minor_shareholder_status(self, corp_code, bsns_year, reprt_code):
        data = self._get("mrhlSttus.json", {"corp_code": corp_code, "bsns_year": str(bsns_year), "reprt_code": reprt_code})
        return data.get("list", []) if data.get("status") == "000" else []

    def get_bulk_holding_reports(self, corp_code):
        data = self._get("majorstock.json", {"corp_code": corp_code})
        return data.get("list", []) if data.get("status") == "000" else []

    def get_exec_holding_reports(self, corp_code):
        data = self._get("elestock.json", {"corp_code": corp_code})
        return data.get("list", []) if data.get("status") == "000" else []


# ---------------------------------------------------------------------------
# 수집/가공 로직
# ---------------------------------------------------------------------------

def collect_financial_statements(client: DartClient, corp_code, years, reprt_codes) -> pd.DataFrame:
    rows = []
    for year in years:
        for reprt_code in reprt_codes:
            for fs_div in ("CFS", "OFS"):
                print(f"[재무제표] {year}년 {REPRT_CODES.get(reprt_code, reprt_code)} / {FS_NAMES[fs_div]} 조회 중...")
                items = client.get_financials(corp_code, year, reprt_code, fs_div)
                for it in items:
                    it["fs_div"] = fs_div
                    it["bsns_year_req"] = year
                    it["reprt_code_req"] = reprt_code
                rows.extend(items)
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    for col in ("thstrm_amount", "frmtrm_amount", "bfefrmtrm_amount"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col].astype(str).str.replace(",", ""), errors="coerce")
    if "account_id" not in df.columns:
        df["account_id"] = df["account_nm"]
    return df


def build_statement_tables(fin_df: pd.DataFrame) -> dict:
    """연결/별도 x 재무제표종류 별로 계정과목 x 기간 피벗 테이블을 만든다.
    account_nm 은 서로 다른 계정에도 동일한 이름이 쓰이는 경우가 있어 account_id 를
    실제 피벗 키로 쓰고, 화면에는 account_nm 을 보여준다."""
    tables = {}
    if fin_df.empty:
        return tables
    df = fin_df.copy()
    df["period"] = df["bsns_year_req"].astype(str) + "_" + df["reprt_code_req"].astype(str)
    for (fs_div, sj_div), g in df.groupby(["fs_div", "sj_div"]):
        order_source = g.sort_values("ord") if "ord" in g.columns else g
        order_map = order_source.drop_duplicates("account_id")[["account_id", "account_nm"]]
        pivot = g.pivot_table(index="account_id", columns="period", values="thstrm_amount", aggfunc="last")
        pivot = pivot.reindex(order_map["account_id"])
        pivot.insert(0, "계정과목", order_map.set_index("account_id")["account_nm"])
        pivot = pivot.reset_index(drop=True)
        sheet_name = f"{FS_NAMES.get(fs_div, fs_div)}_{SJ_NAMES.get(sj_div, sj_div)}"[:31]
        tables[sheet_name] = pivot
    return tables


def compute_key_ratios(fin_df: pd.DataFrame) -> pd.DataFrame:
    if fin_df.empty:
        return pd.DataFrame()
    sub = fin_df[fin_df["account_nm"].isin(KEY_RATIO_ACCOUNTS)]
    if sub.empty:
        return pd.DataFrame()
    piv = sub.pivot_table(
        index=["fs_div", "bsns_year_req", "reprt_code_req"], columns="account_nm", values="thstrm_amount", aggfunc="last"
    ).reset_index()
    for col in KEY_RATIO_ACCOUNTS:
        if col not in piv.columns:
            piv[col] = pd.NA
    piv["부채비율(%)"] = piv["부채총계"] / piv["자본총계"] * 100
    piv["유동비율(%)"] = piv["유동자산"] / piv["유동부채"] * 100
    piv["영업이익률(%)"] = piv["영업이익"] / piv["매출액"] * 100
    piv["순이익률(%)"] = piv["당기순이익"] / piv["매출액"] * 100
    piv["회사구분"] = piv["fs_div"].map(FS_NAMES)
    piv["보고서"] = piv["reprt_code_req"].map(REPRT_CODES)
    return piv


def detect_notable_items(fin_df: pd.DataFrame, ratio_df: pd.DataFrame) -> pd.DataFrame:
    flags = []
    for _, row in fin_df.iterrows():
        thstrm, frmtrm, name = row.get("thstrm_amount"), row.get("frmtrm_amount"), row.get("account_nm", "")
        reasons = []
        if pd.notna(thstrm) and pd.notna(frmtrm):
            if frmtrm != 0:
                pct = (thstrm - frmtrm) / abs(frmtrm)
                if (thstrm >= 0) != (frmtrm >= 0):
                    reasons.append(f"전년 대비 부호 반전({'흑자전환' if thstrm >= 0 else '적자전환'})")
                elif abs(pct) >= YOY_THRESHOLD:
                    reasons.append(f"전년 대비 {pct:+.1%} 변동")
            elif thstrm != 0:
                reasons.append("전년도 값이 0이었으나 당기 신규 발생")
        for kw, desc in NOTE_KEYWORDS.items():
            if kw in str(name):
                reasons.append(f"확인 필요 계정({kw}): {desc}")
        if reasons:
            flags.append(
                {
                    "회사구분": FS_NAMES.get(row.get("fs_div"), row.get("fs_div")),
                    "보고서": REPRT_CODES.get(row.get("reprt_code_req"), row.get("reprt_code_req")),
                    "사업연도": row.get("bsns_year_req"),
                    "재무제표": SJ_NAMES.get(row.get("sj_div"), row.get("sj_div")),
                    "계정과목": name,
                    "당기금액": thstrm,
                    "전기금액": frmtrm,
                    "특이사항": "; ".join(reasons),
                }
            )
    for _, r in ratio_df.iterrows():
        msgs = []
        if pd.notna(r.get("부채비율(%)")) and r["부채비율(%)"] > 200:
            msgs.append(f"부채비율 {r['부채비율(%)']:.0f}% (200% 초과, 재무레버리지 과다 가능성)")
        if pd.notna(r.get("유동비율(%)")) and r["유동비율(%)"] < 100:
            msgs.append(f"유동비율 {r['유동비율(%)']:.0f}% (100% 미만, 단기 유동성 위험 가능성)")
        if pd.notna(r.get("자본총계")) and r["자본총계"] < 0:
            msgs.append("자본총계 마이너스(완전자본잠식 가능성)")
        if msgs:
            flags.append(
                {
                    "회사구분": r["회사구분"],
                    "보고서": r["보고서"],
                    "사업연도": r["bsns_year_req"],
                    "재무제표": "핵심비율",
                    "계정과목": "부채비율/유동비율/자본총계",
                    "당기금액": None,
                    "전기금액": None,
                    "특이사항": "; ".join(msgs),
                }
            )
    return pd.DataFrame(flags)


def collect_shareholding(client: DartClient, corp_code, years, reprt_codes) -> dict:
    largest, changes, minor = [], [], []
    for year in years:
        for reprt_code in reprt_codes:
            largest.extend(client.get_largest_shareholder_status(corp_code, year, reprt_code) or [])
            changes.extend(client.get_largest_shareholder_changes(corp_code, year, reprt_code) or [])
            minor.extend(client.get_minor_shareholder_status(corp_code, year, reprt_code) or [])
    return {
        "최대주주현황": pd.DataFrame(largest),
        "최대주주변동현황": pd.DataFrame(changes),
        "소액주주현황": pd.DataFrame(minor),
        "대량보유상황보고(5%rule)": pd.DataFrame(client.get_bulk_holding_reports(corp_code) or []),
        "임원ㆍ주요주주소유보고": pd.DataFrame(client.get_exec_holding_reports(corp_code) or []),
    }


def find_annual_report(client: DartClient, corp_code, year):
    reports = client.search_disclosures(corp_code, f"{year}0101", f"{year + 1}0630", pblntf_ty="A")
    candidates = [r for r in reports if "사업보고서" in r.get("report_nm", "")]
    if not candidates:
        return None
    candidates.sort(key=lambda r: r.get("rcept_dt", ""), reverse=True)
    return candidates[0]


def analyze_annual_reports(client: DartClient, corp_code, years, max_snippets_per_kw=3, segment_context=250):
    """사업보고서 원문을 내려받아 (1) 리스크 관련 주석 키워드 발췌, (2) 부문별 손익 언급
    구간을 텍스트 검색으로 찾아낸다. DART Open API는 주석/세그먼트를 구조화된 형태로
    제공하지 않으므로 정확한 수치는 반드시 원문 링크에서 직접 확인해야 한다."""
    footnote_rows, segment_rows = [], []
    for year in years:
        report = find_annual_report(client, corp_code, year)
        if not report:
            print(f"  [안내] {year}년 사업보고서를 찾지 못해 원문 분석을 건너뜁니다.")
            continue
        rcept_no = report["rcept_no"]
        print(f"[원문 분석] {year}년 사업보고서(rcept_no={rcept_no}) 다운로드 중...")
        texts = client.download_document_texts(rcept_no)
        full_text = " ".join(texts.values())
        link = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}"

        for kw, desc in NOTE_KEYWORDS.items():
            count = 0
            for m in re.finditer(re.escape(kw), full_text):
                if count >= max_snippets_per_kw:
                    break
                start, end_idx = max(0, m.start() - 80), min(len(full_text), m.end() + 120)
                footnote_rows.append(
                    {
                        "사업연도": year,
                        "키워드": kw,
                        "설명": desc,
                        "발췌": full_text[start:end_idx].strip(),
                        "rcept_no": rcept_no,
                        "원문링크": link,
                    }
                )
                count += 1

        seen_windows = set()
        for m in re.finditer(r"부문", full_text):
            window = full_text[max(0, m.start() - 50): m.start() + segment_context].strip()
            if window in seen_windows:
                continue
            if any(k in window for k in ("매출", "영업손익", "영업이익")):
                seen_windows.add(window)
                segment_rows.append({"사업연도": year, "발췌": window, "rcept_no": rcept_no, "원문링크": link})
            if len(seen_windows) >= 15:
                break

    footnote_df = pd.DataFrame(footnote_rows)
    segment_df = pd.DataFrame(segment_rows)
    return footnote_df, segment_df


# ---------------------------------------------------------------------------
# 출력
# ---------------------------------------------------------------------------

def write_excel(path, company_overview, tables, ratio_df, notable_df, share, footnote_df, segment_df):
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        overview_df = pd.DataFrame([{k: v for k, v in company_overview.items() if k not in ("status", "message")}])
        overview_df.to_excel(writer, sheet_name="회사개요", index=False)

        for name, df in tables.items():
            df.to_excel(writer, sheet_name=name, index=False)

        (ratio_df if not ratio_df.empty else pd.DataFrame({"안내": ["핵심 비율을 계산할 계정을 찾지 못했습니다."]})).to_excel(
            writer, sheet_name="핵심_재무비율", index=False
        )
        (notable_df if not notable_df.empty else pd.DataFrame({"안내": ["탐지된 특이사항이 없습니다."]})).to_excel(
            writer, sheet_name="특이사항_요약", index=False
        )
        for name, df in share.items():
            (df if not df.empty else pd.DataFrame({"안내": ["데이터가 없습니다."]})).to_excel(
                writer, sheet_name=name[:31], index=False
            )
        (footnote_df if not footnote_df.empty else pd.DataFrame({"안내": ["주석 키워드 스캔 결과가 없습니다."]})).to_excel(
            writer, sheet_name="주석_키워드스캔", index=False
        )
        (segment_df if not segment_df.empty else pd.DataFrame({"안내": ["부문 관련 언급을 찾지 못했습니다."]})).to_excel(
            writer, sheet_name="부문별_원문발췌", index=False
        )


def print_summary(corp_info, notable_df, share, footnote_df):
    print("\n" + "=" * 60)
    print(f" {corp_info['corp_name']} 재무 분석 요약")
    print("=" * 60)

    if not notable_df.empty:
        print(f"\n[재무제표 특이사항] {len(notable_df)}건 탐지 (최신순 상위 15건)")
        for _, r in notable_df.sort_values("사업연도", ascending=False).head(15).iterrows():
            print(f" - {r['사업연도']} {r['회사구분']} {r['재무제표']} '{r['계정과목']}': {r['특이사항']}")
    else:
        print(f"\n[재무제표 특이사항] 기준(전년대비 ±{YOY_THRESHOLD:.0%}, 부호 반전, 부채비율/유동비율 등)에 해당하는 항목이 없습니다.")

    largest = share.get("최대주주현황")
    if largest is not None and not largest.empty:
        print("\n[최대주주 및 특수관계인 보유 현황] (수집된 데이터 중 최근 항목)")
        cols = [
            c
            for c in (
                "bsns_year",
                "nm",
                "relate",
                "stock_knd",
                "trmend_posesn_stock_co",
                "trmend_posesn_stock_qota_rt",
            )
            if c in largest.columns
        ]
        print(largest[cols].tail(10).to_string(index=False) if cols else largest.tail(10).to_string(index=False))

    if not footnote_df.empty:
        print(f"\n[주석 키워드 스캔] {footnote_df['키워드'].nunique()}개 항목 발견 (상세는 엑셀 '주석_키워드스캔' 시트 참고)")
        for kw, g in footnote_df.groupby("키워드"):
            print(f" - {kw}: {NOTE_KEYWORDS.get(kw, '')} (해당연도: {sorted(g['사업연도'].unique())})")
    else:
        print("\n[주석 키워드 스캔] 리스크 관련 키워드가 원문에서 발견되지 않았습니다.")

    print(
        "\n[안내] 위 요약은 공시 원문에 대한 자동 키워드 스캔/수치 비교 결과이며 회계·법률적 판단을"
        " 대신하지 않습니다. 세부 수치와 부문별 손익은 각 rcept_no의 DART 원문 링크에서 직접 확인하세요."
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(description="DART 공시 기반 기업 재무제표 통합 수집·분석 도구")
    p.add_argument("--corp", required=True, help="회사명 또는 8자리 corp_code (예: 삼성전자)")
    p.add_argument("--start-year", type=int, required=True, help="조회 시작 사업연도 (예: 2021)")
    p.add_argument("--end-year", type=int, required=True, help="조회 종료 사업연도 (예: 2023)")
    p.add_argument(
        "--reprt-codes",
        default="11011",
        help="콤마로 구분된 보고서 코드. 11011=사업보고서(연간, 기본값), 11012=반기, 11013=1분기, 11014=3분기",
    )
    p.add_argument("--api-key", default=os.environ.get("DART_API_KEY"), help="DART Open API 인증키 (환경변수 DART_API_KEY로도 설정 가능)")
    p.add_argument("--out", default=None, help="결과 엑셀 파일 경로 (기본값: 회사명_DART분석_기간.xlsx)")
    p.add_argument("--skip-notes", action="store_true", help="사업보고서 원문 주석/부문 스캔을 건너뛰어 속도를 높임")
    return p.parse_args()


def main():
    args = parse_args()
    if not args.api_key:
        sys.exit(
            "DART API 키가 필요합니다. https://opendart.fss.or.kr 에서 무료로 발급받은 뒤 "
            "--api-key 옵션 또는 환경변수 DART_API_KEY로 전달하세요."
        )
    if args.start_year > args.end_year:
        sys.exit("--start-year 는 --end-year 보다 클 수 없습니다.")

    years = list(range(args.start_year, args.end_year + 1))
    reprt_codes = [c.strip() for c in args.reprt_codes.split(",") if c.strip()]
    unknown = [c for c in reprt_codes if c not in REPRT_CODES]
    if unknown:
        print(f"[경고] 알 수 없는 보고서 코드입니다(그대로 조회 시도): {unknown}")

    client = DartClient(args.api_key)
    corp_info = client.find_corp_code(args.corp)
    corp_code = corp_info["corp_code"]
    print(f"[대상 기업] {corp_info['corp_name']} (corp_code={corp_code}, 종목코드={corp_info.get('stock_code') or '비상장'})")

    company_overview = client.get_company(corp_code)
    fin_df = collect_financial_statements(client, corp_code, years, reprt_codes)
    ratio_df = compute_key_ratios(fin_df)
    notable_df = detect_notable_items(fin_df, ratio_df)
    tables = build_statement_tables(fin_df)
    share = collect_shareholding(client, corp_code, years, reprt_codes)

    if not args.skip_notes:
        footnote_df, segment_df = analyze_annual_reports(client, corp_code, years)
    else:
        footnote_df, segment_df = pd.DataFrame(), pd.DataFrame()

    out_path = args.out or f"{corp_info['corp_name']}_DART분석_{args.start_year}-{args.end_year}.xlsx"
    write_excel(out_path, company_overview, tables, ratio_df, notable_df, share, footnote_df, segment_df)
    print_summary(corp_info, notable_df, share, footnote_df)
    print(f"\n[완료] 결과가 저장되었습니다: {out_path}")


if __name__ == "__main__":
    main()
