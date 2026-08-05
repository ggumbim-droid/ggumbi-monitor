"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { BRAND_INSIGHTS, BRAND_TREND_GROUPS, BRAND_RANKING_GROUPS, CATEGORY_TO_TREND_GID, type BrandInsight } from "@/lib/brand-insights";

const BRAND_COLORS = ["#f56b3d", "#10B981", "#45B7D1", "#8B5CF6", "#0EA5E9", "#EC4899", "#14B8A6", "#94A3B8"];
type Row = Record<string, string | number>;

interface KwBrand { name: string; keywords: string[] }
interface KwGroups { [key: string]: { label: string; brands: KwBrand[] } }

// 04 키워드 1페이지 노출 (브랜드 모니터링 ranking)
interface RankRow {
  keyword: string; volume: number; priceRank: string;
  blogCount: number; blogRanks: string; blogUrl: string;
  cafeCount: number; cafeUrl: string; blogSov: string; cafeSov: string; action: string;
}
interface RankGroup { name: string; brand: string; rows: RankRow[]; }

const STACK = [
  { label: "최근 3개월", value: "3months" },
  { label: "3년", value: "3years" },
];

function stateBadge(state: string) {
  if (state === "up") return <span className="text-emerald-700 bg-emerald-50 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">상승</span>;
  if (state === "down") return <span className="text-rose-700 bg-rose-50 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">하락</span>;
  return <span className="text-stone-500 bg-stone-100 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">유지</span>;
}
function Delta({ v }: { v: string }) {
  const n = parseFloat(v);
  if (!n || isNaN(n)) return <span className="text-stone-400">{v || "0"}</span>;
  const up = n > 0;
  return <span className={up ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>{up ? "▲" : "▼"} {Math.abs(n)}</span>;
}

interface TooltipEntry { name: string; value: number; color: string; }

// 날짜 포맷: "Mon Apr 01 2024 00:00:00 GMT+0900 (...)" → 짧게
function fmtTickDate(v: string): string {
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return `${d.getMonth() + 1}/${d.getDate()}`; // 4/1
}
function fmtFullDate(v: string): string {
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${m}.${day}`; // 2024.04.01
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "8px 10px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", minWidth: "140px" }}>
      <p style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>{fmtFullDate(label ?? "")}</p>
      {payload.map((e) => (
        <div key={e.name} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "1px 0" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: e.color, flexShrink: 0 }} />
          <span style={{ fontSize: "12px", color: "#6b7280", flex: 1 }}>{e.name}</span>
          <span style={{ fontSize: "12px", color: e.color }}>{typeof e.value === "number" ? e.value.toFixed(1) : e.value}</span>
        </div>
      ))}
    </div>
  );
}

// 브랜드에 매핑된 키워드 그룹들의 네이버 트렌드를 자동 조회.
// onData로 조회 결과(그룹별 차트 데이터·라벨·브랜드)를 부모에 전달해 순위표와 핑퐁 배치한다.
interface TrendState {
  brands: Record<string, string[]>;
  charts: Record<string, Record<string, Row[]>>;
  loaded: boolean;
}

// 개별 차트 슬롯 — 기본 기간(3개월/3년) 표시 + 날짜 달력으로 커스텀 기간 재조회
function TrendSlot({ cat, defLabel, brands, initialRows }: {
  cat: string; defLabel: string; brands: string[]; initialRows: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [custom, setCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // 상위에서 기본 데이터가 바뀌면(재조회 등) 커스텀이 아닐 때 갱신
  useEffect(() => { if (!custom) setRows(initialRows); }, [initialRows, custom]);

  async function query() {
    if (!start || !end) { setErr("시작일과 종료일을 선택하세요."); return; }
    if (start > end) { setErr("시작일이 종료일보다 늦습니다."); return; }
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/trend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: cat, period: "custom", customStart: start, customEnd: end }),
      });
      const data = await res.json();
      if (res.ok) { setRows((data.results ?? []) as Row[]); setCustom(true); }
      else setErr(data.error || "조회 실패");
    } catch { setErr("조회 중 오류"); }
    finally { setLoading(false); }
  }
  function reset() { setCustom(false); setStart(""); setEnd(""); setErr(""); setRows(initialRows); }

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <div className="text-[11px] font-semibold text-stone-500">
          {custom ? `${start} ~ ${end}` : `${defLabel} 추이`}
        </div>
      </div>
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
          className="text-[10px] border border-stone-200 rounded px-1.5 py-1 text-stone-600" />
        <span className="text-[10px] text-stone-400">~</span>
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
          className="text-[10px] border border-stone-200 rounded px-1.5 py-1 text-stone-600" />
        <button onClick={query} disabled={loading}
          className="text-[10px] font-semibold px-2 py-1 bg-kkumbi-500 text-white rounded hover:bg-kkumbi-600 disabled:opacity-50">
          {loading ? "조회중" : "조회"}
        </button>
        {custom && (
          <button onClick={reset} className="text-[10px] font-semibold px-2 py-1 bg-stone-100 text-stone-500 rounded hover:bg-stone-200">
            기본
          </button>
        )}
      </div>
      {err && <p className="text-[10px] text-rose-500 mb-1">{err}</p>}
      {rows.length === 0 ? (
        <p className="text-[11px] text-stone-300 py-8 text-center">데이터 없음</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="period" tickFormatter={fmtTickDate} tick={{ fontSize: 9, fill: "#94a3b8" }} minTickGap={30} />
            <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} width={28} />
            <Tooltip content={<TrendTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {brands.map((b, i) => (
              <Line key={b} type="monotone" dataKey={b} stroke={BRAND_COLORS[i % BRAND_COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function GroupTrendChart({ cat, brands, gCharts }: {
  cat: string; brands: string[]; gCharts?: Record<string, Row[]>;
}) {
  return (
    <div className="mb-2">
      <div className="text-xs font-bold text-stone-700 mb-2">{cat} · 검색 트렌드</div>
      {!gCharts ? (
        <p className="text-[11px] text-stone-300">불러오는 중…</p>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {STACK.map((pp) => {
            const rows = gCharts[pp.value];
            if (!rows || rows.length === 0) return null;
            return (
              <TrendSlot key={pp.value} cat={cat} defLabel={pp.label} brands={brands} initialRows={rows} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function useBrandTrend(cats: string[]) {
  const [state, setState] = useState<TrendState>({ brands: {}, charts: {}, loaded: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const catsKey = cats.join("|");

  const fetchAll = useCallback(async () => {
    if (cats.length === 0) return;
    setLoading(true); setError("");
    try {
      const charts: Record<string, Record<string, Row[]>> = {};
      const brands: Record<string, string[]> = {};
      for (const cat of cats) {
        charts[cat] = {};
        await Promise.all(STACK.map(async (pp) => {
          const res = await fetch("/api/trend", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groupId: cat, period: pp.value }),
          });
          const data = await res.json();
          if (res.ok) {
            charts[cat][pp.value] = (data.results ?? []) as Row[];
            if (Array.isArray(data.brands) && data.brands.length) brands[cat] = data.brands as string[];
          }
        }));
      }
      setState({ brands, charts, loaded: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
    // catsKey가 바뀔 때만 새로 만들면 충분합니다 (cats 배열은 매 렌더 새로 생성됨)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catsKey]);

  // 브랜드를 선택하면 버튼을 누르지 않아도 바로 불러옵니다.
  // (기존에는 "검색 트렌드 조회" 버튼을 눌러야만 그래프가 떴습니다)
  useEffect(() => {
    setState({ brands: {}, charts: {}, loaded: false });
    setError("");
    fetchAll();
  }, [fetchAll]);

  return { state, loading, error, fetchAll };
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-bold text-kkumbi-700 mb-2 flex items-center gap-1.5">
      <span className="w-1 h-3.5 bg-kkumbi-400 rounded-sm inline-block" />{children}
    </div>
  );
}

// 04 키워드 1페이지 노출(브랜드 모니터링) 실시간 조회. 브랜드에 매핑된 표(group.name)만 필터링.
function useRanking(brandId: string) {
  const names = BRAND_RANKING_GROUPS[brandId] ?? [];
  const [groups, setGroups] = useState<RankGroup[]>([]);
  const [updated, setUpdated] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function fetchRanking() {
    setLoading(true); setError(""); setLoaded(true);
    try {
      const res = await fetch("/api/brand-monitor?type=all");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "조회 실패");
      const all = (data?.ranking?.groups ?? []) as RankGroup[];
      setGroups(all.filter((g) => names.includes(g.name)));
      setUpdated(data?.ranking?.updated ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  return { names, groups, updated, loading, error, loaded, fetchRanking };
}

function RankingBlock({ brandId }: { brandId: string }) {
  const { names, groups, updated, loading, error, loaded, fetchRanking } = useRanking(brandId);
  if (names.length === 0) {
    return <p className="text-xs text-stone-400">이 브랜드에 연결된 1페이지 노출 표가 없습니다.</p>;
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <p className="text-[11px] text-stone-400">
          04 키워드 1페이지 노출 연동: {names.join(" · ")}{updated && ` · 최종 조회 ${updated}`}
        </p>
        <button onClick={fetchRanking} disabled={loading}
          className="text-xs font-semibold px-3 py-1.5 bg-kkumbi-500 text-white rounded-lg hover:bg-kkumbi-600 disabled:opacity-50">
          {loading ? "조회 중..." : loaded ? "다시 조회" : "1페이지 노출 조회"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}
      {!loaded && <p className="text-[11px] text-stone-400">※ 위 버튼을 누르면 사이드바 04와 동일한 최신 1페이지 노출 데이터를 불러옵니다.</p>}
      {loaded && !loading && groups.length === 0 && !error && (
        <p className="text-xs text-stone-400">연동된 표에 데이터가 없습니다.</p>
      )}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.name}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold text-stone-700">{g.name}</span>
              <span className="text-[10px] text-stone-400">브랜드: {g.brand}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-stone-400 text-left border-b border-stone-200">
                  <th className="py-1.5 px-2 font-medium">키워드</th>
                  <th className="py-1.5 px-2 font-medium text-center">월검색량</th>
                  <th className="py-1.5 px-2 font-medium text-center">가격비교</th>
                  <th className="py-1.5 px-2 font-medium text-center">블로그</th>
                  <th className="py-1.5 px-2 font-medium text-center">카페</th>
                  <th className="py-1.5 px-2 font-medium">점유율</th>
                </tr></thead>
                <tbody>
                  {g.rows.map((row) => (
                    <tr key={row.keyword} className="border-b border-stone-100">
                      <td className="py-1.5 px-2 font-semibold text-stone-800">{row.keyword}</td>
                      <td className="py-1.5 px-2 text-center text-stone-600">{Number(row.volume).toLocaleString()}</td>
                      <td className="py-1.5 px-2 text-center">
                        {row.priceRank !== "-" ? <span className="bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded">{row.priceRank}위</span> : <span className="text-stone-300">-</span>}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {row.blogCount > 0
                          ? <a href={row.blogUrl} target="_blank" rel="noopener noreferrer" className="bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded hover:underline">{row.blogCount}건 ({row.blogRanks})</a>
                          : <span className="text-stone-300">-</span>}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {row.cafeCount > 0
                          ? <a href={row.cafeUrl} target="_blank" rel="noopener noreferrer" className="bg-orange-50 text-orange-700 font-bold px-1.5 py-0.5 rounded hover:underline">{row.cafeCount}건</a>
                          : <span className="text-stone-300">-</span>}
                      </td>
                      <td className="py-1.5 px-2 text-stone-500">
                        {row.blogSov && <div><span className="text-stone-400">블로그</span> {row.blogSov}</div>}
                        {row.cafeSov && <div><span className="text-stone-400">카페</span> {row.cafeSov}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandPanel({ brand }: { brand: BrandInsight }) {
  const cats = brand.comp.map((b) => b.cat);
  const { state, loading, error, fetchAll } = useBrandTrend(cats);
  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-[11px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-md">① 경쟁사 인사이트</span>
          <span className="text-sm font-bold text-stone-800">검색 트렌드 · 주간 증감 · 특이사항</span>
        </div>

        {cats.length > 0 && (
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <p className="text-[11px] text-stone-400">연결된 검색 그룹: {cats.join(" · ")}</p>
            <button onClick={fetchAll} disabled={loading}
              className="text-xs font-semibold px-3 py-1.5 bg-white text-kkumbi-600 border border-kkumbi-300 rounded-lg hover:bg-kkumbi-50 disabled:opacity-50">
              {loading ? "불러오는 중..." : "새로고침"}
            </button>
          </div>
        )}
        {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}
        {loading && !state.loaded && cats.length > 0 && <p className="text-[11px] text-stone-400 mb-3">네이버 검색 트렌드(3개월·3년)를 불러오는 중입니다…</p>}

        <div className="space-y-3">
          {brand.comp.map((block, bi) => {
            const cat = block.cat; // 카테고리 이름을 그대로 그룹 id로 사용 (시트 탭명과 일치)
            // 그래프 브랜드 배열(색 순서와 동일) — 표 브랜드명을 여기서 찾아 같은 색 적용
            const chartBrands = state.brands[cat] ?? [];
            const colorOf = (name: string): string | undefined => {
              const idx = chartBrands.findIndex((cb) => cb === name);
              return idx >= 0 ? BRAND_COLORS[idx % BRAND_COLORS.length] : undefined;
            };
            // 표를 7일평균 내림차순 정렬 (그래프 상위 순서와 맞춤)
            const sortedRows = [...block.rows].sort((a, b) => {
              const av = parseFloat(a.idx); const bv = parseFloat(b.idx);
              if (isNaN(av) && isNaN(bv)) return 0;
              if (isNaN(av)) return 1;
              if (isNaN(bv)) return -1;
              return bv - av;
            });
            return (
              <div key={bi} className="border border-stone-200 rounded-xl p-4 bg-white">
                <GroupTrendChart cat={cat} brands={chartBrands} gCharts={state.charts[cat]} />
                <div className="font-bold text-sm text-stone-800 mb-3 mt-1">{block.cat} · 경쟁사 순위</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-stone-400 text-left">
                      <th className="py-1 px-1.5 font-medium">브랜드</th>
                      <th className="py-1 px-1.5 font-medium">기간</th>
                      <th className="py-1 px-1.5 font-medium">7일평균</th>
                      <th className="py-1 px-1.5 font-medium">증감</th>
                      <th className="py-1 px-1.5 font-medium">최고점</th>
                      <th className="py-1 px-1.5 font-medium">최고점 날짜</th>
                      <th className="py-1 px-1.5 font-medium">상태</th>
                    </tr></thead>
                    <tbody>
                      {sortedRows.map((r, i) => {
                        const c = colorOf(r.name);
                        return (
                        <tr key={i} className="border-t border-stone-100">
                          <td className="py-1.5 px-1.5 whitespace-nowrap font-bold" style={c ? { color: c } : undefined}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={c ? { background: c } : { background: "#cbd5e1" }} />
                            {r.name}
                          </td>
                          <td className="py-1.5 px-1.5 text-stone-500 whitespace-nowrap">{r.period || "—"}</td>
                          <td className="py-1.5 px-1.5 text-stone-800">{r.idx}</td>
                          <td className="py-1.5 px-1.5"><Delta v={r.delta} /></td>
                          <td className="py-1.5 px-1.5 text-stone-500">{r.pk && !isNaN(parseFloat(r.pk)) ? r.pk : "—"}</td>
                          <td className="py-1.5 px-1.5 text-stone-500 whitespace-nowrap">{r.pkDate || "—"}</td>
                          <td className="py-1.5 px-1.5">{stateBadge(r.state && isNaN(parseFloat(r.state)) ? r.state : "flat")}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {block.note && (
                  <div className="mt-3 bg-stone-50 border border-dashed border-stone-300 rounded-lg px-3 py-2.5">
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full">✎ 시트 연동</span>
                    <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line mt-1.5">{block.note}</p>
                  </div>
                )}
                {block.comment && (
                  <div className="mt-3 bg-amber-50 border-l-[3px] border-amber-400 rounded-r-lg px-3 py-2.5">
                    <span className="text-[10px] font-bold text-amber-700">📝 경쟁사 동향 인사이트</span>
                    <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-line mt-1">{block.comment}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-[11px] font-bold text-white bg-kkumbi-500 px-2 py-0.5 rounded-md">② 자사 인사이트</span>
          <span className="text-sm font-bold text-stone-800">목표 달성 현황 · 채널 진단</span>
        </div>
        <div className="border border-stone-200 rounded-xl p-4 bg-white space-y-5">
          <div>
            <SubLabel>네이버 쇼핑검색 순위 · 1페이지 노출 (04 연동)</SubLabel>
            <RankingBlock brandId={brand.id} />
          </div>

          {(() => {
            // selfRows(현황·해결방안 쌍)가 있으면 그것을, 없으면 기존 rankNote/improvement를 한 행으로
            const pairs = (brand.selfRows && brand.selfRows.length > 0)
              ? brand.selfRows
              : ((brand.rankNote || brand.improvement) ? [{ status: brand.rankNote, solution: brand.improvement }] : []);
            if (pairs.length === 0) return null;
            return (
              <div>
                <SubLabel>1페이지 노출 현황 · 해결방안</SubLabel>
                <div className="overflow-hidden border border-stone-200 rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left">
                        <th className="w-1/2 py-2 px-3 font-bold text-sky-700 bg-sky-50 border-b border-stone-200">🔍 현황</th>
                        <th className="w-1/2 py-2 px-3 font-bold text-kkumbi-700 bg-kkumbi-50 border-b border-l border-stone-200">💡 해결방안</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pairs.map((p, i) => (
                        <tr key={i} className="align-top border-b border-stone-100 last:border-b-0">
                          <td className="py-2.5 px-3 text-stone-700 leading-relaxed whitespace-pre-line">{p.status || "—"}</td>
                          <td className="py-2.5 px-3 text-stone-700 leading-relaxed whitespace-pre-line border-l border-stone-100 bg-kkumbi-50/30">{p.solution || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {brand.lastWork.length > 0 && (
            <div>
              <SubLabel>지난주 진행 업무 · 진행률 · 결과</SubLabel>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-stone-400 text-left border-b border-stone-200">
                    <th className="py-1.5 px-2 font-medium min-w-[130px]">진행 업무</th>
                    <th className="py-1.5 px-2 font-medium min-w-[150px]">세부 내용</th>
                    <th className="py-1.5 px-2 font-medium min-w-[90px]">진행률</th>
                    <th className="py-1.5 px-2 font-medium min-w-[180px]">결과 (잘된 점 · 아쉬운 점)</th>
                  </tr></thead>
                  <tbody>
                    {brand.lastWork.map((r, i) => {
                      const ach = parseFloat(r[2]);
                      const hasAch = !isNaN(ach);
                      const color = ach >= 80 ? "bg-emerald-500" : ach >= 40 ? "bg-amber-500" : "bg-rose-500";
                      const txt = ach >= 80 ? "text-emerald-700" : ach >= 40 ? "text-amber-700" : "text-rose-700";
                      return (
                        <tr key={i} className="border-b border-stone-100 align-top">
                          <td className="py-2 px-2 font-semibold text-stone-800 leading-snug whitespace-pre-line">{r[0]}</td>
                          <td className="py-2 px-2 text-stone-600 leading-snug whitespace-pre-line">{r[1] || "—"}</td>
                          <td className="py-2 px-2">
                            {hasAch ? (
                              <div className="flex items-center gap-1.5 min-w-[80px]">
                                <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${Math.min(100, ach)}%` }} /></div>
                                <span className={`text-[11px] font-bold ${txt}`}>{ach}%</span>
                              </div>
                            ) : <span className="text-stone-400">—</span>}
                          </td>
                          <td className="py-2 px-2 text-stone-600 leading-snug whitespace-pre-line">{r[3] || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(brand.ig.upload || brand.ig.good || brand.ig.bad || brand.igContents.length > 0) && (
            <div>
              <SubLabel>인스타그램 주간 인사이트</SubLabel>
              <div className="flex gap-2 mb-3 flex-wrap">
                <div className="flex-1 min-w-[120px] bg-stone-50 rounded-lg px-3 py-2.5">
                  <div className="text-[11px] text-stone-400 mb-0.5">업로드 콘텐츠</div>
                  <div className="text-base font-extrabold text-stone-800">{brand.ig.upload || "—"}<span className="text-xs font-medium text-stone-400"> 건</span></div>
                </div>
                <div className="flex-1 min-w-[120px] bg-stone-50 rounded-lg px-3 py-2.5">
                  <div className="text-[11px] text-stone-400 mb-0.5">팔로우 증감</div>
                  <div className="text-base font-extrabold text-stone-800">{brand.ig.follow || "—"}</div>
                </div>
              </div>
              {brand.igContents.length > 0 && (
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-xs">
                    <thead><tr className="text-stone-400 text-left border-b border-stone-200">
                      <th className="py-1.5 px-2 font-medium">콘텐츠</th>
                      <th className="py-1.5 px-2 font-medium">조회</th>
                      <th className="py-1.5 px-2 font-medium">도달</th>
                      <th className="py-1.5 px-2 font-medium">팔로우</th>
                      <th className="py-1.5 px-2 font-medium">공유</th>
                      <th className="py-1.5 px-2 font-medium">댓글</th>
                    </tr></thead>
                    <tbody>
                      {brand.igContents.map((c, i) => (
                        <tr key={i} className="border-b border-stone-100">
                          <td className="py-1.5 px-2 font-semibold text-stone-800">{c.name}</td>
                          <td className="py-1.5 px-2 text-stone-600">{c.views || "—"}</td>
                          <td className="py-1.5 px-2 text-stone-600">{c.reach || "—"}</td>
                          <td className="py-1.5 px-2 text-stone-600">{c.follows || "—"}</td>
                          <td className="py-1.5 px-2 text-stone-600">{c.shares || "—"}</td>
                          <td className="py-1.5 px-2 text-stone-600">{c.comments || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {brand.ig.good && (
                <div className="bg-teal-50 border-l-[3px] border-teal-400 rounded-r-lg px-3 py-2.5">
                  <div className="text-[11px] font-bold text-teal-700 mb-1">📸 인스타 인사이트</div>
                  <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-line">{brand.ig.good}</p>
                </div>
              )}
            </div>
          )}

        </div>
      </section>

      {brand.thisWeek.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[11px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-md">③ 금주 업무 · 목표</span>
            <span className="text-sm font-bold text-stone-800">금주 액션 플랜</span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {brand.thisWeek.map((s, i) => (
              <div key={i} className="border border-stone-200 border-l-[3px] border-l-emerald-500 rounded-r-lg p-3.5 bg-white">
                <div className="text-[10px] font-bold text-stone-400 tracking-wide mb-1">내용</div>
                <div className="font-bold text-sm text-stone-800 mb-2.5">{s[0]}</div>
                <div className="text-[10px] font-bold text-stone-400 tracking-wide mb-1">목표</div>
                <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-md leading-snug whitespace-pre-line mb-2.5">🎯 {s[1]}</div>
                {s[2] && <>
                  <div className="text-[10px] font-bold text-stone-400 tracking-wide mb-1">세부내용</div>
                  <p className="text-xs text-stone-500 leading-relaxed whitespace-pre-line">{s[2]}</p>
                </>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface SheetBrandData {
  comp?: BrandInsight["comp"];
  rankNote?: string; improvement?: string;
  selfRows?: { status: string; solution: string }[];
  lastWork?: string[][]; thisWeek?: string[][];
  ig?: { upload: string; follow: string; good: string; bad: string };
  igContents?: { name: string; views: string; reach: string; follows: string; shares: string; comments: string }[];
}

// 시트 실데이터를 예시(fallback) 위에 병합. 시트가 비어있는 필드는 예시를 그대로 유지.
function mergeBrand(base: BrandInsight, sheet?: SheetBrandData): BrandInsight {
  if (!sheet) return base;
  const merged: BrandInsight = { ...base };
  if (sheet.comp && sheet.comp.length > 0) merged.comp = sheet.comp;
  if (sheet.rankNote) merged.rankNote = sheet.rankNote;
  if (sheet.improvement) merged.improvement = sheet.improvement;
  if (sheet.selfRows && sheet.selfRows.length > 0) merged.selfRows = sheet.selfRows;
  if (sheet.lastWork && sheet.lastWork.length > 0) merged.lastWork = sheet.lastWork;
  if (sheet.thisWeek && sheet.thisWeek.length > 0) merged.thisWeek = sheet.thisWeek;
  if (sheet.ig && (sheet.ig.upload || sheet.ig.good || sheet.ig.bad || sheet.ig.follow)) merged.ig = sheet.ig;
  if (sheet.igContents && sheet.igContents.length > 0) merged.igContents = sheet.igContents;
  return merged;
}

// 대시보드 최초 로드 시의 주차(기본 선택 = 최근 주차)를 예시 주차로 간주.
// 그 주차에만 예시 폴백을 허용하고, 사용자가 다른 주차로 바꾸면 공란 처리한다.
// (특정 주차ID 값에 의존하지 않음)

// 시트 데이터가 없을 때 다른 주차에서 쓸 빈 브랜드 데이터(예시 없이 공란)
function emptyBrand(base: BrandInsight): BrandInsight {
  return {
    ...base,
    comp: [],
    rankNote: "", improvement: "",
    selfRows: [],
    supporters: "",
    lastWork: [], thisWeek: [],
    ig: { upload: "", follow: "", good: "", bad: "" },
    igContents: [],
  };
}

// 해당 브랜드의 시트 데이터가 실제로 채워졌는지
// comp(경쟁사 순위)는 주차 무관하게 항상 오므로 제외 — 주차별 입력 데이터로만 판정
function hasSheetData(sheet?: SheetBrandData): boolean {
  if (!sheet) return false;
  return Boolean(
    sheet.rankNote || sheet.improvement ||
    (sheet.selfRows && sheet.selfRows.length > 0) ||
    (sheet.lastWork && sheet.lastWork.length > 0) || (sheet.thisWeek && sheet.thisWeek.length > 0) ||
    (sheet.igContents && sheet.igContents.length > 0) ||
    (sheet.ig && (sheet.ig.upload || sheet.ig.good || sheet.ig.bad || sheet.ig.follow)) ||
    // 경쟁사 코멘트(comp[].comment)가 이 주차에 입력됐으면 데이터 있음으로 봄
    (Array.isArray(sheet.comp) && sheet.comp.some((c) => c && typeof c === "object" && "comment" in c && (c as { comment?: string }).comment))
  );
}

export function BrandInsights({ currentWeek }: { currentWeek?: string }) {
  const [active, setActive] = useState(BRAND_INSIGHTS[0].id);
  const [sheetData, setSheetData] = useState<Record<string, SheetBrandData>>({});
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    const qs = currentWeek ? `?week=${encodeURIComponent(currentWeek)}` : "";
    fetch(`/api/brand-insights${qs}`).then((r) => r.json()).then((data: unknown) => {
      if (!alive || !data || typeof data !== "object") return;
      const d = data as { brands?: Record<string, SheetBrandData> };
      if (d.brands && Object.keys(d.brands).length > 0) {
        setSheetData(d.brands);
        // 시트에 실데이터가 하나라도 있으면 live 표시
        const anyData = Object.values(d.brands).some((b) =>
          b.rankNote || b.improvement ||
          (b.lastWork && b.lastWork.length > 0) || (b.thisWeek && b.thisWeek.length > 0) ||
          (b.igContents && b.igContents.length > 0)
        );
        setLive(anyData);
      } else {
        setSheetData({}); setLive(false);
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [currentWeek]);

  const baseBrand = BRAND_INSIGHTS.find((b) => b.id === active) || BRAND_INSIGHTS[0];
  const sheet = sheetData[active];
  // 시트에 실데이터가 있으면 표시, 없으면 안내 문구(아래 렌더에서 처리)
  // 시트 데이터가 있으면 빈 값 위에 병합 (없는 필드는 예시로 채우지 않고 빈 칸 유지)
  const brand = hasSheetData(sheet) ? mergeBrand(emptyBrand(baseBrand), sheet) : emptyBrand(baseBrand);

  return (
    <div className="mt-5 pt-4 border-t border-stone-200">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-stone-800">브랜드별 상세 인사이트</h3>
          <p className="text-[11px] text-stone-400 mt-0.5">브랜드별 검색 트렌드 · 경쟁사 순위 · 쇼핑순위 · 업무 · 금주 액션</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${live ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
          {live ? "● 시트 연동" : "○ 예시 데이터"}
        </span>
      </div>

      <div>
        <div className="grid gap-2 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          {BRAND_INSIGHTS.map((b) => {
            const on = b.id === active;
            return (
              <button key={b.id} onClick={() => setActive(b.id)}
                className={`text-left rounded-xl px-3 py-2.5 border transition ${on ? "border-kkumbi-400 bg-kkumbi-50" : "border-stone-200 bg-white hover:border-kkumbi-300"}`}>
                <div className="text-[11px] text-stone-400 mb-0.5">{b.tag}</div>
                <div className={`text-[13px] font-bold leading-tight ${on ? "text-kkumbi-700" : "text-stone-800"}`}>{b.name}</div>
                <div className="text-[11px] font-bold text-kkumbi-600 mt-1.5">목표 {b.target}</div>
              </button>
            );
          })}
        </div>
        <div className="text-sm font-bold text-stone-800 mb-3">{brand.tag} · {brand.name}</div>
        {!hasSheetData(sheet) ? (
          <div className="border border-dashed border-stone-300 rounded-xl px-4 py-8 text-center">
            <p className="text-sm text-stone-600 font-semibold">구글 시트에 데이터를 입력해주세요</p>
            <p className="text-xs text-stone-500 mt-2 leading-relaxed whitespace-pre-line">
              <span className="font-semibold text-stone-600">{currentWeek || "선택한 주차"}</span> 데이터가 아직 없습니다.<br />
              주간보고 구글시트의 <span className="font-semibold text-kkumbi-600">KPI1_브랜드인사이트</span> · <span className="font-semibold text-kkumbi-600">KPI1_인스타</span> 탭에<br />
              <span className="font-semibold">주차</span> 칸을 <span className="font-semibold text-stone-600">&quot;{currentWeek || "해당 주차"}&quot;</span>로 입력하면 이 화면에 표시됩니다.
            </p>
            <div className="mt-3 inline-block text-left bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
              <p className="text-[11px] text-stone-500 leading-relaxed whitespace-pre-line">
                · <span className="font-semibold">KPI1_브랜드인사이트</span>: 경쟁사코멘트 / 자사코멘트 / 지난주업무 / 금주업무<br />
                · <span className="font-semibold">KPI1_인스타</span>: 요약 / 콘텐츠<br />
                <span className="text-stone-400">(각 행의 &apos;구분&apos; 칸으로 종류를 선택)</span>
              </p>
            </div>
          </div>
        ) : (
          <BrandPanel brand={brand} />
        )}
      </div>
    </div>
  );
}
