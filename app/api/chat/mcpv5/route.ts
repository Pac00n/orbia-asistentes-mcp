import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { McpClient } from '@/lib/mcp/client'; // Import McpClient
import { getAssistantById } from '@/lib/assistants'; // Import getAssistantById

// Configuración de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint para obtener la lista de herramientas
export async function GET() {
  console.log("[API MCPv5 GET] Request received to list tools.");
  try {
    const mcpClient = new McpClient();
    await mcpClient.initialize();
    console.log("[API MCPv5 GET] McpClient initialized.");

    const openAITools = mcpClient.getOpenAIToolDefinitions();
    console.log(`[API MCPv5 GET] Retrieved ${openAITools.length} tools from McpClient.`);

    const frontendTools = openAITools.map(tool => ({
      id: tool.function.name, // Use the OpenAI tool name as ID
      name: tool.function.name,
      description: tool.function.description,
    }));
    
    console.log("[API MCPv5 GET] Tools transformed for frontend.");
    return NextResponse.json({
      success: true,
      toolCount: frontendTools.length,
      tools: frontendTools,
    });

  } catch (error: any) {
    console.error("[API MCPv5 GET] Error fetching tools:", error);
    return NextResponse.json({
      success: false,
      toolCount: 0,
      tools: [],
      error: "Error al obtener herramientas MCP: " + error.message,
    }, { status: 500 }); 
  }
}

// Endpoint para procesar mensajes
export async function POST(request: Request) {
  console.log("[API MCPv5 POST] Request received to process message.");
  try {
    const body = await request.json();
    const { assistantId, message, forced_tool_id } = body;

    if (!assistantId || typeof assistantId !== 'string') {
        console.error("[API MCPv5 POST] Invalid or missing assistantId.");
        return NextResponse.json({ success: false, error: "Se requiere un assistantId válido." }, { status: 400 });
    }
    if (!message || typeof message !== 'string') {
      console.error("[API MCPv5 POST] Invalid or missing message.");
      return NextResponse.json({ success: false, error: "Se requiere un mensaje." }, { status: 400 });
    }
    console.log(`[API MCPv5 POST] Assistant ID: ${assistantId}, Message: "${message.substring(0, 50)}...", Forced Tool ID: ${forced_tool_id}`);

    const assistantConfig = getAssistantById(assistantId);
    if (!assistantConfig) {
      console.error(`[API MCPv5 POST] Assistant configuration not found for ID: ${assistantId}`);
      return NextResponse.json({ success: false, error: "Configuración del asistente no encontrada." }, { status: 404 });
    }
    console.log(`[API MCPv5 POST] Loaded assistant config for: ${assistantConfig.name}`);

    const mcpClient = new McpClient();
    await mcpClient.initialize();
    console.log("[API MCPv5 POST] McpClient initialized.");

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // System Message
    let systemContent = assistantConfig.instructions || assistantConfig.description;
    if (!systemContent && assistantConfig.id === "mcp-test-assistant") {
        // Specific default for mcp-test-assistant if instructions/description are somehow empty
        systemContent = "You are a helpful assistant designed for testing tool usage with MCP. Use tools proactively.";
    } else if (!systemContent) {
        systemContent = "You are a helpful assistant.";
    }
    messages.push({ role: 'system', content: systemContent });
    console.log(`[API MCPv5 POST] System prompt: "${systemContent.substring(0,100)}..."`);
    
    // User Message
    messages.push({ role: 'user', content: message });

    // Tool Choice Logic
    let toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = "auto";
    if (forced_tool_id && typeof forced_tool_id === 'string' && forced_tool_id.trim() !== "") {
      console.log(`[API MCPv5 POST] Forcing tool: ${forced_tool_id}`);
      toolChoice = { type: "function", function: { name: forced_tool_id } };
    }

    console.log("[API MCPv5 POST] Making initial call to OpenAI Chat Completions API.");
    let completion = await openai.chat.completions.create({
      model: assistantConfig.model || "gpt-4o-mini",
      messages: messages,
      stream: false, // Non-streaming as per requirement
      tools: mcpClient.getOpenAIToolDefinitions(),
      tool_choice: toolChoice,
    });
    console.log("[API MCPv5 POST] Initial OpenAI API call completed.");

    let assistantResponse = completion.choices[0].message;
    messages.push(assistantResponse); // Add assistant's first response to messages

    // Handle tool calls if present
    if (assistantResponse.tool_calls) {
      console.log(`[API MCPv5 POST] Assistant requested ${assistantResponse.tool_calls.length} tool call(s).`);
      const toolOutputs: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

      for (const toolCall of assistantResponse.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgsString = toolCall.function.arguments;
        console.log(`[API MCPv5 POST] Executing tool: ${toolName} with args: ${toolArgsString}`);
        
        try {
          const parsedArgs = JSON.parse(toolArgsString);
          const result = await mcpClient.executeTool(toolName, parsedArgs);
          const resultString = typeof result === 'string' ? result : JSON.stringify(result);
          
          console.log(`[API MCPv5 POST] Tool ${toolName} executed. Result preview: ${resultString.substring(0,100)}...`);
          toolOutputs.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: resultString,
          });
        } catch (error: any) {
          console.error(`[API MCPv5 POST] Error executing tool ${toolName}:`, error);
          toolOutputs.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify({ error: `Error executing tool ${toolName}: ${error.message}` }),
          });
        }
      }
      messages.push(...toolOutputs); // Add all tool results to messages

      console.log("[API MCPv5 POST] Making second call to OpenAI Chat Completions API with tool results.");
      completion = await openai.chat.completions.create({
        model: assistantConfig.model || "gpt-4o-mini",
        messages: messages,
        stream: false,
        // tools and tool_choice might not be needed here if we expect a final text response
      });
      console.log("[API MCPv5 POST] Second OpenAI API call completed.");
      assistantResponse = completion.choices[0].message;
      // No need to push this response to messages array if it's the final one for this turn.
    }

    const finalContent = assistantResponse.content || "No text content received from assistant.";
    console.log(`[API MCPv5 POST] Final assistant content: "${finalContent.substring(0,100)}..."`);
    
    // Include raw tool results in the response if any tools were called
    const rawToolResults = messages
        .filter(msg => msg.role === 'tool' && msg.tool_call_id)
        // @ts-ignore
        .map(msg => ({ tool_call_id: msg.tool_call_id, content: msg.content }));

    let responsePayload: any = {
        success: true,
        response: finalContent,
    };

    if (rawToolResults.length > 0) {
        responsePayload.rawToolResults = rawToolResults;
        // Attempt to add a "verification info" section similar to the old logic for frontend display
        const verificationInfo = rawToolResults.map(tr => {
            let toolName = "unknown_tool";
            // Try to find the tool name from the assistant's tool_calls
            const originalToolCall = assistantResponse.tool_calls?.find(tc => tc.id === tr.tool_call_id);
            if (originalToolCall) {
                toolName = originalToolCall.function.name;
            }
            return `[Herramienta usada: ${toolName}]\nRaw Result: ${tr.content}`;
        }).join("\n\n");
        responsePayload.response += `\n\n---\nInformación de verificación:\n${verificationInfo}`;
    }


    return NextResponse.json(responsePayload);

  } catch (error: any) {
    console.error("[API MCPv5 POST] Critical error in POST handler:", error);
    return NextResponse.json({
      success: false,
      response: "Lo siento, no pude procesar tu mensaje debido a un error interno.",
      error: error.message || "Error desconocido al procesar el mensaje",
    }, { status: 500 });
  }
}
