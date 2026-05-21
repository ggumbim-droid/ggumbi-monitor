"use client";

import { useState, KeyboardEvent } from "react";

interface KeywordInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  disabled?: boolean;
}

export function KeywordInput({
  keywords,
  onChange,
  disabled,
}: KeywordInputProps) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const value = draft.trim();
    if (!value) return;

    if (!keywords.includes(value)) {
      onChange([...keywords, value]);
    }
    setDraft("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    commitDraft();
  };

  const removeTag = (index: number) => {
    onChange(keywords.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-stone-700">
        브랜드 / 제품 키워드
      </label>

      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, index) => (
            <span
              key={`${keyword}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-kkumbi-200 bg-kkumbi-50 py-1 pl-3 pr-1.5 text-sm font-medium text-kkumbi-800"
            >
              {keyword}
              <button
                type="button"
                onClick={() => removeTag(index)}
                disabled={disabled}
                className="flex h-5 w-5 items-center justify-center rounded-full text-kkumbi-500 transition hover:bg-kkumbi-200 hover:text-kkumbi-800 disabled:opacity-40"
                aria-label={`${keyword} 삭제`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="경쟁사 브랜드명 또는 제품 키워드를 입력하세요"
        className="w-full rounded-xl border border-kkumbi-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-kkumbi-400 focus:ring-2 focus:ring-kkumbi-200 disabled:bg-stone-50"
      />
    </div>
  );
}
