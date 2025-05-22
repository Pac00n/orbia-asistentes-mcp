# Simulación Local de Servidores MCP

## Descripción del Sistema de Simulación

La aplicación implementa un sistema de simulación para herramientas MCP que permite probar la funcionalidad sin necesidad de conectarse a servidores externos reales. Esta característica es especialmente útil durante el desarrollo y cuando hay problemas de conectividad.

## Implementación Técnica

La simulación se implementa en la clase `McpClient` en el archivo `lib/mcp/client.ts`, específicamente en los métodos `discoverToolsFromServer` y `executeTool`.

### Descubrimiento de Herramientas

Cuando falla la conexión a un servidor MCP configurado, el cliente verifica si el ID del servidor tiene simulación predefinida:

```javascript
// Fallback a simulación si la conexión falla (para desarrollo/pruebas)
if (server.id === "srv1") {
  console.warn(`McpClient: Usando herramientas simuladas para ${server.id} debido a error de conexión.`);
  mcpTools = [
    { toolName: "calculator", description: "Calculadora de srv1", parametersSchema: { /* ... */ } },
    { toolName: "weather", description: "Obtiene el clima de una ciudad en srv1", parametersSchema: { /* ... */ } },
  ];
} else if (server.id === "toolCo") {
  // Simulación para toolCo
} else if (server.id === "brave-search") {
  // Simulación para brave-search
} else if (server.id === "exa-local") {
  // Simulación para exa-local
} else {
  console.warn(`McpClient: No hay herramientas simuladas para ${server.id}. Devolviendo array vacío.`);
  mcpTools = [];
}
```

### Ejecución de Herramientas

De manera similar, cuando falla la ejecución de una herramienta en un servidor remoto, se utiliza simulación:

```javascript
// Fallback a simulación si la conexión falla (para desarrollo/pruebas)
console.warn(`McpClient: Usando simulación como fallback para ${originalToolName} en ${serverId}`);

// Simular latencia de red
await new Promise(resolve => setTimeout(resolve, 50));

let simulatedResult;
if (serverId === "srv1" && originalToolName === "calculator") {
  simulatedResult = { value: `srv1_calculator_result_for_${parsedArguments.expression}` };
} else if (serverId === "srv1" && originalToolName === "weather") {
  simulatedResult = { temperature: `25C for ${parsedArguments.city} from srv1` };
} // ... más casos de simulación
```

## Herramientas Simuladas Disponibles

La implementación actual proporciona simulación para 12 herramientas distintas distribuidas entre 4 servidores:

1. **srv1**:
   - `calculator`: Simulación de cálculos matemáticos
   - `weather`: Simulación de información del clima

2. **toolCo**:
   - `search`: Simulación de búsqueda general
   - `imageGenerator`: Simulación de generación de imágenes

3. **brave-search**:
   - `brave_web_search`: Simulación de búsqueda web
   - `brave_local_search`: Simulación de búsqueda local

4. **exa-local**:
   - `web_search`: Búsqueda web general
   - `research_paper_search`: Búsqueda de papers académicos
   - `twitter_search`: Búsqueda en Twitter
   - `company_research`: Investigación de empresas
   - `crawling`: Extracción de contenido de URLs
   - `competitor_finder`: Búsqueda de competidores

## Control de la Simulación

La simulación se controla mediante la variable de entorno `MCP_FORCE_REAL`:

- `MCP_FORCE_REAL=false`: Permite el uso de simulación cuando falla la conexión (configuración actual)
- `MCP_FORCE_REAL=true`: Requiere conexiones reales a servidores (útil cuando la conectividad está disponible)

## Ventajas de la Simulación

1. **Desarrollo independiente**: Permite a los desarrolladores trabajar sin dependencia de servidores externos
2. **Pruebas controladas**: Proporciona respuestas predecibles para pruebas automatizadas
3. **Demostración offline**: Facilita demostraciones del sistema sin conexión a internet
4. **Fallback de seguridad**: Garantiza la funcionalidad básica incluso cuando hay problemas de red
