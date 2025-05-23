# Migration of MCP Assistant to Chat Completions API (May 2024)

## 1. Objective

The primary objective of this migration was to transition the MCP assistant, specifically the `asistente-senalizacion` (formerly using OpenAI Assistant ID `asst_MXuUc0TcV7aPYkLGbN5glitq`), from the OpenAI Assistants API to the more direct and potentially faster Chat Completions API. This change aims to reduce overhead from managing Assistant and Thread objects and improve response times, while critically retaining the ability to call external tools via the MCP infrastructure.

## 2. Core Changes

### 2.1. API Endpoint: `app/api/chat/route.ts`

The main chat endpoint was significantly refactored:

*   **Removal of Assistants API Logic**: All code related to `openai.beta.threads` (creating threads, adding messages, creating and streaming runs) was removed.
*   **Integration of `McpClient`**:
    *   The `McpClient` (from `lib/mcp/client.ts`) is now instantiated and initialized (`mcpClient.initialize()`) at the beginning of each request. This client is responsible for fetching tool definitions from MCP servers and executing them.
*   **Chat Completions API Usage**:
    *   The endpoint now uses `openai.chat.completions.create()` with `stream: true` for generating responses.
    *   Tool definitions are provided to OpenAI via the `tools: mcpClient.getOpenAIToolDefinitions()` parameter.
    *   `tool_choice: "auto"` allows the model to decide when to call tools.
*   **Tool Call Handling**:
    *   The response stream from OpenAI is monitored for `tool_calls`.
    *   When the model indicates a tool call (`finish_reason === 'tool_calls'`), the necessary information (tool name, arguments) is collected from the stream.
    *   `mcpClient.executeTool()` is then invoked with the appropriate (prefixed) tool name and parsed arguments.
    *   The result from `executeTool()` (or any error) is then sent back to the Chat Completions API with `role: "tool"` to allow the model to continue the conversation.
*   **System Prompts**:
    *   The system prompt for the selected assistant is now derived from its configuration in `lib/assistants.ts`. The new `app/api/chat/route.ts` uses the `assistantConfig.instructions` field, falling back to `assistantConfig.description`, and then to a generic default if neither is present.
*   **Image Input (Vision)**:
    *   If an `imageBase64` string is provided in the request, it's formatted into the `image_url` content block required by the Chat Completions API for vision capabilities. The previous logic of creating an OpenAI File object has been removed.
    *   Example message format for image input:
        ```json
        {
          "role": "user",
          "content": [
            { "type": "text", "text": "User's message about the image" },
            {
              "type": "image_url",
              "image_url": { "url": "data:image/jpeg;base64,..." }
            }
          ]
        }
        ```

### 2.2. Assistant Configuration: `lib/assistants.ts`

To support the new API and provide better configuration:

*   The `Assistant` type definition was extended with two optional fields:
    *   `instructions?: string;`: To explicitly define the system prompt for the assistant.
    *   `model?: string;`: To specify the OpenAI model to be used (e.g., "gpt-4o-mini").
*   All existing assistant configurations, including `asistente-senalizacion`, were updated:
    *   The `instructions` field was populated (typically by copying the existing `description`, which often served as a de facto instruction).
    *   The `model` field was added, generally defaulting to `"gpt-4o-mini"`.
*   The `app/api/chat/route.ts` uses these new fields to configure the Chat Completions API call. The `openaiAssistantId` field is no longer directly used by this route for making OpenAI API calls but is kept for potential reference or other uses.

## 3. Tool Calling Functionality

*   External tool calling remains a critical feature. The `McpClient` handles this by:
    *   Discovering available tools from MCP servers defined in the `MCP_SERVERS_CONFIG` environment variable during its `initialize()` phase.
    *   Providing these tool definitions to the OpenAI Chat Completions API.
    *   Executing tool calls by making HTTP requests to the appropriate MCP server's `/execute` endpoint when the model requests a tool invocation.
*   The environment variable `MCP_SERVERS_CONFIG` (as provided in the issue requirements) is the source of truth for configuring which MCP servers and tools are accessible.
    ```
    MCP_SERVERS_CONFIG='[
      { "id": "fs-demo", "url": "https://fs-demo.mcpservers.org/mcp", "name": "MCP FS Demo" },
      { "id": "git", "url": "https://git.mcpservers.org/mcp", "name": "Git Mirror ReadOnly" },
      { "id": "fetch", "url": "https://demo.mcp.tools/fetch/mcp", "name": "Fetch Tool" }
    ]'
    ```
*   The `lib/mcp/config.ts` module is responsible for parsing this environment variable.
*   The `lib/mcp/client.ts` contains fallback simulation logic for tool discovery and execution, which is primarily intended for development or when live servers are unavailable. If `MCP_SERVERS_CONFIG` is correctly set and servers are responsive, real tools should be used.

## 4. Testing and Verification

Thorough testing is required to ensure:
*   Improved (or at least comparable) response speed.
*   Correct conversational flow.
*   Successful invocation of external tools as defined by `MCP_SERVERS_CONFIG`.
    *   For example, testing with the `fs-demo`, `git`, or `fetch` tools.
*   Proper handling of image inputs for `asistente-senalizacion`.
*   Graceful error handling for API issues or tool execution failures.

This migration leverages the Chat Completions API's native tool-calling features and a robust client (`McpClient`) to interact with the MCP ecosystem.
