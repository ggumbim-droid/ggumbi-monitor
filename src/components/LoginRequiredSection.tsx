"use client";

import { LinkedTitle } from "@/components/LinkedTitle";
import { getChannelMeta } from "@/lib/channels";
import type { LoginRequiredItem } from "@/types/monitor";

interface LoginRequiredSectionProps {
  items: LoginRequiredItem[];
}

export function LoginRequiredSection({ items }: LoginRequiredSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50/80 p-6 shadow-sm">
      <header className="mb-4">
        <h2 className="text-lg font-bold text-amber-900">
          팀원 직접 확인 필요 (전 채널)
        </h2>
        <p className="mt-1 text-sm text-amber-800/80">
          로그인·비공개·회원 전용 등 자동 수집이 불가한 항목을 채널별로
          모았습니다.
        </p>
      </header>

      <ul className="space-y-3">
        {items.map((item, i) => {
          const meta = getChannelMeta(item.channel);
          return (
            <li
              key={`all-login-${i}`}
              className="rounded-xl border border-amber-200 bg-white p-4"
            >
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                {meta.shortLabel}
              </span>
              <p className="mt-2 text-xs font-medium text-amber-700">
                {item.source}
              </p>
              <LinkedTitle
                title={item.title}
                link={item.link}
                className="font-semibold text-stone-800"
                linkClassName="cursor-pointer text-stone-800 hover:text-amber-700 hover:underline"
              />
              {item.reason && (
                <p className="mt-1 text-sm text-stone-500">{item.reason}</p>
              )}
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-sm text-amber-700 hover:underline"
                >
                  링크 열기 →
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
