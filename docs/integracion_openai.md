# Conectando MCP con Asistentes OpenAI Function Calling

## Introducción

La integración del Model Context Protocol (MCP) con los asistentes de OpenAI que utilizan function calling requiere un enfoque estructurado para traducir entre ambos sistemas. Esta sección detalla cómo implementar esta conexión, centrándose en el componente clave: el Adaptador MCP.

## Entendiendo las Diferencias

Antes de implementar la conexión, es importante entender las diferencias fundamentales entre el function calling de OpenAI y el protocolo MCP:

| Característica | OpenAI Function Calling | Model Context Protocol |
|----------------|-------------------------|------------------------|
| Formato | JSON Schema para definir funciones | JSON-RPC 2.0 para comunicación |
| Ciclo de vida | Stateless, cada llamada es independiente | Stateful, mantiene conexiones |
| Capacidades | Limitado a funciones definidas | Recursos, Prompts y Herramientas |
| Seguridad | Gestionada por la aplicación | Principios integrados en el protocolo |

## El Adaptador MCP

El Adaptador MCP es el componente central que permite la comunicación entre los asistentes de OpenAI y los servidores MCP. Sus responsabilidades principales son:

1. Traducir las definiciones de herramientas MCP al formato de funciones de OpenAI
2. Convertir las llamadas a funciones de OpenAI en solicitudes MCP
3. Gestionar el ciclo de vida de las conexiones MCP
4. Implementar la lógica de consentimiento y seguridad

### Arquitectura del Adaptador

```
┌─────────────────────────────────────────────────────────────────┐
│                      Adaptador MCP                              │
│                                                                 │
│  ┌───────────────┐    ┌────────────────┐    ┌───────────────┐   │
│  │ Traductor de  │    │ Gestor de      │    │ Gestor de     │   │
│  │ Definiciones  │◄───┤ Conexiones     │◄───┤ Seguridad     │   │
│  └───────────────┘    └────────────────┘    └───────────────┘   │
│          ▲                    ▲                    ▲            │
│          │                    │                    │            │
│          ▼                    ▼                    ▼            │
│  ┌───────────────┐    ┌────────────────┐    ┌───────────────┐   │
│  │ Traductor de  │    │ Caché de       │    │ Registro de   │   │
│  │ Llamadas      │    │ Resultados     │    │ Actividad     │   │
│  └───────────────┘    └────────────────┘    └───────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         ▲                                           ▲
         │                                           │
         ▼                                           ▼
┌─────────────────┐                        ┌─────────────────────┐
│  OpenAI API     │                        │  Servidores MCP     │
└─────────────────┘                        └─────────────────────┘
```

## Implementación Paso a Paso

### 1. Inicialización del Adaptador MCP

```javascript
// Ejemplo de inicialización del Adaptador MCP
import { createClient } from '@supabase/supabase-js';
import { MCPClient } from '@modelcontextprotocol/client';

export class MCPAdapter {
  constructor(supabaseClient, openaiClient) {
    this.supabase = supabaseClient;
    this.openai = openaiClient;
    this.mcpClients = {}; // Almacena las conexiones a servidores MCP
    this.toolsCache = {}; // Caché de herramientas disponibles
  }

  async initialize() {
    // Cargar configuración de servidores MCP desde Supabase
    const { data: servers, error } = await this.supabase
      .from('mcp_servers')
      .select('*')
      .eq('active', true);
    
    if (error) throw new Error(`Error al cargar servidores MCP: ${error.message}`);
    
    // Inicializar conexiones a servidores MCP
    for (const server of servers) {
      await this.connectToServer(server);
    }
  }

  async connectToServer(serverConfig) {
    try {
      // Crear cliente MCP según el tipo de servidor
      const client = new MCPClient({
        serverType: serverConfig.type, // 'stdio' o 'sse'
        serverUrl: serverConfig.url,
        serverParams: serverConfig.params
      });
      
      // Inicializar conexión
      await client.connect();
      
      // Almacenar cliente en el registro
      this.mcpClients[serverConfig.id] = client;
      
      // Cargar y cachear herramientas disponibles
      await this.cacheServerTools(serverConfig.id);
      
      console.log(`Conectado al servidor MCP: ${serverConfig.name}`);
      return true;
    } catch (error) {
      console.error(`Error al conectar con servidor MCP ${serverConfig.name}: ${error.message}`);
      return false;
    }
  }
}
```

### 2. Traducción de Herramientas MCP a Funciones OpenAI

```javascript
async cacheServerTools(serverId) {
  const client = this.mcpClients[serverId];
  if (!client) throw new Error(`Cliente MCP no encontrado para servidor: ${serverId}`);
  
  // Obtener lista de herramientas del servidor MCP
  const tools = await client.listTools();
  
  // Traducir herramientas MCP al formato de funciones de OpenAI
  const openAIFunctions = tools.map(tool => this.translateToolToFunction(tool, serverId));
  
  // Almacenar en caché
  this.toolsCache[serverId] = {
    mcpTools: tools,
    openAIFunctions: openAIFunctions
  };
  
  // Registrar en Supabase para persistencia
  await this.registerToolsInDatabase(serverId, tools);
  
  return openAIFunctions;
}

translateToolToFunction(mcpTool, serverId) {
  // Traducir una herramienta MCP al formato de función de OpenAI
  return {
    type: "function",
    function: {
      name: `${serverId}_${mcpTool.name}`, // Prefijo para evitar colisiones
      description: mcpTool.description,
      parameters: this.translateParametersSchema(mcpTool.parameters),
      // Metadatos adicionales para rastrear origen
      metadata: {
        mcp_server_id: serverId,
        mcp_tool_name: mcpTool.name
      }
    }
  };
}

translateParametersSchema(mcpParameters) {
  // Convertir el esquema de parámetros MCP a JSON Schema para OpenAI
  // Esta es una implementación simplificada
  return {
    type: "object",
    properties: Object.entries(mcpParameters).reduce((acc, [key, param]) => {
      acc[key] = {
        type: param.type,
        description: param.description
      };
      return acc;
    }, {}),
    required: Object.entries(mcpParameters)
      .filter(([_, param]) => param.required)
      .map(([key, _]) => key)
  };
}
```

### 3. Integración con el Endpoint de Chat

Modificación del endpoint de chat actual para incluir las herramientas MCP:

```javascript
export async function POST(req: NextRequest) {
  if (!openai) {
    return NextResponse.json({ error: "OpenAI client not initialized." }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { assistantId, message, imageBase64, threadId: existingThreadId, employeeToken } = body;

    // Código existente para validación y configuración...

    // Inicializar adaptador MCP si no existe
    if (!global.mcpAdapter) {
      global.mcpAdapter = new MCPAdapter(supabase, openai);
      await global.mcpAdapter.initialize();
    }

    // Obtener herramientas MCP disponibles para este asistente
    const mcpTools = await global.mcpAdapter.getToolsForAssistant(assistantId);

    // Crear o recuperar thread...
    // Código existente para manejo de imágenes y mensajes...

    // Modificar la llamada a OpenAI para incluir herramientas MCP
    const runStream = openai.beta.threads.runs.stream(currentThreadId, {
      assistant_id: openaiAssistantId,
      tools: mcpTools // Incluir herramientas MCP traducidas
    });

    // Configurar el encoder para SSE...
    
    // Modificar el procesamiento de eventos para manejar llamadas a herramientas MCP
    for await (const event of runStream) {
      // Construir el payload...
      
      // Manejar llamadas a herramientas MCP
      if (event.event === 'thread.run.requires_action' && 
          event.data.required_action.type === 'submit_tool_outputs') {
        
        const toolCalls = event.data.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = [];
        
        for (const toolCall of toolCalls) {
          // Verificar si es una herramienta MCP
          if (toolCall.function.name.includes('_')) {
            const [serverId, toolName] = toolCall.function.name.split('_', 2);
            
            // Ejecutar la herramienta MCP
            const result = await global.mcpAdapter.executeToolCall(
              serverId, 
              toolName, 
              JSON.parse(toolCall.function.arguments),
              assistantId,
              employeeToken
            );
            
            toolOutputs.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify(result)
            });
          } else {
            // Manejar herramientas no-MCP existentes...
          }
        }
        
        // Enviar resultados de herramientas a OpenAI
        await openai.beta.threads.runs.submitToolOutputs(
          currentThreadId,
          event.data.id,
          { tool_outputs: toolOutputs }
        );
      }
      
      // Resto del código para manejo de eventos...
    }
    
    // Resto del código para finalización y manejo de errores...
  } catch (error) {
    // Manejo de errores...
  }
}
```

### 4. Ejecución de Herramientas MCP

```javascript
async executeToolCall(serverId, toolName, args, assistantId, employeeToken) {
  // Verificar consentimiento del usuario para esta herramienta
  const hasConsent = await this.verifyUserConsent(serverId, toolName, assistantId, employeeToken);
  if (!hasConsent) {
    return { error: "El usuario no ha dado consentimiento para ejecutar esta herramienta" };
  }
  
  // Obtener cliente MCP
  const client = this.mcpClients[serverId];
  if (!client) {
    return { error: `Servidor MCP no encontrado: ${serverId}` };
  }
  
  try {
    // Registrar inicio de ejecución
    const executionId = await this.logToolExecution(serverId, toolName, args, assistantId, employeeToken);
    
    // Ejecutar herramienta MCP
    const result = await client.callTool(toolName, args);
    
    // Registrar resultado
    await this.updateToolExecution(executionId, result);
    
    return result;
  } catch (error) {
    console.error(`Error al ejecutar herramienta MCP ${toolName}: ${error.message}`);
    
    // Registrar error
    if (executionId) {
      await this.updateToolExecution(executionId, null, error.message);
    }
    
    return { error: `Error al ejecutar herramienta: ${error.message}` };
  }
}

async verifyUserConsent(serverId, toolName, assistantId, employeeToken) {
  // Implementación de verificación de consentimiento
  // Puede incluir:
  // 1. Verificar consentimientos previos almacenados
  // 2. Solicitar consentimiento en tiempo real si es necesario
  // 3. Aplicar políticas de seguridad configuradas
  
  // Ejemplo simplificado:
  const { data, error } = await this.supabase
    .from('mcp_user_consents')
    .select('*')
    .eq('server_id', serverId)
    .eq('tool_name', toolName)
    .eq('assistant_id', assistantId)
    .eq('employee_token', employeeToken)
    .eq('active', true)
    .single();
  
  if (data) return true;
  
  // Si no hay consentimiento previo, podría implementarse un mecanismo
  // para solicitar consentimiento en tiempo real
  
  return false; // Por defecto, no permitir sin consentimiento explícito
}
```

### 5. Gestión del Ciclo de Vida

```javascript
// Métodos para gestionar el ciclo de vida de las conexiones MCP

async refreshConnections() {
  // Actualizar conexiones periódicamente
  for (const serverId in this.mcpClients) {
    const client = this.mcpClients[serverId];
    if (!client.isConnected()) {
      console.log(`Reconectando al servidor MCP: ${serverId}`);
      try {
        await client.connect();
        // Actualizar caché de herramientas
        await this.cacheServerTools(serverId);
      } catch (error) {
        console.error(`Error al reconectar con servidor MCP ${serverId}: ${error.message}`);
      }
    }
  }
}

async shutdown() {
  // Cerrar conexiones al finalizar
  for (const serverId in this.mcpClients) {
    try {
      await this.mcpClients[serverId].disconnect();
      console.log(`Desconectado del servidor MCP: ${serverId}`);
    } catch (error) {
      console.error(`Error al desconectar del servidor MCP ${serverId}: ${error.message}`);
    }
  }
}
```

## Ejemplo Completo de Flujo

A continuación se presenta un ejemplo completo del flujo de interacción entre un asistente de OpenAI y un servidor MCP:

1. **Inicialización**:
   - La aplicación inicia y carga la configuración de servidores MCP desde Supabase.
   - El Adaptador MCP establece conexiones con los servidores configurados.
   - Se obtienen y cachean las herramientas disponibles.

2. **Configuración de Asistente**:
   - Se asignan herramientas MCP específicas a cada asistente según su propósito.
   - Las asignaciones se almacenan en Supabase para persistencia.

3. **Interacción de Usuario**:
   - El usuario envía un mensaje a un asistente.
   - El mensaje se procesa y se envía a OpenAI junto con las definiciones de herramientas MCP.

4. **Llamada a Herramienta**:
   - OpenAI decide llamar a una herramienta MCP.
   - El Adaptador MCP recibe la solicitud y:
     - Identifica el servidor y la herramienta correspondiente.
     - Verifica el consentimiento del usuario.
     - Traduce los argumentos al formato MCP.
     - Ejecuta la llamada al servidor MCP.
     - Recibe y procesa la respuesta.
     - Traduce la respuesta al formato esperado por OpenAI.
     - Envía la respuesta a OpenAI para continuar la conversación.

5. **Respuesta Final**:
   - OpenAI genera una respuesta final incorporando los resultados de las herramientas.
   - La respuesta se envía al usuario y se almacena en Supabase.

## Consideraciones de Implementación

### Manejo de Errores

Es crucial implementar un manejo robusto de errores para gestionar:

- Fallos de conexión con servidores MCP
- Errores en la ejecución de herramientas
- Problemas de traducción entre formatos
- Tiempos de espera y reintentos

### Seguridad

Siguiendo los principios de seguridad de MCP:

1. Implementar verificación de consentimiento para cada ejecución de herramienta.
2. Registrar todas las ejecuciones para auditoría.
3. Limitar el acceso a herramientas según el contexto y permisos del usuario.
4. Validar y sanitizar todos los argumentos antes de ejecutar herramientas.

### Rendimiento

Para optimizar el rendimiento:

1. Implementar caché de herramientas con invalidación controlada.
2. Utilizar conexiones persistentes con servidores MCP.
3. Implementar mecanismos de timeout y circuit breaker para herramientas lentas o con fallos.
4. Considerar la implementación de un pool de conexiones para servidores MCP muy utilizados.

## Esquema de Base de Datos

Para soportar esta integración, se recomienda ampliar el esquema de Supabase con las siguientes tablas:

```sql
-- Servidores MCP disponibles
CREATE TABLE mcp_servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'stdio' o 'sse'
  url TEXT,
  params JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Herramientas proporcionadas por servidores MCP
CREATE TABLE mcp_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID REFERENCES mcp_servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parameters JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(server_id, name)
);

-- Asignación de herramientas a asistentes
CREATE TABLE mcp_assistant_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assistant_id TEXT NOT NULL,
  tool_id UUID REFERENCES mcp_tools(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(assistant_id, tool_id)
);

-- Registro de ejecuciones de herramientas
CREATE TABLE mcp_tool_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID REFERENCES mcp_servers(id),
  tool_name TEXT NOT NULL,
  assistant_id TEXT NOT NULL,
  employee_token TEXT,
  thread_id TEXT,
  arguments JSONB,
  result JSONB,
  error TEXT,
  execution_time FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Consentimientos de usuario para herramientas
CREATE TABLE mcp_user_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID REFERENCES mcp_servers(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  assistant_id TEXT NOT NULL,
  employee_token TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(server_id, tool_name, assistant_id, employee_token)
);
```

## Conclusión

La integración de MCP con los asistentes de OpenAI que utilizan function calling requiere un enfoque estructurado y la implementación de un Adaptador MCP robusto. Este adaptador actúa como puente entre ambos sistemas, traduciendo definiciones y llamadas, gestionando conexiones y asegurando que se cumplan los principios de seguridad de MCP.

Con esta implementación, la plataforma puede aprovechar la potencia y flexibilidad de MCP mientras mantiene la compatibilidad con la infraestructura existente basada en OpenAI.
