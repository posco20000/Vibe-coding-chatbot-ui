export type ChatRole = "user" | "assistant" | "notice";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ChatRoom = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

export function isChatRole(value: string): value is ChatRole {
  return value === "user" || value === "assistant" || value === "notice";
}
