# Configuración para Producción en Vercel

## Enfoque Recomendado

Para mantener la configuración de desarrollo local (con simulación) y a la vez permitir que la aplicación funcione correctamente en producción con Vercel, utilizaremos variables de entorno específicas para cada entorno.

## Configuración en Vercel

Sigue estos pasos para configurar las variables de entorno en Vercel:

1. Inicia sesión en tu [Dashboard de Vercel](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a "Settings" → "Environment Variables"
4. Añade las siguientes variables:

   ```
   OPENAI_API_KEY=tu_clave_api_real
   MCP_FORCE_REAL=true
   MCP_SERVERS_CONFIG=[{"id":"fs-demo","url":"https://fs-demo.mcpservers.org/mcp","name":"MCP FS Demo"},{"id":"git","url":"https://git.mcpservers.org/mcp","name":"Git Mirror ReadOnly"},{"id":"fetch","url":"https://demo.mcp.tools/fetch/mcp","name":"Fetch Tool"}]
   ```

5. Haz clic en "Save" para guardar las variables

## Ventajas de este Enfoque

1. **Sin bifurcación de código**: No necesitas mantener ramas diferentes para desarrollo y producción
2. **Configuración limpia**: Las variables de entorno están separadas por entorno
3. **Fácil mantenimiento**: Los cambios en el código se aplican a ambos entornos
4. **Seguridad**: Las claves API y configuraciones sensibles se mantienen en Vercel, no en el código

## Verificación de la Configuración

Después de implementar la aplicación en Vercel:

1. Verifica en los logs de Vercel que el cliente MCP está intentando conectarse a los servidores reales
2. Confirma que aparece un mensaje indicando que la configuración se ha cargado correctamente
3. Prueba la funcionalidad para asegurarte de que las herramientas MCP funcionan como se espera

## Depuración en Producción

Si encuentras problemas con los servidores MCP en producción:

1. Verifica los logs en el panel de Vercel
2. Asegúrate de que Vercel pueda acceder a los dominios de los servidores MCP (no debería haber problemas de DNS)
3. Confirma que `MCP_FORCE_REAL=true` está correctamente configurado
4. Verifica que la clave API de OpenAI es válida y tiene permisos suficientes

## Alternativas Consideradas

### Opción 1: Ramas Git separadas

Podrías mantener dos ramas: `development` (con simulación) y `production` (con conexiones reales). Sin embargo, esto complicaría el mantenimiento y podría llevar a divergencias en el código.

### Opción 2: Detectar el entorno en el código

Podrías modificar el código para detectar automáticamente si está en Vercel y usar una configuración diferente. Esto añadiría complejidad y lógica condicional al código.

### Opción 3: Configuración manual en cada despliegue

Podrías cambiar manualmente el archivo `.env.local` antes de cada despliegue. Esto es propenso a errores y no es una buena práctica de CI/CD.

## Recomendación Final

El enfoque de variables de entorno en Vercel es la solución más limpia y mantenible. Te permite conservar tu configuración local para desarrollo mientras aseguras que la aplicación funciona correctamente en producción sin necesidad de cambios en el código.
