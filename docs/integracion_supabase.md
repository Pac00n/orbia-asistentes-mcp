# Recomendaciones Específicas para Integración con Supabase

Este documento proporciona recomendaciones específicas para integrar el Model Context Protocol (MCP) con Supabase como backend en una plataforma web de gestión de asistentes virtuales.

## Introducción

Supabase ofrece una plataforma completa que incluye base de datos PostgreSQL, autenticación, almacenamiento y funciones en tiempo real, lo que la convierte en una excelente opción para implementar la infraestructura de backend necesaria para MCP. Las siguientes recomendaciones están diseñadas para aprovechar al máximo las capacidades de Supabase en este contexto.

## Esquema de Base de Datos Optimizado

### Tablas Principales

Recomendamos implementar el siguiente esquema de base de datos en Supabase:

```sql
-- Servidores MCP disponibles
CREATE TABLE mcp_servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('stdio', 'sse')),
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

-- Trabajos asíncronos para herramientas de larga duración
CREATE TABLE mcp_async_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID REFERENCES mcp_servers(id),
  tool_name TEXT NOT NULL,
  arguments JSONB,
  assistant_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress JSONB,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Caché de herramientas MCP
CREATE TABLE mcp_tools_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID REFERENCES mcp_servers(id) ON DELETE CASCADE,
  tools_data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Índices Recomendados

Para optimizar el rendimiento de las consultas, recomendamos los siguientes índices:

```sql
-- Índices para búsquedas frecuentes
CREATE INDEX idx_mcp_tools_server_id ON mcp_tools(server_id);
CREATE INDEX idx_mcp_assistant_tools_assistant_id ON mcp_assistant_tools(assistant_id);
CREATE INDEX idx_mcp_tool_executions_assistant_id ON mcp_tool_executions(assistant_id);
CREATE INDEX idx_mcp_tool_executions_created_at ON mcp_tool_executions(created_at);
CREATE INDEX idx_mcp_user_consents_assistant_employee ON mcp_user_consents(assistant_id, employee_token);
CREATE INDEX idx_mcp_async_jobs_status ON mcp_async_jobs(status);
CREATE INDEX idx_mcp_async_jobs_assistant_id ON mcp_async_jobs(assistant_id);
```

### Políticas de Seguridad RLS

Supabase ofrece Row Level Security (RLS), que recomendamos configurar para proteger los datos:

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_assistant_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_async_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tools_cache ENABLE ROW LEVEL SECURITY;

-- Política para administradores (pueden ver y modificar todo)
CREATE POLICY admin_policy ON mcp_servers 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Política para usuarios normales (solo pueden ver servidores activos)
CREATE POLICY user_view_policy ON mcp_servers 
  FOR SELECT 
  TO authenticated 
  USING (active = true);

-- Política para ejecuciones de herramientas (usuarios solo ven sus propias ejecuciones)
CREATE POLICY user_executions_policy ON mcp_tool_executions 
  FOR SELECT 
  TO authenticated 
  USING (employee_token = auth.uid()::text);
```

## Integración con Autenticación de Supabase

### Autenticación para Servidores MCP

Recomendamos utilizar la autenticación de Supabase para proteger los servidores MCP:

```javascript
// Ejemplo de middleware para autenticar solicitudes a servidores MCP
const authenticateMCPRequest = async (req, res, next) => {
  const { authorization } = req.headers;
  
  if (!authorization) {
    return res.status(401).json({ error: 'No se proporcionó token de autenticación' });
  }
  
  try {
    // Verificar token con Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data, error } = await supabase.auth.getUser(authorization.replace('Bearer ', ''));
    
    if (error || !data.user) {
      return res.status(401).json({ error: 'Token de autenticación inválido' });
    }
    
    // Añadir información de usuario a la solicitud
    req.user = data.user;
    
    // Verificar permisos específicos para MCP
    const { data: permissions, error: permError } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', data.user.id)
      .single();
    
    if (permError || !permissions.can_use_mcp) {
      return res.status(403).json({ error: 'No tiene permisos para usar MCP' });
    }
    
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    return res.status(500).json({ error: 'Error interno de autenticación' });
  }
};
```

### Integración con Roles de Usuario

Supabase permite definir roles de usuario que pueden utilizarse para controlar el acceso a los servidores MCP:

```sql
-- Tabla de roles de usuario
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de asignación de roles a usuarios
CREATE TABLE user_role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES user_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Tabla de permisos de roles para servidores MCP
CREATE TABLE role_mcp_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID REFERENCES user_roles(id) ON DELETE CASCADE,
  server_id UUID REFERENCES mcp_servers(id) ON DELETE CASCADE,
  can_use BOOLEAN DEFAULT false,
  can_manage BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, server_id)
);
```

## Aprovechamiento de Funciones en Tiempo Real

### Suscripciones para Actualizaciones de Estado

Supabase ofrece capacidades de tiempo real que pueden utilizarse para notificar a los clientes sobre cambios en el estado de los servidores MCP:

```javascript
// En el cliente
const setupRealtimeSubscriptions = (supabase, assistantId) => {
  // Suscribirse a actualizaciones de trabajos asíncronos
  const asyncJobsSubscription = supabase
    .channel('mcp_async_jobs_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mcp_async_jobs',
        filter: `assistant_id=eq.${assistantId}`
      },
      (payload) => {
        console.log('Actualización de trabajo asíncrono:', payload);
        // Actualizar UI con el nuevo estado del trabajo
        updateJobStatus(payload.new);
      }
    )
    .subscribe();
  
  // Suscribirse a nuevas herramientas disponibles
  const toolsSubscription = supabase
    .channel('mcp_tools_changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mcp_tools'
      },
      (payload) => {
        console.log('Nueva herramienta disponible:', payload);
        // Actualizar lista de herramientas disponibles
        updateAvailableTools();
      }
    )
    .subscribe();
  
  return () => {
    // Función para limpiar suscripciones
    supabase.removeChannel(asyncJobsSubscription);
    supabase.removeChannel(toolsSubscription);
  };
};
```

### Notificaciones en Tiempo Real

Implementar notificaciones para eventos importantes relacionados con MCP:

```javascript
// Función para enviar notificación cuando una herramienta completa su ejecución
const notifyToolCompletion = async (supabase, jobId, assistantId, employeeToken) => {
  // Obtener detalles del trabajo
  const { data: job, error } = await supabase
    .from('mcp_async_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (error || !job) {
    console.error('Error al obtener detalles del trabajo:', error);
    return;
  }
  
  // Crear notificación en la base de datos
  const { error: notifError } = await supabase
    .from('notifications')
    .insert({
      user_id: employeeToken,
      type: 'tool_completion',
      title: `Herramienta ${job.tool_name} completada`,
      content: job.status === 'completed' 
        ? 'La herramienta ha completado su ejecución exitosamente.' 
        : `La herramienta ha fallado: ${job.error}`,
      metadata: {
        job_id: jobId,
        assistant_id: assistantId,
        tool_name: job.tool_name,
        status: job.status
      },
      read: false
    });
  
  if (notifError) {
    console.error('Error al crear notificación:', notifError);
  }
};
```

## Almacenamiento de Archivos para MCP

### Gestión de Archivos con Supabase Storage

Supabase Storage puede utilizarse para almacenar archivos relacionados con MCP:

```javascript
// Clase para gestionar archivos MCP con Supabase Storage
class MCPFileManager {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.bucketName = 'mcp-files';
  }
  
  // Inicializar bucket si no existe
  async initializeBucket() {
    const { data, error } = await this.supabase.storage.getBucket(this.bucketName);
    
    if (error && error.statusCode === 404) {
      // Crear bucket si no existe
      const { error: createError } = await this.supabase.storage.createBucket(this.bucketName, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      });
      
      if (createError) {
        throw new Error(`Error al crear bucket: ${createError.message}`);
      }
    } else if (error) {
      throw new Error(`Error al verificar bucket: ${error.message}`);
    }
  }
  
  // Subir archivo para uso con herramientas MCP
  async uploadFile(assistantId, fileName, fileData, contentType) {
    const filePath = `${assistantId}/${fileName}`;
    
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filePath, fileData, {
        contentType,
        upsert: true
      });
    
    if (error) {
      throw new Error(`Error al subir archivo: ${error.message}`);
    }
    
    // Obtener URL pública (con tiempo limitado)
    const { data } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(filePath, 3600); // 1 hora
    
    return {
      path: filePath,
      url: data.signedUrl
    };
  }
  
  // Obtener archivo para herramientas MCP
  async getFile(filePath) {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .download(filePath);
    
    if (error) {
      throw new Error(`Error al descargar archivo: ${error.message}`);
    }
    
    return data;
  }
  
  // Listar archivos disponibles para un asistente
  async listFiles(assistantId) {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .list(assistantId);
    
    if (error) {
      throw new Error(`Error al listar archivos: ${error.message}`);
    }
    
    return data;
  }
  
  // Eliminar archivo
  async deleteFile(filePath) {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([filePath]);
    
    if (error) {
      throw new Error(`Error al eliminar archivo: ${error.message}`);
    }
    
    return true;
  }
}
```

### Servidor MCP para Acceso a Archivos

Implementar un servidor MCP específico para acceso a archivos almacenados en Supabase:

```javascript
// Servidor MCP para acceso a archivos en Supabase Storage
import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioTransport } from "@modelcontextprotocol/sdk/server/transports/stdio";
import { createClient } from '@supabase/supabase-js';

// Crear cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Crear servidor MCP
const server = new Server({
  name: "Servidor de Archivos MCP",
  transport: new StdioTransport(),
});

// Herramienta para listar archivos
server.registerTool({
  name: "listar_archivos",
  description: "Lista archivos disponibles para un asistente",
  parameters: {
    assistant_id: {
      type: "string",
      description: "ID del asistente",
      required: true,
    },
  },
  async execute({ assistant_id }) {
    try {
      const { data, error } = await supabase.storage
        .from('mcp-files')
        .list(assistant_id);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { 
        success: true, 
        files: data.map(file => ({
          name: file.name,
          size: file.metadata.size,
          created_at: file.metadata.lastModified,
          path: `${assistant_id}/${file.name}`
        }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
});

// Herramienta para leer contenido de archivo
server.registerTool({
  name: "leer_archivo",
  description: "Lee el contenido de un archivo",
  parameters: {
    file_path: {
      type: "string",
      description: "Ruta del archivo a leer",
      required: true,
    },
  },
  async execute({ file_path }) {
    try {
      const { data, error } = await supabase.storage
        .from('mcp-files')
        .download(file_path);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      // Convertir a texto si es posible
      let content;
      try {
        content = await data.text();
      } catch (e) {
        // Si no se puede convertir a texto, devolver información sobre el archivo
        const { data: urlData } = await supabase.storage
          .from('mcp-files')
          .createSignedUrl(file_path, 3600);
        
        return { 
          success: true, 
          is_binary: true,
          file_url: urlData.signedUrl,
          content_type: data.type
        };
      }
      
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
});

// Iniciar servidor
server.start();
```

## Funciones Edge para Servidores MCP

### Implementación de Servidores MCP como Funciones Edge

Supabase Edge Functions pueden utilizarse para implementar servidores MCP ligeros:

```typescript
// supabase/functions/mcp-database-server/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Server } from 'https://esm.sh/@modelcontextprotocol/sdk/server';
import { SseTransport } from 'https://esm.sh/@modelcontextprotocol/sdk/server/transports/sse';

serve(async (req) => {
  // Verificar método
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Método no permitido', { status: 405 });
  }
  
  // Crear cliente Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Crear servidor MCP con transporte SSE
  const server = new Server({
    name: "Servidor de Base de Datos MCP",
    transport: new SseTransport(),
  });
  
  // Registrar herramienta para consultar datos
  server.registerTool({
    name: "consultar_datos",
    description: "Consulta datos de una tabla específica",
    parameters: {
      tabla: {
        type: "string",
        description: "Nombre de la tabla a consultar",
        required: true,
      },
      filtros: {
        type: "object",
        description: "Filtros para la consulta",
        required: false,
      },
      limite: {
        type: "number",
        description: "Límite de resultados",
        required: false,
      },
    },
    async execute({ tabla, filtros, limite = 100 }) {
      try {
        // Verificar si la tabla está permitida
        const tablasPermitidas = ['productos', 'categorias', 'usuarios'];
        if (!tablasPermitidas.includes(tabla)) {
          return { 
            success: false, 
            error: `Tabla no permitida. Tablas disponibles: ${tablasPermitidas.join(', ')}` 
          };
        }
        
        // Construir consulta
        let query = supabase.from(tabla).select('*');
        
        // Aplicar filtros si existen
        if (filtros && typeof filtros === 'object') {
          Object.entries(filtros).forEach(([campo, valor]) => {
            query = query.eq(campo, valor);
          });
        }
        
        // Aplicar límite
        query = query.limit(limite);
        
        // Ejecutar consulta
        const { data, error } = await query;
        
        if (error) {
          return { success: false, error: error.message };
        }
        
        return { 
          success: true, 
          data,
          count: data.length,
          limite
        };
      } catch (error) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    },
  });
  
  // Manejar solicitud con el servidor MCP
  return await server.handleRequest(req);
});
```

### Despliegue de Funciones Edge

Para desplegar la función Edge:

```bash
supabase functions deploy mcp-database-server --no-verify-jwt
```

## Optimización de Rendimiento con Supabase

### Uso de Vistas Materializadas

Para consultas frecuentes y complejas, recomendamos utilizar vistas materializadas:

```sql
-- Vista materializada para estadísticas de uso de herramientas
CREATE MATERIALIZED VIEW mcp_tool_usage_stats AS
SELECT
  server_id,
  tool_name,
  COUNT(*) as total_executions,
  COUNT(CASE WHEN error IS NULL THEN 1 END) as successful_executions,
  COUNT(CASE WHEN error IS NOT NULL THEN 1 END) as failed_executions,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_execution_time,
  MAX(EXTRACT(EPOCH FROM (completed_at - created_at))) as max_execution_time,
  MIN(EXTRACT(EPOCH FROM (completed_at - created_at))) as min_execution_time
FROM
  mcp_tool_executions
WHERE
  completed_at IS NOT NULL
GROUP BY
  server_id, tool_name;

-- Función para actualizar la vista materializada
CREATE OR REPLACE FUNCTION refresh_mcp_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mcp_tool_usage_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar estadísticas periódicamente
CREATE TRIGGER refresh_mcp_stats_trigger
AFTER INSERT OR UPDATE ON mcp_tool_executions
REFERENCING NEW TABLE AS new_table
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_mcp_stats();
```

### Uso de Funciones PostgreSQL

Implementar lógica compleja en funciones PostgreSQL para mejorar el rendimiento:

```sql
-- Función para verificar permisos de herramientas MCP
CREATE OR REPLACE FUNCTION check_mcp_tool_permission(
  p_assistant_id TEXT,
  p_server_id UUID,
  p_tool_name TEXT,
  p_employee_token TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tool_id UUID;
  v_permission BOOLEAN;
BEGIN
  -- Obtener ID de la herramienta
  SELECT id INTO v_tool_id
  FROM mcp_tools
  WHERE server_id = p_server_id AND name = p_tool_name;
  
  IF v_tool_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar si el asistente tiene permiso para la herramienta
  SELECT enabled INTO v_permission
  FROM mcp_assistant_tools
  WHERE assistant_id = p_assistant_id AND tool_id = v_tool_id;
  
  IF v_permission IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar consentimiento del usuario
  IF EXISTS (
    SELECT 1
    FROM mcp_user_consents
    WHERE 
      server_id = p_server_id AND 
      tool_name = p_tool_name AND 
      assistant_id = p_assistant_id AND 
      employee_token = p_employee_token AND
      active = TRUE AND
      (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RETURN v_permission;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

### Implementación de Caché con Supabase

Utilizar Supabase para implementar un sistema de caché para herramientas MCP:

```javascript
// Clase para gestionar caché de herramientas MCP con Supabase
class MCPToolsCache {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.defaultTTL = 300; // 5 minutos en segundos
  }
  
  // Obtener herramientas de caché o fuente original
  async getTools(serverId, fetchFunction) {
    // Intentar obtener de caché
    const { data, error } = await this.supabase
      .from('mcp_tools_cache')
      .select('tools_data, expires_at')
      .eq('server_id', serverId)
      .single();
    
    const now = new Date();
    
    // Si hay datos en caché y no han expirado, devolverlos
    if (!error && data && new Date(data.expires_at) > now) {
      return data.tools_data;
    }
    
    // Si no hay datos en caché o han expirado, obtener datos frescos
    const tools = await fetchFunction();
    
    // Calcular tiempo de expiración
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + this.defaultTTL);
    
    // Guardar en caché
    await this.supabase
      .from('mcp_tools_cache')
      .upsert({
        server_id: serverId,
        tools_data: tools,
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'server_id'
      });
    
    return tools;
  }
  
  // Invalidar caché para un servidor
  async invalidateCache(serverId) {
    const { error } = await this.supabase
      .from('mcp_tools_cache')
      .delete()
      .eq('server_id', serverId);
    
    return !error;
  }
  
  // Actualizar TTL para la caché de un servidor
  async updateCacheTTL(serverId, ttlSeconds) {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);
    
    const { error } = await this.supabase
      .from('mcp_tools_cache')
      .update({
        expires_at: expiresAt.toISOString()
      })
      .eq('server_id', serverId);
    
    return !error;
  }
}
```

## Monitoreo y Análisis con Supabase

### Implementación de Dashboard de Monitoreo

Utilizar Supabase para almacenar métricas de rendimiento y crear un dashboard de monitoreo:

```sql
-- Tabla para métricas de rendimiento
CREATE TABLE mcp_performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID REFERENCES mcp_servers(id),
  metric_name TEXT NOT NULL,
  metric_value FLOAT NOT NULL,
  tags JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas eficientes
CREATE INDEX idx_mcp_metrics_server_timestamp ON mcp_performance_metrics(server_id, timestamp);
CREATE INDEX idx_mcp_metrics_name_timestamp ON mcp_performance_metrics(metric_name, timestamp);
```

```javascript
// Clase para registrar métricas de rendimiento
class MCPMetricsCollector {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.batchSize = 20;
    this.metricsBuffer = [];
    this.flushInterval = 10000; // 10 segundos
    
    // Iniciar flush periódico
    setInterval(() => this.flushMetrics(), this.flushInterval);
  }
  
  // Registrar una métrica
  recordMetric(serverId, metricName, metricValue, tags = {}) {
    this.metricsBuffer.push({
      server_id: serverId,
      metric_name: metricName,
      metric_value: metricValue,
      tags,
      timestamp: new Date().toISOString()
    });
    
    // Flush automático si se alcanza el tamaño del lote
    if (this.metricsBuffer.length >= this.batchSize) {
      this.flushMetrics();
    }
  }
  
  // Enviar métricas acumuladas a Supabase
  async flushMetrics() {
    if (this.metricsBuffer.length === 0) return;
    
    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];
    
    try {
      const { error } = await this.supabase
        .from('mcp_performance_metrics')
        .insert(metrics);
      
      if (error) {
        console.error('Error al guardar métricas:', error);
        // Reintentar en el próximo ciclo
        this.metricsBuffer = [...metrics, ...this.metricsBuffer];
      }
    } catch (e) {
      console.error('Error al enviar métricas:', e);
      // Reintentar en el próximo ciclo
      this.metricsBuffer = [...metrics, ...this.metricsBuffer];
    }
  }
}
```

### Análisis de Uso con SQL

Consultas SQL para analizar el uso de herramientas MCP:

```sql
-- Herramientas más utilizadas en los últimos 7 días
SELECT 
  t.name AS tool_name, 
  s.name AS server_name,
  COUNT(*) AS execution_count,
  AVG(e.execution_time) AS avg_execution_time,
  COUNT(CASE WHEN e.error IS NULL THEN 1 END) * 100.0 / COUNT(*) AS success_rate
FROM 
  mcp_tool_executions e
  JOIN mcp_tools t ON e.tool_name = t.name AND e.server_id = t.server_id
  JOIN mcp_servers s ON e.server_id = s.id
WHERE 
  e.created_at > NOW() - INTERVAL '7 days'
GROUP BY 
  t.name, s.name
ORDER BY 
  execution_count DESC
LIMIT 10;

-- Asistentes que más utilizan herramientas MCP
SELECT 
  e.assistant_id,
  COUNT(*) AS tool_usage_count,
  COUNT(DISTINCT e.tool_name) AS unique_tools_used,
  AVG(e.execution_time) AS avg_execution_time
FROM 
  mcp_tool_executions e
WHERE 
  e.created_at > NOW() - INTERVAL '30 days'
GROUP BY 
  e.assistant_id
ORDER BY 
  tool_usage_count DESC
LIMIT 20;

-- Tendencia de uso diario de herramientas MCP
SELECT 
  DATE_TRUNC('day', e.created_at) AS day,
  COUNT(*) AS execution_count
FROM 
  mcp_tool_executions e
WHERE 
  e.created_at > NOW() - INTERVAL '30 days'
GROUP BY 
  day
ORDER BY 
  day;
```

## Escalabilidad con Supabase

### Particionamiento de Tablas

Para sistemas con alto volumen de datos, recomendamos particionar las tablas de ejecución:

```sql
-- Crear tabla particionada por rango de tiempo
CREATE TABLE mcp_tool_executions (
  id UUID NOT NULL,
  server_id UUID REFERENCES mcp_servers(id),
  tool_name TEXT NOT NULL,
  assistant_id TEXT NOT NULL,
  employee_token TEXT,
  thread_id TEXT,
  arguments JSONB,
  result JSONB,
  error TEXT,
  execution_time FLOAT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
) PARTITION BY RANGE (created_at);

-- Crear particiones mensuales
CREATE TABLE mcp_tool_executions_y2025m01 PARTITION OF mcp_tool_executions
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
  
CREATE TABLE mcp_tool_executions_y2025m02 PARTITION OF mcp_tool_executions
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
  
-- Función para crear particiones automáticamente
CREATE OR REPLACE FUNCTION create_mcp_executions_partition()
RETURNS TRIGGER AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  partition_date := DATE_TRUNC('month', NEW.created_at);
  partition_name := 'mcp_tool_executions_y' || 
                   TO_CHAR(partition_date, 'YYYY') || 
                   'm' || 
                   TO_CHAR(partition_date, 'MM');
  start_date := TO_CHAR(partition_date, 'YYYY-MM-DD');
  end_date := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-DD');
  
  -- Verificar si la partición ya existe
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = partition_name AND n.nspname = 'public'
  ) THEN
    -- Crear nueva partición
    EXECUTE 'CREATE TABLE ' || partition_name || 
            ' PARTITION OF mcp_tool_executions' ||
            ' FOR VALUES FROM (''' || start_date || ''')' || 
            ' TO (''' || end_date || ''')';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para crear particiones automáticamente
CREATE TRIGGER create_mcp_executions_partition_trigger
BEFORE INSERT ON mcp_tool_executions
FOR EACH ROW
EXECUTE FUNCTION create_mcp_executions_partition();
```

### Políticas de Retención de Datos

Implementar políticas de retención para gestionar el crecimiento de datos:

```sql
-- Función para eliminar datos antiguos
CREATE OR REPLACE FUNCTION cleanup_old_mcp_executions()
RETURNS void AS $$
DECLARE
  retention_period INTERVAL := INTERVAL '90 days';
  cutoff_date TIMESTAMP WITH TIME ZONE := NOW() - retention_period;
  partition_date DATE;
  partition_name TEXT;
BEGIN
  -- Eliminar particiones completas que sean más antiguas que el período de retención
  FOR partition_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname LIKE 'mcp_tool_executions_y%' 
      AND n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    -- Extraer fecha de la partición
    BEGIN
      partition_date := TO_DATE(
        SUBSTRING(partition_name FROM 'y([0-9]{4})m([0-9]{2})'), 
        'YYYYMM'
      );
      
      -- Si la partición es más antigua que el período de retención, eliminarla
      IF partition_date < DATE_TRUNC('month', cutoff_date) THEN
        EXECUTE 'DROP TABLE ' || partition_name;
        RAISE NOTICE 'Dropped partition: %', partition_name;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error processing partition %: %', partition_name, SQLERRM;
    END;
  END LOOP;
  
  -- Para particiones actuales, eliminar registros individuales antiguos
  EXECUTE 'DELETE FROM mcp_tool_executions WHERE created_at < $1' USING cutoff_date;
END;
$$ LANGUAGE plpgsql;

-- Programar ejecución periódica (requiere extensión pg_cron)
SELECT cron.schedule('0 2 * * 0', 'SELECT cleanup_old_mcp_executions()');
```

## Seguridad Avanzada con Supabase

### Cifrado de Datos Sensibles

Utilizar el cifrado de PostgreSQL para proteger datos sensibles:

```sql
-- Extensión para cifrado
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Función para cifrar datos
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    pgp_sym_encrypt(
      data,
      key,
      'cipher-algo=aes256'
    ),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para descifrar datos
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(encrypted_data, 'base64'),
    key
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejemplo de uso en tabla
CREATE TABLE mcp_sensitive_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID REFERENCES mcp_servers(id),
  config_name TEXT NOT NULL,
  config_value_encrypted TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(server_id, config_name)
);

-- Trigger para cifrar automáticamente
CREATE OR REPLACE FUNCTION encrypt_config_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- La clave de cifrado debe almacenarse de forma segura y rotarse periódicamente
  NEW.config_value_encrypted := encrypt_sensitive_data(NEW.config_value, current_setting('app.encryption_key'));
  NEW.config_value := NULL; -- No almacenar el valor sin cifrar
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encrypt_config_trigger
BEFORE INSERT OR UPDATE ON mcp_sensitive_configs
FOR EACH ROW
EXECUTE FUNCTION encrypt_config_trigger();
```

### Auditoría Avanzada

Implementar un sistema de auditoría completo:

```sql
-- Tabla de auditoría
CREATE TABLE mcp_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  user_id TEXT,
  assistant_id TEXT,
  server_id UUID,
  tool_name TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Función para registrar eventos de auditoría
CREATE OR REPLACE FUNCTION log_mcp_audit_event(
  p_event_type TEXT,
  p_user_id TEXT,
  p_assistant_id TEXT,
  p_server_id UUID,
  p_tool_name TEXT,
  p_details JSONB,
  p_ip_address TEXT,
  p_user_agent TEXT
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO mcp_audit_log (
    event_type, user_id, assistant_id, server_id, tool_name, details, ip_address, user_agent
  ) VALUES (
    p_event_type, p_user_id, p_assistant_id, p_server_id, p_tool_name, p_details, p_ip_address, p_user_agent
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
```

```javascript
// Middleware para auditoría de acciones MCP
const auditMCPAction = async (req, res, next) => {
  const originalSend = res.send;
  
  // Capturar información de la solicitud
  const requestInfo = {
    user_id: req.user?.id,
    assistant_id: req.body?.assistantId,
    server_id: req.body?.serverId,
    tool_name: req.body?.toolName,
    ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    user_agent: req.headers['user-agent']
  };
  
  // Sobrescribir método send para capturar respuesta
  res.send = function(data) {
    // Restaurar método original
    res.send = originalSend;
    
    // Registrar evento de auditoría
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      let responseData;
      try {
        responseData = JSON.parse(data);
      } catch (e) {
        responseData = { raw: data };
      }
      
      supabase.rpc('log_mcp_audit_event', {
        p_event_type: 'mcp_tool_execution',
        p_user_id: requestInfo.user_id,
        p_assistant_id: requestInfo.assistant_id,
        p_server_id: requestInfo.server_id,
        p_tool_name: requestInfo.tool_name,
        p_details: {
          request: req.body,
          response: responseData,
          status_code: res.statusCode
        },
        p_ip_address: requestInfo.ip_address,
        p_user_agent: requestInfo.user_agent
      });
    } catch (error) {
      console.error('Error al registrar evento de auditoría:', error);
    }
    
    // Llamar al método original
    return originalSend.call(this, data);
  };
  
  next();
};
```

## Conclusiones y Recomendaciones Finales

1. **Aprovechar PostgreSQL**: Supabase se basa en PostgreSQL, lo que permite utilizar características avanzadas como particionamiento, vistas materializadas y funciones para optimizar el rendimiento.

2. **Utilizar RLS para Seguridad**: Implementar Row Level Security para proteger los datos a nivel de fila, asegurando que los usuarios solo puedan acceder a los recursos que les corresponden.

3. **Implementar Caché Estratégicamente**: Utilizar tablas de caché en Supabase para almacenar resultados de operaciones costosas o frecuentes, como las listas de herramientas MCP.

4. **Monitoreo Continuo**: Implementar un sistema de monitoreo basado en Supabase para recopilar métricas de rendimiento y uso, permitiendo identificar cuellos de botella y optimizar el sistema.

5. **Escalabilidad Horizontal**: Diseñar la arquitectura para permitir la escalabilidad horizontal, utilizando técnicas como particionamiento de tablas y distribución de carga.

6. **Seguridad en Profundidad**: Implementar múltiples capas de seguridad, incluyendo autenticación, autorización, cifrado y auditoría.

7. **Automatización**: Utilizar funciones y triggers de PostgreSQL para automatizar tareas como la creación de particiones, limpieza de datos antiguos y actualización de estadísticas.

8. **Integración con Tiempo Real**: Aprovechar las capacidades de tiempo real de Supabase para implementar notificaciones y actualizaciones en vivo.

Siguiendo estas recomendaciones, la plataforma web de gestión de asistentes virtuales podrá aprovechar al máximo las capacidades de Supabase como backend para la implementación de MCP, logrando un sistema escalable, seguro y de alto rendimiento.
