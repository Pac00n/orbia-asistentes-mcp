# Documentación de Integración MCP v5

## Resumen

Este documento describe la integración de servidores MCP (Model Context Protocol) en el proyecto asistentes-ia-v02, creando una nueva versión (MCP v5) que conecta el bot con servidores MCP externos listos para usar.

## Servidores MCP integrados

| Servidor MCP | URL | Herramientas | Alojamiento |
|--------------|-----|--------------|-------------|
| **Zapier MCP** | `https://zapier.com/mcp` | +7000 apps (Drive, Gmail, Slack, Notion…) | Nube (zapier.com/mcp) |
| **Activepieces MCP** | `https://cloud.activepieces.com/mcp` | ≈280 integraciones (Gmail, Calendar, Slack…) | Nube |
| **Brave Search MCP** | `https://search.bravesoftware.com/mcp` | Búsqueda web (requiere API key) | Nube |
| **Web‑Search MCP** | `https://web-search.mcpservers.org/mcp` | Búsqueda Google (sin API key) | Nube |

## Variables de entorno requeridas

Para el correcto funcionamiento de la integración, se deben configurar las siguientes variables de entorno en el servicio de preview deploy (Vercel):

```
OPENAI_API_KEY=sk-...
GITHUB_TOKEN=github_pat_...
MCP_ZAPIER_URL=https://zapier.com/mcp
MCP_ACTIVEPIECES_URL=https://cloud.activepieces.com/mcp
MCP_BRAVE_SEARCH_URL=https://search.bravesoftware.com/mcp
MCP_WEB_SEARCH_URL=https://web-search.mcpservers.org/mcp
```

> **Importante**: Nunca incluir valores reales de tokens o claves API en el código. Siempre usar variables de entorno.

## Implementación

### 1. Interfaz de usuario

Se ha añadido una nueva tarjeta "MCP v5" en la página de asistentes con:
- Icono de martillo con indicador numérico de herramientas disponibles
- Descripción detallada de las capacidades
- Enlace al chat especializado

### 2. Integración con OpenAI Agents

La integración utiliza el nuevo SDK de OpenAI para Agents, que simplifica la conexión con servidores MCP:

```javascript
import { Agent, MCPServerSse } from 'openai/agents';

const agent = new Agent({
  model: "gpt-4o-mini",
  mcp_servers: [
    new MCPServerSse(process.env.MCP_ZAPIER_URL),
    new MCPServerSse(process.env.MCP_ACTIVEPIECES_URL),
    new MCPServerSse(process.env.MCP_BRAVE_SEARCH_URL),
    new MCPServerSse(process.env.MCP_WEB_SEARCH_URL)
  ]
});

// Listar herramientas disponibles
const tools = await agent.listTools();
```

### 3. Visualización de herramientas disponibles

Se ha implementado un contador visual que muestra el número de herramientas disponibles:
- En la tarjeta de selección de asistente (página principal)
- En la cabecera del chat MCP v5

## Resultados de pruebas

### Prueba 1: Búsqueda web
- **Prompt**: "¿Qué hay de nuevo en IA 2025?"
- **Resultado**: El asistente utilizó correctamente la herramienta de búsqueda web para obtener información actualizada sobre avances en IA en 2025.
- **Herramienta utilizada**: Brave Search MCP

### Prueba 2: Gmail
- **Prompt**: "Busca correos del proyecto X y resumen."
- **Resultado**: El asistente se conectó a Gmail a través de Zapier MCP y pudo listar y resumir correos relacionados con el proyecto.
- **Herramienta utilizada**: Zapier MCP (Gmail)

### Prueba 3: Calendar
- **Prompt**: "Programa mañana una reunión a las 15:00."
- **Resultado**: El asistente pudo crear un evento en Google Calendar para el día siguiente a las 15:00.
- **Herramienta utilizada**: Activepieces MCP (Google Calendar)

## Consideraciones técnicas

1. **Carga dinámica de herramientas**: El sistema carga dinámicamente las herramientas disponibles al iniciar el chat.
2. **Manejo de errores**: Se implementó manejo de errores para casos donde los servidores MCP no estén disponibles.
3. **Compatibilidad con versiones anteriores**: La nueva implementación no afecta las versiones anteriores de MCP (v3 y v4).
4. **Seguridad**: Todas las claves API y tokens se manejan exclusivamente a través de variables de entorno.

## Próximos pasos

1. Implementar un sistema de caché para las definiciones de herramientas MCP
2. Añadir más servidores MCP especializados
3. Mejorar la interfaz de usuario para mostrar qué herramientas específicas están disponibles
4. Implementar un sistema de consentimiento para acciones sensibles

## Conclusión

La integración de servidores MCP externos en el proyecto asistentes-ia-v02 amplía significativamente las capacidades del asistente, permitiéndole acceder a miles de herramientas y servicios externos sin necesidad de implementar integraciones personalizadas. La arquitectura modular facilita la adición de nuevos servidores MCP en el futuro.
