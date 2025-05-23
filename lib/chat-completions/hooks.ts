// lib/chat-completions/hooks.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatCompletionsClient } from './client';
import { ChatCompletionsOptions, Message, ToolCall, Tool, MCPServer, StreamChunk } from './types';

export function useChatCompletions(options: ChatCompletionsOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const clientRef = useRef<ChatCompletionsClient | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Inicializar el cliente de Chat Completions
  useEffect(() => {
    clientRef.current = new ChatCompletionsClient(options);
    
    return () => {
      // Cancelar cualquier solicitud pendiente al desmontar
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [options]);
  
  // Función para enviar un mensaje de usuario
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || !clientRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    // Cancelar cualquier solicitud anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Crear nuevo controlador para esta solicitud
    abortControllerRef.current = new AbortController();
    
    // Crear mensaje del usuario
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date()
    };
    
    // Añadir mensaje del usuario a la lista
    setMessages(prev => [...prev, userMessage]);
    
    // Crear un mensaje placeholder para el asistente
    const assistantMessageId = uuidv4();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };
    
    // Añadir mensaje placeholder del asistente
    setMessages(prev => [...prev, assistantMessage]);
    
    try {
      // Enviar mensaje al modelo y procesar la respuesta en streaming
      await clientRef.current.sendMessageStream(
        messages.concat(userMessage),
        (chunk: StreamChunk) => {
          processStreamChunk(chunk, assistantMessageId);
        },
        abortControllerRef.current
      );
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      setError(err instanceof Error ? err.message : String(err));
      
      // Eliminar el mensaje placeholder del asistente si hubo un error
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
      
      // Marcar el mensaje como no streaming
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, isStreaming: false } 
            : msg
        )
      );
      
      abortControllerRef.current = null;
    }
  }, [messages, isLoading]);
  
  // Procesar chunks del stream
  const processStreamChunk = useCallback((chunk: StreamChunk, assistantMessageId: string) => {
    const { choices } = chunk;
    if (!choices || choices.length === 0) return;
    
    const { delta } = choices[0];
    
    // Actualizar contenido del mensaje
    if (delta.content) {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: msg.content + delta.content } 
            : msg
        )
      );
    }
    
    // Procesar tool calls
    if (delta.tool_calls && delta.tool_calls.length > 0) {
      setMessages(prev => {
        const currentMessageIndex = prev.findIndex(msg => msg.id === assistantMessageId);
        if (currentMessageIndex === -1) return prev;

        const updatedMessages = [...prev];
        const currentMessage = { ...updatedMessages[currentMessageIndex] };

        // Inicializar toolCalls si no existe
        currentMessage.toolCalls = currentMessage.toolCalls ? [...currentMessage.toolCalls] : [];

        // Procesar cada tool call en el delta
        if (delta.tool_calls) {
          delta.tool_calls.forEach(deltaToolCall => {
            const index = deltaToolCall.index;

            // Asegurarse de que el array toolCalls tenga suficientes elementos
            while (currentMessage.toolCalls!.length <= index) {
              currentMessage.toolCalls!.push({ id: '', type: 'function', function: { name: '', arguments: '' } });
            }
            
            const existingToolCall = currentMessage.toolCalls![index];

            if (deltaToolCall.id) {
              existingToolCall.id = deltaToolCall.id;
            }
            if (deltaToolCall.type) {
              existingToolCall.type = deltaToolCall.type;
            }
            if (deltaToolCall.function) {
              existingToolCall.function = existingToolCall.function || { name: '', arguments: '' };
              if (deltaToolCall.function.name) {
                existingToolCall.function.name = deltaToolCall.function.name;
              }
              if (deltaToolCall.function.arguments) {
                existingToolCall.function.arguments += deltaToolCall.function.arguments;
              }
            }
          });
        }
        updatedMessages[currentMessageIndex] = currentMessage;
        return updatedMessages;
      });
    }
  }, []);
  
  // Ejecutar herramientas y enviar resultados
  const executeToolCalls = useCallback(async () => {
    if (!clientRef.current) return;
    
    // Obtener el último mensaje del asistente
    const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant');
    if (!lastAssistantMessage || !lastAssistantMessage.toolCalls || lastAssistantMessage.toolCalls.length === 0) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Ejecutar cada tool call y añadir los resultados como mensajes
      for (const toolCall of lastAssistantMessage.toolCalls) {
        // Ejecutar la herramienta
        const toolResult = await clientRef.current.executeToolCall(toolCall);
        
        // Crear mensaje con el resultado de la herramienta
        const toolMessage: Message = {
          id: uuidv4(),
          role: 'tool',
          content: toolResult,
          toolCallId: toolCall.id,
          timestamp: new Date()
        };
        
        // Añadir mensaje con el resultado de la herramienta
        setMessages(prev => [...prev, toolMessage]);
      }
      
      // Crear un nuevo mensaje placeholder para la respuesta del asistente
      const newAssistantMessageId = uuidv4();
      const newAssistantMessage: Message = {
        id: newAssistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      };
      
      // Añadir nuevo mensaje placeholder del asistente
      setMessages(prev => [...prev, newAssistantMessage]);
      
      // Cancelar cualquier solicitud anterior
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Crear nuevo controlador para esta solicitud
      abortControllerRef.current = new AbortController();
      
      // Enviar todos los mensajes al modelo y procesar la respuesta
      await clientRef.current.sendMessageStream(
        messages,
        (chunk: StreamChunk) => {
          processStreamChunk(chunk, newAssistantMessageId);
        },
        abortControllerRef.current
      );
    } catch (err) {
      console.error('Error al ejecutar herramientas:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, processStreamChunk]);
  
  // Ejecutar herramientas automáticamente cuando se detectan
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage && 
      lastMessage.role === 'assistant' && 
      !lastMessage.isStreaming && 
      lastMessage.toolCalls && 
      lastMessage.toolCalls.length > 0
    ) {
      executeToolCalls();
    }
  }, [messages, executeToolCalls]);
  
  return {
    messages,
    isLoading,
    error,
    sendMessage,
    setMessages,
    setError
  };
}