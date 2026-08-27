"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function signOut() {
    setIsLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      className="logout-button"
      type="button"
      onClick={signOut}
      disabled={isLoading}
    >
      {isLoading ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
