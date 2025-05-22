import { McpClient } from '@/lib/mcp/client';
import { NextResponse } from 'next/server';

// Este endpoint devuelve todas las herramientas disponibles en los servidores MCP configurados
export async function GET() {
  try {
    // Instanciar e inicializar McpClient (igual que en la ruta del chat)
    const mcpClient = new McpClient();
    console.log('API /tools: Inicializando cliente MCP...');
    await mcpClient.initialize(); // Esto descubre todas las herramientas disponibles
    
    // Obtener las definiciones de herramientas en formato OpenAI
    const toolDefinitions = mcpClient.getOpenAIToolDefinitions();
    
    console.log(`API /tools: Retornando ${toolDefinitions.length} herramientas disponibles`);
    
    // Definiciones de herramientas de respaldo en caso de que no haya ninguna
    if (!toolDefinitions || toolDefinitions.length === 0) {
      // Herramientas simuladas para que siempre haya algo en la UI
      const fallbackTools = [
        {
          type: "function",
          function: {
            name: "srv1_calculator",
            description: "Calculadora simulada de srv1",
            parameters: {
              type: "object",
              properties: {
                expression: {
                  type: "string",
                  description: "Expresión matemática a evaluar"
                }
              },
              required: ["expression"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "toolCo_search",
            description: "Búsqueda simulada en toolCo",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Término de búsqueda"
                }
              },
              required: ["query"]
            }
          }
        }
      ];

      console.log(`API /tools: No se encontraron herramientas reales, devolviendo ${fallbackTools.length} herramientas de respaldo`);
      return NextResponse.json(fallbackTools);
    }
    
    // Devolver las definiciones de herramientas reales
    return NextResponse.json(toolDefinitions);
  } catch (error) {
    console.error('Error al obtener las herramientas MCP:', error);
    
    // Herramientas simuladas como respaldo en caso de error
    const emergencyTools = [
      {
        type: "function",
        function: {
          name: "emergency_search",
          description: "Búsqueda de emergencia (modo fallback)",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Término de búsqueda"
              }
            },
            required: ["query"]
          }
        }
      }
    ];
    
    console.log('API /tools: Devolviendo herramientas de emergencia debido a un error');
    return NextResponse.json(emergencyTools);
  }
}
