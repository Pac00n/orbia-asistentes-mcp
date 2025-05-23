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
  console.log("[API MCPv5 POST V2_LOGGING] Processing request.");
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
    let allMcpConfigs: McpServerConfig[] = getMcpServersConfiguration();
    let mcpConfigsToUse: McpServerConfig[] = [];

    for (const server of allMcpConfigs) {
      if (server.id === "exa") {
        const exaApiKey = process.env.EXA_API_KEY;
        if (!exaApiKey) {
          console.warn("[API MCPv5 POST / OpenAI Responses API] EXA_API_KEY not found for 'exa' tool. Excluding it.");
          continue; // Skip this server if API key is missing
        }
        // For Exa, the URL from MCP_SERVERS_CONFIG is expected to be the base URL.
        // The API key will be added to headers, not substituted in the URL here.
      }
      mcpConfigsToUse.push(server); // Add server if it's not Exa, or if it's Exa and key is present (key checked during mapping)
    }

    // Apply forced_tool_id filtering
    if (forced_tool_id && typeof forced_tool_id === 'string' && forced_tool_id.trim() !== "") {
      console.log(`[API MCPv5 POST / OpenAI Responses API] Filtering MCP servers to force tool: ${forced_tool_id}`);
      // Check if the forced tool is 'exa' and if its API key is missing
      if (forced_tool_id === "exa" && !process.env.EXA_API_KEY) {
         console.error(`[API MCPv5 POST / OpenAI Responses API] Forced tool 'exa' selected, but EXA_API_KEY is missing.`);
         return NextResponse.json({ success: false, error: `Herramienta forzada ${forced_tool_id} no disponible (falta API key).` }, { status: 400 });
      }
      mcpConfigsToUse = mcpConfigsToUse.filter(server => server.id === forced_tool_id);
      if (mcpConfigsToUse.length === 0) {
        console.error(`[API MCPv5 POST / OpenAI Responses API] Forced tool ID ${forced_tool_id} not found after initial processing.`);
        return NextResponse.json({ success: false, error: `Herramienta forzada ${forced_tool_id} no disponible.` }, { status: 400 });
      }
    }
    console.log(`[API MCPv5 POST / OpenAI Responses API] Using ${mcpConfigsToUse.length} MCP server(s) for tools.`);

    const mappedMcpTools: OpenAI.Beta.Responses.Tool.MCP[] = mcpConfigsToUse.map(mcpServer => {
      const headers: { [key: string]: string } = {};
      
      if (mcpServer.id === "exa") {
        const exaApiKey = process.env.EXA_API_KEY;
        if (exaApiKey) {
          headers['x-api-key'] = exaApiKey; // Correct header for Exa
        } 
        // If exaApiKey is missing here, it should have been filtered out already if 'exa' was not forced.
        // If 'exa' was forced and key is missing, the earlier check handles it.
      } else {
        // Handle auth for other servers
        if (mcpServer.auth?.type === 'bearer_token' && mcpServer.auth.token) {
          headers['Authorization'] = `Bearer ${mcpServer.auth.token}`;
        } else if (mcpServer.auth?.type === 'custom_header' && mcpServer.auth.header_name && mcpServer.auth.token) {
          headers[mcpServer.auth.header_name] = mcpServer.auth.token;
        }
        if (mcpServer.apiKey) { 
          headers['X-API-Key'] = mcpServer.apiKey;
        }
      }
      
      const toolDefinition: OpenAI.Beta.Responses.Tool.MCP = {
        type: "mcp",
        server_label: mcpServer.id,
        server_url: mcpServer.url, // URL is now the base URL for Exa
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        // @ts-ignore - Attempt to add auto-approval field
        require_approval: "never" 
      };
      return toolDefinition;
    });

    console.log("[API MCPv5 POST / OpenAI Responses API] Calling openai.responses.create(). Tools being sent:", JSON.stringify(mappedMcpTools, null, 2));
    // @ts-ignore - Assuming openai.responses.create is available, might need type update for openai package
    const openAIResponse = await openai.responses.create({
      model: assistantConfig.model || "gpt-4o-mini",
      input: fullInput,
      tools: mappedMcpTools.length > 0 ? mappedMcpTools : undefined, // Pass undefined if no tools are applicable
    });
    console.log("[API MCPv5 POST V2_LOGGING] Full OpenAI Response object:", JSON.stringify(openAIResponse, null, 2)); 

    // @ts-ignore
    const rawOpenAIOutputArray = openAIResponse.output;
    // @ts-ignore
    const topLevelToolErrors = openAIResponse.tool_errors; 

    console.log("[API MCPv5 POST V2_LOGGING] Raw OpenAI Output Array:", JSON.stringify(rawOpenAIOutputArray, null, 2));
    console.log("[API MCPv5 POST V2_LOGGING] Top-level tool_errors from OpenAI:", JSON.stringify(topLevelToolErrors, null, 2)); 

    let extractedAssistantMessage: string | null = null;
    const extractedToolErrors: any[] = [];

    if (Array.isArray(rawOpenAIOutputArray)) {
      for (const item of rawOpenAIOutputArray) {
        if (item.type === "message" && item.role === "assistant" && item.content && Array.isArray(item.content)) {
          for (const contentItem of item.content) {
            // @ts-ignore
            if (contentItem.type === "output_text" && typeof contentItem.text === 'string') {
              extractedAssistantMessage = (extractedAssistantMessage || "") + contentItem.text;
            // @ts-ignore
            } else if (contentItem.type === "text" && typeof contentItem.text === 'string') { // Fallback
              extractedAssistantMessage = (extractedAssistantMessage || "") + contentItem.text;
            }
          }
        } else if (item.type === "mcp_call" && item.error) {
          extractedToolErrors.push({
            tool_name: item.name, // 'name' might not exist directly on mcp_call, 'server_label' is more likely
            server_label: item.server_label,
            error: item.error,
            arguments: item.arguments 
          });
        }
      }
    }

    // @ts-ignore
    if (!extractedAssistantMessage && typeof openAIResponse.output_text === 'string' && openAIResponse.output_text.trim() !== '') {
    // @ts-ignore
      extractedAssistantMessage = openAIResponse.output_text;
      console.log("[API MCPv5 POST V2_LOGGING] Used top-level output_text as fallback.");
    }
    
    const finalAssistantText = extractedAssistantMessage || "No text output received from assistant.";
    const finalToolErrors = (extractedToolErrors.length > 0) ? extractedToolErrors : (topLevelToolErrors || null);
    
    console.log(`[API MCPv5 POST V2_LOGGING] Extracted final assistant text: "${finalAssistantText.substring(0,100)}..."`);
    if (finalToolErrors && (!Array.isArray(finalToolErrors) || finalToolErrors.length > 0)) {
        console.warn("[API MCPv5 POST V2_LOGGING] Tool errors for client:", JSON.stringify(finalToolErrors, null, 2));
    }
    
    return NextResponse.json({ 
      success: true, 
      response: finalAssistantText,
      tool_errors: finalToolErrors 
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
