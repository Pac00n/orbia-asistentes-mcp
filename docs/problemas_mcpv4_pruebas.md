# Problemas Encontrados Durante las Pruebas de MCP v4

Este documento detalla los problemas específicos que surgieron durante el proceso de implementación y prueba de la funcionalidad de MCP v4 con un servidor externo real.

## 1. Problema Inicial: Interfaz de Usuario Apuntando al Endpoint Incorrecto

- **Descripción**: Inicialmente, la interfaz de usuario del chat en la ruta `/chat-v3/mcp-v3` estaba configurada para enviar solicitudes a la API de MCP v3 (`/api/chat/mcp`) en lugar de la nueva API de MCP v4 (`/api/chat/mcpv4`).
- **Impacto**: Esto impedía que se probara correctamente el flujo de MCP v4, ya que las solicitudes no llegaban al backend que utilizaba el `McpClient` para interactuar con servidores externos (o la simulación).
- **Resolución**: Se modificó el archivo `asistentes-ia-v02/app/chat-v3/[assistantId]/page.tsx` para que la función `handleSubmit` dirigiera las solicitudes a `/api/chat/mcpv4` cuando el `assistantId` fuera "mcp-v3".

## 2. Problema de Conexión al Servidor MCP Externo

- **Descripción**: Al configurar el cliente MCP para conectarse a un servidor MCP público real (específicamente, "Demo «everything»" en `https://demo.mcp.tools/everything/mcp`), la aplicación no pudo establecer conexión.
- **Logs de Error**: La terminal del servidor mostró errores como `TypeError: fetch failed` con la causa `[Error: getaddrinfo ENOTFOUND demo.mcp.tools]`.
- **Causa**: El error `getaddrinfo ENOTFOUND` indica que el sistema donde se ejecuta la aplicación no pudo resolver el nombre de dominio `demo.mcp.tools` a una dirección IP. Este es un problema de red o configuración de DNS en el entorno del usuario, externo a la aplicación misma.
- **Impacto**: La imposibilidad de resolver el nombre de dominio impidió que el cliente MCP se conectara al servidor externo real para descubrir y utilizar sus herramientas.
- **Consecuencia en el Chat**: Dado que la conexión al servidor real falló y no había simulación definida en `lib/mcp/client.ts` para el ID "everything-demo" configurado, el cliente MCP informó a OpenAI que no había herramientas disponibles. Esto llevó al chat a responder a las solicitudes de herramientas (como `fetch`) indicando que no tenía la capacidad de realizar esas acciones.
- **Solución/Mitigación**: La solución a este problema requiere que el usuario diagnostique y resuelva el problema de red o DNS en su propio entorno. La aplicación está configurada correctamente para intentar la conexión. Como alternativa, se podría intentar configurar el cliente para usar otro servidor MCP público si se sospecha que el problema es específico de `demo.mcp.tools`.

## 3. Consecuencia de la Falta de Simulación para el ID Configurado

- **Descripción**: Cuando la conexión al servidor externo falló, el cliente MCP intentó usar la lógica de simulación como fallback. Sin embargo, la simulación en `lib/mcp/client.ts` solo proporciona definiciones y resultados simulados para los IDs de servidor "srv1" y "toolCo".
- **Impacto**: Dado que el ID configurado en `.env.local` era "everything-demo", para el cual no hay simulación definida, el cliente MCP no pudo proporcionar ninguna herramienta (real o simulada) a OpenAI.
- **Resolución**: Aunque la aplicación funcionó según lo diseñado (usando el fallback), este problema resalta la importancia de tener una estrategia de fallback adecuada si se espera que ciertos IDs de servidor puedan fallar y se desea que la aplicación aún ofrezca alguna funcionalidad (ya sea una simulación básica o un mensaje de error más amigable). Para pruebas futuras con IDs diferentes, se podría considerar añadir lógica de simulación para esos IDs en `lib/mcp/client.ts` si no se espera que los servidores reales estén siempre disponibles.

Este documento sirve para registrar los obstáculos encontrados y su análisis durante el proceso de puesta en marcha de la conexión a servidores MCP externos en MCP v4.