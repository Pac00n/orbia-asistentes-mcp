# API y Endpoint de Herramientas MCP

## Problema Identificado

El componente de interfaz de usuario que muestra el número de herramientas disponibles (icono de martillo) estaba utilizando una lista estática de herramientas simuladas, lo que resultaba en discrepancias entre las herramientas realmente disponibles (12) y las mostradas en la UI (6).

## Solución Implementada

Se desarrolló un nuevo endpoint dedicado a proporcionar la lista completa de herramientas disponibles, que puede ser consultado por el frontend para mostrar información precisa.

### Nuevo Endpoint API

Se creó el archivo `app/api/chat/mcpv4/tools/route.ts` que implementa un endpoint GET para obtener todas las herramientas disponibles:

```typescript
import { McpClient } from '@/lib/mcp/client';
import { NextResponse } from 'next/server';

// Este endpoint devuelve todas las herramientas disponibles en los servidores MCP configurados
export async function GET() {
  try {
    // Instanciar e inicializar McpClient (igual que en la ruta del chat)
    const mcpClient = new McpClient();
    console.log('API /tools: Inicializando cliente MCP...');
    await mcpClient.initialize(); // Esto descubre todas las herramientas disponibles
    
    // Obtener las definiciones de herramientas en formato OpenAI
    const toolDefinitions = mcpClient.getOpenAIToolDefinitions();
    
    console.log(`API /tools: Retornando ${toolDefinitions.length} herramientas disponibles`);
    
    // ... lógica adicional de respaldo y manejo de errores
    
    return NextResponse.json(toolDefinitions);
  } catch (error) {
    // ... manejo de errores con herramientas de emergencia
  }
}
```

### Características Clave

1. **Inicialización de McpClient**: El endpoint inicializa una instancia de McpClient para descubrir todas las herramientas disponibles en los servidores configurados.

2. **Respaldo de Fallback**: Si no se encuentran herramientas reales o si ocurre un error, el endpoint proporciona herramientas simuladas de respaldo para garantizar que la UI siempre tenga algo que mostrar.

3. **Formato OpenAI**: Las herramientas se devuelven en el formato de definición de funciones de OpenAI, facilitando su integración con el modelo de chat.

## Beneficios del Nuevo Endpoint

1. **Precisión en la UI**: Ahora la interfaz muestra con exactitud el número real de herramientas disponibles.

2. **Centralización**: La lógica para obtener herramientas está centralizada en un solo lugar, evitando duplicación de código.

3. **Flexibilidad**: El endpoint puede evolucionar independientemente del frontend, facilitando mejoras futuras.

4. **Coherencia**: Garantiza que la UI y el backend usen exactamente la misma información sobre herramientas disponibles.

## Consideraciones Técnicas

- El endpoint utiliza la misma inicialización de `McpClient` que la ruta del chat, asegurando consistencia.
- Se incluyen logs detallados para facilitar la depuración.
- El sistema de fallback asegura que la UI siempre tenga herramientas para mostrar, incluso en situaciones de error.
