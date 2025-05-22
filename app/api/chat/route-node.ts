// app/api/chat/route-node.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  console.log("--- SIMPLIFIED ROUTE-NODE.TS --- V6 --- POST request received ---");

  try {
    const body = await req.json().catch(() => ({})); // Intenta parsear, pero no falla si está vacío o no es JSON
    console.log("--- SIMPLIFIED ROUTE-NODE.TS --- V6 --- Request body:", body);
    
    return NextResponse.json(
      {
        message: "Hello from simplified route-node.ts V6!",
        received_assistant_id: body.assistantId || "not_provided",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("--- SIMPLIFIED ROUTE-NODE.TS --- V6 --- Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Error in simplified route-node.ts V6",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Podríamos añadir un handler GET simple también para probar la ruta
export async function GET(req: Request) {
  console.log("--- SIMPLIFIED ROUTE-NODE.TS --- V6 --- GET request received ---");
  return NextResponse.json(
    {
      message: "Hello GET from simplified route-node.ts V6!",
    },
    { status: 200 }
  );
el que funciona bien con el asistente es route.ts}
