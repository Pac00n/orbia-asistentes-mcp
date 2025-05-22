# Ejemplos y Patrones de Uso de Clientes y Servidores MCP

Este documento recopila ejemplos prácticos y patrones de implementación para clientes y servidores MCP, adaptados al contexto de una plataforma web que gestiona múltiples asistentes virtuales.

## Patrones Arquitectónicos Comunes

### Patrón Cliente-Servidor MCP

El Model Context Protocol (MCP) sigue un patrón cliente-servidor donde:

- **Hosts**: Aplicaciones LLM (como la plataforma web de asistentes) que inician conexiones
- **Clientes**: Conectores dentro de la aplicación host que mantienen conexiones 1:1 con servidores
- **Servidores**: Servicios que proporcionan contexto, herramientas y prompts a los clientes

Este patrón permite una clara separación de responsabilidades y facilita la escalabilidad horizontal.

### Patrón de Transporte

MCP soporta dos mecanismos principales de transporte:

1. **Stdio**: Para procesos locales, ideal para herramientas que se ejecutan en el mismo servidor
2. **HTTP con SSE**: Para servicios remotos, donde:
   - HTTP POST se usa para mensajes cliente-a-servidor
   - Server-Sent Events (SSE) se usa para mensajes servidor-a-cliente

Ambos mecanismos utilizan JSON-RPC 2.0 para el intercambio de mensajes.

## Ejemplos de Implementación de Servidores MCP

### Servidor MCP Básico en Python

```python
# Importar la biblioteca fastmcp
from mcp.server.fastmcp import FastMCP

# Crear servidor
mcp = FastMCP("Plataforma de Asistentes")

# Importar todas las herramientas
from tools import *

# Ejecutar el servidor
if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### Definición de Herramientas MCP en Python

```python
from mcp.server.fastmcp import FastMCP
from typing import Dict, Any

mcp = FastMCP("Herramientas de Base de Datos")

@mcp.tool()
def consultar_base_datos(tabla: str, filtro: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Consulta datos de una tabla específica en la base de datos.
    
    Args:
        tabla: Nombre de la tabla a consultar
        filtro: Diccionario con condiciones de filtrado (opcional)
        
    Returns:
        Diccionario con los resultados de la consulta
    """
    # Implementación real conectaría con Supabase
    # Ejemplo simplificado:
    import json
    import os
    
    # Simulación de conexión a Supabase
    from supabase import create_client
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    supabase = create_client(url, key)
    
    # Realizar consulta
    query = supabase.table(tabla)
    if filtro:
        for key, value in filtro.items():
            query = query.eq(key, value)
    
    response = query.execute()
    return {"data": response.data, "count": len(response.data)}
```

### Servidor MCP con Recursos en TypeScript

```typescript
import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioTransport } from "@modelcontextprotocol/sdk/server/transports/stdio";

// Crear servidor MCP
const server = new Server({
  name: "Servidor de Recursos",
  transport: new StdioTransport(),
});

// Registrar un recurso
server.registerResource({
  name: "documentacion_api",
  description: "Documentación de la API de la plataforma",
  async fetch() {
    // Implementación real cargaría documentación desde un repositorio
    return {
      content: "# API de la Plataforma\n\n## Endpoints\n\n- GET /api/assistants\n- POST /api/chat\n...",
      mimeType: "text/markdown",
    };
  },
});

// Registrar una herramienta
server.registerTool({
  name: "enviar_notificacion",
  description: "Envía una notificación a un usuario",
  parameters: {
    usuario_id: {
      type: "string",
      description: "ID del usuario destinatario",
      required: true,
    },
    mensaje: {
      type: "string",
      description: "Contenido de la notificación",
      required: true,
    },
    prioridad: {
      type: "string",
      description: "Nivel de prioridad (alta, media, baja)",
      required: false,
    },
  },
  async execute({ usuario_id, mensaje, prioridad = "media" }) {
    // Implementación real enviaría notificación a través de un servicio
    console.log(`Enviando notificación a ${usuario_id}: ${mensaje} (${prioridad})`);
    return { success: true, timestamp: new Date().toISOString() };
  },
});

// Iniciar servidor
server.start();
```

## Ejemplos de Implementación de Clientes MCP

### Cliente MCP en JavaScript/TypeScript para Integración con OpenAI

```typescript
import { ClientSession, StdioServerParameters } from "@modelcontextprotocol/sdk/client";
import { stdioClient } from "@modelcontextprotocol/sdk/client/transports/stdio";
import OpenAI from "openai";

// Configurar parámetros del servidor MCP
const serverParams = new StdioServerParameters({
  command: "node",
  args: ["mcp_server.js"], // Servidor MCP implementado en Node.js
});

// Función para cargar herramientas MCP y convertirlas al formato de OpenAI
async function loadMcpTools() {
  const [read, write] = await stdioClient(serverParams);
  const session = new ClientSession(read, write);
  
  // Inicializar la conexión
  await session.initialize();
  
  // Obtener herramientas disponibles
  const mcpTools = await session.listTools();
  
  // Convertir herramientas MCP al formato de OpenAI
  const openaiTools = mcpTools.map(tool => ({
    type: "function",
    function: {
      name: `mcp_${tool.name}`,
      description: tool.description,
      parameters: convertMcpParamsToJsonSchema(tool.parameters),
    },
  }));
  
  // Crear un mapa para referencia rápida
  const toolMap = new Map(mcpTools.map(tool => [`mcp_${tool.name}`, tool]));
  
  return { openaiTools, toolMap, session };
}

// Función para ejecutar una herramienta MCP desde una llamada de OpenAI
async function executeMcpTool(session, toolMap, functionCall) {
  const { name, arguments: argsString } = functionCall;
  
  // Verificar si es una herramienta MCP
  if (!name.startsWith("mcp_")) {
    throw new Error(`No es una herramienta MCP: ${name}`);
  }
  
  const mcpToolName = name.substring(4); // Quitar prefijo "mcp_"
  const mcpTool = toolMap.get(name);
  
  if (!mcpTool) {
    throw new Error(`Herramienta MCP no encontrada: ${mcpToolName}`);
  }
  
  // Parsear argumentos
  const args = JSON.parse(argsString);
  
  // Ejecutar herramienta MCP
  const result = await session.callTool(mcpToolName, args);
  
  return result;
}

// Ejemplo de uso en un endpoint de API
export async function handleChatRequest(req, res) {
  const { assistantId, message, threadId } = req.body;
  
  // Inicializar OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Cargar herramientas MCP
  const { openaiTools, toolMap, session } = await loadMcpTools();
  
  try {
    // Crear o recuperar thread
    const currentThreadId = threadId || (await openai.beta.threads.create()).id;
    
    // Añadir mensaje del usuario
    await openai.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: message,
    });
    
    // Ejecutar el asistente con herramientas MCP
    const run = await openai.beta.threads.runs.create(currentThreadId, {
      assistant_id: assistantId,
      tools: openaiTools,
    });
    
    // Procesar ejecución
    let runStatus = await openai.beta.threads.runs.retrieve(currentThreadId, run.id);
    
    while (runStatus.status !== "completed" && runStatus.status !== "failed") {
      // Manejar llamadas a herramientas
      if (runStatus.status === "requires_action") {
        const toolCalls = runStatus.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = [];
        
        for (const toolCall of toolCalls) {
          if (toolCall.function.name.startsWith("mcp_")) {
            // Ejecutar herramienta MCP
            const result = await executeMcpTool(
              session, 
              toolMap, 
              toolCall.function
            );
            
            toolOutputs.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify(result),
            });
          }
        }
        
        // Enviar resultados de herramientas a OpenAI
        await openai.beta.threads.runs.submitToolOutputs(
          currentThreadId,
          runStatus.id,
          { tool_outputs: toolOutputs }
        );
      }
      
      // Esperar y verificar estado
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(currentThreadId, run.id);
    }
    
    // Obtener mensajes
    const messages = await openai.beta.threads.messages.list(currentThreadId);
    
    // Devolver respuesta
    res.json({
      threadId: currentThreadId,
      messages: messages.data,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    // Cerrar sesión MCP
    await session.close();
  }
}
```

### Cliente MCP en Python con Frameworks de Agentes

```python
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Configurar parámetros del servidor
server_params = StdioServerParameters(
    command="python",
    args=["mcp_server.py"],  # Servidor MCP implementado en Python
)

# Función para cargar herramientas MCP
async def load_mcp_tools(session):
    # Obtener herramientas disponibles
    tools = await session.list_tools()
    return tools

# Ejemplo de uso con LangGraph
async def create_langgraph_agent():
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Inicializar la conexión
            await session.initialize()
            
            # Obtener herramientas
            tools = await load_mcp_tools(session)
            for tool in tools:
                print(f"Herramienta MCP cargada: {tool.name}")
            
            # Crear y ejecutar el agente
            # (Implementación específica de LangGraph)
            # ...
            
            return tools, session

# Ejemplo de uso con framework personalizado
async def get_mcp_tool(name):
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Descubrir herramientas a través del cliente MCP
            tools = await session.list_tools()
            filtered_tools = [tool for tool in tools if tool.name == name]
            
            if not filtered_tools:
                raise ValueError(f"Herramienta no encontrada: {name}")
                
            print(f"Herramienta MCP cargada: {filtered_tools[0].name}")
            return filtered_tools[0]

# Ejemplo de ejecución
async def main():
    # Cargar herramienta específica
    weather_tool = await get_mcp_tool('weather_tool')
    
    # Ejecutar herramienta
    result = await weather_tool.call({"location": "Madrid"})
    print(f"Resultado: {result}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Patrones de Integración para la Plataforma Web

### Patrón de Adaptador MCP-OpenAI

Este patrón implementa un adaptador que traduce entre el formato de function calling de OpenAI y el protocolo MCP:

```javascript
// Adaptador MCP-OpenAI
class MCPOpenAIAdapter {
  constructor() {
    this.sessions = new Map(); // Mapa de sesiones MCP activas
    this.toolsCache = new Map(); // Caché de herramientas por servidor
  }
  
  // Inicializar conexión con un servidor MCP
  async connectToServer(serverId, serverConfig) {
    const { type, command, args } = serverConfig;
    
    let transport;
    if (type === 'stdio') {
      const serverParams = new StdioServerParameters({
        command,
        args,
      });
      const [read, write] = await stdioClient(serverParams);
      transport = { read, write };
    } else if (type === 'sse') {
      // Implementar transporte SSE para servidores remotos
      // ...
    } else {
      throw new Error(`Tipo de transporte no soportado: ${type}`);
    }
    
    // Crear sesión
    const session = new ClientSession(transport.read, transport.write);
    await session.initialize();
    
    // Almacenar sesión
    this.sessions.set(serverId, session);
    
    // Cargar herramientas
    await this.cacheServerTools(serverId);
    
    return session;
  }
  
  // Cargar y cachear herramientas de un servidor
  async cacheServerTools(serverId) {
    const session = this.sessions.get(serverId);
    if (!session) {
      throw new Error(`Sesión no encontrada para servidor: ${serverId}`);
    }
    
    // Obtener herramientas
    const mcpTools = await session.list_tools();
    
    // Convertir al formato de OpenAI
    const openaiTools = mcpTools.map(tool => ({
      type: "function",
      function: {
        name: `${serverId}_${tool.name}`,
        description: tool.description,
        parameters: this.convertToJsonSchema(tool.parameters),
      },
    }));
    
    // Almacenar en caché
    this.toolsCache.set(serverId, {
      mcpTools,
      openaiTools,
      toolMap: new Map(mcpTools.map(tool => [tool.name, tool])),
    });
    
    return openaiTools;
  }
  
  // Obtener todas las herramientas disponibles en formato OpenAI
  async getAllTools() {
    const allTools = [];
    
    for (const [serverId, cache] of this.toolsCache.entries()) {
      allTools.push(...cache.openaiTools);
    }
    
    return allTools;
  }
  
  // Ejecutar una herramienta MCP
  async executeToolCall(functionCall) {
    const { name, arguments: argsString } = functionCall;
    
    // Parsear el nombre para obtener serverId y toolName
    const [serverId, toolName] = name.split('_', 2);
    
    // Verificar si tenemos el servidor
    if (!this.sessions.has(serverId)) {
      throw new Error(`Servidor MCP no encontrado: ${serverId}`);
    }
    
    // Obtener sesión y caché de herramientas
    const session = this.sessions.get(serverId);
    const cache = this.toolsCache.get(serverId);
    
    // Verificar si la herramienta existe
    if (!cache.toolMap.has(toolName)) {
      throw new Error(`Herramienta no encontrada: ${toolName}`);
    }
    
    // Parsear argumentos
    const args = JSON.parse(argsString);
    
    // Ejecutar herramienta
    const result = await session.call_tool(toolName, args);
    
    return result;
  }
  
  // Cerrar todas las sesiones
  async closeAll() {
    for (const [serverId, session] of this.sessions.entries()) {
      try {
        await session.close();
        console.log(`Sesión cerrada para servidor: ${serverId}`);
      } catch (error) {
        console.error(`Error al cerrar sesión para servidor ${serverId}:`, error);
      }
    }
    
    this.sessions.clear();
    this.toolsCache.clear();
  }
  
  // Convertir parámetros MCP a JSON Schema
  convertToJsonSchema(mcpParams) {
    return {
      type: "object",
      properties: Object.entries(mcpParams).reduce((acc, [key, param]) => {
        acc[key] = {
          type: param.type,
          description: param.description,
        };
        return acc;
      }, {}),
      required: Object.entries(mcpParams)
        .filter(([_, param]) => param.required)
        .map(([key, _]) => key),
    };
  }
}
```

### Patrón de Registro de Servidores MCP

Este patrón implementa un registro centralizado de servidores MCP disponibles:

```typescript
// Registro de Servidores MCP
class MCPServerRegistry {
  private servers: Map<string, MCPServerConfig>;
  private db: SupabaseClient;
  
  constructor(supabaseClient: SupabaseClient) {
    this.servers = new Map();
    this.db = supabaseClient;
  }
  
  // Cargar configuración desde Supabase
  async loadFromDatabase(): Promise<void> {
    const { data, error } = await this.db
      .from('mcp_servers')
      .select('*')
      .eq('active', true);
    
    if (error) {
      throw new Error(`Error al cargar servidores MCP: ${error.message}`);
    }
    
    // Limpiar registro actual
    this.servers.clear();
    
    // Registrar servidores
    for (const server of data) {
      this.servers.set(server.id, {
        id: server.id,
        name: server.name,
        description: server.description,
        type: server.type,
        command: server.params?.command,
        args: server.params?.args || [],
        url: server.url,
        active: server.active,
      });
    }
    
    console.log(`Cargados ${this.servers.size} servidores MCP`);
  }
  
  // Obtener configuración de un servidor
  getServer(id: string): MCPServerConfig | undefined {
    return this.servers.get(id);
  }
  
  // Obtener todos los servidores
  getAllServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }
  
  // Registrar un nuevo servidor
  async registerServer(config: MCPServerConfig): Promise<string> {
    // Guardar en Supabase
    const { data, error } = await this.db
      .from('mcp_servers')
      .insert({
        name: config.name,
        description: config.description,
        type: config.type,
        url: config.url,
        params: {
          command: config.command,
          args: config.args,
        },
        active: config.active,
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error al registrar servidor MCP: ${error.message}`);
    }
    
    const id = data.id;
    
    // Añadir al registro en memoria
    this.servers.set(id, {
      ...config,
      id,
    });
    
    return id;
  }
  
  // Actualizar un servidor existente
  async updateServer(id: string, config: Partial<MCPServerConfig>): Promise<void> {
    // Verificar si existe
    if (!this.servers.has(id)) {
      throw new Error(`Servidor MCP no encontrado: ${id}`);
    }
    
    // Preparar datos para actualización
    const updateData: any = {};
    
    if (config.name !== undefined) updateData.name = config.name;
    if (config.description !== undefined) updateData.description = config.description;
    if (config.type !== undefined) updateData.type = config.type;
    if (config.url !== undefined) updateData.url = config.url;
    if (config.active !== undefined) updateData.active = config.active;
    
    // Actualizar parámetros si es necesario
    if (config.command !== undefined || config.args !== undefined) {
      const currentServer = this.servers.get(id)!;
      updateData.params = {
        command: config.command ?? currentServer.command,
        args: config.args ?? currentServer.args,
      };
    }
    
    // Actualizar en Supabase
    const { error } = await this.db
      .from('mcp_servers')
      .update(updateData)
      .eq('id', id);
    
    if (error) {
      throw new Error(`Error al actualizar servidor MCP: ${error.message}`);
    }
    
    // Actualizar en memoria
    this.servers.set(id, {
      ...this.servers.get(id)!,
      ...config,
    });
  }
  
  // Eliminar un servidor
  async deleteServer(id: string): Promise<void> {
    // Verificar si existe
    if (!this.servers.has(id)) {
      throw new Error(`Servidor MCP no encontrado: ${id}`);
    }
    
    // Eliminar de Supabase
    const { error } = await this.db
      .from('mcp_servers')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Error al eliminar servidor MCP: ${error.message}`);
    }
    
    // Eliminar de memoria
    this.servers.delete(id);
  }
}
```

## Repositorios y Recursos Relevantes

- [Repositorio oficial de MCP](https://github.com/modelcontextprotocol/modelcontextprotocol)
- [Ejemplo de implementación de servidor y cliente MCP](https://github.com/manojjahgirdar/ai-agents-interoperability)
- [Documentación oficial de MCP](https://modelcontextprotocol.io/)
- [Documentación de MCP en Anthropic](https://docs.anthropic.com/en/docs/agents-and-tools/mcp)
- [Integración de MCP en OpenAI Agents SDK](https://openai.github.io/openai-agents-python/mcp/)

## Conclusiones

Los ejemplos y patrones presentados en este documento proporcionan una base sólida para implementar servidores y clientes MCP en la plataforma web de gestión de asistentes virtuales. La arquitectura modular y los patrones de adaptador facilitan la integración con la infraestructura existente basada en OpenAI y Supabase.

Al seguir estos patrones, la plataforma puede beneficiarse de:

1. **Interoperabilidad**: Capacidad para conectar asistentes con diversas fuentes de datos y herramientas.
2. **Modularidad**: Facilidad para añadir o eliminar capacidades sin modificar el núcleo de la aplicación.
3. **Escalabilidad**: Posibilidad de distribuir la carga entre múltiples servidores MCP.
4. **Seguridad**: Implementación de los principios de seguridad y privacidad de MCP desde el diseño.

Estos ejemplos deben adaptarse a las necesidades específicas de la plataforma, considerando aspectos como la autenticación, la gestión de errores y el rendimiento.
