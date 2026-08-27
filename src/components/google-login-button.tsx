"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.4-4H3.3v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.6 14.1a6 6 0 0 1 0-3.9V7.6H3.3a10 10 0 0 0 0 9l3.3-2.5Z"
      />
      <path
        fill="#EA4335"
        d="M12 6a5.4 5.4 0 0 1 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.7 5.6l3.3 2.6A5.8 5.8 0 0 1 12 6Z"
      />
    </svg>
  );
}

export default function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function signInWithGoogle() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/chat`,
        },
      });

      if (error) throw error;
    } catch {
      setErrorMessage("Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setIsLoading(false);
    }
  }

  return (
    <div className="login-action">
      <button
        className="google-login-button"
        type="button"
        onClick={signInWithGoogle}
        disabled={isLoading}
      >
        <GoogleIcon />
        {isLoading ? "Google로 이동 중…" : "Google로 계속하기"}
      </button>
      {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
    </div>
  );
}
