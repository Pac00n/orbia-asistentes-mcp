"use client";

import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button"; // Keep for potential shadcn elements if any remain
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"; // Likely remove unless used by error display
import { Input } from "@/components/ui/input"; // Keep for input, but will be styled manually
import { getAssistantById, Assistant } from "@/lib/assistants"; // Ensure Assistant type is imported or defined
import { ArrowLeft, Send, Loader2, Paperclip, X, RefreshCw, Bot, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown"; // Keep for rendering markdown

// Define Message type locally if not imported
type Message = {
  id: string;
  role: "user" | "assistant" | "system"; // Added system role
  content: string;
  imageBase64?: string | null;
  timestamp: Date;
  isStreaming?: boolean;
};

const formatAssistantMessage = (content: string): string => {
  const citationRegex = /\【.*?\】/g; // Example from chat-v3
  return content.replace(citationRegex, "").trim();
};

export default function SpecializedAssistantChatPage() {
  const params = useParams();
  const router = useRouter();
  const assistantId = params.assistantId as string;
  
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamControllerRef = useRef<AbortController | null>(null);

  // Load assistant details
  useEffect(() => {
    const currentAssistant = getAssistantById(assistantId);
    if (currentAssistant) {
      setAssistant(currentAssistant);
    } else {
      setError(`Asistente con ID '${assistantId}' no encontrado.`);
      // Optionally redirect or show a more prominent error
    }
  }, [assistantId]);

  const showWelcomeMessage = useCallback(() => {
    if (assistant) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `¡Hola! Soy ${assistant.name}. ${assistant.welcome_message || "¿En qué puedo ayudarte hoy?"}`,
        timestamp: new Date(),
        isStreaming: false,
      }]);
    } else {
       setMessages([{
        id: "welcome-error",
        role: "system",
        content: "Cargando información del asistente...",
        timestamp: new Date(),
      }]);
    }
  }, [assistant]);

  // Load initial messages from localStorage or show welcome message
  useEffect(() => {
    if (!assistant) return; // Don't proceed until assistant info is loaded

    try {
      const storedThreadId = localStorage.getItem(`threadId_${assistantId}`);
      if (storedThreadId) {
        setCurrentThreadId(storedThreadId);
        const storedMessages = localStorage.getItem(`messages_${assistantId}`);
        if (storedMessages) {
          try {
            const parsedMessages = JSON.parse(storedMessages);
            const messagesWithDates = parsedMessages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
              isStreaming: false,
            }));
            if (messagesWithDates.length > 0) {
                setMessages(messagesWithDates);
                return; // Skip welcome if history exists
            }
          } catch (e) {
            console.error("Error al cargar mensajes anteriores:", e);
            localStorage.removeItem(`messages_${assistantId}`); // Clear corrupted data
          }
        }
      }
      showWelcomeMessage();
    } catch (e) {
      console.error("Error al inicializar el chat:", e);
      showWelcomeMessage();
    }
  }, [assistantId, showWelcomeMessage, assistant]);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0 && !messages.some(m => m.isStreaming) && messages[0]?.id !== 'welcome' && messages[0]?.id !== 'welcome-error' && currentThreadId) {
      try {
        localStorage.setItem(`messages_${assistantId}`, JSON.stringify(messages));
      } catch (e) {
        console.error("Error al guardar mensajes en localStorage:", e);
      }
    }
  }, [messages, assistantId, currentThreadId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImageBase64(reader.result as string);
      reader.readAsDataURL(file);
    }
    if (event.target) event.target.value = ""; // Reset file input
  };

  const clearImage = () => setImageBase64(null);

  const startNewConversation = () => {
    if (confirm("¿Estás seguro de que quieres comenzar una nueva conversación? Se perderá el historial actual.")) {
      if (streamControllerRef.current) {
        streamControllerRef.current.abort();
        streamControllerRef.current = null;
      }
      try {
        localStorage.removeItem(`threadId_${assistantId}`);
        localStorage.removeItem(`messages_${assistantId}`);
      } catch (e) {
        console.error("Error al eliminar datos de localStorage:", e);
      }
      setCurrentThreadId(null);
      setError(null);
      setInput("");
      setImageBase64(null);
      setIsLoading(false);
      showWelcomeMessage();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !imageBase64) || isLoading || !assistant) return;

    setError(null);
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      imageBase64,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    const currentImageBase64 = imageBase64;
    setInput("");
    setImageBase64(null);
    setIsLoading(true);

    if (streamControllerRef.current) {
      streamControllerRef.current.abort(); // Abort previous stream if any
    }
    streamControllerRef.current = new AbortController();
    const signal = streamControllerRef.current.signal;

    let assistantMessagePlaceholderId: string | null = `assistant-stream-${Date.now()}`;
    let accumulatedContent = "";

    setMessages(prev => [
      ...prev,
      {
        id: assistantMessagePlaceholderId!,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    try {
      // IMPORTANT: Assuming the API endpoint is /api/chat and it supports SSE
      // This matches the `app/api/chat/route.ts.disabled` structure
      const response = await fetch("/api/chat", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId: assistant.id, // Use the actual assistant ID from lib/assistants
          message: currentInput,
          imageBase64: currentImageBase64,
          threadId: currentThreadId,
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error del servidor o respuesta no JSON." }));
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Respuesta sin cuerpo.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        let eolIndex;
        
        while ((eolIndex = buffer.indexOf('\n\n')) !== -1) {
          const line = buffer.substring(0, eolIndex).trim();
          buffer = buffer.substring(eolIndex + 2);

          if (line.startsWith("data:")) {
            const jsonData = line.substring(5).trim();
            if (jsonData === '[DONE]') { // From chat-v3 reference, might not be sent by current API
              setIsLoading(false);
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessagePlaceholderId ? { ...msg, isStreaming: false } : msg
              ));
              streamControllerRef.current = null;
              return;
            }

            try {
              const event = JSON.parse(jsonData);

              if (event.type === 'thread.created' || event.type === 'thread.info') {
                if (event.threadId && event.threadId !== currentThreadId) {
                  setCurrentThreadId(event.threadId);
                  localStorage.setItem(`threadId_${assistantId}`, event.threadId);
                }
              }
              
              switch (event.type) {
                case 'thread.message.delta':
                  if (event.data.delta.content && event.data.delta.content[0]?.type === 'text') {
                    accumulatedContent += event.data.delta.content[0].text.value;
                    setMessages(prev => prev.map(msg =>
                      msg.id === assistantMessagePlaceholderId
                        ? { ...msg, content: formatAssistantMessage(accumulatedContent), isStreaming: true }
                        : msg
                    ));
                  }
                  break;
                case 'thread.message.completed':
                  setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessagePlaceholderId
                      ? { ...msg, content: formatAssistantMessage(accumulatedContent), isStreaming: false, id: event.data.id } // Use final ID from OpenAI
                      : msg
                  ));
                  assistantMessagePlaceholderId = null; // Reset for next potential message
                  accumulatedContent = ""; // Reset content
                  break;
                case 'thread.run.completed':
                  setIsLoading(false);
                  setMessages(prev => prev.map(msg =>
                    (msg.role === 'assistant' && msg.isStreaming) ? { ...msg, isStreaming: false } : msg
                  ));
                  streamControllerRef.current = null;
                  break;
                case 'thread.run.failed':
                case 'thread.run.cancelled':
                case 'thread.run.expired':
                  setError(event.data.last_error?.message || `Error: ${event.type}`);
                  setIsLoading(false);
                  if (assistantMessagePlaceholderId) {
                    setMessages(prev => prev.filter(msg => msg.id !== assistantMessagePlaceholderId));
                  }
                  streamControllerRef.current = null;
                  break;
                case 'error': // Custom error from backend SSE
                  setError(event.data?.details || event.data?.message || "Error en la conexión");
                  setIsLoading(false);
                  if (assistantMessagePlaceholderId) {
                    setMessages(prev => prev.filter(msg => msg.id !== assistantMessagePlaceholderId));
                  }
                  streamControllerRef.current = null;
                  break;
                case 'stream.ended': // Custom event from backend to signal end
                  setIsLoading(false);
                  setMessages(prev => prev.map(msg =>
                    (msg.role === 'assistant' && msg.isStreaming) ? { ...msg, isStreaming: false } : msg
                  ));
                  if (event.error) setError(prevError => prevError || event.error);
                  streamControllerRef.current = null;
                  return; // Exit processing loop
              }
            } catch (e) {
              console.error("Error procesando el stream:", e, jsonData);
              // Continue processing other lines if one fails
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || "Error al enviar el mensaje");
        if (assistantMessagePlaceholderId) {
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessagePlaceholderId));
        }
      }
    } finally {
      // Fallback to ensure loading is stopped if not handled by a stream event
      if (isLoading && (!streamControllerRef.current || streamControllerRef.current.signal.aborted)) {
         setIsLoading(false);
      }
       setMessages(prev => prev.map(msg => msg.isStreaming ? { ...msg, isStreaming: false } : msg ));
    }
  };

  const AccentGradient = assistant?.accentColor || "bg-gradient-to-r from-orange-500 via-red-500 to-purple-600";
  const SubtleGradient = assistant?.subtleColor || "bg-gradient-to-r from-orange-400 to-purple-500";

  const [logoRotation, setLogoRotation] = useState(0);
  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      setLogoRotation(prev => (prev + 0.1) % 360);
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  if (!assistant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-4">
        <Loader2 size={48} className="animate-spin text-purple-500 mb-4" />
        <p className="text-xl mb-2">Cargando asistente...</p>
        {error && <p className="text-red-500">{error}</p>}
         <Link href="/assistants" className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
            Volver a la lista de Asistentes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen text-white bg-gray-950">
      <div className="fixed inset-0 overflow-hidden -z-10">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/20 via-purple-900/10 to-transparent"></div>
        <div
          className="fixed inset-0 flex justify-center items-center pointer-events-none"
          style={{ filter: 'blur(12px)', opacity: 0.15 }}
        >
          <motion.div
            className="w-full h-full flex items-center justify-center"
            style={{ rotate: logoRotation }}
          >
            <Image
              src={assistant.logo_path || "/LogosNuevos/logo_orbia_sin_texto.png"}
              alt={`${assistant.name} Logo Fondo`}
              width={700}
              height={700}
              className="object-contain opacity-90"
              priority
            />
          </motion.div>
        </div>
      </div>

      <header className="sticky top-0 z-20 flex items-center justify-between p-4 border-b border-white/10 bg-gray-900/60 backdrop-blur-md">
        <motion.button
          whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.1)" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push('/assistants')}
          className="p-2 rounded-full transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft size={20} className="text-gray-300" />
        </motion.button>
        <h1 className={`text-xl font-bold tracking-tight bg-clip-text text-transparent ${SubtleGradient}`}>
          {assistant.name}
        </h1>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 15, backgroundColor: "rgba(255,255,255,0.1)" }}
          whileTap={{ scale: 0.95 }}
          onClick={startNewConversation}
          className="p-2 rounded-full transition-colors text-sm text-gray-400 hover:text-white"
          aria-label="Nueva conversación"
          title="Nueva conversación"
        >
          <RefreshCw size={18} />
        </motion.button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 scroll-smooth">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              layout
              key={message.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 300, damping: 25, duration: 0.3 }}
              className={`flex ${ message.role === "system" ? "justify-center" : message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className="flex items-end gap-2 max-w-[80%] md:max-w-[70%]">
                {message.role === "assistant" && (
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center self-start ${assistant.bgColor || AccentGradient}`}>
                     <Image src={assistant.avatar_path || "/LogosNuevos/logo_orbia_sin_texto.png"} alt="Asistente" width={20} height={20} className="rounded-full"/>
                  </div>
                )}
                 <div
                  className={`px-4 py-3 rounded-2xl shadow-lg break-words
                    ${message.role === "user"
                      ? "bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-br-md" // User bubble style from chat-v3
                      : message.role === "assistant"
                      ? "bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-bl-md" // Assistant bubble style from chat-v3
                      : "bg-gray-600/50 text-gray-300 text-xs italic text-center w-full" // System message
                    }`}
                >
                  {message.imageBase64 && message.role === "user" && (
                    <div className="mb-2 rounded-lg overflow-hidden">
                      <img
                        src={message.imageBase64}
                        alt="Imagen adjunta"
                        className="max-w-full h-auto max-h-48 object-cover rounded-lg"
                      />
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.role === "assistant" && message.isStreaming && !message.content ? (
                      <div className="flex space-x-1 py-1">
                        <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    ) : (
                      <div className="prose prose-sm prose-invert max-w-none" style={{color: 'white'}}>
                        <ReactMarkdown components={{ 
                            // Customize rendering if needed, e.g., for links or code blocks
                            a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-orange-300 hover:text-orange-200 underline"/>,
                            // p: ({node, ...props}) => <p {...props} style={{ marginBottom: '0.5em', marginTop: '0.5em' }} />,
                         }}>
                          {formatAssistantMessage(message.content)}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end items-center mt-2">
                    {message.role === "assistant" && message.isStreaming && message.content && (
                      <div className="text-xs text-gray-400 mr-auto">
                        Escribiendo...
                      </div>
                    )}
                    <span className="text-xs text-gray-400">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                {message.role === "user" && (
                   <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center self-start">
                    <User size={18} className="text-white/80"/>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-red-700/90 backdrop-blur-sm border border-red-500 text-white px-4 py-2 rounded-lg shadow-xl text-sm flex items-center space-x-2"
          >
            <X size={16} className="text-red-200"/>
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-200 hover:text-white"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="sticky bottom-0 z-20 p-3 md:p-4 border-t border-white/10 bg-gray-900/60 backdrop-blur-md">
        <div className="max-w-3xl mx-auto">
          {imageBase64 && (
            <motion.div 
                initial={{opacity:0, height:0, y:10}} animate={{opacity:1, height:'auto', y:0}} exit={{opacity:0, height:0, y:10}}
                className="relative mb-2 p-2 border border-gray-700 rounded-lg max-w-[120px] bg-gray-800/70 backdrop-blur-sm"
            >
                <img src={imageBase64} alt="Vista previa" className="h-20 w-auto rounded-md object-cover"/>
                <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors" aria-label="Eliminar imagen">
                    <X size={14}/>
                </button>
            </motion.div>
          )}
          <form onSubmit={handleSubmit} className="flex items-end space-x-2 md:space-x-3">
            <motion.button
              type="button"
              whileHover={{ scale: 1.1, backgroundColor: "rgba(251, 146, 60, 0.1)" }}
              whileTap={{ scale: 0.95 }}
              className="p-2.5 rounded-full text-gray-400 hover:text-orange-400 transition-colors"
              aria-label="Adjuntar archivo"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip size={20} />
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" disabled={isLoading} />
            </motion.button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Mensaje a ${assistant.name}...`}
              className="flex-1 p-3 rounded-xl bg-gray-800/90 border border-gray-700 focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70 outline-none transition-all placeholder-gray-500 text-sm text-gray-100 resize-none overflow-y-auto max-h-32 leading-tight"
              disabled={isLoading}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isLoading && input.trim()) handleSubmit(e as any);
                }
              }}
              style={{scrollbarWidth: 'thin', scrollbarColor: '#4B5563 #374151'}}
            />
            <motion.button
              type="submit"
              disabled={isLoading || (!input.trim() && !imageBase64)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`p-3 rounded-xl text-white disabled:opacity-60 transition-all duration-150 ease-in-out ${AccentGradient} hover:shadow-xl`}
              style={{boxShadow: isLoading || (!input.trim() && !imageBase64) ? 'none' : `0 4px 15px rgba(${assistant?.accentRgb || '255,165,0'}, 0.3)`}}
              aria-label="Enviar mensaje"
            >
              {isLoading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <Loader2 size={20} />
                </motion.div>
              ) : (
                <Send size={20} />
              )}
            </motion.button>
          </form>
          <div className="flex justify-center items-center mt-2.5">
            <p className="text-xs text-gray-500">
              {isLoading ? `${assistant.name} está pensando...` : `Chat con ${assistant.name}`}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
