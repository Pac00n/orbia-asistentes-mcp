# Hallazgos sobre la integración de servidores MCP

## Arquitectura

Según la documentación revisada, la arquitectura para integrar MCP en el proyecto asistentes-ia-v02 se basa en un diseño modular con los siguientes componentes clave:

1. **Adaptador MCP**: Componente central que traduce entre las llamadas a funciones de OpenAI y el protocolo MCP.
2. **Registro de Servidores**: Mantiene un registro de los servidores MCP disponibles y sus capacidades.
3. **Caché de Herramientas**: Almacena en caché las listas de herramientas de los servidores MCP.

## Convenciones de integración OpenAI-MCP

La integración requiere:

1. **Traducción de herramientas MCP a funciones OpenAI**:
   - Cada herramienta MCP se traduce a una función OpenAI con formato específico
   - Se usa prefijo con ID del servidor para evitar colisiones: `${serverId}_${mcpTool.name}`

2. **Ejecución de herramientas**:
   - Verificación de consentimiento del usuario
   - Registro de ejecuciones para auditoría
   - Manejo de errores y timeouts

3. **Ciclo de vida de conexiones**:
   - Conexiones persistentes con reconexión automática
   - Actualización periódica de la caché de herramientas

## Esquema de base de datos

Se requieren las siguientes tablas en Supabase:
- `mcp_servers`: Registro de servidores MCP disponibles
- `mcp_tools`: Catálogo de herramientas proporcionadas por los servidores
- `mcp_assistant_tools`: Relación entre asistentes y herramientas habilitadas
- `mcp_tool_executions`: Registro de ejecuciones para auditoría
- `mcp_user_consents`: Registro de consentimientos de usuario

## Servidores MCP disponibles

Los servidores MCP públicos recomendados incluyen:

| Servidor | URL | Requiere token | 
|----------|-----|----------------|
| Zapier MCP | (Por determinar) | Sí |
| Activepieces MCP | (Por determinar) | Sí |
| Brave Search MCP | https://search.bravesoftware.com/mcp | Sí (Brave key) |
| Web-Search MCP | (Por implementar localmente) | No |

## Integración en el código

La integración en el código del bot requiere:

1. Inicializar el Adaptador MCP al inicio de la aplicación
2. Modificar el endpoint de chat para incluir herramientas MCP
3. Implementar la ejecución de herramientas MCP cuando OpenAI las solicite
4. Gestionar el ciclo de vida de las conexiones MCP

## Ejemplo de cliente MCP en Python

```python
from openai.agents import Agent, MCPServerSse

agent = Agent(
    model="gpt-4o-mini",
    mcp_server=MCPServerSse("https://URL-MCP"),
)
```

## Consideraciones de seguridad

- Implementar verificación de consentimiento para cada ejecución
- Registrar todas las ejecuciones para auditoría
- Limitar acceso a herramientas según contexto y permisos
- Validar y sanitizar argumentos antes de ejecutar herramientas
- Asegurar que las variables de entorno con tokens no se expongan en el repositorio
