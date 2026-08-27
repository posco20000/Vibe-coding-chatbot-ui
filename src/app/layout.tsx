import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "서초 AI | 로그인 기반 AI 챗봇",
  description: "Google 계정으로 안전하게 이용하는 서초 AI 챗봇",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
