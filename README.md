# Plataforma de Asistentes IA con Integración MCP

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/pac0ns-projects/orbia-asistentes-mcp)

## Descripción

Este proyecto integra el Protocolo de Contexto de Modelo (MCP) para proporcionar herramientas avanzadas a los asistentes de IA. La integración permite que los modelos de lenguaje accedan a funciones externas como búsqueda web, procesamiento de imágenes y más.

## Características

- Integración completa con MCP (Model Context Protocol)
- Soporte para múltiples servidores MCP
- Modo de simulación para desarrollo local
- Despliegue optimizado para Vercel
- Interfaz de usuario moderna y responsiva

## Configuración Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
# Copiar .env.local.example a .env.local y configurar

# Iniciar servidor de desarrollo
npm run dev
```

## Despliegue en Vercel

Para desplegar en producción, configure las siguientes variables de entorno en Vercel:

```
OPENAI_API_KEY=su_clave_api_real
MCP_FORCE_REAL=true
MCP_SERVERS_CONFIG=[{"id":"fs-demo","url":"https://fs-demo.mcpservers.org/mcp","name":"MCP FS Demo"},{"id":"git","url":"https://git.mcpservers.org/mcp","name":"Git Mirror ReadOnly"},{"id":"fetch","url":"https://demo.mcp.tools/fetch/mcp","name":"Fetch Tool"}]
```

## Documentación

Consulte la carpeta `docs/implementacion-mcp-mayo2025/` para obtener documentación detallada sobre la implementación y configuración.