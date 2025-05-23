// lib/chat-completions/client.ts
import { v4 as uuidv4 } from 'uuid';
import { 
  ChatCompletionsOptions, 
  Message, 
  StreamChunk, 
  Tool, 
  ToolCall,
  MCPServer
} from './types';

export class ChatCompletionsClient {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private tools: Tool[];
  private mcpServers: MCPServer[];
  private forceReal: boolean;
  private assistantInstructions: string;

  constructor(options: ChatCompletionsOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'gpt-4-turbo';
    this.temperature = options.temperature || 0.7;
    this.maxTokens = options.maxTokens || 4000;
    this.tools = options.tools || [];
    this.mcpServers = options.mcpServers || [];
    this.forceReal = options.forceReal || false;
    
    // Usar la descripción del asistente como instrucciones del sistema
    this.assistantInstructions = options.assistant.description;
  }

  /**
   * Genera un mensaje de sistema con las instrucciones del asistente
   */
  private getSystemMessage(): Message {
    return {
      id: uuidv4(),
      role: 'system',
      content: this.assistantInstructions,
      timestamp: new Date()
    };
  }

  /**
   * Envía un mensaje al modelo y recibe la respuesta como stream
   */
  async sendMessageStream(
    messages: Message[],
    onChunk: (chunk: StreamChunk) => void,
    abortController?: AbortController
  ): Promise<void> {
    // Preparar los mensajes para la API, incluyendo el mensaje del sistema
    const apiMessages = [
      {
        role: 'system',
        content: this.assistantInstructions
      },
      ...messages.map(msg => {
        if (msg.role === 'tool') {
          return {
            role: msg.role,
            content: msg.content,
            tool_call_id: msg.toolCallId
          };
        }
        
        return {
          role: msg.role,
          content: msg.content
        };
      })
    ];

    // Configurar la solicitud a la API
    const requestBody = {
      model: this.model,
      messages: apiMessages,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: true,
      tools: this.tools.length > 0 ? this.tools : undefined
    };

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: abortController?.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error en la API de OpenAI: ${errorData.error?.message || response.statusText}`);
      }

      if (!response.body) {
        throw new Error('El cuerpo de la respuesta está vacío');
      }

      // Procesar el stream de respuesta
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.trim() === 'data: [DONE]') continue;

          try {
            if (line.startsWith('data: ')) {
              const jsonData = JSON.parse(line.slice(6));
              onChunk(jsonData);
            }
          } catch (e) {
            console.error('Error al procesar chunk:', e, line);
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Solicitud cancelada');
      } else {
        throw error;
      }
    }
  }

  /**
   * Ejecuta una herramienta externa a través de los servidores MCP
   */
  async executeToolCall(toolCall: ToolCall): Promise<string> {
    try {
      // Seleccionar el servidor MCP adecuado según la herramienta
      const server = this.selectMCPServer(toolCall.function.name);
      
      if (!server) {
        return JSON.stringify({
          error: `No se encontró un servidor MCP para la herramienta: ${toolCall.function.name}`
        });
      }

      // Preparar la solicitud al servidor MCP
      const response = await fetch(`${server.url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments),
          force_real: this.forceReal
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return JSON.stringify({
          error: `Error al ejecutar la herramienta: ${errorText}`
        });
      }

      const result = await response.json();
      return JSON.stringify(result);
    } catch (error: unknown) {
      console.error('Error al ejecutar herramienta:', error);
      let errorMessage = 'Error desconocido al ejecutar la herramienta';
      if (error instanceof Error) {
        errorMessage = `Error al ejecutar la herramienta: ${error.message}`;
      }
      return JSON.stringify({
        error: errorMessage
      });
    }
  }

  /**
   * Selecciona el servidor MCP adecuado para una herramienta
   */
  private selectMCPServer(toolName: string): MCPServer | undefined {
    // Lógica para seleccionar el servidor adecuado según la herramienta
    // Por ahora, simplemente devolvemos el primer servidor disponible
    if (this.mcpServers.length === 0) {
      return undefined;
    }

    // Aquí se podría implementar una lógica más sofisticada para seleccionar
    // el servidor según el nombre de la herramienta
    if (toolName.startsWith('git_')) {
      return this.mcpServers.find(s => s.id === 'git');
    } else if (toolName.startsWith('fetch_')) {
      return this.mcpServers.find(s => s.id === 'fetch');
    }

    // Por defecto, usar el primer servidor
    return this.mcpServers[0];
  }
}