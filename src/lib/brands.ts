// ══════════════════════════════════════════════════
//  브랜드 기준축 (Canonical Brand Registry)
//
//  사내 브랜드 목록이 갈래로 나뉘어 있어, 이 파일을 "단 하나의 기준"으로 삼고
//  나머지 표기는 전부 여기로 번역해서 씁니다.
//
//  ▶ 구조
//   · BRAND (브랜드)  : 매출·예산이 집계되는 단위. 사업팀과 맞추는 축.
//   · LINE  (제품라인) : 트렌드·경쟁사 분석이 이뤄지는 단위.
//     예) 브랜드 "꿈비" 안에 라인 "꿈비리코코", "꿈비육아"가 들어감.
// ══════════════════════════════════════════════════

/** 매출·예산이 집계되는 기준 브랜드 (사업팀과 맞춰야 하는 축) */
export const BRANDS = [
  "꿈비",
  "봄봄슈슈비",
  "파미야",
  "뉴어스",
  "소브",
  "오가닉그라운드",
  "바바디토",
  "G7커피",
] as const;

export type Brand = (typeof BRANDS)[number];

export function isBrand(v: string): v is Brand {
  return (BRANDS as readonly string[]).includes(v);
}

/** 제품라인 → 소속 브랜드 매핑 (트렌드·경쟁사 분석 축을 매출 축으로 번역) */
export const LINE_TO_BRAND: Record<string, Brand> = {
  꿈비리코코: "꿈비",   // 폴더매트·범퍼침대 라인
  꿈비육아: "꿈비",     // 젖병세척기·분유포트 등 육아가전 라인
  봄봄슈슈비: "봄봄슈슈비", // 시공매트·클립매트 (별도 브랜드)
  오가닉그라운드: "오가닉그라운드",
  바바디토: "바바디토",
  파미야: "파미야",
};

/** 제품라인 이름을 기준 브랜드로 변환. 모르는 값이면 null (조용히 삼키지 않음) */
export function lineToBrand(line: string): Brand | null {
  const key = String(line ?? "").trim();
  if (!key) return null;
  if (LINE_TO_BRAND[key]) return LINE_TO_BRAND[key];
  if (isBrand(key)) return key;
  return null;
}

/**
 * 외부(사업팀 매출, 채널 어드민 등)에서 들어온 브랜드 표기를 기준 브랜드로 정규화.
 * 표기 흔들림(띄어쓰기·영문·별칭)을 흡수합니다.
 * 새로운 표기가 발견되면 ALIASES에 추가하세요.
 */
const ALIASES: Record<string, Brand> = {
  ggumbi: "꿈비",
  꿈비그룹: "꿈비",
  리코코: "꿈비",
  미미루: "꿈비",
  봄봄: "봄봄슈슈비",
  봄봄매트: "봄봄슈슈비",
  슈슈비: "봄봄슈슈비",
  파미야펫: "파미야",
  뉴어스음식물처리기: "뉴어스",
  오가닉그라운드스쿠스쿠: "오가닉그라운드",
  스쿠스쿠: "오가닉그라운드",
  비바디토: "바바디토",
  g7: "G7커피",
  g7커피: "G7커피",
};

export function normalizeBrand(raw: string): Brand | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  if (isBrand(trimmed)) return trimmed;

  const line = lineToBrand(trimmed);
  if (line) return line;

  const flat = trimmed.toLowerCase().replace(/[\s\-_()]/g, "");
  if (ALIASES[flat]) return ALIASES[flat];

  return null;
}

/** 정규화에 실패한 표기를 모아두기 위한 헬퍼 — 수집 로그에 남겨 매핑표를 보강합니다. */
export function collectUnmapped(values: string[]): string[] {
  const seen = new Set<string>();
  for (const v of values) {
    const t = String(v ?? "").trim();
    if (t && !normalizeBrand(t)) seen.add(t);
  }
  return [...seen];
}
