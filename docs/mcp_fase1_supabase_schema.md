# Fase 1: Esquema de Supabase para la Integración Básica de MCP

Este documento describe el esquema inicial de la base de datos en Supabase necesario para la primera fase de integración del Model Context Protocol (MCP) en el proyecto de asistentes.

En esta fase inicial, el objetivo es establecer la estructura básica para que el `MCPAdapter` pueda:
1.  Cargar la configuración de servidores MCP (ficticios por ahora).
2.  Descubrir herramientas MCP (ficticias) asociadas a esos servidores.
3.  Registrar ejecuciones de herramientas (simuladas).
4.  Verificar consentimientos de usuario (simulados).

## Scripts SQL para las Tablas

A continuación se presentan los scripts `CREATE TABLE` para las tablas requeridas. Puedes ejecutar estos scripts directamente en el Editor SQL de tu proyecto Supabase.

### 1. `mcp_servers`

Almacena la información sobre los servidores MCP disponibles. En esta fase, registraremos un servidor ficticio.

```sql
CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('stdio', 'sse', 'fictional')), -- 'fictional' para esta fase
  url TEXT, -- No se usará para 'fictional'
  params JSONB, -- Para configuraciones específicas del servidor (e.g., comando para stdio)
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON COLUMN mcp_servers.type IS 'Tipo de servidor MCP: stdio, sse, o fictional para la fase inicial.';
```

### 2. `mcp_tools`

Catálogo de herramientas proporcionadas por los servidores MCP. Cada herramienta está vinculada a un servidor.

```sql
CREATE TABLE IF NOT EXISTS mcp_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID REFERENCES mcp_servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parameters JSONB, -- Esquema JSON de los parámetros de la herramienta
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(server_id, name)
);

COMMENT ON COLUMN mcp_tools.parameters IS 'Esquema JSON que describe los parámetros que acepta la herramienta.';
```

### 3. `mcp_assistant_tools` (Opcional para inicio, recomendado)

Define qué asistentes tienen permiso para utilizar qué herramientas MCP.

```sql
CREATE TABLE IF NOT EXISTS mcp_assistant_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assistant_id TEXT NOT NULL, -- ID del asistente de OpenAI
  tool_id UUID REFERENCES mcp_tools(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true, -- Si el asistente puede usar esta herramienta
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(assistant_id, tool_id)
);

COMMENT ON COLUMN mcp_assistant_tools.assistant_id IS 'Corresponde al ID del asistente definido en OpenAI.';
```

### 4. `mcp_user_consents`

Registra los consentimientos otorgados por los usuarios para que los asistentes utilicen herramientas específicas en su nombre.

```sql
CREATE TABLE IF NOT EXISTS mcp_user_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Usaremos employee_token como identificador de usuario si es apropiado,
  -- o se podría generalizar a un user_id si existe en tu sistema.
  user_identifier TEXT NOT NULL, 
  server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL, 
  assistant_id TEXT NOT NULL, -- Asistente para el cual se dio el consentimiento
  has_consent BOOLEAN DEFAULT false,
  consent_date TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- Opcional: si el consentimiento expira
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_identifier, server_id, tool_name, assistant_id)
);

COMMENT ON COLUMN mcp_user_consents.user_identifier IS 'Identificador único del usuario que otorga el consentimiento (ej. employeeToken).';
COMMENT ON TABLE mcp_user_consents IS 'Almacena los consentimientos de los usuarios para el uso de herramientas MCP por parte de los asistentes.';

-- Asegurarse de que tool_name y server_id formen una referencia válida a una herramienta existente.
-- Esto se maneja mejor a nivel de aplicación o con triggers más complejos si es necesario,
-- ya que mcp_tools tiene server_id y name como clave única.
```

### 5. `mcp_tool_executions`

Registra cada vez que un asistente llama a una herramienta MCP.

```sql
CREATE TABLE IF NOT EXISTS mcp_tool_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID REFERENCES mcp_servers(id),
  tool_name TEXT NOT NULL,
  assistant_id TEXT NOT NULL,
  user_identifier TEXT, -- Identificador del usuario en cuya sesión se ejecuta la herramienta
  thread_id TEXT, -- ID del thread de OpenAI
  tool_call_id TEXT, -- ID de la llamada a herramienta específica de OpenAI
  arguments JSONB, -- Argumentos con los que se llamó a la herramienta
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'error', 'requires_action_response')),
  result JSONB, -- Resultado de la ejecución de la herramienta
  error_message TEXT, -- Mensaje de error si la ejecución falló
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON COLUMN mcp_tool_executions.user_identifier IS 'Identificador del usuario (ej. employeeToken) en el contexto de la ejecución.';
COMMENT ON COLUMN mcp_tool_executions.tool_call_id IS 'El ID de la llamada a herramienta proporcionado por OpenAI.';
COMMENT ON COLUMN mcp_tool_executions.status IS 'Estado de la ejecución de la herramienta.';
```

## Próximos Pasos

Una vez creadas estas tablas en Supabase:
1.  Poblaremos `mcp_servers` con una entrada para un servidor ficticio (por ejemplo, `id: <nuevo_uuid>, name: 'fictional-server-1', type: 'fictional'`).
2.  Poblaremos `mcp_tools` con una herramienta ficticia asociada a ese servidor (por ejemplo, `server_id: <uuid_servidor_ficticio>, name: 'get_weather_forecast', description: 'Simula obtener el pronóstico del tiempo', parameters: {"type": "object", "properties": {"location": {"type": "string", "description": "Ciudad para el pronóstico"}}, "required": ["location"]}`).
3.  Comenzaremos el desarrollo del `MCPAdapter` en el backend para interactuar con estas tablas.

Este esquema proporciona una base sólida para comenzar la integración y se puede ampliar en fases posteriores a medida que se añadan funcionalidades MCP más complejas.
