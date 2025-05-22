# Instrucciones para Desplegar en Vercel

Este documento proporciona instrucciones detalladas para desplegar la aplicación en Vercel, manteniendo la configuración de simulación local pero permitiendo conexiones a servidores MCP reales en producción.

## Opción 1: Despliegue a través de GitHub (Recomendado)

1. **Limpieza de Repositorio**:
   Antes de subir el código a GitHub, asegúrate de eliminar cualquier clave API o información sensible:
   
   ```bash
   # Eliminar todas las claves API de los archivos
   # Busca en python_example_images/app.py, env-template*.txt, etc.
   ```

2. **Configuración en Vercel**:
   
   a. Conecta tu repositorio de GitHub a Vercel
   b. Durante la configuración, añade las siguientes variables de entorno:
   
   ```
   OPENAI_API_KEY=tu_clave_api_real_para_produccion
   MCP_FORCE_REAL=true
   MCP_SERVERS_CONFIG=[{"id":"fs-demo","url":"https://fs-demo.mcpservers.org/mcp","name":"MCP FS Demo"},{"id":"git","url":"https://git.mcpservers.org/mcp","name":"Git Mirror ReadOnly"},{"id":"fetch","url":"https://demo.mcp.tools/fetch/mcp","name":"Fetch Tool"}]
   ```

## Opción 2: Despliegue Directo con Vercel CLI

Si tienes problemas para hacer push a GitHub debido a protecciones de clave API, puedes desplegar directamente usando Vercel CLI:

1. **Instalar Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Iniciar Sesión**:
   ```bash
   vercel login
   ```
   Sigue las instrucciones para iniciar sesión con tu cuenta de Vercel.

3. **Configurar Variables de Entorno**:
   Crea un archivo `.vercel.json` en la raíz del proyecto (este archivo está en .gitignore y no se subirá a GitHub):
   
   ```json
   {
     "env": {
       "OPENAI_API_KEY": "tu_clave_api_real_para_produccion",
       "MCP_FORCE_REAL": "true",
       "MCP_SERVERS_CONFIG": "[{\"id\":\"fs-demo\",\"url\":\"https://fs-demo.mcpservers.org/mcp\",\"name\":\"MCP FS Demo\"},{\"id\":\"git\",\"url\":\"https://git.mcpservers.org/mcp\",\"name\":\"Git Mirror ReadOnly\"},{\"id\":\"fetch\",\"url\":\"https://demo.mcp.tools/fetch/mcp\",\"name\":\"Fetch Tool\"}]"
     }
   }
   ```

4. **Desplegar**:
   ```bash
   vercel
   ```
   
   Sigue las instrucciones en pantalla para completar el despliegue.

## Verificación del Despliegue

Una vez desplegada la aplicación:

1. Visita la URL proporcionada por Vercel
2. Verifica en los logs de Vercel que:
   - El cliente MCP está intentando conectarse a los servidores reales
   - No hay errores de conexión (o si los hay, están relacionados con los servidores MCP y no con la configuración)
   - La interfaz muestra correctamente el número de herramientas disponibles

## Resolución de Problemas

Si encuentras problemas durante el despliegue:

1. **Errores de Variables de Entorno**:
   - Verifica que las variables de entorno estén correctamente configuradas en el panel de Vercel
   - Asegúrate de que `MCP_SERVERS_CONFIG` tenga el formato JSON correcto

2. **Errores de Conexión MCP**:
   - Verifica que los servidores MCP estén disponibles
   - Prueba con otros servidores MCP si los configurados no responden

3. **Problemas con el Modelo de OpenAI**:
   - Si hay errores de autenticación, verifica que la clave API sea válida y tenga permisos para el modelo configurado
   - Si es necesario, cambia temporalmente a `gpt-3.5-turbo` para las pruebas iniciales
