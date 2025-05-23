// lib/chat-completions/types.ts
import { Assistant } from "../assistants";

export type Role = "user" | "assistant" | "system" | "tool";

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  toolCallId?: string; // Para mensajes de tipo "tool"
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface StreamToolCall {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters?: Record<string, any>;
  };
}

export interface MCPServer {
  id: string;
  url: string;
  name: string;
}

export interface ChatCompletionsOptions {
  assistant: Assistant;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  mcpServers?: MCPServer[];
  forceReal?: boolean;
}

export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: StreamToolCall[];
    };
    finish_reason: string | null;
  }[];
}