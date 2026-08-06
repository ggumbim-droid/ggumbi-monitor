"use client";

// ══════════════════════════════════════════════════
//  원부 사전 — 프로토타입(wonbu-dictionary-system.html) 이식
//
//  ▶ 바뀐 것은 세 곳뿐입니다
//    1. window.storage        → /api/wonbu, /api/wonbu/benchmarks (Vercel KV)
//    2. api.anthropic.com 직접 호출 → /api/wonbu/ai (서버 경유, 키 비노출)
//    3. 네이버쇼핑 상위 20위 자동조회 → 종료 안내 (아래 SHOP_RANK_DISCONTINUED)
//
//  ▶ 스타일은 원본 CSS를 그대로 씁니다.
//    Tailwind로 다시 쓰면 화면이 조용히 달라지므로 건드리지 않았습니다.
//    다만 body/label/input 같은 전역 선택자는 .wonbu-root 아래로 묶어
//    대시보드의 다른 화면에 새지 않게 했습니다.
// ══════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";

const BRANDS = [
  "꿈비", "오가닉그라운드", "바바디토", "파미야", "소브",
  "G7커피", "뉴어스", "봄봄매트", "슈슈비", "리코코",
];

// 네이버 쇼핑 검색 오픈API가 종료되어 상위노출 자동조회는 제공되지 않습니다.
// 대체 소스를 붙이면 false 로 바꾸고 조회 로직을 되살리면 됩니다.
const SHOP_RANK_DISCONTINUED = true;

interface Keyword {
  term: string;
  volume: string;
  source: "manual" | "auto";
}

interface Entry {
  id: string;
  brand: string;
  category: string;
  name: string;
  repOption: string;
  keywords: { term: string; volume: number }[];
  func: string;
  cert: string;
  ban: string;
  note: string;
}

interface Analysis {
  topKeywords?: string[];
  pattern?: string;
  gapKeywords?: string[];
}

interface Benchmark {
  id: string;
  brand: string;
  query: string;
  rawNames: string[];
  analysis: Analysis;
  date: string;
}

interface Insight {
  summary?: string;
  guideLinks?: { finding: string; principle: string }[];
  template?: string;
  example?: string;
}

interface Candidate {
  name: string;
  reason: string;
}

const EMPTY_FORM = {
  brand: BRANDS[0],
  category: "",
  name: "",
  repOption: "",
  func: "",
  cert: "",
  ban: "",
  note: "",
};

export default function WonbuPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeBrand, setActiveBrand] = useState("전체");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [kwRows, setKwRows] = useState<Keyword[]>([{ term: "", volume: "", source: "manual" }]);
  const [lookingUp, setLookingUp] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [guideOpen, setGuideOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [benchOpen, setBenchOpen] = useState(false);

  const [benchBrand, setBenchBrand] = useState(BRANDS[0]);
  const [benchQuery, setBenchQuery] = useState("");
  const [benchManual, setBenchManual] = useState("");
  const [benchStatus, setBenchStatus] = useState("");
  const [benchStatusErr, setBenchStatusErr] = useState(false);
  const [benchBusy, setBenchBusy] = useState(false);
  const [benchResult, setBenchResult] = useState<Analysis | null>(null);

  const [insightBusy, setInsightBusy] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [insightMsg, setInsightMsg] = useState("");

  const [genBrand, setGenBrand] = useState("");
  const [genCount, setGenCount] = useState("10");
  const [useBenchGaps, setUseBenchGaps] = useState(true);
  const [genBusy, setGenBusy] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // ---------- load ----------
  useEffect(() => {
    (async () => {
      try {
        const [eRes, bRes] = await Promise.all([
          fetch("/api/wonbu"),
          fetch("/api/wonbu/benchmarks"),
        ]);
        const eData = await eRes.json();
        const bData = await bRes.json();
        if (eData.error) {
          setLoadError(eData.error);
          return;
        }
        setEntries(eData.entries ?? []);
        setBenchmarks(bData.benchmarks ?? []);
      } catch {
        setLoadError("저장소를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
      }
    })();
  }, []);

  const brandsInUse = Array.from(new Set(entries.map((e) => e.brand)));

  useEffect(() => {
    if (!genBrand && brandsInUse.length) setGenBrand(brandsInUse[0]);
  }, [brandsInUse, genBrand]);

  const filtered = activeBrand === "전체" ? entries : entries.filter((e) => e.brand === activeBrand);

  // ---------- keyword rows ----------
  const setRow = (i: number, patch: Partial<Keyword>) =>
    setKwRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const lookupVolume = useCallback(
    async (i: number, term: string) => {
      if (!term.trim()) return;
      setLookingUp(i);
      try {
        const res = await fetch(`/api/naver/keyword-volume?keyword=${encodeURIComponent(term.trim())}`);
        const data = await res.json();
        if (res.ok && typeof data.monthlyTotal === "number") {
          setRow(i, { volume: String(data.monthlyTotal), source: "auto" });
        } else {
          setRow(i, { source: "manual" });
        }
      } catch {
        setRow(i, { source: "manual" });
      } finally {
        setLookingUp(null);
      }
    },
    []
  );

  // ---------- form ----------
  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setForm({
      brand: entry.brand || BRANDS[0],
      category: entry.category || "",
      name: entry.name || "",
      repOption: entry.repOption || "",
      func: entry.func || "",
      cert: entry.cert || "",
      ban: entry.ban || "",
      note: entry.note || "",
    });
    setKwRows(
      entry.keywords?.length
        ? entry.keywords.map((k) => ({ term: k.term, volume: String(k.volume ?? ""), source: "manual" as const }))
        : [{ term: "", volume: "", source: "manual" }]
    );
    setFormOpen(true);
    document.getElementById("wonbu-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setKwRows([{ term: "", volume: "", source: "manual" }]);
  }

  async function save() {
    if (!form.name.trim()) {
      alert("원부명을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: editingId ?? undefined,
        ...form,
        keywords: kwRows
          .filter((k) => k.term.trim())
          .map((k) => ({ term: k.term.trim(), volume: parseInt(k.volume, 10) || 0 })),
      };
      const res = await fetch("/api/wonbu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "저장에 실패했습니다.");
        return;
      }
      setEntries(data.entries ?? []);
      resetForm();
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 원부를 삭제할까요?")) return;
    const res = await fetch(`/api/wonbu?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "삭제에 실패했습니다.");
      return;
    }
    setEntries(data.entries ?? []);
  }

  // ---------- benchmarking ----------
  async function analyzeBenchmark() {
    const lines = benchManual.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert("분석할 경쟁사 상품명을 입력해주세요.");
      return;
    }
    const ourKeywords = Array.from(
      new Set(entries.filter((e) => e.brand === benchBrand).flatMap((e) => (e.keywords ?? []).map((k) => k.term)))
    );

    setBenchBusy(true);
    setBenchResult(null);
    try {
      const res = await fetch("/api/wonbu/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "analyze", brand: benchBrand, lines, ourKeywords }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBenchStatus(data.error ?? "분석 중 오류가 발생했습니다.");
        setBenchStatusErr(true);
        return;
      }
      const analysis: Analysis = data.result;
      setBenchResult(analysis);

      const saveRes = await fetch("/api/wonbu/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: benchBrand,
          query: benchQuery.trim() || "(미입력)",
          rawNames: lines,
          analysis,
        }),
      });
      const saved = await saveRes.json();
      if (saveRes.ok) setBenchmarks(saved.benchmarks ?? []);
    } catch {
      setBenchStatus("분석 중 오류가 발생했습니다. 다시 시도해주세요.");
      setBenchStatusErr(true);
    } finally {
      setBenchBusy(false);
    }
  }

  async function deleteBenchmark(id: string) {
    const res = await fetch(`/api/wonbu/benchmarks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) setBenchmarks(data.benchmarks ?? []);
  }

  async function deriveInsight() {
    const brandBenchmarks = benchmarks.filter((b) => b.brand === benchBrand);
    if (brandBenchmarks.length === 0) {
      setInsightMsg('이 브랜드의 벤치마킹 이력이 없습니다. 먼저 위에서 검색어를 넣고 "분석하기"를 한 번 이상 실행해주세요.');
      setInsight(null);
      return;
    }
    setInsightBusy(true);
    setInsightMsg("전체 이력 종합 분석 중...");
    setInsight(null);
    try {
      const allRawNames = brandBenchmarks.flatMap((b) => b.rawNames);
      const allPatterns = brandBenchmarks.map((b) => `- (${b.query}, ${b.date}) ${b.analysis.pattern ?? ""}`).join("\n");
      const allGapKeywords = Array.from(new Set(brandBenchmarks.flatMap((b) => b.analysis.gapKeywords ?? [])));
      const ourKeywords = Array.from(
        new Set(entries.filter((e) => e.brand === benchBrand).flatMap((e) => (e.keywords ?? []).map((k) => k.term)))
      );

      const res = await fetch("/api/wonbu/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "insight",
          brand: benchBrand,
          allRawNames,
          allPatterns,
          allGapKeywords,
          ourKeywords,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInsightMsg(data.error ?? "인사이트 도출에 실패했습니다.");
        return;
      }
      setInsight(data.result);
      setInsightMsg("");
    } catch {
      setInsightMsg("인사이트 도출에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setInsightBusy(false);
    }
  }

  // ---------- generator ----------
  async function generate() {
    if (!genBrand) {
      alert("등록된 원부가 있는 브랜드를 먼저 선택해주세요.");
      return;
    }
    const relevant = entries.filter((e) => e.brand === genBrand);
    const keywords = relevant.flatMap((e) => e.keywords ?? []);
    if (keywords.length === 0) {
      setGenMsg("이 브랜드에 등록된 키워드가 없습니다. 원부에 소비자용어 키워드를 추가해주세요.");
      setCandidates([]);
      return;
    }

    const split = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
    const banned = Array.from(new Set(relevant.flatMap((e) => split(e.ban ?? ""))));
    const certs = Array.from(new Set(relevant.flatMap((e) => split(e.cert ?? ""))));
    const repOptions = Array.from(new Set(relevant.map((e) => e.repOption).filter(Boolean)));
    const categories = Array.from(new Set(relevant.map((e) => e.category).filter(Boolean)));

    const latestBench = useBenchGaps
      ? benchmarks.slice().reverse().find((b) => b.brand === genBrand)
      : null;

    setGenBusy(true);
    setGenMsg("동의어 그룹핑 및 상품명 배치 중...");
    setCandidates([]);
    try {
      const res = await fetch("/api/wonbu/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate",
          brand: genBrand,
          count: parseInt(genCount, 10) || 3,
          keywords,
          categories,
          repOptions,
          certs,
          banned,
          gapKeywords: latestBench?.analysis.gapKeywords ?? [],
          benchPattern: latestBench?.analysis.pattern ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenMsg(data.error ?? "생성에 실패했습니다.");
        return;
      }
      setCandidates(data.result?.candidates ?? []);
      setGenMsg("");
    } catch {
      setGenMsg("생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setGenBusy(false);
    }
  }

  const brandBenchHistory = benchmarks.slice().reverse();

  return (
    <div className="wonbu-root">
      <style>{WONBU_CSS}</style>
      <div className="wrap">
        <header>
          <div>
            <div className="eyebrow">Fansumer Marketing · Keyword System</div>
            <h1>원부 사전</h1>
            <div className="subline">등록카테고리 → 원부 → 키워드 → 유사검색어 기반 상품명 생성 인프라</div>
          </div>
          <div className="stat">
            <b>{entries.length}</b>등록된 원부
          </div>
        </header>

        {loadError && <div className="env-warn show">⚠ {loadError}</div>}

        {/* ---------- 가이드 ---------- */}
        <div className="panel">
          <div className={`panel-head ${guideOpen ? "open" : ""}`} onClick={() => setGuideOpen((v) => !v)}>
            <span className="panel-title">📖 네이버쇼핑 SEO 공식 가이드 핵심 요약</span>
            <span className="toggle">{guideOpen ? "접기" : "펼치기"}</span>
          </div>
          <div className={`panel-body ${guideOpen ? "show" : ""}`}>
            <div className="guide-block">
              <div className="guide-title">랭킹 구조</div>
              <div className="guide-formula">적합도 × 인기도 × 신뢰도 × 선호도(N+스토어만)</div>
              <table className="guide-table">
                <tbody>
                  <tr><td className="gt-label">적합도</td><td>검색어와 상품명·브랜드/제조사·카테고리·속성·태그의 연관도. 카테고리 매칭이 잘못되면 판매량이 많아도 노출 안 됨.</td></tr>
                  <tr><td className="gt-label">인기도</td><td>클릭인기도(최근7일) + 판매인기도(최근2·7·30일, 주문수+매출액) + 리뷰인기도(카테고리별 상대점수) + 최신성(신상품 한시 가점). 프로모션·가격·배송혜택도 반영.</td></tr>
                  <tr><td className="gt-label">신뢰도</td><td>상품명 SEO / 이미지 SEO 위반 시 감점. 위반 시 상품뿐 아니라 판매자 스토어 전체에 페널티 가능.</td></tr>
                  <tr><td className="gt-label">선호도</td><td>N+스토어 한정. 사용자 성별·연령·클릭/구매/찜 이력 기반 개인화 노출.</td></tr>
                </tbody>
              </table>
            </div>

            <div className="guide-block">
              <div className="guide-title">상품명 작성 10대 유의사항</div>
              <ol className="guide-list">
                <li>브랜드·제조사·카테고리·모델명 등 <b>적합한 정보만</b> 기입 (엉뚱한 브랜드 나열 금지)</li>
                <li>배송/가격 혜택 문구는 <b>별도 필드</b>에 (상품명엔 넣지 않기)</li>
                <li><b>동의어 반복 금지</b> — 네이버가 자동으로 동의어 처리하므로 중복 기재는 어뷰징 판정</li>
                <li>수식어/홍보문구(타겟연령, 이벤트성 표현 등) 지양</li>
                <li>특수문자 과다 사용, 지나치게 긴 상품명 지양</li>
                <li>사회적 이슈 키워드(정치인명 등) 사용 불가 — 자동 저품질 처리 대상</li>
                <li>브랜드/제조사/카테고리 키워드 반복 기입 금지 (검색 노출에 도움 안 됨)</li>
                <li>금지 수식어 4종 — 가격(가성비·즉시할인·최저가·특가), 혜택/재고(사은품·증정·품절), 홍보성(MD추천·선착순·신상품), 기타(A급·st·공식·모음·정품)</li>
                <li>정확한 띄어쓰기 (너무 없거나 과도하게 많지 않도록)</li>
                <li>전화번호·셀러 식별코드(IP01, ST, _ES 등)·&quot;명품/고급&quot; 단어(모델명 예외) 사용 불가</li>
              </ol>
            </div>

            <div className="guide-block">
              <div className="guide-title">카테고리 / 속성 / 태그</div>
              <table className="guide-table">
                <tbody>
                  <tr><td className="gt-label">카테고리</td><td>반드시 <b>최하위 카테고리</b>로 등록. 여러 하위를 포괄하는 상위 카테고리는 등록 불가.</td></tr>
                  <tr><td className="gt-label">브랜드/제조사</td><td>자동완성에 뜨는 값으로 선택 (없을 때만 직접입력). 상품명보다 필드 등록이 우선.</td></tr>
                  <tr><td className="gt-label">속성</td><td>카테고리별 세부속성을 꼼꼼히 입력. 상품과 무관한 속성 과도하게 선택 시 오히려 노출 안 됨.</td></tr>
                  <tr><td className="gt-label">태그</td><td>네이버 태그 사전에 등록된 것만 유효. 카테고리·브랜드·판매자명과 중복되는 내용은 태그 사용 불가.</td></tr>
                </tbody>
              </table>
            </div>

            <div className="guide-block">
              <div className="guide-title">이미지 SEO</div>
              <div className="guide-text">500×500px 권장(최소 300px~최대 4000px), JPG, 400MB 미만. 정면 촬영 + 흰색/단색 배경 권장. 저품질 사례: 텍스트·워터마크 과다, 초점 흐림, 배경 어수선, 실제와 다른 이미지, 상품 2개 이상 노출, 색상만 다른 제품을 하나로 처리.</div>
            </div>

            <div className="guide-block">
              <div className="guide-title">어뷰징 = 판매자 전체 페널티</div>
              <div className="guide-text">① 가이드/약관 위배 ② 부정판매(가품, 악의적 주문취소) ③ 리뷰·판매실적 어뷰징(외부 이벤트 클릭 유도, 트래픽 리워드 프로그램) ④ 상품정보 어뷰징. 상품 단위가 아니라 <b>판매자 쇼핑몰 전체</b>에 패널티가 부과될 수 있음.</div>
            </div>

            <div className="guide-block">
              <div className="guide-title">기타 운영 참고</div>
              <div className="guide-text">
                · 상품정보 수정 자체는 페널티 없음, 단 랭킹은 <b>약 1일</b> 후 반영<br />
                · 카탈로그 정보 직접 수정 불가 → &apos;정보 수정요청&apos;으로 처리 (영업일 3일 소요)<br />
                · 그룹상품 전환 시 인기도·리뷰 합산까지 <b>1~2일</b> 소요<br />
                · 판매실적은 네이버페이 자동 연동, 클릭수는 네이버가 자체 집계
              </div>
            </div>

            <div className="guide-src">출처: join.shopping.naver.com 상품검색SEO가이드 (담당자 스크린샷 기반 정리)</div>
          </div>
        </div>

        {/* ---------- 브랜드 탭 ---------- */}
        <div className="tabs">
          {["전체", ...brandsInUse].map((b) => (
            <div
              key={b}
              className={`tab ${b === activeBrand ? "active" : ""}`}
              onClick={() => setActiveBrand(b)}
            >
              {b}
            </div>
          ))}
        </div>

        {/* ---------- 등록 폼 ---------- */}
        <div className="panel" id="wonbu-form">
          <div className={`panel-head ${formOpen ? "open" : ""}`} onClick={() => setFormOpen((v) => !v)}>
            <span className="panel-title">{editingId ? `원부 수정 중 — ${editingId}` : "+ 원부 추가"}</span>
            <span className="toggle">{formOpen ? "접기" : "펼치기"}</span>
          </div>
          <div className={`panel-body ${formOpen ? "show" : ""}`}>
            <div className="grid2">
              <div className="field">
                <label>브랜드</label>
                <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
                  {BRANDS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="field">
                <label>등록카테고리 (반드시 최하위 카테고리로)</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="예: 가구/인테리어>수납>이불장 (상위 포괄 카테고리는 등록 불가)"
                />
              </div>
            </div>
            <div className="field">
              <label>원부명(표준 / 사내 공식명)</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 폴리에틸렌 폼(PE Foam)"
              />
            </div>
            <div className="field">
              <label>대표옵션 (색상/용량/사이즈 중 가장 대표적인 것 1개 — 상품명에 포함 권장)</label>
              <input
                type="text"
                value={form.repOption}
                onChange={(e) => setForm({ ...form, repOption: e.target.value })}
                placeholder="예: 1500x2000mm, 그레이 / 성별 구분 상품은 남성·여성도 표기"
              />
            </div>

            <div className="field">
              <label>소비자용어 키워드 + 검색량 (네이버 검색광고 API / 키워드도구에서 확인한 수치)</label>
              <div>
                {kwRows.map((row, i) => (
                  <div className="kw-row" key={i}>
                    <input
                      type="text"
                      className="term"
                      placeholder="소비자용어 키워드 (예: 층간소음매트)"
                      value={row.term}
                      onChange={(e) => setRow(i, { term: e.target.value })}
                      onBlur={() => { if (!row.volume) lookupVolume(i, row.term); }}
                    />
                    <input
                      type="text"
                      className="vol"
                      placeholder="월 검색량"
                      value={row.volume}
                      onChange={(e) => setRow(i, { volume: e.target.value, source: "manual" })}
                    />
                    {row.volume && (
                      <span className={`vol-badge ${row.source}`}>{row.source === "auto" ? "자동" : "수동"}</span>
                    )}
                    <button
                      type="button"
                      className="lookup"
                      disabled={lookingUp === i}
                      onClick={() => lookupVolume(i, row.term)}
                    >
                      {lookingUp === i ? "..." : "조회"}
                    </button>
                    <button
                      type="button"
                      className="rm"
                      onClick={() => setKwRows((rows) => rows.filter((_, idx) => idx !== i))}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="btn-add-kw"
                type="button"
                onClick={() => setKwRows((rows) => [...rows, { term: "", volume: "", source: "manual" }])}
              >
                + 키워드 추가
              </button>
            </div>

            <div className="grid2">
              <div className="field">
                <label>기능/효능 (쉼표 구분)</label>
                <input type="text" value={form.func} onChange={(e) => setForm({ ...form, func: e.target.value })} placeholder="예: 층간소음차단, 완충" />
              </div>
              <div className="field">
                <label>인증/필수표기 (쉼표 구분)</label>
                <input type="text" value={form.cert} onChange={(e) => setForm({ ...form, cert: e.target.value })} placeholder="예: KC인증, 친환경인증" />
              </div>
            </div>
            <div className="field">
              <label>금칙어/주의 표현 (쉼표 구분 — 공정위 표시광고법 + 네이버 상품명 수식어 금지어)</label>
              <input type="text" value={form.ban} onChange={(e) => setForm({ ...form, ban: e.target.value })} placeholder="예: 완벽차단, 100%무독성, 최저가, 사은품, MD추천, 공식" />
              <div className="field-help">
                네이버 상품명 가이드상 금지 수식어 4종 — 가격(가성비·즉시할인·최저가·특가), 혜택/재고(사은품·증정·품절 등), 홍보성(MD추천·선착순·신상품 등), 기타(A급·st·공식·모음·정품 등)
              </div>
            </div>
            <div className="field">
              <label>비고</label>
              <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="선택 입력" />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "저장 중..." : editingId ? "수정 저장" : "저장"}
              </button>
              <button className="btn btn-ghost" onClick={() => { resetForm(); setFormOpen(false); }}>취소</button>
            </div>
          </div>
        </div>

        {/* ---------- 카드 ---------- */}
        <div className="cards">
          {filtered.length === 0 ? (
            <div className="empty">등록된 원부가 없습니다. 위 패널에서 추가해주세요.</div>
          ) : (
            filtered.map((e) => {
              const chips = (e.keywords ?? []).slice().sort((a, b) => (b.volume || 0) - (a.volume || 0));
              const certFlags = (e.cert || "").split(",").map((s) => s.trim()).filter(Boolean);
              const banFlags = (e.ban || "").split(",").map((s) => s.trim()).filter(Boolean);
              return (
                <div className="card" data-brand={e.brand} key={e.id}>
                  <div className="card-actions">
                    <span onClick={() => startEdit(e)}>수정</span>
                    <span onClick={() => remove(e.id)}>삭제</span>
                  </div>
                  <div className="card-id">{e.id}</div>
                  <div className="card-name">{e.name}</div>
                  <div className="card-cat">
                    {e.category || "-"}{e.repOption ? ` · 대표옵션: ${e.repOption}` : ""}
                  </div>
                  <div className="kw-chips">
                    {chips.length ? (
                      chips.map((k, i) => (
                        <span className="chip" key={i}>{k.term} <b>{k.volume || 0}</b></span>
                      ))
                    ) : (
                      <span className="card-func">키워드 없음</span>
                    )}
                  </div>
                  <div className="card-func">{e.func || ""}</div>
                  <div className="card-flags">
                    {certFlags.map((c, i) => <span className="flag cert" key={`c${i}`}>{c}</span>)}
                    {banFlags.map((c, i) => <span className="flag ban" key={`b${i}`}>주의: {c}</span>)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ---------- 벤치마킹 ---------- */}
        <div className="bench-panel">
          <div className={`panel-head ${benchOpen ? "open" : ""}`} onClick={() => setBenchOpen((v) => !v)}>
            <span className="panel-title">경쟁사 상위노출 벤치마킹</span>
            <span className="toggle">{benchOpen ? "접기" : "펼치기"}</span>
          </div>
          {benchOpen && (
            <div className="bench-body">
              <div className="grid2">
                <div className="field">
                  <label>비교 대상 브랜드 (우리 키워드 사전과 대조)</label>
                  <select value={benchBrand} onChange={(e) => setBenchBrand(e.target.value)}>
                    {BRANDS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>등록카테고리 대표 검색어</label>
                  <input
                    type="text"
                    value={benchQuery}
                    onChange={(e) => setBenchQuery(e.target.value)}
                    placeholder="예: 층간소음매트 (해당 카테고리에서 소비자가 실제 검색하는 대표어)"
                  />
                </div>
              </div>

              {SHOP_RANK_DISCONTINUED ? (
                <div className="notice-box">
                  <b>상위 20위 자동조회는 제공되지 않습니다.</b><br />
                  네이버 쇼핑 검색 오픈API가 종료되어 상품명을 자동으로 가져올 수 없습니다.
                  {benchQuery.trim() && (
                    <>
                      {" "}
                      <a
                        href={`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(benchQuery.trim())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        네이버쇼핑에서 &quot;{benchQuery.trim()}&quot; 검색하기 →
                      </a>
                    </>
                  )}
                  <br />
                  검색결과의 상품명을 복사해 아래에 붙여넣으면 분석은 그대로 동작합니다.
                </div>
              ) : null}

              {benchStatus && (
                <div className={`bench-status ${benchStatusErr ? "err" : ""}`}>{benchStatus}</div>
              )}

              <div className="field" style={{ marginTop: 10 }}>
                <label>상품명 붙여넣기 — 네이버쇼핑 검색결과에서 상품명 복사, 한 줄에 하나씩</label>
                <textarea
                  value={benchManual}
                  onChange={(e) => setBenchManual(e.target.value)}
                  placeholder={"예)\n층간소음 완충 놀이방매트 1500x2000\n아기 놀이매트 층간소음방지 접이식\n..."}
                />
              </div>
              <div className="btn-row">
                <button className="btn btn-primary" onClick={analyzeBenchmark} disabled={benchBusy}>
                  {benchBusy ? "분석 중..." : "분석하기"}
                </button>
              </div>

              {benchBusy && <div className="loading-dark">경쟁사 상품명 패턴 분석 중...</div>}

              {benchResult && (
                <div className="cand" style={{ marginTop: 12 }}>
                  <b>패턴</b>
                  <div className="pattern-line">{benchResult.pattern}</div>
                  <b style={{ display: "block", marginTop: 8 }}>우리 사전에 없는 갭 키워드</b>
                  <div className="gap-chips">
                    {(benchResult.gapKeywords ?? []).length ? (
                      (benchResult.gapKeywords ?? []).map((k, i) => <span className="gap-chip" key={i}>{k}</span>)
                    ) : (
                      <span className="pattern-line">없음</span>
                    )}
                  </div>
                </div>
              )}

              {brandBenchHistory.length > 0 && (
                <div className="bench-hist">
                  <div className="bench-hist-label">이전 벤치마킹 이력</div>
                  {brandBenchHistory.map((b) => (
                    <div className="bench-hist-item" key={b.id}>
                      <div className="bench-hist-head">
                        <span className="bench-hist-title">{b.brand} · &quot;{b.query}&quot; · {b.date}</span>
                        <span className="bench-hist-del" onClick={() => deleteBenchmark(b.id)}>삭제</span>
                      </div>
                      <div className="pattern-line">{b.analysis.pattern ?? ""}</div>
                      <div className="gap-chips">
                        {(b.analysis.gapKeywords ?? []).map((k, i) => <span className="gap-chip" key={i}>{k}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="insight-block">
                <div className="btn-row" style={{ marginTop: 14 }}>
                  <button className="btn btn-primary" onClick={deriveInsight} disabled={insightBusy}>
                    이 브랜드 벤치마킹 이력 전체로 인사이트 도출
                  </button>
                </div>
                <div className="field-help" style={{ marginTop: 4 }}>
                  선택된 브랜드의 저장된 벤치마킹 이력(여러 검색어 분석 결과) 전체를 모아 경쟁사 상품명 규칙성을 종합하고, 네이버 공식 가이드 원칙과 연결해 상품명 작성 권장안을 도출합니다.
                </div>
                {insightMsg && <div className="loading-dark">{insightMsg}</div>}
                {insight && (
                  <div className="insight-card">
                    <div className="insight-sec">
                      <div className="insight-sec-title">경쟁사 상품명 규칙성 종합</div>
                      <div className="insight-sec-body">{insight.summary}</div>
                    </div>
                    <div className="insight-sec">
                      <div className="insight-sec-title">네이버 가이드 원칙과의 연결</div>
                      {(insight.guideLinks ?? []).map((g, i) => (
                        <div className="insight-rule" key={i}>
                          <span className="tag">발견</span>
                          <span className="insight-sec-body">{g.finding} → <b>{g.principle}</b></span>
                        </div>
                      ))}
                    </div>
                    <div className="insight-sec">
                      <div className="insight-sec-title">권장 상품명 템플릿</div>
                      <div className="insight-tpl">{insight.template}</div>
                    </div>
                    <div className="insight-sec">
                      <div className="insight-sec-title">적용 예시</div>
                      <div className="insight-sec-body"><b>{insight.example}</b></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ---------- 상품명 생성 ---------- */}
        <div className="gen-panel">
          <div className="gen-title">상품명 후보 생성</div>
          <div className="gen-sub">선택한 브랜드의 등록된 원부 키워드를 모아 동의어 그룹핑 → 검색량순 배치 → 상품명 후보를 생성합니다.</div>
          <label className="checkline">
            <input type="checkbox" checked={useBenchGaps} onChange={(e) => setUseBenchGaps(e.target.checked)} />
            최근 경쟁사 벤치마킹 결과 반영 (해당 브랜드 분석 이력이 있을 때)
          </label>
          <div className="gen-controls">
            <select value={genBrand} onChange={(e) => setGenBrand(e.target.value)}>
              {brandsInUse.length ? (
                brandsInUse.map((b) => <option key={b} value={b}>{b}</option>)
              ) : (
                <option value="">등록된 브랜드 없음</option>
              )}
            </select>
            <select value={genCount} onChange={(e) => setGenCount(e.target.value)}>
              <option value="3">3개</option>
              <option value="5">5개</option>
              <option value="10">10개</option>
            </select>
            <button className="btn-gen" onClick={generate} disabled={genBusy}>상품명 후보 생성</button>
          </div>

          {genMsg && <div className="loading">{genMsg}</div>}

          {candidates.length > 0 && (
            <div className="gen-result">
              {candidates.map((c, i) => (
                <div className="cand" key={i}>
                  <span className="num">{i + 1}안</span>
                  <b>{c.name}</b>
                  <br />
                  <span className="cand-reason">{c.reason}</span>
                </div>
              ))}
            </div>
          )}

          <div className="note">
            * 이 결과는 네이버쇼핑 공식 상품검색SEO가이드(join.shopping.naver.com)와 등록된 원부 사전의 소비자용어 키워드·검색량을 기준으로 생성됩니다.<br />
            * 등록카테고리는 반드시 최하위 카테고리 기준으로 입력해야 하며, 상위 포괄 카테고리는 자동 등록이 불가합니다.<br />
            * 검색량 자동조회는 네이버 검색광고 API 키가 등록되어야 동작합니다. 미등록 시 수동 입력으로 진행하세요.
          </div>
        </div>
      </div>
    </div>
  );
}

// 원본 프로토타입 CSS. 전역 선택자(body/label/input/textarea)는 .wonbu-root 아래로
// 묶어서 대시보드의 다른 화면에 영향을 주지 않게 했습니다.
const WONBU_CSS = `
.wonbu-root {
  --bg: #EFF3EE; --paper: #FBFCFA; --ink: #1E2A22; --ink-soft: #5C6B61;
  --ink-faint: #92A196; --accent: #3F6659; --accent-deep: #2A4A40;
  --accent-soft: #DCEAE3; --caution: #A9762F; --caution-soft: #F3E7D2;
  --danger: #A8524A; --line: #D7DED8;
  --mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  --sans: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Segoe UI', sans-serif;
  background: var(--bg); color: var(--ink); font-family: var(--sans);
  padding: 32px 20px 80px; min-height: 100vh;
}
.wonbu-root * { box-sizing: border-box; }
.wonbu-root .wrap { max-width: 1080px; margin: 0 auto; }
.wonbu-root header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid var(--ink); padding-bottom: 16px; margin-bottom: 28px; }
.wonbu-root .eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: 0.12em; color: var(--accent); text-transform: uppercase; margin-bottom: 6px; }
.wonbu-root h1 { font-size: 26px; margin: 0; letter-spacing: -0.01em; }
.wonbu-root .subline { color: var(--ink-soft); font-size: 13px; margin-top: 4px; }
.wonbu-root .stat { font-family: var(--mono); font-size: 12px; color: var(--ink-soft); text-align: right; }
.wonbu-root .stat b { color: var(--accent-deep); font-size: 20px; display: block; font-family: var(--sans); }
.wonbu-root .env-warn { background: var(--caution-soft); color: var(--caution); border: 1px solid var(--caution); border-radius: 5px; padding: 12px 16px; font-size: 12.5px; line-height: 1.6; margin-bottom: 20px; }
.wonbu-root .tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
.wonbu-root .tab { font-family: var(--mono); font-size: 12px; padding: 6px 12px; border: 1px solid var(--line); border-radius: 3px; background: var(--paper); cursor: pointer; color: var(--ink-soft); }
.wonbu-root .tab.active { background: var(--accent-deep); color: #fff; border-color: var(--accent-deep); }
.wonbu-root .panel { background: var(--paper); border: 1px solid var(--line); border-radius: 6px; margin-bottom: 24px; overflow: hidden; }
.wonbu-root .panel-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; cursor: pointer; border-bottom: 1px solid transparent; }
.wonbu-root .panel-head.open { border-bottom-color: var(--line); }
.wonbu-root .panel-title { font-weight: 600; font-size: 14px; }
.wonbu-root .toggle { font-family: var(--mono); font-size: 12px; color: var(--ink-soft); }
.wonbu-root .panel-body { padding: 18px; display: none; }
.wonbu-root .panel-body.show { display: block; }
.wonbu-root .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.wonbu-root label { display: block; font-size: 11px; color: var(--ink-soft); margin-bottom: 4px; font-family: var(--mono); }
.wonbu-root input[type=text], .wonbu-root select, .wonbu-root textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 4px; font-family: var(--sans); font-size: 13px; background: #fff; color: var(--ink); }
.wonbu-root textarea { min-height: 110px; resize: vertical; }
.wonbu-root .field { margin-bottom: 12px; }
.wonbu-root .field-help { font-size: 10.5px; color: var(--ink-faint); margin-top: 4px; line-height: 1.5; }
.wonbu-root .kw-row { display: flex; gap: 8px; margin-bottom: 6px; align-items: center; }
.wonbu-root .kw-row input.term { flex: 1; }
.wonbu-root .kw-row input.vol { width: 110px; }
.wonbu-root .kw-row .rm { cursor: pointer; color: var(--danger); font-size: 12px; font-family: var(--mono); background: none; border: none; }
.wonbu-root .btn-add-kw { font-family: var(--mono); font-size: 12px; color: var(--accent); background: var(--accent-soft); border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-top: 2px; }
.wonbu-root .btn { font-family: var(--sans); font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 4px; border: none; cursor: pointer; }
.wonbu-root .btn:disabled { opacity: 0.6; cursor: default; }
.wonbu-root .btn-primary { background: var(--accent-deep); color: #fff; }
.wonbu-root .btn-ghost { background: transparent; color: var(--ink-soft); border: 1px solid var(--line); }
.wonbu-root .btn-row { display: flex; gap: 8px; margin-top: 14px; }
.wonbu-root .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 32px; }
.wonbu-root .card { background: var(--paper); border: 1px solid var(--line); border-radius: 4px; position: relative; padding: 16px 16px 14px; }
.wonbu-root .card::before { content: attr(data-brand); position: absolute; top: -1px; left: 16px; background: var(--accent-deep); color: #fff; font-family: var(--mono); font-size: 10px; letter-spacing: 0.04em; padding: 3px 8px; border-radius: 0 0 4px 4px; }
.wonbu-root .card-id { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); margin-top: 14px; }
.wonbu-root .card-name { font-size: 16px; font-weight: 700; margin: 4px 0 8px; }
.wonbu-root .card-cat { font-size: 12px; color: var(--ink-soft); margin-bottom: 10px; }
.wonbu-root .kw-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.wonbu-root .chip { font-family: var(--mono); font-size: 11px; background: var(--accent-soft); color: var(--accent-deep); padding: 3px 8px; border-radius: 3px; }
.wonbu-root .card-func { font-size: 12px; color: var(--ink-soft); margin-bottom: 6px; }
.wonbu-root .card-flags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.wonbu-root .flag { font-size: 10px; font-family: var(--mono); padding: 2px 7px; border-radius: 3px; }
.wonbu-root .flag.cert { background: var(--accent-soft); color: var(--accent-deep); }
.wonbu-root .flag.ban { background: var(--caution-soft); color: var(--caution); }
.wonbu-root .card-actions { position: absolute; top: 12px; right: 12px; display: flex; gap: 8px; }
.wonbu-root .card-actions span { cursor: pointer; font-size: 11px; color: var(--ink-faint); font-family: var(--mono); }
.wonbu-root .card-actions span:hover { color: var(--danger); }
.wonbu-root .empty { text-align: center; color: var(--ink-faint); font-size: 13px; padding: 40px 0; grid-column: 1 / -1; }
.wonbu-root .gen-panel { background: var(--accent-deep); color: #fff; border-radius: 6px; padding: 22px; }
.wonbu-root .gen-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.wonbu-root .gen-sub { font-size: 12px; color: #C7DCD3; margin-bottom: 16px; }
.wonbu-root .gen-controls { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.wonbu-root .gen-controls select { background: #fff; border: none; width: auto; }
.wonbu-root .btn-gen { background: #fff; color: var(--accent-deep); font-weight: 700; font-size: 13px; padding: 10px 20px; border-radius: 4px; border: none; cursor: pointer; }
.wonbu-root .btn-gen:disabled { opacity: 0.6; cursor: default; }
.wonbu-root .gen-result { background: rgba(255,255,255,0.08); border-radius: 5px; padding: 16px; margin-top: 6px; }
.wonbu-root .cand { background: #fff; color: var(--ink); border-radius: 4px; padding: 12px 14px; margin-bottom: 8px; font-size: 14px; line-height: 1.5; }
.wonbu-root .cand .num { font-family: var(--mono); color: var(--accent); font-size: 11px; margin-right: 6px; }
.wonbu-root .cand-reason { font-size: 12px; color: var(--ink-soft); }
.wonbu-root .loading { font-family: var(--mono); font-size: 12px; color: #C7DCD3; }
.wonbu-root .loading-dark { font-family: var(--mono); font-size: 12px; color: var(--ink-faint); margin-top: 10px; }
.wonbu-root .note { font-size: 11px; color: #A9BEB4; margin-top: 14px; line-height: 1.6; }
.wonbu-root .kw-row .lookup { font-family: var(--mono); font-size: 11px; color: var(--accent-deep); background: var(--accent-soft); border: none; padding: 7px 10px; border-radius: 3px; cursor: pointer; white-space: nowrap; }
.wonbu-root .kw-row .lookup:disabled { opacity: 0.5; cursor: default; }
.wonbu-root .vol-badge { font-family: var(--mono); font-size: 10px; padding: 2px 6px; border-radius: 3px; white-space: nowrap; }
.wonbu-root .vol-badge.auto { background: var(--accent-soft); color: var(--accent-deep); }
.wonbu-root .vol-badge.manual { background: var(--caution-soft); color: var(--caution); }
.wonbu-root .bench-panel { background: var(--paper); border: 1px solid var(--line); border-radius: 6px; margin-bottom: 24px; overflow: hidden; }
.wonbu-root .bench-body { padding: 18px; }
.wonbu-root .bench-status { font-family: var(--mono); font-size: 11px; color: var(--ink-faint); margin: 8px 0; }
.wonbu-root .bench-status.err { color: var(--caution); }
.wonbu-root .notice-box { background: var(--caution-soft); color: var(--caution); border: 1px solid var(--caution); border-radius: 5px; padding: 12px 14px; font-size: 12px; line-height: 1.7; margin: 10px 0; }
.wonbu-root .notice-box a { color: var(--accent-deep); font-weight: 700; }
.wonbu-root .bench-hist { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 14px; }
.wonbu-root .bench-hist-label { font-size: 12px; color: var(--ink-soft); margin-bottom: 8px; font-weight: 600; }
.wonbu-root .bench-hist-item { background: #fff; border: 1px solid var(--line); border-radius: 4px; padding: 12px 14px; margin-bottom: 10px; }
.wonbu-root .bench-hist-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.wonbu-root .bench-hist-title { font-size: 12px; font-weight: 700; font-family: var(--mono); }
.wonbu-root .bench-hist-del { font-size: 11px; color: var(--ink-faint); cursor: pointer; font-family: var(--mono); }
.wonbu-root .bench-hist-del:hover { color: var(--danger); }
.wonbu-root .gap-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.wonbu-root .gap-chip { font-family: var(--mono); font-size: 11px; background: var(--caution-soft); color: var(--caution); padding: 3px 8px; border-radius: 3px; }
.wonbu-root .pattern-line { font-size: 12px; color: var(--ink-soft); margin-top: 4px; line-height: 1.5; }
.wonbu-root .checkline { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #E4EFEA; margin-bottom: 12px; font-family: var(--sans); }
.wonbu-root .checkline input { width: auto; }
.wonbu-root .guide-block { margin-bottom: 20px; }
.wonbu-root .guide-title { font-size: 13px; font-weight: 700; color: var(--accent-deep); margin-bottom: 8px; }
.wonbu-root .guide-formula { font-family: var(--mono); font-size: 13px; background: var(--accent-soft); color: var(--accent-deep); padding: 8px 12px; border-radius: 4px; margin-bottom: 10px; display: inline-block; }
.wonbu-root .guide-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.wonbu-root .guide-table td { padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; line-height: 1.5; }
.wonbu-root .guide-table .gt-label { font-family: var(--mono); font-weight: 700; color: var(--accent-deep); width: 90px; white-space: nowrap; }
.wonbu-root .guide-list { margin: 0; padding-left: 18px; font-size: 12.5px; line-height: 1.8; color: var(--ink); }
.wonbu-root .guide-text { font-size: 12.5px; line-height: 1.7; color: var(--ink-soft); }
.wonbu-root .guide-src { font-size: 10.5px; color: var(--ink-faint); font-family: var(--mono); margin-top: 14px; border-top: 1px solid var(--line); padding-top: 10px; }
.wonbu-root .insight-block { margin-top: 4px; }
.wonbu-root .insight-card { background: var(--accent-deep); color: #fff; border-radius: 5px; padding: 18px; margin-top: 12px; }
.wonbu-root .insight-sec { margin-bottom: 14px; }
.wonbu-root .insight-sec:last-child { margin-bottom: 0; }
.wonbu-root .insight-sec-title { font-size: 12px; font-weight: 700; color: #BFE0D3; margin-bottom: 6px; }
.wonbu-root .insight-sec-body { font-size: 13px; line-height: 1.6; color: #fff; }
.wonbu-root .insight-tpl { font-family: var(--mono); font-size: 13px; background: rgba(255,255,255,0.12); padding: 10px 12px; border-radius: 4px; margin-top: 4px; }
.wonbu-root .insight-rule { display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-start; }
.wonbu-root .insight-rule .tag { font-family: var(--mono); font-size: 10px; background: rgba(255,255,255,0.15); padding: 2px 7px; border-radius: 3px; white-space: nowrap; margin-top: 1px; }
@media (max-width: 720px) {
  .wonbu-root .grid2, .wonbu-root .cards { grid-template-columns: 1fr; }
}
`;
