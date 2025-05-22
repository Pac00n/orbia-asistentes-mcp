"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image"; // Mantener si se usa en el diseño original de v3

// Tipos mínimos
interface ChatMessage { id: string; role: "user" | "assistant" | "tool" | "system"; content: string; isStreaming?: boolean; }
interface ToolCall { id: string; name: string; arguments: string } // Arguments as string from OpenAI

export default function ChatPage() {
  const { assistantId } = useParams<{ assistantId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Añadido para indicar carga
  const [error, setError] = useState<string | null>(null); // Añadido para mostrar errores
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamControllerRef = useRef<AbortController | null>(null); // Para cancelar stream

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Enviar mensaje a /api/chat/mcpv4
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return; // No enviar si input vacío o cargando

    setError(null); // Limpiar errores anteriores
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: input };
    
    // Añadir mensaje del usuario inmediatamente
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input; // Capturar input actual
    setInput(""); // Limpiar input

    setIsLoading(true); // Indicar que está cargando

    // Cancelar stream anterior si existe
    if (streamControllerRef.current) {
      streamControllerRef.current.abort();
    }
    streamControllerRef.current = new AbortController();
    const signal = streamControllerRef.current.signal;

    let assistantMessagePlaceholderId: string | null = null;
    let accumulatedContent = "";

    try {
      // Llamada a nuestra API de MCPv4
      const res = await fetch("/api/chat/mcpv4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Enviar historial completo de mensajes (excluyendo mensajes de sistema si es necesario,
        // pero nuestra API de mcpv4 espera el array tal cual)
        body: JSON.stringify({ messages: [...messages, userMsg] }),
        signal, // Pasar señal de aborto
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error: ${res.status}`);
      }

      if (!res.body) {
        throw new Error("No se pudo obtener la respuesta del servidor");
      }

      // Maneja el stream SSE de /api/chat/mcpv4
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Añadir placeholder para el mensaje del asistente si aún no existe
      assistantMessagePlaceholderId = `assistant-stream-${Date.now()}`;
      setMessages(prev => {
        if (!prev.some(msg => msg.id === assistantMessagePlaceholderId)) {
          return [...prev, { id: assistantMessagePlaceholderId!, role: "assistant", content: "", isStreaming: true }];
        }
        return prev;
      });

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        let eolIndex;
        
        while ((eolIndex = buffer.indexOf('\n\n')) !== -1) {
          const line = buffer.substring(0, eolIndex).trim();
          buffer = buffer.substring(eolIndex + 2);

          if (line.startsWith("data:")) {
            const jsonData = line.substring(5).trim();
            if (jsonData === '[DONE]') {
              setIsLoading(false);
              // Marcar el mensaje del asistente como no streaming al finalizar
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessagePlaceholderId
                  ? { ...msg, isStreaming: false }
                  : msg
              ));
              return; // Terminar de procesar el stream
            }

            try {
              const event = JSON.parse(jsonData);
              
              // Manejar eventos de nuestra API de MCPv4 (text, toolCall, toolResult)
              console.log('Evento MCPv4 recibido:', event);
              
              if (event.text) {
                // Acumular y mostrar texto
                accumulatedContent += event.text;
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessagePlaceholderId
                    ? { ...msg, content: accumulatedContent, isStreaming: true }
                    : msg
                ));
              } else if (event.toolCall) {
                // Mostrar llamada a herramienta
                const toolCall = event.toolCall.data; // El evento toolCall de nuestra API tiene la data anidada
                const toolCallContent = `Llamando a herramienta: ${toolCall.name}(${toolCall.arguments})`;
                 setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'system', content: toolCallContent }]); // Mostrar como mensaje del sistema
              } else if (event.toolResult) {
                 // Mostrar resultado de herramienta
                 const toolResult = event.toolResult.data; // El evento toolResult de nuestra API tiene la data anidada
                 const resultContent = `Resultado de ${toolResult.toolName || 'herramienta'}: ${JSON.stringify(toolResult.result || toolResult.error || toolResult)}`;
                 setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'system', content: resultContent }]); // Mostrar como mensaje del sistema
              } else if (event.type === 'error') { // Manejar errores del stream
                 setError(event.data?.message || "Error en el stream");
              }
              
              // Forzar scroll después de cada evento relevante
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

            } catch (e) {
              console.error("Error procesando el stream:", e, jsonData);
              setError(`Error procesando stream: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') { // Ignorar errores de cancelación
        console.error("Error al enviar mensaje o procesar stream:", err);
        setError(err.message || "Error al enviar el mensaje");
        // Opcional: remover el mensaje del usuario si falló el envío inicial
        // setMessages(prev => prev.filter(msg => msg.id !== userMsg.id));
        // Opcional: restaurar el input
        // setInput(currentInput);
      }
      // Remover placeholder si hubo un error antes de recibir contenido
      if (assistantMessagePlaceholderId) {
         setMessages(prev => prev.filter(msg => msg.id !== assistantMessagePlaceholderId || msg.content !== ""));
      }
    } finally {
      setIsLoading(false); // Siempre quitar loading al finalizar o haber error
      streamControllerRef.current = null;
    }
  }, [input, isLoading, messages]); // Añadir dependencias necesarias

  // Eliminar handleToolCall ya que la API de MCPv4 maneja la ejecución internamente
  // const handleToolCall = useCallback(async (toolCall: ToolCall) => { ... }, [assistantId]);

  return (
    <main className="min-h-screen flex flex-col bg-gray-950 text-white">
      {/* Cabecera simple */}
      <header className="p-4 border-b border-white/10">Assistant <span className="font-bold">{assistantId}</span></header>

      {/* Área de mensajes */}
      <section className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => (
          <div key={m.id} className={`${m.role === "user" ? "text-right" : "text-left"}`}>
            {/* Mostrar indicador de streaming si aplica */}
            <span className={`inline-block px-3 py-2 rounded ${m.role === "user" ? "bg-blue-600" : "bg-gray-800"} ${m.isStreaming ? 'animate-pulse' : ''}`}>
              {m.content || (m.isStreaming ? '...' : '')} {/* Mostrar '...' si streaming y sin contenido */}
            </span>
          </div>
        ))}
        {isLoading && ( // Indicador de carga general
           <div className="text-left">
             <span className="inline-block px-3 py-2 rounded bg-gray-800 animate-pulse">...</span>
           </div>
        )}
        {error && ( // Mostrar error
           <div className="text-left text-red-500">
             <span className="inline-block px-3 py-2 rounded bg-red-900">{error}</span>
           </div>
        )}
        <div ref={bottomRef} />
      </section>

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); sendMessage(); }}
        className="p-4 border-t border-white/10 flex gap-2"
      >
        <input
          className="flex-1 bg-gray-800 rounded px-3 py-2 outline-none text-white" // Asegurar color de texto
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={isLoading ? "Esperando respuesta..." : "Escribe un mensaje"} // Placeholder dinámico
          disabled={isLoading} // Deshabilitar input mientras carga
        />
        <button className="px-4 py-2 bg-blue-600 rounded disabled:opacity-50" type="submit" disabled={!input.trim() || isLoading}>
          {isLoading ? 'Enviando...' : 'Enviar'} {/* Texto dinámico */}
        </button>
      </form>
    </main>
  );
}
