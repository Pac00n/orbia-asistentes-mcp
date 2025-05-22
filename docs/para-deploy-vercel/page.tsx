"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";

// Tipos mínimos
interface ChatMessage { id: string; role: "user" | "assistant" | "tool" | "system"; content: string }
interface ToolCall { id: string; name: string; arguments: Record<string, unknown> }

export default function ChatPage() {
  const { assistantId } = useParams<{ assistantId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Enviar mensaje a /api/chat
  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assistantId, messages: [...messages, userMsg] }),
    });

    if (!res.ok) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "system", content: `Error ${res.status}` }]);
      return;
    }

    // Lee el stream SSE
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        const data = l.slice(5).trim();
        if (data === "[DONE]") return;
        const evt = JSON.parse(data);
        if (evt.type === "tool_call") {
          await handleToolCall(evt.toolCall as ToolCall);
        } else if (evt.type === "message") {
          setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: evt.delta }]);
        }
      }
    }
  }, [assistantId, input, messages]);

  // Ejecutar tool y reenviar resultado a LLM
  const handleToolCall = useCallback(async (toolCall: ToolCall) => {
    const res = await fetch("/api/chat/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolCall }),
    });
    const toolResult = await res.json();

    // Reinyectar en /api/chat para que el modelo continúe
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assistantId, toolResult, toolCallId: toolCall.id }),
    });
  }, [assistantId]);

  return (
    <main className="min-h-screen flex flex-col bg-gray-950 text-white">
      {/* Cabecera simple */}
      <header className="p-4 border-b border-white/10">Assistant <span className="font-bold">{assistantId}</span></header>

      {/* Área de mensajes */}
      <section className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => (
          <div key={m.id} className={`${m.role === "user" ? "text-right" : "text-left"}`}>
            <span className="inline-block px-3 py-2 rounded bg-gray-800">{m.content}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </section>

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); sendMessage(); }}
        className="p-4 border-t border-white/10 flex gap-2"
      >
        <input
          className="flex-1 bg-gray-800 rounded px-3 py-2 outline-none"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escribe un mensaje"
        />
        <button className="px-4 py-2 bg-blue-600 rounded" type="submit">Enviar</button>
      </form>
    </main>
  );
}
