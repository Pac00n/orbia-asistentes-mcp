// app/chat/chat-completions/[assistantId]/page.tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAssistantById } from '@/lib/assistants';
import { useChatCompletions, Tool, MCPServer } from '@/lib/chat-completions';
import { Send, Loader2, X, Paperclip, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Estilos
const AccentGradient = "bg-gradient-to-br from-orange-500 to-red-600";

export default function ChatCompletionsPage({ params }: { params: { assistantId: string } }) {
  const { assistantId } = params;
  const router = useRouter();
  const assistant = getAssistantById(assistantId);
  
  // Referencias
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados
  const [input, setInput] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [showTools, setShowTools] = useState(false);
  
  // Obtener variables de entorno
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
  const mcpServerUrl = process.env.NEXT_PUBLIC_MCP_SERVER_URL || '';
  const mcpServersConfig = process.env.MCP_SERVERS_CONFIG || '[]';
  const mcpForceReal = process.env.MCP_FORCE_REAL === 'true';
  
  // Parsear configuración de servidores MCP
  const mcpServers: MCPServer[] = JSON.parse(mcpServersConfig);
  
  // Herramientas disponibles (ejemplo)
  useEffect(() => {
    // Aquí se podrían cargar dinámicamente las herramientas disponibles
    setAvailableTools([
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Obtiene el clima actual para una ubicación',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'La ciudad y país, por ejemplo: Madrid, España'
              }
            },
            required: ['location']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_web',
          description: 'Busca información en la web',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'La consulta de búsqueda'
              }
            },
            required: ['query']
          }
        }
      }
    ]);
  }, []);
  
  // Inicializar el hook de chat completions
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    setError
  } = useChatCompletions({
    assistant: assistant!,
    apiKey,
    tools: availableTools,
    mcpServers,
    forceReal: mcpForceReal
  });
  
  // Desplazarse al final de los mensajes cuando se añaden nuevos
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Manejar envío de formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !imageBase64) return;
    
    // Si hay una imagen, incluirla en el mensaje
    let messageContent = input.trim();
    if (imageBase64) {
      messageContent += `\n\n[Imagen adjunta]`;
      // Aquí se podría implementar la lógica para enviar la imagen
      // Por ahora, solo mencionamos que hay una imagen
    }
    
    sendMessage(messageContent);
    setInput('');
    setImageBase64(null);
  };
  
  // Manejar cambio de archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  // Limpiar imagen
  const clearImage = () => {
    setImageBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Si no se encuentra el asistente, redirigir a la página principal
  if (!assistant) {
    useEffect(() => {
      router.push('/');
    }, [router]);
    return null;
  }
  
  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <header className="sticky top-0 z-30 p-4 border-b border-white/10 bg-gray-900/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full ${assistant.bgColor} flex items-center justify-center`}>
              {assistant.iconType && <assistant.iconType size={20} className="text-white" />}
            </div>
            <div>
              <h1 className="font-semibold text-white">{assistant.name}</h1>
              <p className="text-xs text-gray-400">{assistant.shortDescription}</p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} mb-4`}
              >
                <div className={`flex ${message.role === "user" ? "flex-row-reverse" : "flex-row"} max-w-[85%] items-start gap-3`}>
                  {message.role === "assistant" && (
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full ${assistant.bgColor} flex items-center justify-center self-start`}>
                      {assistant.iconType && <assistant.iconType size={18} className="text-white/80" />}
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.role === "user" 
                      ? AccentGradient + " text-white shadow-lg" 
                      : "bg-gray-800 text-gray-100 border border-gray-700"
                  }`}>
                    <div className="prose prose-sm prose-invert max-w-none">
                      {message.content || (message.isStreaming ? "..." : "")}
                    </div>
                    <div className={`text-xs mt-1 ${message.role === "user" ? "text-orange-200/70" : "text-gray-500"}`}>
                      <span>
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
        </div>
      </main>
      
      <footer className="sticky bottom-0 z-20 p-3 md:p-4 border-t border-white/10 bg-gray-900/60 backdrop-blur-md">
        <div className="max-w-3xl mx-auto">
          {imageBase64 && (
            <motion.div 
              initial={{opacity:0, height:0, y:10}} 
              animate={{opacity:1, height:'auto', y:0}} 
              exit={{opacity:0, height:0, y:10}}
              className="relative mb-2 p-2 border border-gray-700 rounded-lg max-w-[120px] bg-gray-800/70 backdrop-blur-sm"
            >
              <img src={imageBase64} alt="Vista previa" className="h-20 w-auto rounded-md object-cover"/>
              <button 
                onClick={clearImage} 
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors" 
                aria-label="Eliminar imagen"
              >
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
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*" 
                disabled={isLoading} 
              />
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
              style={{boxShadow: isLoading || (!input.trim() && !imageBase64) ? 'none' : `0 4px 15px rgba(255,165,0, 0.3)`}}
              aria-label="Enviar mensaje"
            >
              {isLoading ? (
                <motion.div 
                  animate={{ rotate: 360 }} 
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                  <Loader2 size={20} />
                </motion.div>
              ) : (
                <Send size={20} />
              )}
            </motion.button>
          </form>
          <div className="flex justify-center items-center mt-2.5">
            <p className="text-xs text-gray-500">
              {isLoading ? `${assistant.name} está pensando...` : `Chat con ${assistant.name} (Chat Completions)`}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}