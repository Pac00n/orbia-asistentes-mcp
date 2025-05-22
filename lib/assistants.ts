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
  openaiAssistantId?: string; // ID del Asistente de OpenAI (opcional)
  name: string;
  shortDescription: string;
  description: string;
  iconType: LucideIcon; 
  bgColor: string; 
};

// Lista de asistentes disponibles
export const assistants: Assistant[] = [
  {
    id: "dall-e-images",
    openaiAssistantId: "asst_ABC123DEF456GHI789", // Reemplaza con tu ID real
    name: "Generador de Imágenes",
    shortDescription: "Crea imágenes a partir de descripciones (OpenAI).",
    description: "Utiliza DALL·E a través de la API de Asistentes de OpenAI para generar imágenes únicas basadas en tus indicaciones de texto.",
    iconType: ImageIcon,
    bgColor: "bg-indigo-600",
  },
  {
    id: "general-assistant",
    openaiAssistantId: "asst_XYZ987UVW654RST123", // Reemplaza con tu ID real
    name: "Asistente General",
    shortDescription: "Responde preguntas y realiza tareas (OpenAI).",
    description: "Un asistente conversacional general potenciado por GPT a través de la API de Asistentes. Puede responder preguntas, resumir texto, traducir y más.",
    iconType: MessageSquare,
    bgColor: "bg-green-600",
  },
  {
    id: "asistente-senalizacion", 
    openaiAssistantId: "asst_MXuUc0TcV7aPYkLGbN5glitq", // ID real del asistente OpenAI
    name: "Asistente de Señalización", 
    shortDescription: "Identifica y explica señales de tráfico (OpenAI).",
    description: "Proporciona información sobre señales de tráfico a partir de imágenes o descripciones. Utiliza un asistente de OpenAI especializado.", 
    iconType: TrafficCone, 
    bgColor: "bg-yellow-600", 
  },
  {
    id: "mcp-test-assistant", 
    openaiAssistantId: "asst_aB9vQf9JCz7lJL1bzZKcCM1c", // ID real del nuevo asistente OpenAI para MCP
    name: "Pruebas MCP V2", // <--- CAMBIO DE NOMBRE
    shortDescription: "Asistente V2 para probar MCP.", // <--- CAMBIO DE DESC. CORTA
    description: "Este asistente está configurado para probar herramientas y capacidades a través de MCP. No tiene instrucciones predefinidas.", 
    iconType: Bot, // Usamos un ícono genérico de Bot
    bgColor: "bg-blue-600", // Un color distintivo
  },
];

// Función para obtener un asistente por su ID (de nuestra lista interna)
export const getAssistantById = (id: string): Assistant | undefined => {
  return assistants.find((assistant) => assistant.id === id);
};
