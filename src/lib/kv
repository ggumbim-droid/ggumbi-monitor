// ══════════════════════════════════════════════════
//  Vercel KV 공통 래퍼
//
//  지금까지 auth/keywords/ranking-history 세 라우트에 같은 코드가 복사돼 있었습니다.
//  일단위 저장소가 붙으면 네 곳이 되므로 여기로 모읍니다.
//  (기존 라우트는 건드리지 않았습니다 — 동작 중인 코드라 이번 단계에선 그대로 둡니다.)
// ══════════════════════════════════════════════════

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

export function isKvConfigured(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

/** 키 하나를 읽어 파싱된 값으로 반환. 없거나 실패하면 null */
export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  if (!isKvConfigured()) return null;
  try {
    const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.result ?? data?.value ?? null;
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        // 이중 인코딩된 경우까지 흡수 (기존 kvSet이 문자열을 다시 감싸서 저장함)
        if (typeof parsed === "string") return JSON.parse(parsed) as T;
        return parsed as T;
      } catch {
        return null;
      }
    }
    return raw as T;
  } catch {
    return null;
  }
}

/** 값을 저장. 성공 여부를 반환합니다 (기존 코드는 실패를 조용히 삼켰음) */
export async function kvSet(key: string, value: unknown): Promise<boolean> {
  if (!isKvConfigured()) return false;
  try {
    const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(JSON.stringify(value)),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 여러 키를 한 번에 읽기 (일자 범위 조회용) */
export async function kvGetMany<T = unknown>(
  keys: string[]
): Promise<Record<string, T | null>> {
  const out: Record<string, T | null> = {};
  // 동시 요청이 너무 많으면 제한에 걸리므로 10개씩 끊어서 처리
  const CHUNK = 10;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const slice = keys.slice(i, i + CHUNK);
    const results = await Promise.all(slice.map((k) => kvGet<T>(k)));
    slice.forEach((k, idx) => {
      out[k] = results[idx];
    });
  }
  return out;
}
