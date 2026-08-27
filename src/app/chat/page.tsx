import { redirect } from "next/navigation";

import ChatApp from "@/components/chat-app";
import { createClient } from "@/lib/supabase/server";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims) redirect("/");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const metadata = user.user_metadata as Record<string, unknown>;
  const displayName =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    user.email?.split("@")[0] ||
    "사용자";

  return (
    <ChatApp
      user={{
        id: user.id,
        name: displayName,
        email: user.email ?? "이메일 정보 없음",
      }}
    />
  );
}
