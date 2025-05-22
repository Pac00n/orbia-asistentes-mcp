# Fase 1: Modificación del Endpoint de Chat para Integrar el MCPAdapter

Este documento detalla los cambios realizados en el endpoint de la API de chat (`app/api/chat/route-node.ts`) para integrar el `MCPAdapter` básico. El objetivo es permitir que los asistentes de OpenAI puedan recibir y, de forma simulada en esta fase, "ejecutar" herramientas definidas a través del Model Context Protocol (MCP).

## Archivo Modificado

`app/api/chat/route-node.ts`

## Cambios Implementados

Se han realizado las siguientes modificaciones en la función `POST` del endpoint:

1.  **Importaciones Adicionales:**
    *   Se importó la clase `MCPAdapter` desde `@/lib/mcp_adapter`. Esta clase es nuestro puente entre OpenAI y el ecosistema MCP.
    *   Se importó `createClient` desde `@supabase/supabase-js` para poder interactuar con la base de datos de Supabase dentro de este endpoint.

    ```typescript
    import { NextResponse } from "next/server";
    import OpenAI from "openai";
    import { getAssistantById } from "@/lib/assistants";
    import { MCPAdapter } from "@/lib/mcp_adapter"; // <-- Nuevo
    import { createClient } from '@supabase/supabase-js'; // <-- Nuevo
    ```

2.  **Extracción de `employeeToken`:**
    *   Se añadió `employeeToken` a la desestructuración del cuerpo de la solicitud (`await req.json()`). Esto es necesario para pasarlo al `MCPAdapter` como identificador del usuario en las llamadas a herramientas y para la verificación de consentimiento.

    ```typescript
    const { assistantId, message, threadId, employeeToken } = await req.json(); // <-- employeeToken añadido
    ```

3.  **Inicialización de Supabase Client:**
    *   Se añadió la inicialización del cliente de Supabase utilizando las variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Este cliente es necesario para que el `MCPAdapter` pueda cargar la configuración de servidores/herramientas y registrar las ejecuciones.
    *   Se incluyó una verificación básica de la existencia de las variables de entorno.

    ```typescript
    // Inicializar el cliente de Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // O SUPABASE_ANON_KEY si es apropiado

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase URL o Key no configuradas");
      return NextResponse.json({ error: "Configuración de Supabase incompleta" }, { status: 500 });
    }
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    ```

4.  **Instanciación e Inicialización del `MCPAdapter`:**
    *   Se crea una instancia del `MCPAdapter`, pasándole los clientes de Supabase y OpenAI.
    *   Se llama al método `initialize()` del adaptador para cargar la configuración de servidores MCP desde Supabase y cachear las herramientas.
    *   Se añadió un bloque `try...catch` alrededor de la inicialización para manejar posibles errores al cargar la configuración de MCP, permitiendo que el endpoint continúe (aunque sin herramientas MCP disponibles si falla la inicialización).

    ```typescript
    // Inicializar MCPAdapter
    const mcpAdapter = new MCPAdapter(supabaseClient, openai); // <-- Instanciar
    try {
      await mcpAdapter.initialize(); // <-- Inicializar
      console.log("MCPAdapter inicializado correctamente.");
    } catch (initError) {
      console.error("Error inicializando MCPAdapter:", initError);
      // Podrías decidir si continuar sin herramientas MCP o devolver un error
      // Por ahora, continuaremos y las herramientas MCP podrían estar vacías.
    }
    ```

5.  **Proporcionar Herramientas a OpenAI:**
    *   Antes de crear el `Run` de OpenAI, se llama a `mcpAdapter.getToolsForAssistant(assistantId)` para obtener la lista de herramientas MCP traducidas al formato de función de OpenAI.
    *   Esta lista de herramientas se pasa en el parámetro `tools` de la llamada `openai.beta.threads.runs.create()`. Si no hay herramientas disponibles, se pasa `undefined`.

    ```typescript
    // Obtener herramientas MCP para OpenAI
    const mcpToolsForOpenAI = await mcpAdapter.getToolsForAssistant(assistantId); // <-- Obtener herramientas
    console.log(`Herramientas MCP para OpenAI: ${JSON.stringify(mcpToolsForOpenAI, null, 2)}`);

    // Crear el Run con las herramientas MCP
    const run = await openai.beta.threads.runs.create(currentThreadId, {
      assistant_id: openaiAssistantId,
      tools: mcpToolsForOpenAI.length > 0 ? mcpToolsForOpenAI : undefined, // <-- Pasar herramientas
    });
    ```

6.  **Manejo de `requires_action` (Tool Calling):**
    *   Se modificó la sección del bucle `while` que verifica el estado del Run para manejar el estado `requires_action`. Previamente, solo devolvía un error 501.
    *   Ahora, si el Run requiere acciones y el tipo es `submit_tool_outputs`, se itera sobre las `tool_calls` proporcionadas por OpenAI.
    *   Para cada `toolCall` de tipo `function`:
        *   Se parsean los argumentos (manejo básico de errores de parseo incluido).
        *   Se verifica si el nombre de la función (`toolCall.function.name`) comienza con el prefijo `mcp_`. Este prefijo indica que es una herramienta MCP.
        *   Si es una herramienta MCP, se llama a `await mcpAdapter.executeToolCall(...)`. Se pasan los datos necesarios: el ID de la llamada a herramienta de OpenAI, el nombre de la función (incluyendo el prefijo y el ID del servidor), los argumentos, el ID del asistente, el ID del thread y el `employeeToken` como identificador del usuario.
        *   El resultado devuelto por `mcpAdapter.executeToolCall` (que en esta fase es simulado) se formatea como un `tool_output` y se añade a la lista `toolOutputs`.
        *   Si no es una herramienta MCP, se registra una advertencia y se devuelve un output de error básico.
    *   Una vez procesadas todas las `toolCalls` en este paso, si hay `toolOutputs`, se envían de vuelta a OpenAI utilizando `openai.beta.threads.runs.submitToolOutputs(...)`. Esto permite a OpenAI continuar con la ejecución del Run.
    *   Se incluyó manejo de errores básico al enviar los `tool_outputs`.
    *   Si `required_action` no es de tipo `submit_tool_outputs`, se loggea y se devuelve un error 501.

    ```typescript
      // ... dentro del bucle while ...
      // Manejar 'requires_action' para tool calls
      if (currentRun.status === "requires_action") { // <-- Modificado
        console.log("Run requiere acción. Procesando tool calls...");
        const requiredAction = currentRun.required_action;
        if (requiredAction && requiredAction.type === 'submit_tool_outputs') {
          const toolCalls = requiredAction.submit_tool_outputs.tool_calls;
          const toolOutputs = [];

          for (const toolCall of toolCalls) {
            if (toolCall.type === 'function') {
              const functionName = toolCall.function.name;
              let functionArgs = {};
              try {
                functionArgs = JSON.parse(toolCall.function.arguments);
              } catch (parseError) {
                console.error(`Error parseando argumentos para ${functionName}:`, parseError);
                // Considerar cómo manejar este error. ¿Enviar un error como output?
              }
              
              if (functionName.startsWith('mcp_')) { // <-- Verificar prefijo MCP
                console.log(`Ejecutando herramienta MCP: ${functionName} con args:`, functionArgs);
                const output = await mcpAdapter.executeToolCall(
                  toolCall.id,
                  functionName,
                  functionArgs,
                  assistantId, 
                  currentThreadId,
                  employeeToken // Pasar el employeeToken
                ); // <-- Llamada al adaptador
                toolOutputs.push({
                  tool_call_id: toolCall.id,
                  output: JSON.stringify(output), // <-- El resultado debe ser string
                });
              } else {
                // Manejar otras funciones no-MCP si las tienes
                console.warn(`Llamada a función desconocida: ${functionName}. No es una herramienta MCP.`);
                toolOutputs.push({
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({ error: `Función ${functionName} no implementada.` }),
                });
              }
            }
          }

          if (toolOutputs.length > 0) {
            console.log("Enviando tool outputs:", toolOutputs);
            try {
              currentRun = await openai.beta.threads.runs.submitToolOutputs(
                currentThreadId,
                run.id,
                { tool_outputs: toolOutputs }
              );
              console.log(`Tool outputs enviados. Nuevo estado del run: ${currentRun.status}`);
            } catch (submitError) {
              console.error("Error enviando tool outputs:", submitError);
              // Decidir cómo manejar este error. ¿Romper el bucle? ¿Intentar de nuevo?
              // Por ahora, el bucle continuará y probablemente el run expirará o fallará.
              return NextResponse.json(
                { error: "Error enviando resultados de herramientas a OpenAI", details: submitError.message },
                { status: 500 }
              );
            }
          }
        } else {
          // Si required_action no es submit_tool_outputs, manejarlo o loggearlo.
           console.error("Run requiere una acción desconocida o no manejada:", requiredAction);
           return NextResponse.json(
             { error: "El asistente requiere una acción desconocida." },
             { status: 501 }
           );
        }
      }
    } // Fin del while loop

    // ... resto del código para procesar la respuesta final ...
    ```

7.  **Mensaje de Error Final Actualizado:**
    *   Se ajustó el mensaje de error devuelto si el Run no llega a estado `completed`, para incluir información sobre la última `required_action` si existió, ayudando en la depuración.

    ```typescript
    if (currentRun.status !== "completed") {
      console.error(`Run no completado. Estado final: ${currentRun.status}. Required Action: ${JSON.stringify(currentRun.required_action)}`); // <-- Info de Required Action añadida
      // No devolver el error 501 si ya hemos intentado manejar requires_action
      return NextResponse.json(
        {
          error: `Error en la ejecución del asistente: ${currentRun.status}`,
          details: `Última acción requerida: ${JSON.stringify(currentRun.required_action)}` // <-- Info de Required Action añadida
        },
        { status: 500 },
      );
    }
    ```

## Propósito de los Cambios

Estas modificaciones establecen la tubería inicial para la integración de MCP:

*   El endpoint ahora puede **descubrir** herramientas MCP cargando su configuración desde Supabase a través del `MCPAdapter`.
*   Puede **anunciar** estas herramientas a OpenAI pasándolas en la llamada al Run.
*   Puede **interceptar** las llamadas a funciones de OpenAI que correspondan a herramientas MCP.
*   Puede **procesar** estas llamadas utilizando el `MCPAdapter` (simulando la ejecución por ahora).
*   Puede **registrar** la ejecución de la herramienta en Supabase.
*   Puede **enviar** el resultado (simulado) de vuelta a OpenAI para que el asistente continúe la conversación.

Aunque la ejecución de la herramienta aún es simulada, esta fase valida la comunicación y el flujo de datos entre OpenAI, nuestro backend, el `MCPAdapter` y Supabase.

## Próximos Pasos

Los próximos pasos lógicos para continuar la integración de MCP incluyen:

1.  **Implementar la lógica real de conexión y ejecución en el `MCPAdapter`**: Modificar `connectToServer` y `executeToolCall` para interactuar con servidores MCP reales (stdio o SSE) en lugar de simular.
2.  **Desarrollar un servidor MCP de ejemplo**: Crear un servidor MCP (por ejemplo, usando el SDK de Python o TypeScript) que implemente la herramienta `get_weather_forecast` realmente.
3.  **Configurar la tabla `mcp_servers` para usar el nuevo servidor real**: Actualizar el tipo y la configuración del servidor en Supabase para que el `MCPAdapter` se conecte a él.
4.  **Refinar la gestión de consentimiento y errores**: Implementar completamente la verificación de consentimiento consultando `mcp_user_consents` y mejorar el manejo de errores y reintentos en la comunicación con los servidores MCP.

Esta fase inicial sienta las bases para una integración más completa de MCP en el proyecto.
