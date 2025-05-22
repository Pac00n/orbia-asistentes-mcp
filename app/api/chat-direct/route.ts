import { NextResponse } from "next/server"
import { getAssistantById } from "@/lib/assistants"

// Usar el runtime de Node.js
export const runtime = "nodejs"

// Permitir respuestas de hasta 60 segundos
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { assistantId, message, threadId } = await req.json()

    // Validar datos
    if (!assistantId || !message) {
      return NextResponse.json({ error: "Se requieren assistantId y message" }, { status: 400 })
    }

    // Obtener la configuración del asistente
    const assistant = getAssistantById(assistantId)
    if (!assistant) {
      return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })
    }

    // Verificar API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API key de OpenAI no configurada" }, { status: 500 })
    }

    const openaiAssistantId = assistant.openaiAssistantId
    const baseUrl = "https://api.openai.com/v1"
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2", // Especificar versión 2 de la API
    }

    // 1. Gestionar el Thread (Hilo)
    let currentThreadId = threadId

    if (!currentThreadId) {
      // Crear un nuevo hilo
      const threadRes = await fetch(`${baseUrl}/threads`, { method: "POST", headers })
      if (!threadRes.ok) {
        const err = await threadRes.json().catch(() => null)
        throw new Error(`Error creando thread: ${err?.error?.message || threadRes.statusText}`)
      }
      const threadData = await threadRes.json()
      currentThreadId = threadData.id
      console.log(`Nuevo thread creado: ${currentThreadId}`)
    } else {
      console.log(`Usando thread existente: ${currentThreadId}`)
    }

    // 2. Añadir el mensaje del usuario al hilo
    const msgBody = { role: "user", content: message }
    const msgRes = await fetch(`${baseUrl}/threads/${currentThreadId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(msgBody),
    })
    if (!msgRes.ok) {
      const err = await msgRes.json().catch(() => null)
      throw new Error(`Error enviando mensaje: ${err?.error?.message || msgRes.statusText}`)
    }
    console.log(`Mensaje añadido al thread: ${message}`)

    // 3. Crear y ejecutar un Run
    console.log(`Creando Run con Assistant ID: ${openaiAssistantId}`)
    const runRes = await fetch(`${baseUrl}/threads/${currentThreadId}/runs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ assistant_id: openaiAssistantId }),
    })
    if (!runRes.ok) {
      const err = await runRes.json().catch(() => null)
      throw new Error(`Error ejecutando asistente: ${err?.error?.message || runRes.statusText}`)
    }
    const runData = await runRes.json()
    const runId = runData.id
    console.log(`Run creado: ${runId}`)

    // 4. Polling estado
    let status = runData.status
    let attempts = 0
    const maxAttempts = 30 // Máximo 30 intentos (30 segundos con 1 segundo de espera)

    while (["queued", "in_progress", "cancelling"].includes(status) && attempts < maxAttempts) {
      // Esperar 1 segundo entre cada consulta
      await new Promise((resolve) => setTimeout(resolve, 1000))
      attempts++

      // Obtener el estado actual del run
      const statusRes = await fetch(`${baseUrl}/threads/${currentThreadId}/runs/${runId}`, { headers })
      if (!statusRes.ok) {
        const err = await statusRes.json().catch(() => null)
        throw new Error(`Error obteniendo estado del run: ${err?.error?.message || statusRes.statusText}`)
      }
      const statusData = await statusRes.json()
      status = statusData.status
      console.log(`Estado del run (intento ${attempts}): ${status}`)
    }

    // 5. Comprobar el estado final
    if (status !== "completed") {
      console.error(`Run no completado. Estado final: ${status}`)

      if (status === "requires_action") {
        return NextResponse.json(
          {
            error: "El asistente requiere acciones adicionales que no están implementadas en esta versión",
          },
          { status: 501 },
        )
      }

      return NextResponse.json(
        {
          error: `Error en la ejecución del asistente: ${status}`,
        },
        { status: 500 },
      )
    }

    // 6. Recuperar la respuesta del asistente
    const messagesRes = await fetch(`${baseUrl}/threads/${currentThreadId}/messages?order=asc`, { headers })
    if (!messagesRes.ok) {
      const err = await messagesRes.json().catch(() => null)
      throw new Error(`Error obteniendo mensajes: ${err?.error?.message || messagesRes.statusText}`)
    }
    const messagesData = await messagesRes.json()

    // Verificar que hay mensajes
    if (!messagesData.data || messagesData.data.length === 0) {
      throw new Error("No se encontraron mensajes en el thread")
    }

    // Encontrar la última respuesta del asistente para este run
    // Añadimos verificaciones para evitar errores de undefined
    const assistantResponses = messagesData.data.filter((msg) => {
      return msg && msg.role === "assistant" && msg.run_id === runId
    })

    // Verificar que hay respuestas del asistente
    if (!assistantResponses || assistantResponses.length === 0) {
      throw new Error("No se encontraron respuestas del asistente para este run")
    }

    const lastAssistantMessage = assistantResponses[assistantResponses.length - 1]
    let assistantReply = "No se encontró respuesta del asistente." // Mensaje por defecto

    // Verificar que el mensaje y su contenido existen
    if (lastAssistantMessage && lastAssistantMessage.content && lastAssistantMessage.content.length > 0) {
      // Buscar el primer contenido de tipo texto
      for (const contentPart of lastAssistantMessage.content) {
        if (contentPart && contentPart.type === "text" && contentPart.text && contentPart.text.value) {
          assistantReply = contentPart.text.value
          break
        }
      }
    } else {
      console.warn("El formato del mensaje del asistente no es el esperado:", lastAssistantMessage)
    }

    console.log("Respuesta del Asistente:", assistantReply)

    // Enviar la respuesta al frontend
    return NextResponse.json({
      reply: assistantReply,
      threadId: currentThreadId,
    })
  } catch (error) {
    console.error("Error en la API de chat:", error)
    return NextResponse.json(
      {
        error: "Error interno del servidor al procesar la solicitud de chat.",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
