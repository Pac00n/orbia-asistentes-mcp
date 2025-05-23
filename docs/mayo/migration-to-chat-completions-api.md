# Migration of "MCP v5 - mcp-test-assistant" to OpenAI Responses API (May 2024)

## 1. Objective & Final Scope

The initial goal of migrating MCP assistants evolved based on user feedback and new information regarding OpenAI API capabilities.

**The final implemented scope is:**

*   **Revert `/api/chat/route.ts`**: The main chat API endpoint, used by "Asistente de Señalización", was reverted to its original OpenAI Assistants API implementation. This ensures its continued stable operation as per user requirements.
*   **Migrate "MCP v5 - mcp-test-assistant" Backend to OpenAI Responses API**: The backend API for "MCP v5 - mcp-test-assistant" (specifically `/api/chat/mcpv5/route.ts`) was migrated to use the new `openai.responses.create()` API. This allows OpenAI to directly handle calls to remote MCP servers, simplifying the backend architecture.

This document details the final changes for the "MCP v5 - mcp-test-assistant" migration.

## 2. Core Changes: `/api/chat/mcpv5/route.ts`

The API route `/api/chat/mcpv5/route.ts`, which serves the "MCP v5 - mcp-test-assistant", was refactored to use `openai.responses.create()`:

*   **`McpClient` No Longer Used for Execution**: The `McpClient` is no longer used in this file for discovering or executing tool calls. OpenAI now manages these interactions.
*   **Dependency on `lib/mcp/config.ts`**: The route still uses `getMcpServersConfiguration()` from `lib/mcp/config.ts` to fetch the list of MCP servers defined in the `MCP_SERVERS_CONFIG` environment variable.

*   **GET Handler (Tool Listing):**
    *   Fetches MCP server configurations via `getMcpServersConfiguration()`.
    *   Transforms this list into a simplified format suitable for UI display (e.g., `[{ id: server.id, name: server.name || server.id, description: ... }]`). This is because the client no longer needs detailed function signatures, only a list of available MCP capabilities.

*   **POST Handler (Chat Processing):**
    *   Uses `openai.responses.create()` to process user messages and interact with MCP tools.
    *   **Input Construction**: The user's message, along with system instructions from `lib/assistants.ts` (`assistantConfig.instructions`), is passed as the `input` to `responses.create()`.
    *   **Tool Definition for `responses.create()`**:
        *   The `tools` array is constructed by mapping entries from `MCP_SERVERS_CONFIG`. Each tool is defined with:
            *   `type: "mcp"`
            *   `server_label: server.id` (a unique identifier for the MCP server)
            *   `server_url: server.url` (For Exa, this URL is processed at runtime, see "Exa Web Search Integration" below).
            *   `headers`: Dynamically constructed based on the `auth` (bearer token, custom header) or legacy `apiKey` fields in `MCP_SERVERS_CONFIG` for each server.
        *   If `forced_tool_id` is provided in the request (matching a `server.id`), the `tools` array passed to `responses.create()` is filtered to only include that specific MCP server, effectively forcing its selection.
    *   **API Call**: `await openai.responses.create({ model: ..., input: ..., tools: ... })`. The call is non-streaming.
    *   **Response Handling**: The final output from the assistant is taken from `openAIResponse.output`. Any errors reported by MCP servers during OpenAI's attempt to call them are expected in `openAIResponse.tool_errors[]` and are returned to the client.
    #### Exa Web Search Integration:
    *   The route now supports integration with "Exa Web Search" as an MCP tool.
    *   **Configuration via `MCP_SERVERS_CONFIG`**: To enable Exa, an entry should exist in `MCP_SERVERS_CONFIG` with `id: "exa"`. Its `url` field must contain the placeholder `${EXA_API_KEY}`. For example:
        ```json
        {
          "id": "exa",
          "url": "https://mcp.exa.ai/mcp?exaApiKey=${EXA_API_KEY}",
          "name": "Exa Web Search"
        }
        ```
    *   **Environment Variable**: The `EXA_API_KEY` environment variable must be set in the Vercel environment.
    *   **Runtime API Key Injection**: The backend replaces the `${EXA_API_KEY}` placeholder in the URL with the actual environment variable value before passing the tool definition to `openai.responses.create()`.
    *   If the `EXA_API_KEY` is not set, the Exa tool is automatically excluded, and a warning is logged.

## 3. Assistant Configuration: `lib/assistants.ts`

*   The `Assistant` type definition (with `instructions?: string;` and `model?: string;` fields) remains essential.
*   The "MCP v5 - mcp-test-assistant" configuration in `lib/assistants.ts` provides the `instructions` (used as part of the `input` to `responses.create()`) and the `model`.

## 4. Tool Calling Functionality (via OpenAI Responses API)

*   For "MCP v5 - mcp-test-assistant", OpenAI now directly calls the MCP servers specified in the `tools` array.
*   The backend (`/api/chat/mcpv5/route.ts`) no longer makes direct HTTP requests to MCP servers. It only declares them to the `responses.create()` API. This includes dynamically configuring the Exa tool's URL with its API key at runtime.
*   This aligns with the user's provided guide, aiming to reduce backend complexity and leverage OpenAI's infrastructure for network interactions with MCPs.

## 5. Testing and Verification (Revised)

Thorough testing is required for:

*   **"MCP v5 - mcp-test-assistant" (via its card and `/api/chat/mcpv5/route.ts`):**
    *   Confirm that it uses the `openai.responses.create()` API. (This might involve checking Vercel logs for OpenAI API calls if `OPENAI_LOG=debug` can be enabled, or observing behavior).
    *   Verify successful invocation of external tools (e.g., "fs-demo", "git", "fetch") via OpenAI. Check that `demo.mcp.tools` DNS issue (if still present) is now reported in `tool_errors` by the Responses API.
    *   Test the "Force Tool" functionality.
*   **Exa Web Search Integration (for "MCP v5 - mcp-test-assistant"):**
    *   Ensure the `EXA_API_KEY` environment variable is correctly set in Vercel.
    *   Add or verify the "exa" tool configuration in `MCP_SERVERS_CONFIG` with the URL placeholder `${EXA_API_KEY}`.
    *   Send prompts that should trigger web searches (e.g., "Busca artículos de los últimos 7 días sobre Quantum Error Correction...").
    *   Verify that Exa is called (this might require checking Vercel logs for outgoing requests from OpenAI if `OPENAI_LOG=debug` is enabled, or observing the nature of the search results).
    *   Confirm that search results from Exa are returned and used by the assistant.
    *   Test behavior if `EXA_API_KEY` is missing (Exa tool should be skipped).
*   **"Asistente de Señalización" (via its card and `/api/chat/route.ts`):**
    *   Re-confirm it is functioning correctly using the reverted Assistants API.
*   **MCP Server Configuration:** Ensure MCP servers listed in `MCP_SERVERS_CONFIG` are publicly accessible via HTTPS with valid TLS certificates and correct auth headers, as required by the OpenAI Responses API for remote MCPs.

This approach leverages the latest OpenAI capabilities for a more robust and managed integration of remote MCP tools.
