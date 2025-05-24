'use client';

import { useState } from 'react';

export default function Chat() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState('');

  async function send() {
    const res = await fetch('/api/chat/mcpv6', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userPrompt: input }),
    });
    const text = await res.text();
    setMessages((m) => [...m, '👤 ' + input, '🤖 ' + text]);
    setInput('');
  }

  return (
    <div className="mx-auto max-w-xl p-4 space-y-4">
      {messages.map((m, i) => (<p key={i}>{m}</p>))}
      <input
        className="border p-2 w-full"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        placeholder="Escribe tu pregunta…"
      />
    </div>
  );
}
