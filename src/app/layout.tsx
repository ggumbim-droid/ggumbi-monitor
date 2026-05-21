import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "꿈비 · 전 채널 통합 경쟁사 모니터링",
  description:
    "꿈비 그룹 유아용품 브랜드의 8개 채널 통합 경쟁사 모니터링",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
