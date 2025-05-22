# Migración a Repositorio Limpio y Despliegue en Vercel

Este documento describe el proceso de migración a un repositorio limpio (sin claves API en el historial) y la configuración para el despliegue en Vercel.

## Problema Inicial

El repositorio original contenía claves API en el historial de commits, lo que activaba las protecciones de seguridad de GitHub y bloqueaba los push.

```
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - GITHUB PUSH PROTECTION
remote:       —— OpenAI API Key ————————————————————————————————————
```

## Solución Implementada

### 1. Creación de Rama Huérfana

Para evitar los problemas con el historial de commits, se creó una rama huérfana sin historial:

```bash
# Crear una rama huérfana nueva
git checkout --orphan limpio

# Confirmar que estamos en la rama correcta
git branch
```

### 2. Configuración del .gitignore

Se aseguró que el archivo `.gitignore` excluyera correctamente los archivos sensibles:

```
# local env files
.env*.local
env-template*.txt

# archivos con posibles claves API
python_example_images/app.py
```

### 3. Creación de Nuevo Repositorio en GitHub

Se creó un nuevo repositorio en GitHub:

- URL: https://github.com/Pac00n/orbia-asistentes-mcp

### 4. Configuración de Remote para el Nuevo Repositorio

Se configuró el nuevo repositorio como un remoto adicional:

```bash
# Añadir el nuevo repositorio como remoto
git remote add nuevo-origen https://github.com/Pac00n/orbia-asistentes-mcp.git

# Verificar remotos configurados
git remote -v
```

### 5. Commit y Push Inicial

Se realizó un commit inicial con todos los archivos limpios:

```bash
# Hacer commit de todos los archivos (excluyendo los sensibles gracias a .gitignore)
git commit -m "Versión inicial limpia sin historial"

# Push al nuevo repositorio como rama principal
git push nuevo-origen limpio:main
```

### 6. Pruebas de Funcionamiento

Se realizaron pruebas para verificar que el sistema siguiera funcionando correctamente:

1. Inicio del servidor de desarrollo
2. Verificación de la carga de servidores MCP
3. Prueba de herramientas con simulación local
4. Confirmación de respuestas correctas

### 7. Actualización de Documentación

Se actualizó el README.md para reflejar la nueva información del proyecto:

```bash
git add README.md
git commit -m "Actualizar README con información de integración MCP"
git push nuevo-origen limpio:main
```

## Configuración en Vercel

### 1. Conexión del Repositorio en Vercel

Vercel se configuró para desplegar desde el nuevo repositorio limpio:
- Repositorio: https://github.com/Pac00n/orbia-asistentes-mcp

### 2. Variables de Entorno en Vercel

Es crucial configurar las siguientes variables de entorno en Vercel para el funcionamiento correcto en producción:

```
OPENAI_API_KEY=tu_clave_api_real_para_produccion
MCP_FORCE_REAL=true
MCP_SERVERS_CONFIG=[{"id":"fs-demo","url":"https://fs-demo.mcpservers.org/mcp","name":"MCP FS Demo"},{"id":"git","url":"https://git.mcpservers.org/mcp","name":"Git Mirror ReadOnly"},{"id":"fetch","url":"https://demo.mcp.tools/fetch/mcp","name":"Fetch Tool"}]
```

## Flujo de Trabajo Futuro

Para continuar el desarrollo:

1. Trabajar en la rama `limpio` del repositorio local
2. Hacer commits normalmente
3. Push al nuevo repositorio usando:
   ```bash
   git push nuevo-origen limpio:main
   ```
4. Vercel detectará automáticamente los cambios y desplegará la nueva versión

## Verificación del Despliegue

Después de cada despliegue, es importante verificar:

1. Que la aplicación se inicie correctamente
2. Que la configuración de MCP se cargue con `MCP_FORCE_REAL=true`
3. Que se intente la conexión a servidores MCP reales
4. Que las herramientas MCP funcionen en producción

## Resolución de Problemas

Si hay problemas con el despliegue:

1. Verificar los logs de Vercel para identificar errores
2. Comprobar que las variables de entorno estén correctamente configuradas
3. Verificar la conexión a los servidores MCP reales
4. Si es necesario, cambiar temporalmente a `MCP_FORCE_REAL=false` para diagnosticar problemas
