"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Send, RefreshCw, Loader2, X, Bot, User, Cpu, Hammer, CheckCircle, Circle } from "lucide-react"; // Added Hammer, CheckCircle, Circle
import { motion, AnimatePresence } from "framer-motion";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isStreaming?: boolean; 
};

// Define Tool type
type Tool = {
  id: string; // Assuming 'name' from API can be used as 'id'
  name: string;
  description?: string;
};

// Helper function to format assistant messages (e.g., remove citations if any)
// For MCP v5, the backend already provides detailed verification info, so this might just be a pass-through
const formatAssistantMessage = (content: string): string => {
  // Example: const citationRegex = /\【.*?\】/g;
  // return content.replace(citationRegex, "").trim();
  return content; 
};

export default function MCPv5ChatPage() {
  const router = useRouter();
  
  const [assistantName, setAssistantName] = useState("MCP v5 Assistant");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [showToolSelector, setShowToolSelector] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // File input ref is not used as image uploads are not supported by the current mcpv5 API
  // const fileInputRef = useRef<HTMLInputElement>(null);

  const showWelcomeMessage = useCallback(() => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: `¡Hola! Soy el ${assistantName}. ¿En qué puedo ayudarte hoy? Este asistente tiene acceso a herramientas externas.`,
      timestamp: new Date(),
      isStreaming: false
    }]);
  }, [assistantName]);

  // Load welcome message and tools on initial mount
  useEffect(() => {
    showWelcomeMessage();
    fetchAvailableTools();
  }, [showWelcomeMessage]); // fetchAvailableTools will be defined below

  const fetchAvailableTools = async () => {
    try {
      const response = await fetch('/api/chat/mcpv5'); // Using GET on /api/chat/mcpv5
      if (!response.ok) {
        throw new Error(`Error fetching tools: ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.tools) {
        // Assuming 'name' can be used as 'id' for tools
        setAvailableTools(data.tools.map((tool: any) => ({ id: tool.name, name: tool.name, description: tool.description })));
      } else {
        setAvailableTools([]);
        console.warn("Failed to parse tools or no tools available:", data);
      }
    } catch (err) {
      console.error("Error fetching available tools:", err);
      setAvailableTools([]);
      // setError("No se pudieron cargar las herramientas."); // Optional: set error for tools
    }
  };
  
  // Auto-scroll to final de los mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startNewConversation = () => {
    if (confirm("¿Estás seguro de que quieres comenzar una nueva conversación? Se perderá el historial actual.")) {
      setIsLoading(false); // Stop any active loading
      setError(null);
      setInput("");
      setSelectedToolId(null); // Clear forced tool
      setShowToolSelector(false); // Close tool selector
      showWelcomeMessage(); // Reset to welcome message
    }
  };

  const handleToolSelect = (toolId: string) => {
    if (selectedToolId === toolId) {
      setSelectedToolId(null); // Deselect if already selected
    } else {
      setSelectedToolId(toolId);
    }
    setShowToolSelector(false); // Close popover after selection or deselection
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setError(null);
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);
    
    // Placeholder for assistant message while loading
    const assistantMessagePlaceholderId = `assistant-loading-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        id: assistantMessagePlaceholderId,
        role: "assistant",
        content: "", // Empty content while loading
        timestamp: new Date(),
        isStreaming: true, // Use isStreaming to show typing indicator
      },
    ]);

    try {
      const requestBody: { message: string; forced_tool_id?: string } = { message: currentInput };
      if (selectedToolId) {
        requestBody.forced_tool_id = selectedToolId;
      }

      const response = await fetch('/api/chat/mcpv5', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // Remove placeholder before adding actual response or error
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessagePlaceholderId));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error de red o respuesta no JSON" }));
        throw new Error(errorData.error || errorData.response || `Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.response) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          isStreaming: false,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || data.response || "Respuesta no exitosa o formato inesperado");
      }

    } catch (err: any) {
      // Ensure placeholder is removed on error too
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessagePlaceholderId));
      setError(err.message || "Error al enviar el mensaje");
      // Optionally, re-add user message to input if sending failed fundamentally
      // setInput(currentInput); 
    } finally {
      setIsLoading(false);
      // Ensure any message that was 'streaming' is marked as not streaming
      setMessages(prev => prev.map(msg => msg.id === assistantMessagePlaceholderId ? {...msg, isStreaming: false, content: msg.content || "..."} : msg ));
    }
  };
  
  const AccentGradient = "bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-600";
  const SubtleGradient = "bg-gradient-to-r from-emerald-400 to-sky-500";

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

  return (
    <div className="flex flex-col min-h-screen text-white bg-gray-950">
      <div className="fixed inset-0 overflow-hidden -z-10">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/20 via-emerald-900/10 to-transparent"></div>
        <div
          className="fixed inset-0 flex justify-center items-center pointer-events-none"
          style={{ filter: 'blur(12px)', opacity: 0.15 }}
        >
          <motion.div
            className="w-full h-full flex items-center justify-center"
            style={{ rotate: logoRotation }}
          >
            <Image
              src="/LogosNuevos/logo_orbia_sin_texto.png" // Ensure this path is correct
              alt="Orbia Logo Fondo"
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
          onClick={() => router.push('/assistants')} // Navigate to assistants list or previous page
          className="p-2 rounded-full transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft size={20} className="text-gray-300" />
        </motion.button>
        
        <div className="flex flex-col items-center">
          <h1 className={`text-xl font-bold tracking-tight bg-clip-text text-transparent ${SubtleGradient}`}>
            {assistantName}
          </h1>
          {availableTools.length > 0 && (
            <div className="text-xs text-emerald-400">
              {availableTools.length} Herramientas Disponibles
            </div>
          )}
        </div>

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
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-sky-700 flex items-center justify-center self-start">
                    <Bot size={18} className="text-white/80"/>
                  </div>
                )}
                <div
                  className={`px-4 py-3 rounded-2xl shadow-lg break-words
                    ${message.role === "user"
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-md"
                      : message.role === "assistant"
                      ? "bg-gradient-to-br from-gray-700 to-gray-800 text-white rounded-bl-md border border-gray-600"
                      : "bg-gray-600/50 text-gray-300 text-xs italic text-center w-full"
                    }`}
                >
                  {/* ImageBase64 preview removed as not supported by API */}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.role === "assistant" && message.isStreaming && !message.content ? (
                      <div className="flex space-x-1 py-1">
                        <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    ) : (
                      <div className="prose prose-sm prose-invert max-w-none" style={{color: 'white'}}>
                        {formatAssistantMessage(message.content)}
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
                   <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center self-start">
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
          {/* Tool Selector Popover */}
          {showToolSelector && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-full mb-2 w-full max-w-md left-1/2 -translate-x-1/2 bg-gray-800/90 backdrop-blur-md border border-gray-700 rounded-lg shadow-xl p-4 z-30"
            >
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-lg font-semibold text-emerald-400">Forzar Herramienta</h4>
                <button onClick={() => setShowToolSelector(false)} className="text-gray-400 hover:text-white">
                  <X size={20}/>
                </button>
              </div>
              {availableTools.length > 0 ? (
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {availableTools.map((tool) => (
                    <li key={tool.id}>
                      <button
                        onClick={() => handleToolSelect(tool.id)}
                        className={`w-full text-left p-3 rounded-md transition-colors flex items-center justify-between
                                      ${selectedToolId === tool.id ? 'bg-emerald-600/30 text-emerald-300 ring-1 ring-emerald-500' : 'hover:bg-gray-700/70'}`}
                      >
                        <div>
                          <p className="font-medium">{tool.name}</p>
                          {tool.description && <p className="text-xs text-gray-400 mt-0.5">{tool.description}</p>}
                        </div>
                        {selectedToolId === tool.id ? <CheckCircle size={18} className="text-emerald-400"/> : <Circle size={18} className="text-gray-500"/>}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 text-sm">No hay herramientas disponibles para seleccionar.</p>
              )}
              {selectedToolId && (
                <button 
                  onClick={() => { setSelectedToolId(null); setShowToolSelector(false); }}
                  className="mt-3 w-full p-2 text-sm bg-red-600/30 text-red-300 hover:bg-red-600/50 rounded-md transition-colors"
                >
                  Limpiar Selección
                </button>
              )}
            </motion.div>
          )}

          {/* Forced Tool Indicator */}
          {selectedToolId && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center text-xs text-emerald-400 mb-2 p-2 bg-emerald-900/30 rounded-md border border-emerald-700/50"
            >
              <Hammer size={14} className="mr-2 text-emerald-500"/>
              Forzando herramienta: <strong className="mx-1">{availableTools.find(t => t.id === selectedToolId)?.name || selectedToolId}</strong>
              <button onClick={() => setSelectedToolId(null)} className="ml-2 p-0.5 hover:bg-red-500/30 rounded-full">
                <X size={14} className="text-red-400"/>
              </button>
            </motion.div>
          )}
          
          <form onSubmit={handleSubmit} className="flex items-end space-x-2 md:space-x-3">
            {/* Hammer Icon Button */}
            <motion.button
              type="button"
              onClick={() => setShowToolSelector(prev => !prev)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`p-2.5 rounded-full text-gray-400 transition-colors relative
                          ${selectedToolId ? 'bg-emerald-500/20 text-emerald-400 hover:text-emerald-300' : 'hover:text-gray-200 hover:bg-gray-700/50'}`}
              aria-label="Forzar herramienta"
              title="Forzar herramienta"
            >
              <Hammer size={20} />
              {availableTools.length > 0 && (
                <span className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white
                                ${selectedToolId ? 'bg-emerald-500' : 'bg-sky-600'}`}>
                  {availableTools.length}
                </span>
              )}
            </motion.button>
            
            <textarea
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize textarea
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isLoading && input.trim()) {
                  handleSubmit(e as any);
                  e.target.style.height = 'auto'; // Reset height after submit
                }
              }}
              placeholder="Escribe un mensaje al MCP v5..."
              className="flex-1 p-3 rounded-xl bg-gray-800/90 border border-gray-700 focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70 outline-none transition-all placeholder-gray-500 text-sm text-gray-100 resize-none overflow-y-auto max-h-32 leading-tight"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#4B5563 #374151' }} // For Firefox
              disabled={isLoading}
            />
            {/* Send Button */}
            <motion.button
              type="submit"
              disabled={isLoading || !input.trim()}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe un mensaje al MCP v5..."
              className="flex-1 p-3 rounded-xl bg-gray-800/90 border border-gray-700 focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70 outline-none transition-all placeholder-gray-500 text-sm text-gray-100"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isLoading && input.trim()) {
                  handleSubmit(e as any);
                }
              }}
            />
            <motion.button
              type="submit"
              disabled={isLoading || !input.trim()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`p-3 rounded-xl text-white disabled:opacity-60 transition-all duration-150 ease-in-out ${AccentGradient} hover:shadow-xl hover:shadow-emerald-500/30`}
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
              {isLoading ? "MCP v5 está pensando..." : `Chat con ${assistantName}`}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Basic CSS for prose class if not globally available through Tailwind Typography
// You might need to install and configure @tailwindcss/typography for this
// <style jsx global>{`
// .prose { color: inherit; }
// .prose-sm :where(p) { margin-top: 0.8em; margin-bottom: 0.8em; }
// .prose-invert { /* Invert colors for dark mode if needed */ }
// `}</style>
