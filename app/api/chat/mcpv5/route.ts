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
    mcpConfigsToUse = allMcpConfigs // Removed `let` and type annotation here
      .map(serverConfig => {
        // This initial map is just to prepare for potential filtering based on api_key_env_var
        // No actual transformation of serverConfig happens here, that's done in mappedMcpTools
        if (serverConfig.api_key_env_var && !process.env[serverConfig.api_key_env_var]) {
          console.warn(`[API MCPv5 POST V2_LOGGING] API key environment variable '${serverConfig.api_key_env_var}' not found for MCP server '${serverConfig.id}'. This tool will be excluded if selected.`);
          // We don't return null here yet, because it might not be selected.
          // The actual exclusion will happen in the mappedMcpTools step or if forced.
        }
        return serverConfig;
      });

    // Apply forced_tool_id filtering
    if (forced_tool_id && typeof forced_tool_id === 'string' && forced_tool_id.trim() !== "") {
      console.log(`[API MCPv5 POST / OpenAI Responses API] Filtering MCP servers to force tool: ${forced_tool_id}`);
      const forcedConfig = mcpConfigsToUse.find(s => s.id === forced_tool_id);
      if (forcedConfig?.api_key_env_var && !process.env[forcedConfig.api_key_env_var]) {
         console.error(`[API MCPv5 POST / OpenAI Responses API] Forced tool '${forced_tool_id}' selected, but its API key environment variable '${forcedConfig.api_key_env_var}' is missing.`);
         return NextResponse.json({ success: false, error: `Herramienta forzada ${forced_tool_id} no disponible (falta API key env var).` }, { status: 400 });
      }
      mcpConfigsToUse = mcpConfigsToUse.filter(server => server.id === forced_tool_id);
      if (mcpConfigsToUse.length === 0) { // Should be caught by above if API key for forced tool is missing
        console.error(`[API MCPv5 POST / OpenAI Responses API] Forced tool ID ${forced_tool_id} not found after initial processing.`);
        return NextResponse.json({ success: false, error: `Herramienta forzada ${forced_tool_id} no disponible.` }, { status: 400 });
      }
    }
    console.log(`[API MCPv5 POST / OpenAI Responses API] Using ${mcpConfigsToUse.length} MCP server(s) for tools.`);

    const mappedMcpTools = mcpConfigsToUse
      .map(mcpServer => {
        const headers: { [key: string]: string } = {};
        let apiKey: string | undefined;

        if (mcpServer.api_key_env_var) {
          apiKey = process.env[mcpServer.api_key_env_var];
          if (!apiKey) {
            console.warn(`[API MCPv5 POST V2_LOGGING] API key from env var '${mcpServer.api_key_env_var}' not found for MCP server '${mcpServer.id}'. This tool will be excluded if an API key is strictly required by its auth_type.`);
            // If auth_type implies a key is needed, we should exclude the tool.
            if (mcpServer.auth_type === 'bearer' || mcpServer.auth_type === 'x-api-key') {
                return null; // Exclude this tool
            }
          } else {
            // Construct headers based on auth_type and apiKey
            if (mcpServer.auth_type === 'bearer') {
              headers['Authorization'] = `Bearer ${apiKey}`;
            } else if (mcpServer.auth_type === 'x-api-key') {
              headers['x-api-key'] = apiKey;
            } else if (mcpServer.auth_type) {
                console.warn(`[API MCPv5 POST V2_LOGGING] Unrecognized auth_type '${mcpServer.auth_type}' for MCP server '${mcpServer.id}' with a provided api_key_env_var. No specific authorization header will be added based on this auth_type.`);
            }
            // If auth_type is not set but api_key_env_var was, it's ambiguous how to use the key.
            // For now, we assume auth_type will guide header creation if an API key is involved.
          }
        } else if (mcpServer.apiKey) { // Fallback to legacy direct apiKey (less secure, from old config)
            console.warn(`[API MCPv5 POST V2_LOGGING] Using legacy 'apiKey' field (direct key) for MCP server '${mcpServer.id}'. Please migrate to 'auth_type' and 'api_key_env_var'.`);
            headers['X-API-Key'] = mcpServer.apiKey; // Generic header for legacy direct key
        } else if (mcpServer.auth && mcpServer.auth.token) { // Fallback to legacy 'auth' object
            console.warn(`[API MCPv5 POST V2_LOGGING] Using legacy 'auth' object for MCP server '${mcpServer.id}'. Please migrate to 'auth_type' and 'api_key_env_var'.`);
            if (mcpServer.auth.type === 'bearer') { // Assuming 'auth.type' could be 'bearer'
                headers['Authorization'] = `Bearer ${mcpServer.auth.token}`;
            } else if (mcpServer.auth.type === 'header' && mcpServer.auth.header) { // Assuming 'auth.type' could be 'header' for custom
                headers[mcpServer.auth.header] = mcpServer.auth.token;
            } else {
                headers['X-API-Key'] = mcpServer.auth.token; // Fallback for unknown legacy auth object structure
            }
        }
        // If no api_key_env_var, no legacy apiKey, and no legacy auth object, it's an open tool or misconfigured for auth.

        const toolDefinition = { // Explicitly type or cast later if needed due to @ts-ignore for require_approval
          type: "mcp",
          server_label: mcpServer.id,
          server_url: mcpServer.url,
          // Only include headers if it's not empty
          headers: Object.keys(headers).length > 0 ? headers : undefined,
          // @ts-ignore - allow require_approval if not in base type
          require_approval: "never"
        };
        return toolDefinition;
      })
      .filter(tool => tool !== null) as OpenAI.Beta.Responses.Tool.MCP[]; // Filter out excluded tools

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
