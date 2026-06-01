"use client";

import { useState, useEffect } from "react";

interface InstagramAccount {
  id: string;
  brandName: string;
  url: string;
  addedAt: string;
}

export function InstagramAccountsPanel() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [brandName, setBrandName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/instagram-accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(data))
      .catch(() => {});
  }, []);

  async function handleAdd() {
    if (!brandName.trim() || !url.trim()) {
      setError("브랜드명과 URL을 모두 입력해주세요.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/instagram-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", brandName, url }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "오류 발생"); return; }
      setAccounts(data);
      setBrandName("");
      setUrl("");
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 계정을 삭제할까요?")) return;
    try {
      const res = await fetch("/api/instagram-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json();
      if (res.ok) setAccounts(data);
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-700 mb-3">
          경쟁사 인스타그램 계정 추가
        </h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="브랜드명 (예: 나리몽)"
            className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL 또는 @계정명"
            className="flex-[2] rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={loading}
            className="rounded-lg bg-kkumbi-500 px-4 py-2 text-sm font-semibold text-white hover:bg-kkumbi-600 disabled:opacity-50"
          >
            추가
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
        <p className="mt-2 text-xs text-stone-400">
          URL 또는 @계정명 입력 가능 · 팀원 모두 공유됩니다
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-stone-700">
            모니터링 계정 목록
          </h3>
          <span className="rounded-full bg-kkumbi-100 px-2.5 py-0.5 text-xs font-semibold text-kkumbi-700">
            {accounts.length}개
          </span>
        </div>

        {accounts.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-400">
            등록된 계정이 없습니다. 위에서 추가해주세요!
          </p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white">
                    {account.brandName.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800">
                      {account.brandName}
                    </p>
                    <p className="text-xs text-stone-400">{account.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  
                    href={account.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-kkumbi-200 px-3 py-1.5 text-xs font-semibold text-kkumbi-600 hover:bg-kkumbi-50"
                  >
                    바로가기
                  </a>
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
