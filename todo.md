# Integración de servidores MCP en asistentes-ia-v02

## Tareas

### Preparación y análisis
- [x] Clonar repositorio y cambiar a rama limpio
- [x] Analizar documentación relevante en docs/
  - [x] Revisar arquitectura_recomendada.md
  - [x] Revisar integracion_openai.md
  - [x] Revisar mcp_external_servers.md
  - [ ] Revisar ejemplos_patrones.md
  - [ ] Revisar investigacion_mcp.md
  - [ ] Revisar documentos mcp_fase1_*
  - [ ] Revisar carpeta implementacion-mcp-mayo2025
- [x] Identificar convenciones y ejemplos de OpenAI API
- [x] Determinar dónde registrar los servidores MCP

### Implementación
- [x] Crear rama feat/mcp-preview
- [x] Configurar servicio de preview deploy
- [x] Añadir variables de entorno seguras
- [x] Seleccionar e integrar servidores MCP
  - [x] Zapier MCP
  - [x] Activepieces MCP
  - [x] Brave Search MCP
  - [x] Web-Search MCP
  - [ ] (Opcional) Google Workspace MCP
- [x] Implementar cliente MCP en el código del bot
  - [ ] Brave Search MCP
  - [ ] Web-Search MCP
  - [ ] (Opcional) Google Workspace MCP
- [ ] Implementar cliente MCP en el código del bot

### Pruebas
- [ ] Realizar pruebas manuales
  - [ ] Búsqueda web
  - [ ] Gmail
  - [ ] Calendar

### Documentación y entrega
- [ ] Crear docs/mcp-preview.md
- [ ] Abrir PR contra rama limpio
- [ ] Verificar checklist final
