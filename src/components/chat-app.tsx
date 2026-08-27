"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import LogoutButton from "@/components/logout-button";
import type { ChatMessage, ChatRoom } from "@/lib/chat-history";
import {
  createLegacyChatImportPayload,
  getLegacyChatStorageKey,
  toSupabaseJson,
} from "@/lib/legacy-chat-migration";
import { createClient } from "@/lib/supabase/client";

const FALLBACK_NOTICE = "요청에 실패했습니다.";

type ChatAppProps = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  initialRooms: ChatRoom[];
  initialLoadError?: string;
};

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 7-7m-7 7 7 7M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
    </svg>
  );
}

export default function ChatApp({
  user,
  initialRooms,
  initialLoadError,
}: ChatAppProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rooms, setRooms] = useState<ChatRoom[]>(initialRooms);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(
    initialRooms[0]?.id ?? null,
  );
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncError, setSyncError] = useState(initialLoadError ?? "");
  const [migrationMessage, setMigrationMessage] = useState("");
  const migrationAttemptedRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const activeRoom = rooms.find((room) => room.id === activeRoomId);
  const messages = activeRoom?.messages ?? [];

  useEffect(() => {
    if (migrationAttemptedRef.current) return;
    migrationAttemptedRef.current = true;

    const storageKey = getLegacyChatStorageKey(user.id);

    async function migrateLegacyHistory() {
      try {
        const storedHistory = localStorage.getItem(storageKey);

        if (!storedHistory) return;

        const legacyRooms = createLegacyChatImportPayload(storedHistory);

        if (legacyRooms.length === 0) {
          localStorage.removeItem(storageKey);
          return;
        }

        setMigrationMessage("기존 브라우저 대화를 안전하게 이전하고 있습니다…");

        const { error } = await supabase.rpc("import_legacy_chat_history", {
          p_rooms: toSupabaseJson(legacyRooms),
        });

        if (error) throw error;

        localStorage.removeItem(storageKey);

        setMigrationMessage("기존 대화 이전이 완료되었습니다.");
        window.location.reload();
      } catch {
        setMigrationMessage("");
        setSyncError(
          "기존 브라우저 대화를 DB로 이전하지 못했습니다. 원본은 브라우저에 그대로 보관되어 있습니다.",
        );
      }
    }

    void migrateLegacyHistory();
  }, [supabase, user.id]);

  useEffect(() => {
    if (messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeRoomId, isSending, messages.length]);

  function appendMessageToRoom(roomId: string, message: ChatMessage) {
    setRooms((current) => {
      const room = current.find((item) => item.id === roomId);
      if (!room) return current;

      const updatedRoom = {
        ...room,
        messages: [...room.messages, message],
        updatedAt: message.createdAt,
      };

      return [updatedRoom, ...current.filter((item) => item.id !== roomId)];
    });
  }

  function startNewChat() {
    setActiveRoomId(null);
    setPrompt("");
    setSidebarOpen(false);
    setSyncError("");
  }

  function openRoom(roomId: string) {
    setActiveRoomId(roomId);
    setPrompt("");
    setSidebarOpen(false);
    setSyncError("");
  }

  async function deleteRoom(roomId: string) {
    const room = rooms.find((item) => item.id === roomId);
    if (!room || isSending || deletingRoomId) return;

    if (!window.confirm("이 대화와 저장된 메시지를 삭제할까요?")) return;

    setDeletingRoomId(roomId);
    setSyncError("");

    const { error } = await supabase
      .from("chat_rooms")
      .delete()
      .eq("id", roomId)
      .eq("user_id", user.id);

    if (error) {
      setSyncError("대화를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setDeletingRoomId(null);
      return;
    }

    const remainingRooms = rooms.filter((item) => item.id !== roomId);
    setRooms(remainingRooms);

    if (activeRoomId === roomId) {
      setActiveRoomId(remainingRooms[0]?.id ?? null);
      setPrompt("");
    }

    setDeletingRoomId(null);
  }

  async function persistMessage(roomId: string, message: ChatMessage) {
    const { error } = await supabase.from("chat_messages").insert({
      id: message.id,
      user_id: user.id,
      room_id: roomId,
      role: message.role,
      content: message.content,
      created_at: message.createdAt,
    });

    if (error) throw new Error("CHAT_MESSAGE_SAVE_FAILED");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = prompt.trim();

    if (!message || isSending) return;

    const isNewRoom = activeRoomId === null;
    const roomId = activeRoomId ?? crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      createdAt,
    };
    const title = Array.from(message).slice(0, 60).join("");

    setPrompt("");
    setIsSending(true);
    setSyncError("");

    try {
      if (isNewRoom) {
        const { error } = await supabase.from("chat_rooms").insert({
          id: roomId,
          user_id: user.id,
          title,
          created_at: createdAt,
          updated_at: createdAt,
        });

        if (error) throw new Error("CHAT_ROOM_SAVE_FAILED");
      }

      await persistMessage(roomId, userMessage);
    } catch {
      if (isNewRoom) {
        await supabase
          .from("chat_rooms")
          .delete()
          .eq("id", roomId)
          .eq("user_id", user.id);
      }

      setPrompt(message);
      setSyncError("메시지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setIsSending(false);
      return;
    }

    if (isNewRoom) {
      setRooms((current) => [
        {
          id: roomId,
          title,
          messages: [userMessage],
          updatedAt: createdAt,
        },
        ...current,
      ]);
      setActiveRoomId(roomId);
    } else {
      appendMessageToRoom(roomId, userMessage);
    }

    let responseMessage: ChatMessage;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: messages
            .filter((item) => item.role !== "notice")
            .map((item) => ({ role: item.role, content: item.content })),
        }),
      });
      const data = (await response.json()) as {
        code?: string;
        message?: string;
      };

      if (response.status === 401) {
        router.replace("/");
        router.refresh();
        return;
      }

      responseMessage = {
        id: crypto.randomUUID(),
        role: data.code ? "notice" : "assistant",
        content: data.message ?? FALLBACK_NOTICE,
        createdAt: new Date().toISOString(),
      };
    } catch {
      responseMessage = {
        id: crypto.randomUUID(),
        role: "notice",
        content: FALLBACK_NOTICE,
        createdAt: new Date().toISOString(),
      };
    }

    appendMessageToRoom(roomId, responseMessage);

    try {
      await persistMessage(roomId, responseMessage);
    } catch {
      setSyncError(
        "답변은 표시했지만 저장하지 못했습니다. 페이지를 새로고침하면 사라질 수 있습니다.",
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="app-shell">
      <button
        className={`sidebar-backdrop ${sidebarOpen ? "is-visible" : ""}`}
        type="button"
        aria-label="사이드바 닫기"
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand-row">
            <a className="brand" href="#top" aria-label="서초 AI 홈">
              <span className="brand-mark">S</span>
              <span>서초 AI</span>
            </a>
            <button
              className="icon-button sidebar-close"
              type="button"
              aria-label="사이드바 닫기"
              onClick={() => setSidebarOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <button
          className="new-chat-button"
          type="button"
          onClick={startNewChat}
          disabled={isSending}
        >
          <PlusIcon />
          새 대화
        </button>

        {rooms.length > 0 ? (
          <nav className="conversation-nav" aria-label="대화 목록">
            <span className="section-label">저장된 대화</span>
            {rooms.map((room) => (
              <div
                className={`conversation-item ${
                  room.id === activeRoomId ? "is-active" : ""
                }`}
                key={room.id}
              >
                <button
                  className="conversation-select"
                  type="button"
                  aria-current={room.id === activeRoomId ? "page" : undefined}
                  onClick={() => openRoom(room.id)}
                  disabled={isSending}
                >
                  <span>{room.title}</span>
                </button>
                <button
                  className="delete-room-button"
                  type="button"
                  aria-label={`${room.title} 삭제`}
                  onClick={() => deleteRoom(room.id)}
                  disabled={isSending || deletingRoomId !== null}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </nav>
        ) : null}
      </aside>

      <main className="main-panel" id="top">
        <header className="topbar">
          <div className="topbar-brand">
            <button
              className="icon-button mobile-menu"
              type="button"
              aria-label="사이드바 열기"
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon />
            </button>
            <span className="topbar-title">서초 AI</span>
          </div>
          <div className="account-bar" aria-label="로그인 사용자 정보">
            <span className="account-avatar" aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className="account-copy">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </span>
            <LogoutButton />
          </div>
        </header>

        <section className="chat-stage">
          <header className="chat-masthead">
            <h1>
              무엇을
              <br />
              도와드릴까요?
            </h1>
            {syncError ? (
              <p className="chat-sync-status" role="alert">
                {syncError}
              </p>
            ) : null}
            {migrationMessage ? (
              <p className="chat-sync-status is-info" role="status">
                {migrationMessage}
              </p>
            ) : null}
          </header>

          <div className="conversation" aria-live="polite">
            {messages.length > 0 ? (
              <div className="message-list">
                {messages.map((chatMessage) =>
                  chatMessage.role === "user" ? (
                    <article
                      className="message user-message"
                      key={chatMessage.id}
                    >
                      <span className="message-label">나</span>
                      <p>{chatMessage.content}</p>
                    </article>
                  ) : chatMessage.role === "notice" ? (
                    <article
                      className="message notice-message"
                      key={chatMessage.id}
                    >
                      <div className="notice-mark" aria-hidden="true">
                        !
                      </div>
                      <p>{chatMessage.content}</p>
                    </article>
                  ) : (
                    <article
                      className="message assistant-message"
                      key={chatMessage.id}
                    >
                      <span className="message-label">서초 Agent</span>
                      <p>{chatMessage.content}</p>
                    </article>
                  ),
                )}
                {isSending ? (
                  <div className="loading-row" role="status">
                    <span />
                    <span />
                    <span />
                    <span className="sr-only">답변 생성 중</span>
                  </div>
                ) : null}
                <div ref={endRef} />
              </div>
            ) : null}
          </div>
        </section>

        <footer className="composer-wrap">
          <form className="composer" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="chat-input">
              메시지 입력
            </label>
            <textarea
              id="chat-input"
              rows={1}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="메시지를 입력하세요"
              disabled={isSending}
            />
            <button
              className="send-button"
              type="submit"
              aria-label="메시지 보내기"
              disabled={!prompt.trim() || isSending}
            >
              <ArrowIcon />
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}
