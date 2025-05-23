import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAssistantById } from '@/lib/assistants';
import { getMcpServersConfiguration, McpServerConfig } from '@/lib/mcp/config';

// Configuración de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint para obtener la lista de herramientas (MCP Servers)
export async function GET() {
  console.log("[API MCPv5 GET / OpenAI Responses API] Request received to list tools.");
  try {
    const mcpServers = getMcpServersConfiguration();
    console.log(`[API MCPv5 GET / OpenAI Responses API] Retrieved ${mcpServers.length} MCP server configurations.`);

    const frontendTools = mcpServers.map(server => ({
      id: server.id, // Use server.id as the tool ID for the frontend
      name: server.name || server.id,
      description: `MCP Server: ${server.name || server.id}`, // Generic description
    }));
    
    console.log("[API MCPv5 GET / OpenAI Responses API] MCP Servers transformed for frontend.");
    return NextResponse.json({
      success: true,
      toolCount: frontendTools.length,
      tools: frontendTools,
    });

  } catch (error: any) {
    console.error("[API MCPv5 GET / OpenAI Responses API] Error fetching MCP server configurations:", error);
    return NextResponse.json({
      success: false,
      toolCount: 0,
      tools: [],
      error: "Error al obtener configuraciones de MCP Server: " + error.message,
    }, { status: 500 }); 
  }
}

// Endpoint para procesar mensajes usando openai.responses.create()
export async function POST(request: Request) {
  console.log("[API MCPv5 POST / OpenAI Responses API] Request received to process message.");
  try {
    const body = await request.json();
    const { assistantId, message, forced_tool_id } = body;

    if (!assistantId || typeof assistantId !== 'string') {
        console.error("[API MCPv5 POST / OpenAI Responses API] Invalid or missing assistantId.");
        return NextResponse.json({ success: false, error: "Se requiere un assistantId válido." }, { status: 400 });
    }
    if (!message || typeof message !== 'string') {
      console.error("[API MCPv5 POST / OpenAI Responses API] Invalid or missing message.");
      return NextResponse.json({ success: false, error: "Se requiere un mensaje." }, { status: 400 });
    }
    console.log(`[API MCPv5 POST / OpenAI Responses API] Assistant ID: ${assistantId}, Message: "${message.substring(0, 50)}...", Forced Tool ID: ${forced_tool_id}`);

    const assistantConfig = getAssistantById(assistantId);
    if (!assistantConfig) {
      console.error(`[API MCPv5 POST / OpenAI Responses API] Assistant configuration not found for ID: ${assistantId}`);
      return NextResponse.json({ success: false, error: "Configuración del asistente no encontrada." }, { status: 404 });
    }
    console.log(`[API MCPv5 POST / OpenAI Responses API] Loaded assistant config for: ${assistantConfig.name}`);

    const fullInput = assistantConfig.instructions 
      ? `${assistantConfig.instructions}\n\nUser: ${message}` 
      : message;
    console.log(`[API MCPv5 POST / OpenAI Responses API] Full input prompt: "${fullInput.substring(0,150)}..."`);

    let allMcpConfigs: McpServerConfig[] = getMcpServersConfiguration();
    let mcpConfigsToUse: McpServerConfig[] = [];

    // Process and filter MCP configurations
    for (const server of allMcpConfigs) {
      let processedServer = { ...server }; // Clone server config
      if (server.id === "exa" && server.url.includes('${EXA_API_KEY}')) {
        const exaApiKey = process.env.EXA_API_KEY;
        if (exaApiKey) {
          processedServer.url = server.url.replace('${EXA_API_KEY}', exaApiKey);
          console.log(`[API MCPv5 POST / OpenAI Responses API] Substituted EXA_API_KEY for exa tool. URL: ${processedServer.url}`);
        } else {
          console.warn(`[API MCPv5 POST / OpenAI Responses API] EXA_API_KEY not found for 'exa' tool. Excluding it.`);
          continue; // Skip this server if API key is missing
        }
      }
      mcpConfigsToUse.push(processedServer);
    }

    // Apply forced_tool_id filtering *after* processing URLs
    if (forced_tool_id && typeof forced_tool_id === 'string' && forced_tool_id.trim() !== "") {
      console.log(`[API MCPv5 POST / OpenAI Responses API] Filtering MCP servers to force tool: ${forced_tool_id}`);
      mcpConfigsToUse = mcpConfigsToUse.filter(server => server.id === forced_tool_id);
      if (mcpConfigsToUse.length === 0) {
        console.error(`[API MCPv5 POST / OpenAI Responses API] Forced tool ID ${forced_tool_id} not found or was excluded (e.g., missing API key for 'exa').`);
        return NextResponse.json({ success: false, error: `Herramienta forzada ${forced_tool_id} no disponible.` }, { status: 400 });
      }
    }
    console.log(`[API MCPv5 POST / OpenAI Responses API] Using ${mcpConfigsToUse.length} MCP server(s) for tools.`);

    const mappedMcpTools: OpenAI.Beta.Responses.Tool.MCP[] = mcpConfigsToUse.map(mcpServer => {
      const headers: { [key: string]: string } = {};
      if (mcpServer.auth?.type === 'bearer_token' && mcpServer.auth.token) {
        headers['Authorization'] = `Bearer ${mcpServer.auth.token}`;
      } else if (mcpServer.auth?.type === 'custom_header' && mcpServer.auth.header_name && mcpServer.auth.token) {
        headers[mcpServer.auth.header_name] = mcpServer.auth.token;
      }
      // Note: For Exa, if it uses an API key in the URL, it might not need an X-API-Key header.
      // If it also requires a header, that should be part of its McpServerConfig.auth or a specific check.
      // The current logic assumes EXA_API_KEY is only for URL substitution.
      // If Exa also uses a specific header like 'x-api-key' (different from the generic 'apiKey' field),
      // that would need explicit handling here or in its McpServerConfig.
      if (mcpServer.apiKey && mcpServer.id !== "exa") { // Example: Don't add generic X-API-Key if it's exa and key is in URL
        headers['X-API-Key'] = mcpServer.apiKey;
      }
      
      return {
        type: "mcp",
        server_label: mcpServer.id,
        server_url: mcpServer.url, // This URL is now processed for Exa
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      };
    });

    console.log("[API MCPv5 POST / OpenAI Responses API] Calling openai.responses.create(). Tools being sent:", JSON.stringify(mappedMcpTools, null, 2));
    // @ts-ignore - Assuming openai.responses.create is available, might need type update for openai package
    const openAIResponse = await openai.responses.create({
      model: assistantConfig.model || "gpt-4o-mini",
      input: fullInput,
      tools: mappedMcpTools.length > 0 ? mappedMcpTools : undefined, // Pass undefined if no tools are applicable
    });
    console.log("[API MCPv5 POST / OpenAI Responses API] openai.responses.create() call completed.");

    // @ts-ignore
    const rawOutputText = openAIResponse.output;
    // @ts-ignore
    const toolErrors = openAIResponse.tool_errors || null;

    const finalAssistantText = (typeof rawOutputText === 'string') ? rawOutputText : "No text output received from assistant.";
    
    console.log(`[API MCPv5 POST / OpenAI Responses API] Final assistant output: "${finalAssistantText.substring(0,100)}..."`);
    if (toolErrors) {
      console.warn(`[API MCPv5 POST / OpenAI Responses API] Tool errors reported:`, toolErrors);
    }
    
    return NextResponse.json({ 
      success: true, 
      response: finalAssistantText, // Use the guarded variable
      tool_errors: toolErrors 
    });

  } catch (error: any) {
    console.error("[API MCPv5 POST / OpenAI Responses API] Critical error in POST handler:", error);
    // Check if it's an OpenAI APIError for more specific feedback
    if (error instanceof OpenAI.APIError) {
        console.error(`[API MCPv5 POST / OpenAI Responses API] OpenAI API Error: ${error.status} ${error.name} ${error.message}`);
        return NextResponse.json({
          success: false,
          response: `Error de OpenAI: ${error.message}`,
          error: {
            message: error.message,
            status: error.status,
            name: error.name,
          }
        }, { status: error.status || 500 });
    }
    return NextResponse.json({
      success: false,
      response: "Lo siento, no pude procesar tu mensaje debido a un error interno.",
      error: error.message || "Error desconocido al procesar el mensaje",
    }, { status: 500 });
  }
}
