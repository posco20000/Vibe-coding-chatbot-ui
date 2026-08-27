import type { ChatRole } from "@/lib/chat-history";
import type { Json } from "@/lib/supabase/database.types";

const LEGACY_STORAGE_KEY_PREFIX = "seocho-ai-chat-rooms-v1";
const MAX_ROOMS = 250;
const MAX_MESSAGES = 10_000;
const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 50_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LegacyMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type LegacyRoom = {
  id: string;
  title: string;
  messages: LegacyMessage[];
  updatedAt: number;
};

export type LegacyChatImportRoom = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: {
    id: string;
    role: ChatRole;
    content: string;
    created_at: string;
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRole(value: unknown): value is ChatRole {
  return value === "user" || value === "assistant" || value === "notice";
}

function assertUuid(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error(`${label} ID가 올바르지 않습니다.`);
  }
}

function parseMessage(value: unknown): LegacyMessage {
  if (!isRecord(value)) {
    throw new Error("메시지 형식이 올바르지 않습니다.");
  }

  assertUuid(value.id, "메시지");

  if (!isRole(value.role)) {
    throw new Error("메시지 역할이 올바르지 않습니다.");
  }

  if (
    typeof value.content !== "string" ||
    value.content.trim().length === 0 ||
    value.content.length > MAX_CONTENT_LENGTH
  ) {
    throw new Error("메시지 내용이 저장 가능한 길이가 아닙니다.");
  }

  return {
    id: value.id,
    role: value.role,
    content: value.content,
  };
}

function parseRoom(value: unknown): LegacyRoom {
  if (!isRecord(value) || !Array.isArray(value.messages)) {
    throw new Error("대화 형식이 올바르지 않습니다.");
  }

  assertUuid(value.id, "대화");

  if (
    typeof value.title !== "string" ||
    value.title.trim().length === 0 ||
    value.title.length > MAX_TITLE_LENGTH
  ) {
    throw new Error("대화 제목이 저장 가능한 길이가 아닙니다.");
  }

  if (
    typeof value.updatedAt !== "number" ||
    !Number.isFinite(value.updatedAt)
  ) {
    throw new Error("대화 시간이 올바르지 않습니다.");
  }

  try {
    new Date(value.updatedAt).toISOString();
  } catch {
    throw new Error("대화 시간이 올바르지 않습니다.");
  }

  return {
    id: value.id,
    title: value.title,
    messages: value.messages.map(parseMessage),
    updatedAt: value.updatedAt,
  };
}

export function getLegacyChatStorageKey(userId: string) {
  return `${LEGACY_STORAGE_KEY_PREFIX}:${userId}`;
}

export function createLegacyChatImportPayload(
  serializedHistory: string,
): LegacyChatImportRoom[] {
  const parsed: unknown = JSON.parse(serializedHistory);

  if (!isRecord(parsed) || !Array.isArray(parsed.rooms)) {
    throw new Error("저장된 채팅 형식이 올바르지 않습니다.");
  }

  if (parsed.rooms.length > MAX_ROOMS) {
    throw new Error(`한 번에 ${MAX_ROOMS}개 대화까지 이전할 수 있습니다.`);
  }

  const rooms = parsed.rooms.map(parseRoom);
  const messageCount = rooms.reduce(
    (total, room) => total + room.messages.length,
    0,
  );

  if (messageCount > MAX_MESSAGES) {
    throw new Error(
      `한 번에 ${MAX_MESSAGES.toLocaleString("ko-KR")}개 메시지까지 이전할 수 있습니다.`,
    );
  }

  const roomIds = new Set<string>();
  const messageIds = new Set<string>();

  return rooms.map((room) => {
    if (roomIds.has(room.id)) {
      throw new Error("중복된 대화 ID가 있습니다.");
    }
    roomIds.add(room.id);

    const updatedAt = new Date(room.updatedAt).toISOString();
    const messages = room.messages.map((message, index) => {
      if (messageIds.has(message.id)) {
        throw new Error("중복된 메시지 ID가 있습니다.");
      }
      messageIds.add(message.id);

      const offset = (room.messages.length - index - 1) * 1_000;

      return {
        id: message.id,
        role: message.role,
        content: message.content,
        created_at: new Date(Math.max(0, room.updatedAt - offset)).toISOString(),
      };
    });

    return {
      id: room.id,
      title: room.title,
      created_at: messages[0]?.created_at ?? updatedAt,
      updated_at: updatedAt,
      messages,
    };
  });
}

export function toSupabaseJson(rooms: LegacyChatImportRoom[]): Json {
  return rooms as Json;
}
