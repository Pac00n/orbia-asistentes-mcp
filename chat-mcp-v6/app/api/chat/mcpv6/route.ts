import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

interface McpServer {
  id: string;
  url: string;
  auth_type?: "bearer" | "none";
  api_key_env_var?: string;
}

function buildTools(): any[] {
  const cfg = JSON.parse(process.env.MCP_SERVERS_CONFIG ?? "[]") as McpServer[];
  return cfg.map((s) => {
    const tool: any = {
      type: "mcp",
      server_label: s.id,
      server_url: s.url,
      require_approval: "never",
    };
    if (s.auth_type === "bearer" && s.api_key_env_var) {
      const key = process.env[s.api_key_env_var as keyof NodeJS.ProcessEnv];
      if (key) tool.headers = { Authorization: `Bearer ${key}` };
    }
    return tool;
  });
}

const openai = new OpenAI();

export async function POST(req: NextRequest) {
  const { userPrompt = "" } = await req.json();
  const tools = buildTools();
  console.log("Tools being sent:\n", JSON.stringify(tools, null, 2));
  const resp = await openai.responses.create({
    model: "gpt-4o",
    input: userPrompt,
    tools,
    stream: true,
  });
  return new NextResponse(resp.output);
}
