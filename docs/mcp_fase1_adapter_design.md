# Fase 1: Diseño del MCPAdapter Básico

Este documento describe el diseño inicial y la implementación del `MCPAdapter` para la primera fase de integración del Model Context Protocol (MCP). El objetivo es crear un adaptador que pueda interactuar con la estructura de Supabase definida en `docs/mcp_fase1_supabase_schema.md`, manejar herramientas ficticias y comunicarse con la API de OpenAI.

## Ubicación

El adaptador se implementará en: `lib/mcp_adapter.ts` (o una ruta similar según la estructura del proyecto).

## Estructura de la Clase `MCPAdapter`

```typescript
// lib/mcp_adapter.ts
import { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Tipos para los datos de Supabase (simplificados por ahora)
interface McpServer {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'fictional';
  url?: string | null;
  params?: any | null;
  active?: boolean | null;
}

interface McpTool {
  id: string;
  server_id: string;
  name: string;
  description?: string | null;
  parameters: any; // Debería ser un JSON Schema
}

interface McpAssistantTool {
  assistant_id: string;
  tool_id: string;
  enabled: boolean;
}

// Formato de herramienta para OpenAI
interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: any; // JSON Schema
  };
}

export class MCPAdapter {
  private supabase: SupabaseClient;
  private openai: OpenAI;
  private mcpClients: Map<string, any>; // Simulará clientes MCP por serverId
  private toolsCache: Map<string, { mcpTools: McpTool[], openAITools: OpenAITool[] }>;

  constructor(supabaseClient: SupabaseClient, openaiClient: OpenAI) {
    this.supabase = supabaseClient;
    this.openai = openaiClient;
    this.mcpClients = new Map();
    this.toolsCache = new Map();
    console.log("MCPAdapter instantiated");
  }

  /**
   * Inicializa el adaptador cargando la configuración de servidores MCP desde Supabase.
   */
  async initialize(): Promise<void> {
    console.log("MCPAdapter: Initializing...");
    const { data: servers, error } = await this.supabase
      .from('mcp_servers')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error("MCPAdapter: Error loading MCP servers:", error);
      throw new Error(`Error loading MCP servers: ${error.message}`);
    }

    if (!servers || servers.length === 0) {
      console.warn("MCPAdapter: No active MCP servers found in Supabase.");
      return;
    }

    console.log(`MCPAdapter: Found ${servers.length} active MCP servers.`);

    for (const server of servers as McpServer[]) {
      await this.connectToServer(server);
    }
    console.log("MCPAdapter: Initialization complete.");
  }

  /**
   * Simula la conexión a un servidor MCP y carga sus herramientas.
   * Para servidores 'fictional', solo carga las herramientas desde Supabase.
   */
  private async connectToServer(serverConfig: McpServer): Promise<void> {
    console.log(`MCPAdapter: Connecting to server ${serverConfig.name} (ID: ${serverConfig.id}, Type: ${serverConfig.type})`);
    if (serverConfig.type === 'fictional') {
      // Para servidores ficticios, no hay conexión real, solo cargamos herramientas.
      this.mcpClients.set(serverConfig.id, { status: 'connected', type: 'fictional' });
      await this.cacheServerTools(serverConfig.id);
      console.log(`MCPAdapter: Successfully "connected" to fictional server ${serverConfig.name} and cached its tools.`);
    } else {
      // Aquí iría la lógica para conectar a servidores stdio o sse reales en el futuro.
      console.warn(`MCPAdapter: Connection logic for server type '${serverConfig.type}' is not yet implemented.`);
      this.mcpClients.set(serverConfig.id, { status: 'not_implemented', type: serverConfig.type });
    }
  }

  /**
   * Carga las herramientas de un servidor MCP específico desde Supabase,
   * las traduce al formato de OpenAI y las almacena en caché.
   */
  private async cacheServerTools(serverId: string): Promise<void> {
    console.log(`MCPAdapter: Caching tools for server ID: ${serverId}`);
    const { data: mcpToolsData, error } = await this.supabase
      .from('mcp_tools')
      .select('*')
      .eq('server_id', serverId);

    if (error) {
      console.error(`MCPAdapter: Error loading tools for server ${serverId}:`, error);
      this.toolsCache.delete(serverId); // Limpiar caché si hay error
      return;
    }

    if (!mcpToolsData || mcpToolsData.length === 0) {
      console.warn(`MCPAdapter: No tools found for server ${serverId}.`);
      this.toolsCache.set(serverId, { mcpTools: [], openAITools: [] });
      return;
    }

    const mcpTools = mcpToolsData as McpTool[];
    const openAITools = mcpTools.map(tool => this.translateToolToOpenAIFormat(tool, serverId));
    
    this.toolsCache.set(serverId, { mcpTools, openAITools });
    console.log(`MCPAdapter: Cached ${mcpTools.length} tools for server ${serverId}.`);
  }

  /**
   * Traduce una herramienta MCP al formato de función de OpenAI.
   */
  private translateToolToOpenAIFormat(mcpTool: McpTool, serverId: string): OpenAITool {
    // Usar un prefijo para identificar claramente las herramientas MCP y evitar colisiones.
    // El formato será: mcp_${serverId}_${mcpTool.name}
    // OpenAI tiene restricciones en los nombres de funciones (letras, números, guiones bajos, max 64 chars)
    const openAIName = `mcp_${serverId.replace(/-/g, '_')}_${mcpTool.name}`.substring(0, 64);

    return {
      type: 'function',
      function: {
        name: openAIName,
        description: mcpTool.description || undefined,
        parameters: mcpTool.parameters || { type: 'object', properties: {} },
      },
    };
  }

  /**
   * Obtiene todas las herramientas disponibles (en formato OpenAI) para un asistente específico.
   * TODO: Implementar la lógica para filtrar herramientas basadas en `mcp_assistant_tools`.
   */
  async getToolsForAssistant(assistantId: string): Promise<OpenAITool[]> {
    console.log(`MCPAdapter: Getting tools for assistant ID: ${assistantId}`);
    let allOpenAITools: OpenAITool[] = [];

    // Por ahora, devolvemos todas las herramientas cacheadas de todos los servidores.
    // En el futuro, filtraremos según la tabla `mcp_assistant_tools`.
    
    // Ejemplo de cómo se podría filtrar (requiere cargar `mcp_assistant_tools`):
    // const { data: assistantToolLinks, error } = await this.supabase
    //   .from('mcp_assistant_tools')
    //   .select('tool_id, mcp_tools(server_id, name, description, parameters)')
    //   .eq('assistant_id', assistantId)
    //   .eq('enabled', true);
    // if (error || !assistantToolLinks) {
    //   console.error('MCPAdapter: Error fetching assistant tool links', error);
    //   return [];
    // }
    // allOpenAITools = assistantToolLinks.map(link => {
    //   const tool = (link.mcp_tools as any) as McpTool; // Cast needed due to Supabase join type
    //   return this.translateToolToOpenAIFormat(tool, tool.server_id);
    // });


    for (const serverCache of this.toolsCache.values()) {
      allOpenAITools = allOpenAITools.concat(serverCache.openAITools);
    }

    console.log(`MCPAdapter: Providing ${allOpenAITools.length} tools for assistant ${assistantId}.`);
    return allOpenAITools;
  }

  /**
   * Ejecuta una llamada a herramienta MCP.
   * Para esta fase, simulará la ejecución y devolverá una respuesta ficticia.
   */
  async executeToolCall(
    toolCallId: string, // ID de la tool_call de OpenAI
    functionName: string, // Nombre de la función como la conoce OpenAI (e.g., mcp_serverid_toolname)
    functionArgs: any,
    assistantId: string,
    threadId: string,
    userIdentifier?: string,
  ): Promise<any> {
    console.log(`MCPAdapter: Attempting to execute tool call for OpenAI function: ${functionName}`);
    
    // Parsear serverId y toolName desde functionName
    // Asumimos el formato `mcp_${serverId}_${toolName}`
    const nameParts = functionName.startsWith('mcp_') ? functionName.substring(4).split('_') : [];
    if (nameParts.length < 2) { // Debería ser serverId_toolName, potencialmente con más guiones bajos en serverId
        console.error(`MCPAdapter: Could not parse serverId and toolName from OpenAI function name: ${functionName}`);
        return { error: `Invalid MCP function name format: ${functionName}` };
    }
    
    // Reconstruir serverId si contenía guiones bajos (que se convirtieron en '_')
    // Esta parte es un poco heurística y depende de cómo se generó el serverId originalmente.
    // Si los serverId son UUIDs, no tendrán guiones bajos. Si son nombres, sí.
    // Por simplicidad, asumimos que el último segmento es el toolName y el resto es serverId.
    const toolName = nameParts.pop()!; 
    const serverIdFromFuncName = nameParts.join('_'); // Esto podría necesitar ajuste si los serverId tienen guiones bajos.
                                                  // Por ahora, buscaremos un serverId que coincida.

    let actualServerId = serverIdFromFuncName;
    let serverCache = this.toolsCache.get(actualServerId);

    if (!serverCache) {
        // Intentar encontrar el serverId original si el nombre fue modificado (e.g. UUIDs con guiones)
        for (const [sid, cache] of this.toolsCache.entries()) {
            if (sid.replace(/-/g, '_') === serverIdFromFuncName) {
                actualServerId = sid;
                serverCache = cache;
                break;
            }
        }
    }

    if (!serverCache || !serverCache.mcpTools.find(t => t.name === toolName)) {
      console.error(`MCPAdapter: Tool ${toolName} on server ${actualServerId} not found in cache for OpenAI function ${functionName}.`);
      return { error: `Tool ${toolName} on server ${actualServerId} not found.` };
    }
    
    console.log(`MCPAdapter: Identified MCP Tool: ${toolName} on Server ID: ${actualServerId}`);

    // 1. Verificar consentimiento (simulado por ahora)
    const consent = await this.verifyUserConsent(actualServerId, toolName, assistantId, userIdentifier);
    if (!consent) {
      const errorMsg = `User consent not granted for tool ${toolName} on server ${actualServerId}.`;
      console.warn(`MCPAdapter: ${errorMsg}`);
      await this.logToolExecution(toolCallId, actualServerId, toolName, assistantId, threadId, functionArgs, 'error', null, errorMsg, userIdentifier);
      return { error: errorMsg };
    }
    console.log(`MCPAdapter: Consent verified for tool ${toolName}.`);

    // 2. Loggear inicio de ejecución
    const executionLogId = await this.logToolExecution(toolCallId, actualServerId, toolName, assistantId, threadId, functionArgs, 'pending', null, null, userIdentifier);
    console.log(`MCPAdapter: Logged pending execution for tool ${toolName} with ID: ${executionLogId}`);

    // 3. Simular ejecución de la herramienta
    let result: any;
    let status: 'success' | 'error' = 'success';
    let errorMessage: string | null = null;

    try {
      // Aquí, en el futuro, se llamaría a `this.mcpClients.get(actualServerId).callTool(toolName, functionArgs);`
      console.log(`MCPAdapter: Simulating execution of ${toolName} with args:`, functionArgs);
      
      if (toolName === 'get_weather_forecast') {
        result = { 
          forecast: `Sunny with a chance of awesome for ${functionArgs.location}! (Simulated)`,
          temperature: "25°C"
        };
      } else {
        result = { message: `Simulated result for ${toolName}`, args_received: functionArgs };
      }
      await new Promise(resolve => setTimeout(resolve, 500)); // Simular latencia
      console.log(`MCPAdapter: Simulation successful for ${toolName}. Result:`, result);

    } catch (e: any) {
      console.error(`MCPAdapter: Error simulating execution of tool ${toolName}:`, e);
      status = 'error';
      errorMessage = e.message || "Unknown error during tool simulation.";
      result = { error: errorMessage };
    }

    // 4. Loggear finalización de ejecución
    await this.logToolExecution(toolCallId, actualServerId, toolName, assistantId, threadId, functionArgs, status, result, errorMessage, userIdentifier, executionLogId);
    console.log(`MCPAdapter: Logged ${status} execution for tool ${toolName}.`);
    
    return result;
  }

  /**
   * Simula la verificación del consentimiento del usuario.
   * Debería consultar `mcp_user_consents` en una implementación real.
   */
  private async verifyUserConsent(
    serverId: string, 
    toolName: string, 
    assistantId: string, 
    userIdentifier?: string
  ): Promise<boolean> {
    if (!userIdentifier) {
      console.warn(`MCPAdapter: No userIdentifier provided for consent check. Defaulting to no consent.`);
      return false; // O true si queremos bypass para pruebas iniciales sin usuario
    }
    console.log(`MCPAdapter: Verifying consent for User: ${userIdentifier}, Server: ${serverId}, Tool: ${toolName}, Assistant: ${assistantId}`);
    
    // TODO: Implementar consulta real a `mcp_user_consents`
    // const { data, error } = await this.supabase
    //   .from('mcp_user_consents')
    //   .select('has_consent')
    //   .eq('user_identifier', userIdentifier)
    //   .eq('server_id', serverId)
    //   .eq('tool_name', toolName)
    //   .eq('assistant_id', assistantId)
    //   .single();
    // if (error || !data) { return false; }
    // return data.has_consent;

    // Por ahora, simular que siempre hay consentimiento si hay userIdentifier
    console.log("MCPAdapter: Consent check simulated: Granted.");
    return true; 
  }

  /**
   * Registra la ejecución de una herramienta en la tabla `mcp_tool_executions`.
   * Si se proporciona `existingLogId`, actualiza el registro existente.
   */
  private async logToolExecution(
    toolCallId: string,
    serverId: string,
    toolName: string,
    assistantId: string,
    threadId: string,
    args: any,
    status: 'pending' | 'success' | 'error' | 'requires_action_response',
    result?: any | null,
    errorMessage?: string | null,
    userIdentifier?: string,
    existingLogId?: string,
  ): Promise<string | null> {
    console.log(`MCPAdapter: Logging tool execution - Server: ${serverId}, Tool: ${toolName}, Status: ${status}`);
    
    const logEntry = {
      tool_call_id: toolCallId,
      server_id: serverId,
      tool_name: toolName,
      assistant_id: assistantId,
      thread_id: threadId,
      arguments: args,
      status: status,
      result: result,
      error_message: errorMessage,
      user_identifier: userIdentifier,
      completed_at: (status === 'success' || status === 'error') ? new Date().toISOString() : null,
      // started_at se define por defecto en la DB con NOW() al insertar
    };

    if (existingLogId) {
      // Actualizar registro existente (principalmente para status y completed_at)
      const { data, error } = await this.supabase
        .from('mcp_tool_executions')
        .update({
          status: status,
          result: result,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', existingLogId)
        .select('id')
        .single();
        
      if (error) {
        console.error('MCPAdapter: Error updating tool execution log:', error);
        return null;
      }
      return data?.id || null;
    } else {
      // Crear nuevo registro
      const { data, error } = await this.supabase
        .from('mcp_tool_executions')
        .insert(logEntry)
        .select('id')
        .single();

      if (error) {
        console.error('MCPAdapter: Error inserting tool execution log:', error);
        return null;
      }
      return data?.id || null;
    }
  }

  // TODO: Métodos para gestionar el ciclo de vida (refreshConnections, shutdown) si es necesario.
}

```

## Consideraciones Iniciales

*   **Tipos**: Los tipos para `McpServer`, `McpTool` deben coincidir con las columnas de Supabase. `parameters` en `McpTool` es un `JSONB` que idealmente contendrá un JSON Schema.
*   **Conexión a Servidores**: `connectToServer` solo simula la conexión y carga de herramientas para el tipo `'fictional'`. La lógica para tipos `'stdio'` y `'sse'` se añadirá en fases posteriores.
*   **`getToolsForAssistant`**: Inicialmente, este método devolverá todas las herramientas cacheadas. La lógica para filtrar según los permisos del asistente (`mcp_assistant_tools`) se implementará después.
*   **`executeToolCall`**:
    *   El parseo de `functionName` para extraer `serverId` y `toolName` es crucial. Se usa el prefijo `mcp_`. La reconstrucción del serverId si tiene guiones bajos que se transformaron en `_` en el nombre de la función de OpenAI necesitará ser robusta.
    *   La verificación de consentimiento (`verifyUserConsent`) es simulada.
    *   La ejecución real de la herramienta es simulada. Se añadirá la llamada real al cliente MCP (`this.mcpClients.get(serverId).callTool(...)`) cuando tengamos servidores MCP funcionales.
    *   Se incluye un logging básico a `mcp_tool_executions`.
*   **Errores y Logging**: Se incluye `console.log` básico para seguimiento. Se mejorará el manejo de errores.
*   **Nombres de Funciones OpenAI**: OpenAI tiene restricciones para los nombres de las funciones (generalmente `a-zA-Z0-9_`, máx 64 caracteres). El método `translateToolToOpenAIFormat` debe asegurar que los nombres generados sean válidos. Se antepone `mcp_` y se reemplazan guiones por guiones bajos en el serverId para el nombre de la función.

## Datos Ficticios en Supabase

Para probar este adaptador, necesitaremos insertar algunos datos en las tablas de Supabase:

1.  **En `mcp_servers`**:
    *   Un servidor ficticio. Ejemplo:
        ```sql
        INSERT INTO mcp_servers (name, type, description, active) VALUES 
        ('fictional_weather_service', 'fictional', 'Servidor ficticio para pronósticos del tiempo', true);
        ```
        (Toma nota del `id` UUID generado para este servidor).

2.  **En `mcp_tools`**:
    *   Una herramienta ficticia asociada al servidor anterior. Ejemplo (reemplaza `<ID_DEL_SERVIDOR_FICTICIO>`):
        ```sql
        INSERT INTO mcp_tools (server_id, name, description, parameters) VALUES 
        ('<ID_DEL_SERVIDOR_FICTICIO>', 'get_weather_forecast', 'Obtiene el pronóstico del tiempo para una ubicación.', 
        '{
          "type": "object",
          "properties": {
            "location": {"type": "string", "description": "La ciudad y estado, ej. San Francisco, CA"},
            "unit": {"type": "string", "enum": ["celsius", "fahrenheit"], "description": "Unidad de temperatura"}
          },
          "required": ["location"]
        }');
        ```

Con estos datos y la estructura del `MCPAdapter`, podremos empezar a modificar el endpoint de la API de chat.

## Modificación del Endpoint de Chat (Próximo Paso)

Una vez que el `MCPAdapter` esté implementado con esta funcionalidad básica, el siguiente paso será:
1. Instanciar e inicializar el `MCPAdapter` en el endpoint de chat.
2. Usar `adapter.getToolsForAssistant()` para obtener las herramientas y pasarlas a OpenAI.
3. En el `event handler` de `thread.run.requires_action`, llamar a `adapter.executeToolCall()` para las funciones MCP y enviar el resultado a OpenAI.
