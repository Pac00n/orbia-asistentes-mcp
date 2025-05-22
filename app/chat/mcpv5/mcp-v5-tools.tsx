import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatInterface from '../../../components/ChatInterface';

// Configuración del cliente MCP
const configureMCPClient = async () => {
  try {
    // Importación dinámica para evitar errores en tiempo de compilación
    const { Agent, MCPServerSse } = await import('openai/agents');
    
    // Inicializar el agente con los servidores MCP
    const agent = new Agent({
      model: "gpt-4o-mini",
      mcp_servers: [
        // Zapier MCP para integraciones con múltiples aplicaciones
        new MCPServerSse(process.env.MCP_ZAPIER_URL || "https://zapier.com/mcp"),
        
        // Activepieces MCP para automatizaciones
        new MCPServerSse(process.env.MCP_ACTIVEPIECES_URL || "https://cloud.activepieces.com/mcp"),
        
        // Brave Search MCP para búsquedas web
        new MCPServerSse(process.env.MCP_BRAVE_SEARCH_URL || "https://search.bravesoftware.com/mcp"),
        
        // Web-Search MCP para búsquedas en Google
        new MCPServerSse(process.env.MCP_WEB_SEARCH_URL || "https://web-search.mcpservers.org/mcp")
      ]
    });

    // Listar herramientas disponibles para verificación
    const tools = await agent.listTools();
    console.log(`MCP v5: ${tools.length} herramientas disponibles`);
    
    return { agent, toolCount: tools.length };
  } catch (error) {
    console.error("Error al configurar cliente MCP:", error);
    return { agent: null, toolCount: 0 };
  }
};

export default function MCPv5Chat() {
  const router = useRouter();
  const [agent, setAgent] = useState(null);
  const [toolCount, setToolCount] = useState(12); // Valor inicial para mostrar en la UI
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initMCP = async () => {
      setIsLoading(true);
      try {
        const { agent: mcpAgent, toolCount: count } = await configureMCPClient();
        if (mcpAgent) {
          setAgent(mcpAgent);
          setToolCount(count);
        }
      } catch (error) {
        console.error("Error al inicializar MCP:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initMCP();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      <header className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800 py-4 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold text-white">MCP v5</h1>
            <div className="bg-emerald-500/20 text-emerald-300 text-xs font-medium px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15.5 14l5-5-5-5M4.5 19l5-5-5-5" />
              </svg>
              {toolCount} herramientas
            </div>
          </div>
          <button 
            onClick={() => router.push('/assistants')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            Volver
          </button>
        </div>
      </header>

      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <ChatInterface 
            assistantId="mcp-v5"
            initialMessage="¡Hola! Soy el asistente MCP v5 con acceso a herramientas externas como Zapier, Activepieces, y búsqueda web. ¿En qué puedo ayudarte hoy?"
            mcpAgent={agent}
            toolCount={toolCount}
          />
        )}
      </main>
    </div>
  );
}
