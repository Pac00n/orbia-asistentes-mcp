# Migration of "MCP v5 - mcp-test-assistant" Backend to Chat Completions API (May 2024)

## 1. Objective & Scope Adjustment

The initial objective was to migrate the assistant using OpenAI Assistant ID `asst_MXuUc0TcV7aPYkLGbN5glitq` ("Asistente de Señalización") to the Chat Completions API. However, based on user feedback, this assistant was already functioning correctly and should not have been altered.

**The revised and actual scope of this migration was:**

*   **Revert `/api/chat/route.ts`**: The main chat API endpoint, used by "Asistente de Señalización", was reverted to its original OpenAI Assistants API implementation to ensure its continued stable operation.
*   **Migrate Backend for "MCP v5 - mcp-test-assistant"**: The primary goal became migrating the backend API used by the "MCP v5 - mcp-test-assistant" (specifically `/api/chat/mcpv5/route.ts`) to the OpenAI Chat Completions API, integrating `McpClient` for dynamic tool usage.

This document details the changes made to achieve the migration for "MCP v5 - mcp-test-assistant".

## 2. Core Changes

### 2.1. API Endpoint: `/api/chat/mcpv5/route.ts` (for "MCP v5 - mcp-test-assistant")

This API route was refactored as follows:

*   **GET Handler (Tool Listing):**
    *   The logic for listing available tools was updated.
    *   It now initializes `McpClient` and calls `mcpClient.getOpenAIToolDefinitions()`.
    *   The fetched tool definitions are then transformed into the format expected by the frontend (`[{ id: toolName, name: toolName, description: toolDescription }]`) and returned as a JSON response.

*   **POST Handler (Chat Processing):**
    *   Removed previous logic (which might have been ad-hoc assistant creation or another method).
    *   **Integration of `McpClient`**: `McpClient` is instantiated and initialized on each request.
    *   **Chat Completions API Usage**:
        *   The endpoint now uses `openai.chat.completions.create()` for generating responses. Crucially, `stream: false` is used, as the corresponding frontend page (`app/chat/mcpv5/[assistantId]/page.tsx`) expects a single JSON response.
        *   Tool definitions are provided to OpenAI via `tools: mcpClient.getOpenAIToolDefinitions()`.
        *   `tool_choice: "auto"` is default, but if `forced_tool_id` is present in the request, `tool_choice` is set to force that specific tool.
    *   **Non-Streaming Tool Call Handling**:
        *   If the initial Chat Completions response includes `tool_calls`:
            1.  The assistant's first message (containing the `tool_calls` object) is added to an internal message history.
            2.  Each requested tool is executed using `mcpClient.executeTool()`.
            3.  The results from tool executions are added to the message history as `role: "tool"` messages.
            4.  A second call to `openai.chat.completions.create()` is made with this updated message history to get the final textual response from the assistant.
        *   The final assistant message content is then returned in the JSON response.
    *   **System Prompts**:
        *   The system prompt for "MCP v5 - mcp-test-assistant" is derived from its configuration in `lib/assistants.ts` (using `assistantConfig.instructions`, falling back to `assistantConfig.description`).

### 2.2. Assistant Configuration: `lib/assistants.ts`

Changes to this file remain relevant as they support the refactored `/api/chat/mcpv5/route.ts`:

*   The `Assistant` type definition includes:
    *   `instructions?: string;`: For the system prompt.
    *   `model?: string;`: To specify the OpenAI model.
*   The "mcp-test-assistant" configuration in `lib/assistants.ts` uses these fields. Its `instructions` field (e.g., "Este asistente está configurado para probar herramientas y capacidades a través de MCP...") is used as the system prompt by `/api/chat/mcpv5/route.ts`.

### 2.3. Main API Endpoint: `/api/chat/route.ts`

*   As per the revised scope, this file was **reverted** to its original implementation using the OpenAI Assistants API. This ensures that assistants like "Asistente de Señalización" continue to function as they did before this migration effort began.

## 3. Tool Calling Functionality (for "MCP v5 - mcp-test-assistant")

*   External tool calling for "MCP v5 - mcp-test-assistant" is handled by `McpClient` within the `/api/chat/mcpv5/route.ts` backend:
    *   `McpClient` discovers tools from `MCP_SERVERS_CONFIG`.
    *   It provides tool definitions to Chat Completions and executes calls as described above.
*   The `MCP_SERVERS_CONFIG` environment variable remains the source for tool server configuration.

## 4. Testing and Verification

Thorough testing is required for:

*   **"MCP v5 - mcp-test-assistant" (via its card on the Assistants page):**
    *   Verify that it now uses the Chat Completions API (e.g., no new assistants should be created in the OpenAI dashboard for these interactions).
    *   Confirm successful invocation of external tools defined in `MCP_SERVERS_CONFIG` (e.g., "fs-demo", "git", "fetch") and that results are correctly incorporated.
    *   Check response speed and conversational flow.
    *   Test the "Force Tool" functionality on its chat page.
*   **"Asistente de Señalización" (via its card on the Assistants page):**
    *   Confirm it is functioning as it was *before* this migration effort (i.e., using the Assistants API, handling images correctly, etc.). This will verify the successful reversion of `/api/chat/route.ts`.
*   **Overall System:**
    *   Ensure graceful error handling for API issues or tool execution failures for both assistants.

This revised approach ensures targeted migration for the "MCP v5 - mcp-test-assistant" while preserving the existing functionality of other assistants.
