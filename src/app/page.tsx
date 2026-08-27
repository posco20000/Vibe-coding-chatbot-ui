import { redirect } from "next/navigation";

import GoogleLoginButton from "@/components/google-login-button";
import { createClient } from "@/lib/supabase/server";

type LandingPageProps = {
  searchParams: Promise<{ auth_error?: string }>;
};

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const { auth_error: authError } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (claimsData?.claims) redirect("/chat");

  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="주요 탐색">
        <a className="brand" href="#home" aria-label="서초 AI 홈">
          <span className="brand-mark">S</span>
          <span>서초 AI</span>
        </a>
        <span className="landing-nav-note">MEMBERS ONLY</span>
      </nav>

      <section className="landing-hero" id="home">
        <div className="landing-kicker">YOUR PRIVATE AI WORKSPACE</div>
        <h1>
          질문에서 답까지,
          <br />
          더 빠르고 선명하게.
        </h1>
        <p>
          Google 계정 하나로 시작하세요. 로그인한 사용자만 개인 채팅 공간에
          접근할 수 있습니다.
        </p>
        <GoogleLoginButton />
        {authError ? (
          <p className="login-error landing-auth-error">
            로그인 처리가 완료되지 않았습니다. 다시 시도해 주세요.
          </p>
        ) : null}
        <span className="landing-terms">
          계속하면 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
        </span>
      </section>

      <footer className="landing-footer">
        <span>SEOCHO AI</span>
        <span>SECURE ACCESS · POWERED BY SUPABASE</span>
      </footer>
    </main>
  );
}
