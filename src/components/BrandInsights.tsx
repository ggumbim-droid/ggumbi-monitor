"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { BRAND_INSIGHTS, BRAND_TREND_GROUPS, BRAND_RANKING_GROUPS, type BrandInsight } from "@/lib/brand-insights";

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
  { label: "주간(전주 월~일)", value: "lastweek" },
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
function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "8px 10px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", minWidth: "140px" }}>
      <p style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>{label}</p>
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
  labels: Record<string, string>;
  groupBrands: Record<string, KwBrand[]>;
  charts: Record<string, Record<string, Row[]>>;
  loaded: boolean;
}

function GroupTrendChart({ gid, label, brands, gCharts }: {
  gid: string; label: string; brands: KwBrand[]; gCharts?: Record<string, Row[]>;
}) {
  return (
    <div className="mb-2">
      <div className="text-xs font-bold text-stone-700 mb-2">{label || gid} · 검색 트렌드</div>
      {!gCharts ? (
        <p className="text-[11px] text-stone-300">검색 트렌드 조회 대기 중</p>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {STACK.map((pp) => {
            const rows = gCharts[pp.value];
            if (!rows || rows.length === 0) return null;
            return (
              <div key={pp.value}>
                <div className="text-[11px] font-semibold text-stone-500 mb-1">{pp.label} 추이</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
                    <Tooltip content={<TrendTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {brands.map((b, i) => (
                      <Line key={b.name} type="monotone" dataKey={b.name} stroke={BRAND_COLORS[i % BRAND_COLORS.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function useBrandTrend(brandId: string) {
  const groups = BRAND_TREND_GROUPS[brandId] ?? [];
  const [state, setState] = useState<TrendState>({ labels: {}, groupBrands: {}, charts: {}, loaded: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setState({ labels: {}, groupBrands: {}, charts: {}, loaded: false });
    setError("");
    fetch("/api/keywords").then((r) => r.json()).then((data: unknown) => {
      if (!alive || !data || typeof data !== "object") return;
      const g = data as KwGroups;
      const lab: Record<string, string> = {};
      const gb: Record<string, KwBrand[]> = {};
      groups.forEach((gid) => { if (g[gid]) { lab[gid] = g[gid].label; gb[gid] = g[gid].brands; } });
      setState((s) => ({ ...s, labels: lab, groupBrands: gb }));
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  async function fetchAll() {
    setLoading(true); setError("");
    try {
      const result: Record<string, Record<string, Row[]>> = {};
      for (const gid of groups) {
        result[gid] = {};
        await Promise.all(STACK.map(async (pp) => {
          const res = await fetch("/api/trend", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groupId: gid, period: pp.value }),
          });
          const data = await res.json();
          if (res.ok) result[gid][pp.value] = (data.results ?? []) as Row[];
        }));
      }
      setState((s) => ({ ...s, charts: result, loaded: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return { groups, state, loading, error, fetchAll };
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
  const { groups, state, loading, error, fetchAll } = useBrandTrend(brand.id);
  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-[11px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-md">① 경쟁사 인사이트</span>
          <span className="text-sm font-bold text-stone-800">검색 트렌드 · 주간 증감 · 특이사항</span>
        </div>

        {groups.length > 0 && (
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <p className="text-[11px] text-stone-400">연결된 검색 그룹: {groups.map((g) => state.labels[g] || g).join(" · ")}</p>
            <button onClick={fetchAll} disabled={loading}
              className="text-xs font-semibold px-3 py-1.5 bg-kkumbi-500 text-white rounded-lg hover:bg-kkumbi-600 disabled:opacity-50">
              {loading ? "조회 중..." : state.loaded ? "다시 조회" : "검색 트렌드 조회"}
            </button>
          </div>
        )}
        {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}
        {!state.loaded && groups.length > 0 && <p className="text-[11px] text-stone-400 mb-3">※ 위 버튼을 누르면 네이버 검색 트렌드(주간·3년)를 불러옵니다.</p>}

        <div className="space-y-3">
          {brand.comp.map((block, bi) => {
            const gid = groups[bi]; // comp 카테고리와 키워드 그룹을 순서로 매칭
            return (
              <div key={bi} className="border border-stone-200 rounded-xl p-4 bg-white">
                {gid && (
                  <GroupTrendChart gid={gid} label={state.labels[gid] || gid} brands={state.groupBrands[gid] ?? []} gCharts={state.charts[gid]} />
                )}
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
                      {block.rows.map((r, i) => (
                        <tr key={i} className="border-t border-stone-100">
                          <td className={`py-1.5 px-1.5 whitespace-nowrap ${r.mine ? "font-bold text-kkumbi-700" : "font-medium text-stone-700"}`}>{r.mine && "● "}{r.name}</td>
                          <td className="py-1.5 px-1.5 text-stone-500 whitespace-nowrap">{r.period || "—"}</td>
                          <td className="py-1.5 px-1.5 text-stone-800">{r.idx}</td>
                          <td className="py-1.5 px-1.5"><Delta v={r.delta} /></td>
                          <td className="py-1.5 px-1.5 text-stone-500">{r.pk && !isNaN(parseFloat(r.pk)) ? r.pk : "—"}</td>
                          <td className="py-1.5 px-1.5 text-stone-500 whitespace-nowrap">{r.pkDate || "—"}</td>
                          <td className="py-1.5 px-1.5">{stateBadge(r.state && isNaN(parseFloat(r.state)) ? r.state : "flat")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {block.note && (
                  <div className="mt-3 bg-stone-50 border border-dashed border-stone-300 rounded-lg px-3 py-2.5">
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full">✎ 시트 연동</span>
                    <p className="text-xs text-stone-600 leading-relaxed mt-1.5">{block.note}</p>
                  </div>
                )}
                {block.comment && (
                  <div className="mt-3 bg-amber-50 border-l-[3px] border-amber-400 rounded-r-lg px-3 py-2.5">
                    <span className="text-[10px] font-bold text-amber-700">📝 경쟁사 동향 코멘트</span>
                    <p className="text-xs text-stone-700 leading-relaxed mt-1">{block.comment}</p>
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
            {brand.rankNote && (
              <div className="mt-2 bg-stone-50 border border-dashed border-stone-300 rounded-lg px-3 py-2">
                <p className="text-xs text-stone-600 leading-relaxed">{brand.rankNote}</p>
              </div>
            )}
          </div>

          {brand.lastWork.length > 0 && (
            <div>
              <SubLabel>지난주 진행 업무 · 결과 · 달성률</SubLabel>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-stone-400 text-left border-b border-stone-200">
                    <th className="py-1.5 px-2 font-medium min-w-[130px]">진행 업무</th>
                    <th className="py-1.5 px-2 font-medium min-w-[150px]">업무 결과</th>
                    <th className="py-1.5 px-2 font-medium min-w-[90px]">달성률</th>
                    <th className="py-1.5 px-2 font-medium min-w-[130px]">잘된 점</th>
                    <th className="py-1.5 px-2 font-medium min-w-[130px]">아쉬운 점</th>
                  </tr></thead>
                  <tbody>
                    {brand.lastWork.map((r, i) => {
                      const ach = parseFloat(r[2]);
                      const hasAch = !isNaN(ach);
                      const color = ach >= 80 ? "bg-emerald-500" : ach >= 40 ? "bg-amber-500" : "bg-rose-500";
                      const txt = ach >= 80 ? "text-emerald-700" : ach >= 40 ? "text-amber-700" : "text-rose-700";
                      return (
                        <tr key={i} className="border-b border-stone-100 align-top">
                          <td className="py-2 px-2 font-semibold text-stone-800 leading-snug">{r[0]}</td>
                          <td className="py-2 px-2 text-stone-600 leading-snug">{r[1]}</td>
                          <td className="py-2 px-2">
                            {hasAch ? (
                              <div className="flex items-center gap-1.5 min-w-[80px]">
                                <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${Math.min(100, ach)}%` }} /></div>
                                <span className={`text-[11px] font-bold ${txt}`}>{ach}%</span>
                              </div>
                            ) : <span className="text-stone-400">—</span>}
                          </td>
                          <td className="py-2 px-2 text-emerald-700 leading-snug">{r[3]}</td>
                          <td className="py-2 px-2 text-rose-700 leading-snug">{r[4]}</td>
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
              {(brand.ig.good || brand.ig.bad) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {brand.ig.good && (
                    <div className="bg-emerald-50 rounded-lg px-3 py-2">
                      <div className="text-[11px] font-bold text-emerald-700 mb-1">👍 잘된 점</div>
                      <p className="text-xs text-stone-700 leading-relaxed">{brand.ig.good}</p>
                    </div>
                  )}
                  {brand.ig.bad && (
                    <div className="bg-rose-50 rounded-lg px-3 py-2">
                      <div className="text-[11px] font-bold text-rose-700 mb-1">👀 아쉬운 점</div>
                      <p className="text-xs text-stone-700 leading-relaxed">{brand.ig.bad}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {brand.improvement && (
            <div>
              <SubLabel>아쉬운 점 해결방안</SubLabel>
              <div className="bg-kkumbi-50 border-l-[3px] border-kkumbi-400 rounded-r-lg px-3 py-2.5">
                <span className="text-[10px] font-bold text-kkumbi-700">✎ 시트 연동</span>
                <p className="text-xs text-kkumbi-800 leading-relaxed mt-1 font-medium">{brand.improvement}</p>
              </div>
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
                <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-md leading-snug mb-2.5">🎯 {s[1]}</div>
                {s[2] && <>
                  <div className="text-[10px] font-bold text-stone-400 tracking-wide mb-1">세부내용</div>
                  <p className="text-xs text-stone-500 leading-relaxed">{s[2]}</p>
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
    supporters: "",
    lastWork: [], thisWeek: [],
    ig: { upload: "", follow: "", good: "", bad: "" },
    igContents: [],
  };
}

// 해당 브랜드의 시트 데이터가 실제로 채워졌는지
function hasSheetData(sheet?: SheetBrandData): boolean {
  if (!sheet) return false;
  return Boolean(
    (sheet.comp && sheet.comp.length > 0) || sheet.rankNote || sheet.improvement ||
    (sheet.lastWork && sheet.lastWork.length > 0) || (sheet.thisWeek && sheet.thisWeek.length > 0) ||
    (sheet.igContents && sheet.igContents.length > 0) ||
    (sheet.ig && (sheet.ig.upload || sheet.ig.good || sheet.ig.bad || sheet.ig.follow))
  );
}

export function BrandInsights({ currentWeek }: { currentWeek?: string }) {
  const [active, setActive] = useState(BRAND_INSIGHTS[0].id);
  const [sheetData, setSheetData] = useState<Record<string, SheetBrandData>>({});
  const [live, setLive] = useState(false);
  // 예시 데이터는 7월 2주차에만 표시 (주차ID = 2026-07-05)
  const isExampleWeek = currentWeek === "2026-07-05";

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
          (b.comp && b.comp.length > 0) || b.rankNote || b.improvement ||
          (b.lastWork && b.lastWork.length > 0) || (b.thisWeek && b.thisWeek.length > 0)
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
  // 시트에 실데이터가 있으면 그것을 사용(예시 병합).
  // 없으면: 최초 로드 주차(기본 최근 주차)만 예시 표시, 다른 주차는 공란.
  const brand = hasSheetData(sheet)
    ? mergeBrand(baseBrand, sheet)
    : (isExampleWeek ? baseBrand : emptyBrand(baseBrand));

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
        {!hasSheetData(sheet) && !isExampleWeek ? (
          <div className="border border-dashed border-stone-300 rounded-xl px-4 py-8 text-center">
            <p className="text-sm text-stone-600 font-semibold">구글 시트에 데이터를 입력해주세요</p>
            <p className="text-xs text-stone-500 mt-2 leading-relaxed">
              <span className="font-semibold text-stone-600">{currentWeek || "선택한 주차"}</span> 데이터가 아직 없습니다.<br />
              주간보고 구글시트의 <span className="font-semibold text-kkumbi-600">KPI1_브랜드인사이트</span> · <span className="font-semibold text-kkumbi-600">KPI1_인스타</span> 탭에<br />
              <span className="font-semibold">주차</span> 칸을 <span className="font-semibold text-stone-600">&quot;{currentWeek || "해당 주차"}&quot;</span>로 입력하면 이 화면에 표시됩니다.
            </p>
            <div className="mt-3 inline-block text-left bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
              <p className="text-[11px] text-stone-500 leading-relaxed">
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
