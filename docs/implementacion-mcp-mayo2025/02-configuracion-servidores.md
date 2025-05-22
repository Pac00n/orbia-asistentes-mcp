# Configuración de Servidores MCP

## Problema Inicial

Al intentar conectarse a servidores MCP externos como `fs-demo.mcpservers.org` y `demo.mcp.tools`, se encontraron errores de DNS que impedían la resolución de estos nombres de dominio a direcciones IP.

```
Error: getaddrinfo ENOTFOUND fs-demo.mcpservers.org
```

Esta situación impedía que el cliente MCP pudiera obtener herramientas de servidores externos reales.

## Solución Implementada

Se modificó la configuración en `.env.local` para utilizar IDs de servidor que tienen simulación predefinida en el código de `lib/mcp/client.ts`:

```javascript
MCP_SERVERS_CONFIG='[
  {
    "id": "srv1",
    "url": "http://simulated.server",
    "name": "Servidor Simulado 1 (Calculadora y Clima)"
  },
  {
    "id": "toolCo",
    "url": "http://simulated.toolserver",
    "name": "Tool Company Simulada (Búsqueda e Imágenes)"
  },
  {
    "id": "brave-search",
    "url": "https://brave-search.mcpservers.org/mcp",
    "name": "Brave Search Simulado"
  },
  {
    "id": "exa-local",
    "url": "https://exa-search.mcpservers.org/mcp",
    "name": "Exa Search Simulado"
  }
]'
```

Además, se estableció `MCP_FORCE_REAL=false` para habilitar el modo de simulación.

## Características Clave

1. **IDs con Simulación Predefinida**: Se utilizaron IDs específicos ("srv1", "toolCo", "brave-search", "exa-local") que tienen simulación implementada en el código.

2. **Fallback Automático**: Cuando el sistema no puede conectarse a las URLs configuradas (lo cual es esperado en este caso), automáticamente utiliza la simulación predefinida para esos IDs.

3. **Variedad de Herramientas**: La configuración proporciona acceso a 12 herramientas simuladas diferentes que cubren calculadoras, clima, búsqueda, generación de imágenes, y más.

## Solución Alternativa Considerada

Una alternativa habría sido configurar direcciones IP directas en lugar de nombres de dominio, pero esto requeriría conocer las IPs exactas de los servidores MCP, lo cual no es práctico ni sostenible a largo plazo.

## Recomendaciones para el Futuro

Para una conexión real a servidores MCP externos, se recomienda:

1. Resolver los problemas de DNS en el entorno local (actualizar DNS, vaciar caché, etc.)
2. Una vez resueltos los problemas de DNS, cambiar `MCP_FORCE_REAL=true` para utilizar conexiones reales
3. Verificar la disponibilidad de los servidores externos antes de configurarlos
