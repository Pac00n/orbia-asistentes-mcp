"use client"

import React from "react";
import { LucideProps, HelpCircle } from "lucide-react"; // Importar HelpCircle para fallback

interface IconRendererProps {
  // Cambiado de string a React.ElementType
  iconType: React.ElementType;
  className?: string;
  size?: number;
}

export function IconRenderer({ iconType: IconComponent, className = "", size = 24 }: IconRendererProps) {
  // Ya no necesitamos convertir el nombre, recibimos el componente directamente.
  // Renombramos iconType a IconComponent para usarlo como JSX Tag.

  // Validar si el componente es válido, si no usar fallback.
  const RenderIcon = typeof IconComponent === 'function' ? IconComponent : HelpCircle;

  return <RenderIcon className={className} size={size} />;
}
