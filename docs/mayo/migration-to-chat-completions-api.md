# Migration of "MCP v5 - mcp-test-assistant" to OpenAI Responses API (May 2024)

## 1. Objective & Final Scope

The initial goal of migrating MCP assistants evolved based on user feedback and new information regarding OpenAI API capabilities.

**The final implemented scope is:**

*   **Revert `/api/chat/route.ts`**: The main chat API endpoint, used by "Asistente de Señalización", was reverted to its original OpenAI Assistants API implementation. This ensures its continued stable operation as per user requirements.
*   **Migrate "MCP v5 - mcp-test-assistant" Backend to OpenAI Responses API**: The backend API for "MCP v5 - mcp-test-assistant" (specifically `/api/chat/mcpv5/route.ts`) was migrated to use the new `openai.responses.create()` API. This allows OpenAI to directly handle calls to remote MCP servers, simplifying the backend architecture.

This document details the final changes for the "MCP v5 - mcp-test-assistant" migration.

## 2. Core Changes

### 2.1. API Endpoint: `/api/chat/mcpv5/route.ts` (for "MCP v5 - mcp-test-assistant")

This API route, serving the "MCP v5 - mcp-test-assistant", was refactored to use `openai.responses.create()` and a flexible system for defining MCP tools.

*   **Dynamic Tool Definition from `MCP_SERVERS_CONFIG`**:
    *   The route reads its tool configurations from the `MCP_SERVERS_CONFIG` environment variable.
    *   To support various authentication mechanisms (e.g., Bearer tokens for Zapier, API keys in headers for Exa), entries in `MCP_SERVERS_CONFIG` should now use these optional fields:
        *   `"auth_type"`: Specifies the authentication method (e.g., `"bearer"`, `"x-api-key"`).
        *   `"api_key_env_var"`: Specifies the name of the environment variable that holds the actual API key (e.g., `"ZAPIER_MCP_API_KEY"`).
    *   The backend code in `/api/chat/mcpv5/route.ts` uses these fields to dynamically construct the `headers` object for each tool passed to `openai.responses.create()`.
    *   If an `api_key_env_var` is specified but the environment variable is not set, the tool is excluded, and a warning is logged.
    *   The `server_url` should be the base URL of the MCP server (e.g., `https://mcp.zapier.com/api/mcp/mcp`).
    *   `require_approval: "never"` is set for all tools to enable auto-execution by OpenAI.

*   **Example: Configuring Zapier/Tavily Search in `MCP_SERVERS_CONFIG`**:
    To use Tavily Search via Zapier (as per user's latest guide), the `MCP_SERVERS_CONFIG` entry would look like:
    ```json
    {
      "id": "zapier-tavily-search", // Unique server_label for OpenAI
      "name": "Tavily Search via Zapier",
      "url": "https://mcp.zapier.com/api/mcp/mcp", // Or from ZAPIER_MCP_URL env var
      "auth_type": "bearer",
      "api_key_env_var": "ZAPIER_MCP_API_KEY"
    }
    ```
    And the following environment variables must be set in Vercel:
    *   `ZAPIER_MCP_API_KEY`: Your Zapier NLA API key.
    *   `ZAPIER_MCP_URL`: (Optional, if you want to set the URL via env var too) `https://mcp.zapier.com/api/mcp/mcp`. The backend can be adapted to read this if `MCP_SERVERS_CONFIG.url` points to it. For now, it assumes the direct URL is in `MCP_SERVERS_CONFIG`.

*   **GET Handler (Tool Listing):** Continues to list tools based on `MCP_SERVERS_CONFIG` for UI display.
*   **POST Handler (Chat Processing):**
    *   Uses `openai.responses.create()` with the dynamically configured MCP tools.
    *   Parses the `openAIResponse.output` array to find the final assistant message (from `type: "message"`) and to collect any tool execution errors (from `type: "mcp_call"` objects).

*   **(Previous Exa Configuration Note):** While Exa was used for debugging, if it's still needed, it would be configured similarly:
    ```json
    {
      "id": "exa-search",
      "name": "Exa Web Search",
      "url": "https://mcp.exa.ai/mcp",
      "auth_type": "x-api-key", // Assuming Exa uses x-api-key header
      "api_key_env_var": "EXA_API_KEY"
    }
    ```

## 3. Assistant Configuration: `lib/assistants.ts`

*   The `Assistant` type definition (with `instructions?: string;` and `model?: string;` fields) remains essential.
*   The "MCP v5 - mcp-test-assistant" configuration in `lib/assistants.ts` provides the `instructions` (used as part of the `input` to `responses.create()`) and the `model`.

## 4. Tool Calling Functionality (via OpenAI Responses API)

*   For "MCP v5 - mcp-test-assistant", OpenAI now directly calls the MCP servers specified in the `tools` array.
*   The backend (`/api/chat/mcpv5/route.ts`) no longer makes direct HTTP requests to MCP servers. It only declares them to the `responses.create()` API. This includes dynamically configuring tool headers based on `MCP_SERVERS_CONFIG` (using `auth_type` and `api_key_env_var`) and setting `require_approval: "never"` for all MCP tools.
*   This aligns with the user's provided guide, aiming to reduce backend complexity and leverage OpenAI's infrastructure for network interactions with MCPs.

## 5. Testing and Verification (Revised for Zapier/Tavily)

Thorough testing is required for:

*   **"MCP v5 - mcp-test-assistant" (with Zapier/Tavily):**
    *   **Environment Variables:**
        *   Ensure `MCP_SERVERS_CONFIG` in Vercel is updated to primarily (or solely) list the Zapier/Tavily tool, configured with `auth_type: "bearer"` and `api_key_env_var: "ZAPIER_MCP_API_KEY"`.
        *   Ensure `ZAPIER_MCP_API_KEY` is correctly set.
        *   Ensure `ZAPIER_MCP_URL` is set if your `MCP_SERVERS_CONFIG` entry for Zapier's `url` field references this environment variable (otherwise, ensure the direct URL is in `MCP_SERVERS_CONFIG`).
    *   **Functionality:**
        *   Send prompts that should trigger Tavily web search (e.g., "Dame un resumen de las 3 noticias más recientes sobre Artemis II.").
        *   Verify that the assistant provides search results from Tavily.
        *   Check Vercel logs (`V2_LOGGING` messages) to confirm:
            *   The Zapier tool is correctly prepared with the Bearer token in headers.
            *   The `Full OpenAI Response object` shows successful `mcp_call` for `server_label: "zapier-tavily-search"` (or similar) without errors.
            *   The final assistant message is correctly extracted.
    *   Test the "Force Tool" functionality for Zapier/Tavily.
*   **"Asistente de Señalización"**: Re-confirm it remains functional with the reverted Assistants API.
*   **Error Handling**:
    *   Test with an incorrect `ZAPIER_MCP_API_KEY` to see if Zapier/OpenAI reports an auth error (e.g., 401/403 in an `mcp_call` error object) and if the backend surfaces this in the `tool_errors` part of its JSON response to the client.

This approach leverages the latest OpenAI capabilities for a more robust and managed integration of remote MCP tools.
