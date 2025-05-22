# Ideas para Mejoras Futuras - MCP v5

## 1. Interfaz de Autenticación OAuth

**Objetivo**: Crear un espacio en la interfaz para conectar con servicios que requieren OAuth o credenciales específicas.

**Implementación propuesta**:
- Añadir una sección "Conectar servicios" en la interfaz del chat MCP v5
- Incluir botones para iniciar el flujo de autenticación con distintos servicios:
  - Google (Gmail, Drive, Calendar)
  - Microsoft (Outlook, OneDrive)
  - Slack
  - Notion
  - Otros servicios populares
- Diseñar una página de callback para recibir y procesar tokens OAuth
- Implementar almacenamiento seguro de tokens (encriptados) en base de datos
- Mostrar visualmente qué servicios están conectados y permitir desconexión

**Beneficios**:
- Acceso real a los datos del usuario en lugar de simulaciones
- Experiencia personalizada y contextualizada
- Mayor utilidad del asistente al interactuar con datos reales

## 2. Recuperar Interfaz de Chat y Asistente de Señalización

**Objetivo**: Implementar la interfaz de chat y la funcionalidad del asistente de señalización del commit [fa06d5a81ed4541fc9118891fdde0cd6ea04c64a](https://github.com/Pac00n/asistentes-ia-v02/commit/fa06d5a81ed4541fc9118891fdde0cd6ea04c64a), añadiendo las mejoras del martillo con contador de herramientas.

**Elementos a recuperar**:
- Diseño responsivo con barra lateral
- Historial de chats persistente
- Formato de mensajes mejorado
- Indicadores visuales de proceso
- Gestión de errores con feedback visual
- **Funcionalidad completa del asistente de señalización**
  - Sistema de notificaciones visuales
  - Indicadores de procesamiento
  - Flujos de trabajo de señalización

**Mejoras a incorporar**:
- Icono de martillo con contador de herramientas disponibles
- Menú desplegable para visualizar herramientas
- Almacenamiento de configuraciones de usuario
- Modo oscuro/claro persistente
- Integración mejorada entre la señalización y las herramientas MCP

## 3. Selector de Herramientas Forzadas

**Objetivo**: Implementar un desplegable en el icono del martillo que permita al usuario forzar el uso de herramientas específicas.

**Funcionalidad propuesta**:
- Añadir opción "Forzar herramienta" en el menú desplegable del martillo
- Listar todas las herramientas disponibles con descripción breve
- Permitir seleccionar una herramienta para la siguiente consulta
- Indicador visual de herramienta forzada activa
- Opción para desactivar el forzado de herramienta

**Implementación técnica**:
- Modificar la API para aceptar un parámetro `forcedTool` en las solicitudes
- Implementar lógica en el backend que priorice la herramienta forzada:
  ```typescript
  // En route.ts
  if (req.body.forcedTool) {
    console.log(`Forzando uso de herramienta: ${req.body.forcedTool}`);
    // Redirigir cualquier intento de usar otra herramienta a la forzada
    if (toolName !== req.body.forcedTool) {
      console.log(`Redirigiendo de ${toolName} a ${req.body.forcedTool}`);
      toolName = req.body.forcedTool;
    }
  }
  ```
- Añadir un estado en el frontend para rastrear la herramienta forzada actual

## 4. Separación de Asistentes en Página Principal

**Objetivo**: Reorganizar la página principal de asistentes para separar claramente los asistentes especializados de los asistentes MCP.

**Implementación propuesta**:
- Crear secciones distintas en la página principal:
  - "Asistentes Especializados" - Para asistentes con funciones específicas (señalización, legal, etc.)
  - "Asistentes MCP" - Para asistentes con acceso a herramientas externas
- Utilizar elementos visuales diferenciadores:
  - Iconografía específica para cada tipo
  - Esquemas de color distintos
  - Badges o etiquetas identificativas
- Implementar filtros de búsqueda y categorización
- Permitir favoritos o accesos rápidos personalizados

**Beneficios**:
- Mayor claridad para el usuario sobre las capacidades de cada asistente
- Experiencia de usuario mejorada y más intuitiva
- Escalabilidad para añadir nuevas categorías de asistentes en el futuro

## 5. Ideas Adicionales

### Historial de Herramientas Utilizadas
- Mostrar un registro de qué herramientas se han utilizado en cada conversación
- Estadísticas de uso de herramientas

### Configuración de Preferencias de Herramientas
- Permitir al usuario priorizar ciertas herramientas sobre otras
- Desactivar herramientas específicas que no desee utilizar

### Mejora de Simulaciones
- Permitir al usuario proporcionar datos de ejemplo para mejorar las simulaciones
- Opción para alternar entre datos reales y simulados para pruebas

### Integración con Plugins de Navegador
- Extensión de navegador que permita al asistente acceder al contenido de la página actual
- Acciones contextuales basadas en el contenido del navegador

## Próximos Pasos Recomendados

1. Priorizar la implementación de autenticación OAuth para servicios clave
2. Recuperar la interfaz de chat y la funcionalidad del asistente de señalización
3. Reorganizar la página principal separando asistentes especializados y MCP
4. Implementar el selector de herramientas forzadas
5. Probar exhaustivamente con usuarios reales
6. Iterar basado en feedback de usuarios
