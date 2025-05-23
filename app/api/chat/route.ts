// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAssistantById } from '@/lib/assistants';
import { McpClient } from '@/lib/mcp/client'; // Import McpClient
// Buffer no es necesario para imageBase64 con Chat Completions en el formato esperado
// import { Buffer } from 'buffer'; 

export const runtime = "nodejs";
export const maxDuration = 60; // Max duration for the function

// --- OpenAI Client (Robust Initialization) ---
let openai: OpenAI | null = null;
const openAIApiKey = process.env.OPENAI_API_KEY;

if (openAIApiKey && openAIApiKey.trim() !== "") {
    try {
        openai = new OpenAI({ apiKey: openAIApiKey });
        console.log("[API Chat] OpenAI Client initialized successfully.");
    } catch (e) {
        console.error("[API Chat] Failed to initialize OpenAI Client:", e);
    }
} else {
    console.warn("[API Chat] OPENAI_API_KEY is not configured. OpenAI features will not work.");
}
// --- End OpenAI Client ---

// Helper to send Server-Sent Events (SSE)
function sendEvent(controller: ReadableStreamDefaultController<any>, event: object) {
  controller.enqueue(`data: ${JSON.stringify(event)}

`);
}

export async function POST(req: NextRequest) {
  console.log("--- API Chat Endpoint Start (Chat Completions with McpClient) ---");

  if (!openai) {
    console.error("[API Chat] OpenAI Client not initialized (API Key missing?).");
    return NextResponse.json({ error: 'Server configuration error for OpenAI (API Key).' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { assistantId, message, imageBase64, threadId: clientThreadId, employeeToken } = body; // clientThreadId for client-side context

    console.log(`[API Chat] Request Data: assistantId=${assistantId}, msg=${message ? message.substring(0, 30) + "..." : "N/A"}, img=${imageBase64 ? "Yes" : "No"}, clientThreadId=${clientThreadId}, token=${employeeToken ? "Yes" : "No"}`);

    // --- Input Validation ---
    if (typeof assistantId !== 'string' || !assistantId) return NextResponse.json({ error: 'assistantId is required' }, { status: 400 });
    if ((typeof message !== 'string' || !message.trim()) && (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image'))) return NextResponse.json({ error: 'Valid text or image is required' }, { status: 400 });
    if (clientThreadId !== undefined && typeof clientThreadId !== 'string' && clientThreadId !== null) return NextResponse.json({ error: 'Invalid clientThreadId' }, { status: 400 });

    const assistantConfig = getAssistantById(assistantId);
    if (!assistantConfig) {
      console.error(`[API Chat] Assistant not found for id: ${assistantId}`);
      return NextResponse.json({ error: 'Assistant not found' }, { status: 404 });
    }
    // Note: openaiAssistantId from assistantConfig is no longer directly used for assistant runs.
    // We use assistantConfig.instructions (or description) for system prompt.

    // --- Initialize McpClient ---
    const mcpClient = new McpClient();
    try {
      await mcpClient.initialize();
      console.log("[API Chat] McpClient initialized successfully.");
    } catch (error) {
      console.error("[API Chat] Failed to initialize McpClient:", error);
      return NextResponse.json({ error: 'Failed to initialize tool client.' }, { status: 500 });
    }
    // --- End McpClient Initialization ---

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send an initial info event (optional, but can be useful for client)
          sendEvent(controller, { type: 'info', data: { assistantId, clientThreadId } });

          // --- Construct Messages for Chat Completions ---
          const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

          // System Message from Assistant Configuration
          if (assistantConfig.instructions) {
            messages.push({ role: 'system', content: assistantConfig.instructions });
          } else if (assistantConfig.description) { // Fallback to description
            messages.push({ role: 'system', content: assistantConfig.description });
          } else {
            // Default system message if none provided
            messages.push({ role: 'system', content: 'You are a helpful assistant.' });
          }
          
          // User Message (with text and/or image)
          const userMessageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
          if (typeof message === 'string' && message.trim()) {
            userMessageContent.push({ type: 'text', text: message });
          }
          if (typeof imageBase64 === 'string' && imageBase64.startsWith('data:image')) {
            // Validate base64 string if necessary, though OpenAI API will also validate
            userMessageContent.push({ type: 'image_url', image_url: { url: imageBase64 } });
          }
          
          if (userMessageContent.length === 0) {
             // Should be caught by validation, but as a safeguard:
            userMessageContent.push({type: 'text', text: '(User tried to send an empty message or invalid image)'});
          }
          messages.push({ role: 'user', content: userMessageContent });
          // --- End Construct Messages ---

          console.log(`[API Chat] Initial messages for OpenAI:`, JSON.stringify(messages, null, 2));

          // Structure to hold tool calls being built from deltas
          // type ToolCallInProgress = { id: string; name: string; arguments: string; index: number };
          let toolCallsInProgress: { [index: number]: { id?: string; name?: string; arguments: string} } = {};
          let assistantResponseWithMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam | null = null;

          // Loop to handle multiple OpenAI calls (initial + tool responses)
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const currentCompletion = await openai!.chat.completions.create({
              model: assistantConfig.model || "gpt-4o-mini", // Use model from assistant config or default
              messages: messages, // Send the latest state of messages
              stream: true,
              tools: mcpClient.getOpenAIToolDefinitions(),
              tool_choice: "auto",
            });

            let aggregatedAssistantResponse: {
              role: "assistant";
              content: string | null;
              tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
            } = {
              role: "assistant",
              content: null,
              tool_calls: []
            };
            toolCallsInProgress = {}; // Reset for each new completion stream

            for await (const chunk of currentCompletion) {
              // Text delta
              const textContent = chunk.choices[0]?.delta?.content;
              if (textContent) {
                sendEvent(controller, { type: 'text.delta', data: textContent });
                if (aggregatedAssistantResponse.content === null) aggregatedAssistantResponse.content = "";
                aggregatedAssistantResponse.content += textContent;
              }

              // Tool call delta
              if (chunk.choices[0]?.delta?.tool_calls) {
                for (const toolCallDelta of chunk.choices[0].delta.tool_calls) {
                  const index = toolCallDelta.index;
                  if (toolCallsInProgress[index] === undefined) {
                    toolCallsInProgress[index] = { arguments: "" };
                    // ID and Name usually come in the first delta for a tool_call
                    if (toolCallDelta.id) toolCallsInProgress[index].id = toolCallDelta.id;
                    if (toolCallDelta.function?.name) toolCallsInProgress[index].name = toolCallDelta.function.name;
                  }
                  
                  if (toolCallDelta.id && !toolCallsInProgress[index].id) {
                     toolCallsInProgress[index].id = toolCallDelta.id;
                  }
                  if (toolCallDelta.function?.name && !toolCallsInProgress[index].name) {
                     toolCallsInProgress[index].name = toolCallDelta.function.name;
                  }
                  if (toolCallDelta.function?.arguments) {
                    toolCallsInProgress[index].arguments += toolCallDelta.function.arguments;
                  }
                }
              }

              // Check for finish reason
              if (chunk.choices[0]?.finish_reason) {
                const finishReason = chunk.choices[0].finish_reason;
                console.log(`[API Chat] Finish reason: ${finishReason}`);

                if (finishReason === 'tool_calls') {
                  // Finalize tool calls for this step
                  const completeToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
                  for (const index in toolCallsInProgress) {
                    const tc = toolCallsInProgress[index];
                    if (tc.id && tc.name) {
                      completeToolCalls.push({
                        id: tc.id,
                        type: 'function',
                        function: { name: tc.name, arguments: tc.arguments }
                      });
                      // Send event about starting this specific tool call execution
                      sendEvent(controller, { type: 'tool.call.started', data: { toolCallId: tc.id, toolName: tc.name, argumentsString: tc.arguments } });
                      console.log(`[API Chat] Executing tool: ${tc.name} with ID: ${tc.id}, Args: ${tc.arguments}`);
                    }
                  }
                  aggregatedAssistantResponse.tool_calls = completeToolCalls;
                  
                  // Add assistant's full response (text + tool_calls) to messages history
                  if (aggregatedAssistantResponse.content || (aggregatedAssistantResponse.tool_calls && aggregatedAssistantResponse.tool_calls.length > 0) ) {
                     messages.push({ ...aggregatedAssistantResponse });
                  }


                  const toolResultMessages: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];
                  for (const toolCall of completeToolCalls) {
                    try {
                      const parsedArgs = JSON.parse(toolCall.function.arguments);
                      const result = await mcpClient.executeTool(toolCall.function.name, parsedArgs);
                      const resultString = typeof result === 'string' ? result : JSON.stringify(result);
                      
                      sendEvent(controller, { type: 'tool.call.result', data: { toolCallId: toolCall.id, toolName: toolCall.function.name, result } });
                      console.log(`[API Chat] Tool ${toolCall.function.name} (ID: ${toolCall.id}) executed. Result:`, result);
                      toolResultMessages.push({ tool_call_id: toolCall.id, role: 'tool', content: resultString });
                    } catch (error: any) {
                      console.error(`[API Chat] Error executing tool ${toolCall.function.name} (ID: ${toolCall.id}):`, error);
                      const errorMessage = error.message || "Error executing tool";
                      sendEvent(controller, { type: 'tool.call.result', data: { toolCallId: toolCall.id, toolName: toolCall.function.name, error: errorMessage } });
                      toolResultMessages.push({ tool_call_id: toolCall.id, role: 'tool', content: JSON.stringify({ error: errorMessage, details: error.stack }) });
                    }
                  }
                  messages.push(...toolResultMessages); // Add all tool results to messages
                  
                  // Reset for next iteration of the while loop (which will call OpenAI again)
                  aggregatedAssistantResponse = { role: "assistant", content: null, tool_calls: [] };
                  toolCallsInProgress = {};
                  break; // Breaks inner for-await, continues while loop for next OpenAI call
                
                } else if (finishReason === 'stop') {
                  // Assistant finished without calling tools, or after tool calls
                  if (aggregatedAssistantResponse.content) { // Ensure there's content to push
                    messages.push({ role: "assistant", content: aggregatedAssistantResponse.content }); // Push final assistant text if any
                  }
                  sendEvent(controller, { type: 'text.completed' });
                  sendEvent(controller, { type: 'stream.ended', data: { clientThreadId } });
                  console.log("[API Chat] Stream ended due to 'stop' finish reason.");
                  controller.close();
                  return; // Exit the start function
                }
              }
            } // End of for-await loop for stream chunks
            
            // If the for-await loop finishes without a break (e.g. tool_calls) or return (e.g. stop)
            // it implies the stream ended without a clear finish_reason from the last chunk.
            // This can happen if the stream is unexpectedly cut.
            if (chunk.choices[0]?.finish_reason !== 'tool_calls' && chunk.choices[0]?.finish_reason !== 'stop') {
                 console.warn("[API Chat] OpenAI stream finished without a 'stop' or 'tool_calls' finish reason in the last chunk processing.");
                 // If there was any aggregated content, ensure it's added before ending.
                 if (aggregatedAssistantResponse.content && !messages.find(m => m.role === 'assistant' && m.content === aggregatedAssistantResponse.content)) {
                    messages.push({ role: "assistant", content: aggregatedAssistantResponse.content });
                 }
                 sendEvent(controller, { type: 'stream.ended', data: { clientThreadId, warning: 'Stream ended without explicit stop.' } });
                 controller.close();
                 return; // Exit the start function
            }
            // Implicitly continue while loop if finish_reason was 'tool_calls'
          } // End of while(true) loop for handling multiple OpenAI calls

        } catch (error: any) {
          console.error("[API Chat] Error within ReadableStream:", error);
          let errorMessage = "Internal server error during stream.";
                controller.close();
                return;
              }
            }
          } // End of for-await loop for stream chunks

          console.warn("[API Chat] OpenAI stream finished without a 'stop' or 'tool_calls' finish reason in the last chunk.");
          sendEvent(controller, { type: 'stream.ended', data: { clientThreadId, warning: 'Stream ended unexpectedly.' } });
          controller.close();

        } catch (error: any) {
          console.error("[API Chat] Error within ReadableStream:", error);
          let errorMessage = "Internal server error during stream.";
          if (error instanceof OpenAI.APIError) {
            errorMessage = `OpenAI API Error: ${error.status} ${error.name} ${error.message}`;
            console.error(`[API Chat] OpenAI API Error Details: status=${error.status}, type=${error.type}, code=${error.code}, param=${error.param}`);
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          try {
            sendEvent(controller, { type: 'error', data: { message: errorMessage, details: error.toString() } });
            sendEvent(controller, { type: 'stream.ended', error: errorMessage });
          } catch (e) { /* controller might be already closed or in error state */ }
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });

  } catch (error: any) {
    console.error('[API Chat] Unhandled error in POST /api/chat:', error);
    const reportableError = error.message || "Unknown internal server error";
    return NextResponse.json({ error: 'Internal Server Error', details: reportableError }, { status: 500 });
  }
}
