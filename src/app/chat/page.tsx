import { redirect } from "next/navigation";

import ChatApp from "@/components/chat-app";
import type { ChatMessage, ChatRoom } from "@/lib/chat-history";
import { isChatRole } from "@/lib/chat-history";
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

  let initialRooms: ChatRoom[] = [];
  let initialLoadError: string | undefined;

  const { data: roomRows, error: roomsError } = await supabase
    .from("chat_rooms")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (roomsError) {
    initialLoadError =
      "저장된 대화를 불러오지 못했습니다. 새로고침해 다시 시도해 주세요.";
  } else if (roomRows.length > 0) {
    const roomIds = roomRows.map((room) => room.id);
    const { data: messageRows, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id, room_id, role, content, created_at")
      .eq("user_id", user.id)
      .in("room_id", roomIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(5000);

    if (messagesError) {
      initialLoadError =
        "저장된 메시지를 불러오지 못했습니다. 새로고침해 다시 시도해 주세요.";
    } else {
      const messagesByRoom = new Map<string, ChatMessage[]>();

      for (const message of messageRows) {
        if (!isChatRole(message.role)) continue;

        const roomMessages = messagesByRoom.get(message.room_id) ?? [];
        roomMessages.push({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.created_at,
        });
        messagesByRoom.set(message.room_id, roomMessages);
      }

      initialRooms = roomRows.map((room) => ({
        id: room.id,
        title: room.title,
        messages: messagesByRoom.get(room.id) ?? [],
        updatedAt: room.updated_at,
      }));
    }
  }

  return (
    <ChatApp
      user={{
        id: user.id,
        name: displayName,
        email: user.email ?? "이메일 정보 없음",
      }}
      initialRooms={initialRooms}
      initialLoadError={initialLoadError}
    />
  );
}
