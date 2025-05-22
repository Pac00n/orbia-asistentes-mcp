"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Función para obtener herramientas desde la API
const fetchMCPTools = async () => {
  try {
    const response = await fetch('/api/chat/mcpv5', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error al obtener herramientas: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Datos de API MCP v5:', data);
    return data;
  } catch (error) {
    console.error('Error al obtener herramientas MCP:', error);
    return { success: false, toolCount: 0, tools: [] };
  }
};

export default function MCPv5Chat() {
  const router = useRouter();
  const [toolCount, setToolCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initMCP = async () => {
      setIsLoading(true);
      try {
        const data = await fetchMCPTools();
        if (data.success) {
          setToolCount(data.toolCount);
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
            {toolCount > 0 && (
              <div className="bg-emerald-500/20 text-emerald-300 text-xs font-medium px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {toolCount} herramientas
              </div>
            )}
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
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Asistente MCP v5</h2>
            <p className="text-gray-300 mb-6">Este asistente tiene acceso a {toolCount} herramientas externas mediante servidores MCP.</p>
            
            <div className="bg-gray-700 p-4 rounded-md mb-6">
              <h3 className="text-lg font-semibold text-emerald-400 mb-2">Servidores conectados:</h3>
              <ul className="list-disc pl-5 text-gray-300 space-y-2">
                <li>Zapier MCP: +7000 aplicaciones integradas</li>
                <li>Activepieces MCP: ~280 integraciones</li>
                <li>Brave Search MCP: Búsqueda web</li>
                <li>Web-Search MCP: Búsqueda Google</li>
              </ul>
            </div>
            
            <p className="text-gray-400 italic mb-4">Esta es la versión simplificada del chat MCP v5. Para usar el chat completo, es necesario implementar un componente ChatInterface personalizado.</p>
            
            <div className="flex justify-center">
              <button 
                onClick={() => router.push('/assistants')}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
