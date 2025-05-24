// lib/assistants.ts

import {
  Bot, 
  Code, 
  Database, 
  FileText, 
  Image as ImageIcon, 
  Paintbrush, 
  Calculator, 
  FlaskConical, 
  Globe, 
  MessageSquare, 
  TrafficCone, 
  LucideIcon, 
} from "lucide-react";

// Define la estructura de un asistente
export type Assistant = {
  id: string; 
  openaiAssistantId?: string; // ID del Asistente de OpenAI (opcional, menos relevante para Chat Completions)
  name: string;
  shortDescription: string;
  description: string;
  instructions?: string; // Instrucciones para el System Prompt en Chat Completions
  model?: string; // Modelo de OpenAI a usar (e.g., "gpt-4o-mini", "gpt-4-turbo")
  iconType: LucideIcon; 
  bgColor: string; 
};

// Lista de asistentes disponibles
export const assistants: Assistant[] = [
  {
    id: "dall-e-images",
    openaiAssistantId: "asst_ABC123DEF456GHI789", // Conservado por si se usa en otro lado, pero no para Chat Completions directas
    name: "Generador de Imágenes",
    shortDescription: "Crea imágenes a partir de descripciones.",
    description: "Utiliza DALL·E para generar imágenes únicas basadas en tus indicaciones de texto. Este asistente coordina la generación de imágenes.",
    instructions: "Utiliza DALL·E para generar imágenes únicas basadas en tus indicaciones de texto. Este asistente coordina la generación de imágenes.", // Copiado de description
    model: "gpt-4o-mini", // Modelo para orquestar, DALL-E es la herramienta subyacente
    iconType: ImageIcon,
    bgColor: "bg-indigo-600",
  },
  {
    id: "general-assistant",
    openaiAssistantId: "asst_XYZ987UVW654RST123", // Conservado
    name: "Asistente General",
    shortDescription: "Responde preguntas y realiza tareas.",
    description: "Un asistente conversacional general potenciado por GPT. Puede responder preguntas, resumir texto, traducir y más.",
    instructions: "Un asistente conversacional general potenciado por GPT. Puede responder preguntas, resumir texto, traducir y más.", // Copiado de description
    model: "gpt-4o-mini",
    iconType: MessageSquare,
    bgColor: "bg-green-600",
  },
  {
    id: "asistente-senalizacion", 
    openaiAssistantId: "asst_MXuUc0TcV7aPYkLGbN5glitq", // ID real del asistente OpenAI
    name: "Asistente de Señalización", 
    shortDescription: "Identifica y explica señales de tráfico.",
    description: "Proporciona información sobre señales de tráfico a partir de imágenes o descripciones. Utiliza un asistente de OpenAI especializado.", 
    instructions: "Proporciona información sobre señales de tráfico a partir de imágenes o descripciones. Utiliza un asistente de OpenAI especializado.", // Tarea Específica
    model: "gpt-4o-mini", // Tarea Específica
    iconType: TrafficCone, 
    bgColor: "bg-yellow-600", 
  },
  {
    id: "mcp-test-assistant", 
    openaiAssistantId: "asst_aB9vQf9JCz7lJL1bzZKcCM1c", // ID real del nuevo asistente OpenAI para MCP
    name: "Pruebas MCP V2", 
    shortDescription: "Asistente V2 para probar MCP.", 
    description: "Este asistente está configurado para probar herramientas y capacidades a través de MCP. No tiene instrucciones predefinidas explícitas aquí, usará el default o las que provea el sistema que lo llama.", 
    instructions: "Este asistente está configurado para probar herramientas y capacidades a través de MCP. No tiene instrucciones predefinidas explícitas aquí, usará el default o las que provea el sistema que lo llama.", // Copiado de description
    model: "gpt-4o-mini",
    iconType: Bot, 
    bgColor: "bg-blue-600", 
  },
];

// Función para obtener un asistente por su ID (de nuestra lista interna)
export const getAssistantById = (id: string): Assistant | undefined => {
  return assistants.find((assistant) => assistant.id === id);
};
