# Investigación sobre Model Context Protocol (MCP)

## Definición y Propósito

El Model Context Protocol (MCP) es un protocolo abierto que estandariza cómo las aplicaciones proporcionan contexto a los modelos de lenguaje (LLMs). Se puede considerar como un "puerto USB-C para aplicaciones de IA": así como USB-C proporciona una forma estandarizada de conectar dispositivos a diversos periféricos y accesorios, MCP proporciona una forma estandarizada de conectar modelos de IA con diferentes fuentes de datos y herramientas.

## Arquitectura General

MCP utiliza mensajes JSON-RPC 2.0 para establecer comunicación entre:

- **Hosts**: Aplicaciones LLM que inician conexiones
- **Clientes**: Conectores dentro de la aplicación host
- **Servidores**: Servicios que proporcionan contexto y capacidades

### Tipos de Servidores MCP

La especificación MCP define dos tipos de servidores, basados en el mecanismo de transporte que utilizan:

1. **Servidores stdio**: Funcionan como un subproceso de la aplicación principal. Se pueden considerar como "locales".
2. **Servidores HTTP sobre SSE (Server-Sent Events)**: Funcionan de forma remota. La conexión se realiza a través de una URL.

## Características Principales

Los servidores MCP ofrecen las siguientes características a los clientes:

- **Recursos**: Contexto y datos, para que el usuario o el modelo de IA los utilice
- **Prompts**: Mensajes y flujos de trabajo plantilla para los usuarios
- **Herramientas**: Funciones que el modelo de IA puede ejecutar

Los clientes pueden ofrecer la siguiente característica a los servidores:

- **Sampling**: Comportamientos agénticos iniciados por el servidor e interacciones LLM recursivas

### Utilidades Adicionales

- Configuración
- Seguimiento de progreso
- Cancelación
- Informes de errores
- Registro (logging)

## Seguridad y Confianza

El protocolo MCP habilita capacidades poderosas a través de acceso arbitrario a datos y rutas de ejecución de código. Con este poder vienen consideraciones importantes de seguridad y confianza que todos los implementadores deben abordar cuidadosamente.

### Principios Clave

1. **Consentimiento y Control del Usuario**
   - Los usuarios deben consentir explícitamente y entender todo el acceso a datos y operaciones
   - Los usuarios deben mantener control sobre qué datos se comparten y qué acciones se toman
   - Los implementadores deben proporcionar interfaces claras para revisar y autorizar actividades

2. **Privacidad de Datos**
   - Los hosts deben obtener consentimiento explícito del usuario antes de exponer datos a servidores
   - Los hosts no deben transmitir datos de recursos a otros lugares sin consentimiento del usuario
   - Los datos del usuario deben protegerse con controles de acceso apropiados

3. **Seguridad de Herramientas**
   - Las herramientas representan ejecución arbitraria de código y deben tratarse con precaución
   - Los hosts deben obtener consentimiento explícito del usuario antes de invocar cualquier herramienta
   - Los usuarios deben entender lo que hace cada herramienta antes de autorizar su uso

4. **Controles de Sampling de LLM**
   - Los usuarios deben aprobar explícitamente cualquier solicitud de sampling de LLM
   - Los usuarios deben controlar si el sampling ocurre, el prompt que se enviará y qué resultados puede ver el servidor

## Implementaciones y SDKs

MCP cuenta con implementaciones en varios lenguajes de programación:

- Python SDK
- TypeScript SDK
- Java SDK
- Kotlin SDK
- C# SDK
- Swift SDK

## Integración con Plataformas Existentes

MCP está siendo adoptado por varias plataformas de IA:

- **Anthropic**: Integración con Claude y Claude Desktop
- **OpenAI**: Soporte a través del SDK de OpenAI Agents
- **Cursor**: Integración para conectar con sistemas externos y fuentes de datos

## Referencias

- [Especificación oficial de MCP](https://modelcontextprotocol.io/specification/2025-03-26)
- [Documentación de MCP en Anthropic](https://docs.anthropic.com/en/docs/agents-and-tools/mcp)
- [Integración de MCP en OpenAI Agents SDK](https://openai.github.io/openai-agents-python/mcp/)
- [Repositorio oficial en GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol)
