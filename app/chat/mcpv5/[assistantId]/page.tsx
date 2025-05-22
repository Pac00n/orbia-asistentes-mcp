"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Hammer, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";

// Tipos mínimos
interface ChatMessage { 
  id: string; 
  role: "user" | "assistant" | "tool" | "system"; 
  content: string; 
  isStreaming?: boolean; 
}

interface Tool {
  name: string;
  description: string;
}

export default function ChatPage() {
  const { assistantId } = useParams<{ assistantId: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "¡Hola! Soy el asistente MCP v5 con acceso a herramientas externas como Zapier, Activepieces, y búsqueda web. ¿En qué puedo ayudarte hoy?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [showTools, setShowTools] = useState(false);

  // Scroll al fondo cuando cambian los mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Obtener herramientas disponibles al cargar la página
  useEffect(() => {
    const fetchTools = async () => {
      try {
        // Obtener herramientas desde nuestra API
        const response = await fetch('/api/chat/mcpv5', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });
        
        if (!response.ok) {
          throw new Error(`Error al obtener herramientas: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Herramientas MCP v5:', data);
        
        if (data.success && data.tools) {
          setAvailableTools(data.tools);
        } else {
          // Si no hay herramientas disponibles, mostrar herramientas simuladas
          setAvailableTools([
            { name: "zapier.gmail", description: "Accede a Gmail a través de Zapier" },
            { name: "zapier.drive", description: "Manipula archivos en Google Drive" },
            { name: "zapier.calendar", description: "Gestiona eventos de Google Calendar" },
            { name: "activepieces.slack", description: "Envía mensajes a Slack" },
            { name: "brave_search", description: "Busca información en internet" },
            { name: "web_search", description: "Búsqueda en Google sin API key" }
          ]);
        }
      } catch (e) {
        console.error("Error al obtener herramientas:", e);
        setError("Error al cargar herramientas MCP");
        // Herramientas de fallback
        setAvailableTools([
          { name: "zapier.gmail", description: "Accede a Gmail a través de Zapier" },
          { name: "zapier.drive", description: "Manipula archivos en Google Drive" },
          { name: "zapier.calendar", description: "Gestiona eventos de Google Calendar" },
          { name: "activepieces.slack", description: "Envía mensajes a Slack" },
          { name: "brave_search", description: "Busca información en internet" },
          { name: "web_search", description: "Búsqueda en Google sin API key" }
        ]);
      }
    };
    
    fetchTools();
  }, []);

  // Manejar envío de mensaje
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Añadir mensaje del usuario
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);
    
    try {
      // Preparar mensaje de respuesta vacío para streaming
      const responseId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: responseId,
        role: "assistant",
        content: "",
        isStreaming: true
      }]);
      
      // Llamar a la API que hemos creado
      const response = await fetch('/api/chat/mcpv5', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: input
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error en la respuesta: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Actualizar el mensaje con la respuesta completa
      setMessages(prev => prev.map(msg => 
        msg.id === responseId 
          ? { ...msg, content: data.success ? data.response : "Error al procesar el mensaje.", isStreaming: false } 
          : msg
      ));
    } catch (e) {
      console.error("Error al procesar mensaje:", e);
      setError("Error al comunicarse con el asistente MCP");
      
      // Añadir mensaje de error
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "Lo siento, ha ocurrido un error al procesar tu mensaje. Por favor, intenta de nuevo más tarde."
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800 py-4 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push('/assistants')}
              className="text-gray-400 hover:text-white mr-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold">MCP v5 - {assistantId}</h1>
            <button
              onClick={() => setShowTools(!showTools)}
              className="flex items-center p-2 rounded hover:bg-gray-700 transition-colors"
              title="Herramientas disponibles"
            >
              <Hammer className="w-5 h-5 mr-2" />
              <span>{availableTools.length}</span>
              {showTools ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </button>
          </div>
        </div>
        
        {/* Desplegable de herramientas */}
        {showTools && (
          <div className="absolute right-4 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10 p-3">
            <h3 className="text-sm font-semibold mb-2 px-2">Herramientas Disponibles:</h3>
            {availableTools.length > 0 ? (
              <ul className="max-h-72 overflow-y-auto text-sm">
                {availableTools.map((tool, index) => (
                  <li key={index} className="p-2 hover:bg-gray-700 rounded mb-1">
                    <p className="font-medium">{tool.name}</p>
                    <p className="text-xs text-gray-400">{tool.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 px-2">No hay herramientas disponibles o no se pudieron cargar.</p>
            )}
          </div>
        )}
      </header>

      {/* Chat container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-3/4 rounded-lg p-3 ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse"></span>
              )}
            </div>
          </div>
        ))}
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 p-3 rounded-md">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800 bg-gray-900">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-gray-800 text-white rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`px-4 py-2 rounded-md ${
              isLoading || !input.trim()
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  );
}
