"use client";

import { useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const KEYWORD_GROUPS = [
  {
    id: "folder_mat", label: "폴더매트",
    brands: [
      { name: "꿈비", keywords: ["더블원피스매트","꿈비더블원피스매트","트리플원피스매트","꿈비트리플원피스매트","자이언트매트","꿈비자이언트매트","클린롤매트","리코코클린롤매트","꿈비클린롤매트","꿈비폴더매트","꿈비복도매트","꿈비매트","리코코매트","리코코폴더매트","꿈비원피스매트"] },
      { name: "알집매트", keywords: ["알집폴더매트","알집더블제로매트","알집트리플제로매트","알집트윈매트","알집더블플립매트","알집에코실리온","알집매트더블제로매트","알집복도제로매트","에코실리온","알집매트커버","알집복도제로매트"] },
      { name: "크림하우스", keywords: ["크림하우스폴더매트","크림하우스프리2","크림하우스프리2폴더매트","크림하우스프리2s","크림하우스프리2베이비룸","슬라이드프리","크림하우스슬라이드프리","크림하우스슬라이드프리와이드","프리그라운드2","크림하우스프리그라운드2","크림하우스맞춤매트"] },
      { name: "파크론", keywords: ["빅베어베베","파크론빅베어베베","베어베베","파크론베어베베","파크론베어베베논슬립","파크론베어베베클린","파크론폴더매트","파크론접이식매트"] },
      { name: "모노맷", keywords: ["모노맷매트","모노맷폴더매트","모노맷한판매트","모노맷클린매트","모노맷2단매트","모노맷모노핏","모노맷맞춤폴더매트","모노맷맞춤매트"] },
    ],
  },
  {
    id: "construction_mat", label: "시공매트",
    brands: [
      { name: "꿈비", keywords: ["꿈비시공매트","꿈비매트시공","꿈비퍼즐매트","리코코퍼즐매트","꿈비시공퍼즐매트","리코코황변방지","리코코디자인tpu클립매트"] },
      { name: "알집매트", keywords: ["알집시공매트","알집거실시공","알집노블시공","알집tpu시공매트","알집tpu매트","알집tpu시공","알집매트시공비용"] },
      { name: "크림하우스", keywords: ["크림하우스시공매트","크림하우스시공","크림하우스퍼즐매트","크림하우스셀프시공"] },
      { name: "파크론", keywords: ["파크론시공","파크론매트시공","파크론시공매트","파크론제로블럭","파크론퍼즐매트","파크론셀프시공","파크론tpu","파크론tpu매트","제로블럭"] },
      { name: "봄봄매트", keywords: ["봄봄매트시공","봄봄시공매트","봄봄스킨텍스처","시공매트봄봄매트"] },
    ],
  },
  {
    id: "bumper_bed", label: "범퍼침대/아기침대",
    brands: [
      { name: "꿈비", keywords: ["꿈비범퍼침대","꿈비아기침대","꿈비하이가드범퍼침대","꿈비범퍼침대대형","꿈비범퍼침대특대형","꿈비범퍼침대슈퍼특대형","꿈비범퍼침대매트","꿈비트윈스타","꿈비월드스타","꿈비럭키스타","꿈비럭키스타범퍼침대"] },
      { name: "도노도노", keywords: ["도노도노아기침대","도노도노범퍼침대","도노도노하이가드범퍼침대","도노도노패밀리범퍼침대","도노도노하이가드","도노도노범퍼침대가드","도노도노범퍼침대매트"] },
      { name: "코지스토리", keywords: ["코지스토리아기침대","코지스토리범퍼침대"] },
      { name: "바치", keywords: ["바치조이범퍼침대","바치포칠드런범퍼침대","바치범퍼침대특대형","바치범퍼침대가드","바치범퍼침대매트","바치물결범퍼침대"] },
      { name: "쥬다르", keywords: ["쥬다르범퍼침대","주다르범퍼침대","쥬다르범퍼침대밀크","쥬다르누보범퍼침대","주다르누보범퍼침대","쥬다르밀크티브라운범퍼침대","쥬다르크림범퍼침대","쥬다르점보범퍼침대"] },
    ],
  },
  {
    id: "bottle_washer", label: "젖병세척기",
    brands: [
      { name: "꿈비", keywords: ["꿈비젖병세척기","꿈비세척기","꿈비젖병소독기","꿈비젖병세척소독기","uvpro"] },
      { name: "베이비브레짜", keywords: ["베이비브레짜젖병세척기","브레짜젖병세척기","베이비브레짜젖병세척소독기","브레짜젖병세척소독기","베이비브레짜세척기","브레짜세척기"] },
      { name: "소베맘", keywords: ["소베맘젖병세척기","소베맘세척기","소베맘젖병소독기","소베맘젖병세척소독기"] },
      { name: "오르테", keywords: ["오르테젖병세척기","오르테세척기","오르테젖병소독기","오르테젖병세척소독기"] },
      { name: "버들아이", keywords: ["버들아이젖병세척기","버들젖병세척기","버들젖병소독기","버들아이젖병소독기","버들아이세척기","버들세척기"] },
    ],
  },
  {
    id: "formula_pot", label: "분유포트",
    brands: [
      { name: "꿈비", keywords: ["꿈비휴대용분유포트","꿈비보온병","꿈비외출용분유포트","꿈비휴대용포트","꿈비분유포트","꿈비무선분유포트","꿈비분리형휴대용분유포트","꿈비분리형분유포트","꿈비배터리분리형분유포트"] },
      { name: "나리몽", keywords: ["나리몽휴대용분유포트","나리몽분리형분유포트","나리몽보온병","나리몽외출용분유포트","나리몽휴대용포트","나리몽무선분유포트","나리몽분리형휴대용분유포트","나리몽분유포트","나리몽배터리분리형분유포트"] },
      { name: "보아르", keywords: ["보아르휴대용분유포트","보아르보온병","보아르외출용분유포트","보아르휴대용포트","보아르무선분유포트"] },
      { name: "해님", keywords: ["해님휴대용분유포트","해님보온병","해님외출용분유포트","해님휴대용포트","해님무선분유포트","해님분리형분유포트","해님분리형휴대용분유포트","해님분유포트"] },
      { name: "마베비", keywords: ["마베비휴대용분유포트","마베비분리형분유포트","마베비보온병","마베비외출용분유포트","마베비분유포트","마베비휴대용포트","마베비무선분유포트","마베비똑딱포트"] },
    ],
  },
  {
    id: "formula_shaker", label: "분유쉐이커",
    brands: [
      { name: "꿈비", keywords: ["꿈비분유쉐이커","꿈비쉐이커","꿈비젖병쉐이커","꿈비분유제조기","꿈비분유믹서기"] },
      { name: "나리몽", keywords: ["나리몽분유쉐이커","나리몽쉐이커","나리몽젖병쉐이커","나리몽분유제조기","나리몽분유믹서기"] },
      { name: "보아르", keywords: ["보아르분유쉐이커","보아르쉐이커","보아르젖병쉐이커","보아르분유제조기","보아르분유믹서기"] },
      { name: "해님", keywords: ["해님분유쉐이커","해님쉐이커","해님젖병쉐이커","해님분유제조기","해님분유믹서기"] },
      { name: "워너홈", keywords: ["워너홈분유쉐이커","워너홈쉐이커","워너홈젖병쉐이커","워너홈분유제조기","워너홈분유믹서기"] },
    ],
  },
];

const PERIODS = [
  { label: "주간", value: "1week" },
  { label: "3개월", value: "3months" },
  { label: "1년", value: "1year" },
  { label: "3년", value: "3years" },
];

const BRAND_COLORS = ["#FF6B35","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD"];

export default function TrendPage() {
  const [selectedGroup, setSelectedGroup] = useState(KEYWORD_GROUPS[0].id);
  const [selectedPeriod, setSelectedPeriod] = useState("3months");
  const [chartData, setChartData] = useState<Record<string, string | number>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hiddenBrands, setHiddenBrands] = useState<Set<string>>(new Set());
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  const currentGroup = KEYWORD_GROUPS.find((g) => g.id === selectedGroup)!;

  function toggleBrand(brandName: string) {
    setHiddenBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brandName)) next.delete(brandName);
      else next.add(brandName);
      return next;
    });
  }

  function toggleExpand(brandName: string) {
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brandName)) next.delete(brandName);
      else next.add(brandName);
      return next;
    });
  }

  async function fetchTrend() {
    setLoading(true);
    setError("");
    setChartData([]);
    setHiddenBrands(new Set());
    try {
      const res = await fetch("/api/trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroup, period: selectedPeriod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류 발생");
      setChartData(data.results);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error("오류 발생");
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-800">키워드 트렌드 대시보드</h1>
          <Link href="/" className="text-sm text-orange-500 hover:underline">← 모니터링으로 돌아가기</Link>
        </div>
        <p className="text-gray-500 text-sm mb-6">네이버 검색어트렌드 기반 · 경쟁사 브랜드 비교</p>

        <div className="flex gap-2 mb-4 flex-wrap">
          {KEYWORD_GROUPS.map((g) => (
            <button key={g.id} onClick={() => { setSelectedGroup(g.id); setChartData([]); setHiddenBrands(new Set()); setExpandedBrands(new Set()); }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedGroup === g.id ? "bg-orange-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-orange-300"}`}>
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setSelectedPeriod(p.value)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${selectedPeriod === p.value ? "bg-gray-800 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h2 className="font-semibold text-gray-700 mb-3">{currentGroup.label} 키워드 구성</h2>
          <div className="space-y-3">
            {currentGroup.brands.map((brand, i) => (
              <div key={brand.name} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BRAND_COLORS[i] }} />
                    <span className="font-medium text-sm text-gray-700">{brand.name}</span>
                    <span className="text-xs text-gray-400">{brand.keywords.length}개</span>
                  </div>
                  <button onClick={() => toggleExpand(brand.name)} className="text-xs text-orange-500 hover:underline">
                    {expandedBrands.has(brand.name) ? "접기" : "전체보기"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(expandedBrands.has(brand.name) ? brand.keywords : brand.keywords.slice(0, 5)).map((k) => (
                    <span key={k} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{k}</span>
                  ))}
                  {!expandedBrands.has(brand.name) && brand.keywords.length > 5 && (
                    <button onClick={() => toggleExpand(brand.name)} className="text-xs text-orange-400 px-1">+{brand.keywords.length - 5}개 더보기</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <p className="text-sm text-gray-500 mb-2">브랜드 클릭으로 차트 표시/숨기기</p>
            <div className="flex flex-wrap gap-2">
              {currentGroup.brands.map((brand, i) => (
                <button key={brand.name} onClick={() => toggleBrand(brand.name)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${hiddenBrands.has(brand.name) ? "bg-gray-100 text-gray-400 border-gray-200 line-through" : "bg-white text-gray-700 border-gray-300"}`}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hiddenBrands.has(brand.name) ? "#ccc" : BRAND_COLORS[i] }} />
                  {brand.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={fetchTrend} disabled={loading}
          className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 mb-6">
          {loading ? "데이터 조회 중..." : "트렌드 조회"}
        </button>

        {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

        {chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-700 mb-4">{currentGroup.label} 검색량 추이</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
  contentStyle={{
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
    padding: "12px 16px",
  }}
  content={({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const hovered = payload[0]?.name;
    return (
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px 16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
        <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "2px 0",
            opacity: entry.name === hovered ? 1 : 0.4,
          }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: entry.color as string }} />
            <span style={{
              fontSize: entry.name === hovered ? "15px" : "12px",
              fontWeight: entry.name === hovered ? "700" : "400",
              color: entry.name === hovered ? "#111" : "#6b7280",
              transition: "all 0.1s",
            }}>{entry.name}</span>
            <span style={{
              fontSize: entry.name === hovered ? "15px" : "12px",
              fontWeight: entry.name === hovered ? "700" : "400",
              color: entry.color as string,
              marginLeft: "auto",
              paddingLeft: "16px",
            }}>{Number(entry.value).toFixed(1)}</span>
          </div>
        ))}
      </div>
    );
  }}
/>
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
    padding: "12px 16px",
  }}
  itemStyle={{ fontSize: "13px", fontWeight: "600", padding: "2px 0" }}
  labelStyle={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px", fontWeight: "500" }}
  formatter={(value: number, name: string) => [
    <span key={name} style={{ fontWeight: "700", fontSize: "14px" }}>{value.toFixed(1)}</span>,
    name
  ]}
/>
                <Legend />
                {currentGroup.brands.map((brand, i) => (
                  !hiddenBrands.has(brand.name) && (
                    <Line key={brand.name} type="monotone" dataKey={brand.name}
                      stroke={BRAND_COLORS[i]} strokeWidth={2} dot={false} />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
