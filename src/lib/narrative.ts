// 주차별 서사 텍스트(시트 원문)를 가독성 있는 구조로 파싱.
// 원문 예: "<꿈비> 1) 에디터 12기 ... (~7/19) 2) 도토리 ... <오가닉그라운드> 1) 로션 ... ㄴ목표1: ..."
// 원본 표기가 흔들리면(파싱 실패) 안전하게 원문 줄바꿈으로 폴백한다.

export interface NarrativeLine {
  kind: "item" | "sub" | "text"; // 번호항목 / 하위목표 / 일반문장
  marker?: string;               // "1)", "ㄴ목표1" 등
  text: string;
}
export interface NarrativeBlock {
  brand?: string;                // <브랜드명> 소제목 (없으면 무브랜드 블록)
  lines: NarrativeLine[];
}

// <브랜드명> 토큰으로 텍스트를 브랜드 구획으로 분할
function splitByBrand(raw: string): { brand?: string; body: string }[] {
  const re = /<\s*([^<>]{1,20}?)\s*>/g;
  const out: { brand?: string; body: string }[] = [];
  let lastIndex = 0;
  let lastBrand: string | undefined;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const body = raw.slice(lastIndex, m.index).trim();
    if (body) out.push({ brand: lastBrand, body });
    lastBrand = m[1].trim();
    lastIndex = re.lastIndex;
  }
  const tail = raw.slice(lastIndex).trim();
  if (tail) out.push({ brand: lastBrand, body: tail });
  if (out.length === 0 && raw.trim()) out.push({ body: raw.trim() });
  return out;
}

// 한 브랜드 구획의 본문을 번호항목(1) 2) 3)) 단위로 쪼갬
function splitItems(body: string): string[] {
  // "1)" "2)" 형태 앞에서 분리 (문두 또는 공백 뒤)
  const parts = body.split(/(?=(?:^|\s)\d{1,2}\)\s)/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [body.trim()];
}

// 항목 내부의 하위목표(ㄴ, ㄴ목표, └ 등) 및 => 화살표를 별도 줄로 분리
function splitSubs(item: string): NarrativeLine[] {
  const lines: NarrativeLine[] = [];
  // 선행 번호마커 추출
  const numMatch = item.match(/^(\d{1,2}\))\s*([\s\S]*)$/);
  let marker: string | undefined;
  let rest = item;
  if (numMatch) { marker = numMatch[1]; rest = numMatch[2]; }

  // ㄴ / └ / => 앞에서 분할 (하위 항목 · 결론)
  const segs = rest
    .split(/(?=\s*(?:ㄴ|└)|=>)/)
    .map((s) => s.trim())
    .filter(Boolean);

  segs.forEach((seg, idx) => {
    const subMatch = seg.match(/^(ㄴ|└)\s*(목표\d*\s*[:：]?|[^\s:：]{0,8}[:：])?\s*([\s\S]*)$/);
    if (subMatch) {
      const lbl = (subMatch[2] || "").replace(/[:：]\s*$/, "").trim();
      lines.push({ kind: "sub", marker: lbl || "ㄴ", text: subMatch[3].trim() });
      return;
    }
    if (seg.startsWith("=>")) {
      lines.push({ kind: "sub", marker: "=>", text: seg.replace(/^=>\s*/, "").trim() });
      return;
    }
    // 항목 본문 (첫 세그먼트에만 번호마커 부여)
    lines.push({ kind: "item", marker: idx === 0 ? marker : undefined, text: seg });
  });

  if (lines.length === 0) lines.push({ kind: "item", marker, text: rest.trim() });
  return lines;
}

export function parseNarrative(raw: string): NarrativeBlock[] {
  if (!raw || !raw.trim()) return [];
  const blocks: NarrativeBlock[] = [];
  for (const seg of splitByBrand(raw)) {
    const lines: NarrativeLine[] = [];
    for (const item of splitItems(seg.body)) {
      lines.push(...splitSubs(item));
    }
    if (lines.length > 0) blocks.push({ brand: seg.brand, lines });
  }
  return blocks;
}
