"use client";

import { LinkedTitle } from "@/components/LinkedTitle";
import type { CafePost, LoginRequiredItem } from "@/types/monitor";

interface ResultsPanelProps {
  publicPosts: CafePost[];
  loginRequired: LoginRequiredItem[];
}

export function ResultsPanel({ publicPosts, loginRequired }: ResultsPanelProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-800">공개 콘텐츠</h2>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            {publicPosts.length}건
          </span>
        </header>

        {publicPosts.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">
            수집된 공개 게시글이 없습니다.
          </p>
        ) : (
          <ul className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
            {publicPosts.map((post, i) => (
              <li
                key={`${post.link}-${i}`}
                className="rounded-xl border border-stone-100 bg-stone-50/50 p-4 transition hover:border-kkumbi-200"
              >
                <p className="text-xs font-medium text-kkumbi-600">
                  {post.cafeName ?? (post as { source?: string }).source}
                </p>
                <LinkedTitle title={post.title} link={post.link} />
                {post.preview && (
                  <p className="mt-2 text-sm text-stone-500 line-clamp-2">
                    {post.preview}
                  </p>
                )}
                {post.link && (
                  <a
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex text-sm font-medium text-kkumbi-600 hover:underline"
                  >
                    게시글 보기 →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-amber-900">
            팀원 직접 확인 필요
          </h2>
          <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
            {loginRequired.length}건
          </span>
        </header>
        <p className="mb-3 text-xs text-amber-800/80">
          로그인·회원 전용 등으로 자동 수집이 불가한 항목입니다.
        </p>

        {loginRequired.length === 0 ? (
          <p className="py-8 text-center text-sm text-amber-700/60">
            로그인 필요 항목이 없습니다.
          </p>
        ) : (
          <ul className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
            {loginRequired.map((item, i) => (
              <li
                key={`login-${i}`}
                className="rounded-xl border border-amber-200 bg-white p-4"
              >
                <p className="text-xs font-medium text-amber-700">
                  {item.source ?? (item as { cafeName?: string }).cafeName}
                </p>
                <LinkedTitle
                  title={item.title}
                  link={item.link}
                  className="mt-1 font-semibold text-stone-800"
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
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
