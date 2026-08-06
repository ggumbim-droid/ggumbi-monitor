import { NextRequest, NextResponse } from "next/server";
import {
  fetchDatalab,
  resolvePeriodRange,
  DatalabError,
  MAX_GROUPS,
  MAX_KEYWORDS_PER_GROUP,
  type KeywordGroup,
  type TimeUnit,
} from "@/lib/naver-datalab";

// ══════════════════════════════════════════════════
//  키워드 미리보기 조회
//
//  화면에서 키워드를 고친 뒤 "이렇게 바꾸면 그래프가 어떻게 되나"를
//  즉시 확인하기 위한 통로입니다.
//
//  ▶ 저장소(KV)를 거치지 않습니다.
//    저장소 값은 시트의 예전 키워드로 계산된 것이라,
//    편집한 키워드와 맞지 않는 옛 수치를 보여주게 됩니다.
//    미리보기는 반드시 데이터랩을 새로 불러야 합니다.
//
//  ▶ 시트에도 쓰지 않습니다. 확정 저장은 별도 단계입니다.
// ══════════════════════════════════════════════════

export const maxDuration = 60;
export const preferredRegion = ["icn1"];

interface PreviewBody {
  groups?: KeywordGroup[];
  period?: string;
  startDate?: string;
  endDate?: string;
  timeUnit?: TimeUnit;
}

export async function POST(request: NextRequest) {
  let body: PreviewBody;
  try {
    body = (await request.json()) as PreviewBody;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const groups = Array.isArray(body.groups) ? body.groups : [];
  if (groups.length === 0) {
    return NextResponse.json({ error: "브랜드·키워드를 보내주세요." }, { status: 400 });
  }

  // 직접 날짜를 주면 그걸 쓰고, 아니면 프리셋으로 계산
  // 수집기(collect-trend)와 같은 함수를 씁니다 — 기준이 어긋나지 않도록.
  const preset = resolvePeriodRange(String(body.period ?? "3months"));
  const startDate = body.startDate || preset.startDate;
  const endDate = body.endDate || preset.endDate;
  const timeUnit: TimeUnit = body.timeUnit ?? preset.timeUnit;

  if (startDate > endDate) {
    return NextResponse.json({ error: "시작일이 종료일보다 늦습니다." }, { status: 400 });
  }

  try {
    const { rows, series } = await fetchDatalab({ startDate, endDate, timeUnit, groups });
    return NextResponse.json({
      rows,
      series,
      startDate,
      endDate,
      timeUnit,
      count: rows.length,
      // 미리보기임을 화면이 구분할 수 있게 표시합니다.
      preview: true,
    });
  } catch (e) {
    if (e instanceof DatalabError) {
      return NextResponse.json({ error: e.message }, { status: 200 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 중 오류가 발생했습니다." },
      { status: 200 }
    );
  }
}

/** 화면이 상한을 미리 알 수 있게 알려줍니다 (입력 단계에서 막기 위함) */
export async function GET() {
  return NextResponse.json({
    maxGroups: MAX_GROUPS,
    maxKeywordsPerGroup: MAX_KEYWORDS_PER_GROUP,
  });
}
