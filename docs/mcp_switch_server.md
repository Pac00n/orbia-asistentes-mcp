
## Probar con otro servidor MCP (si tu DNS sigue fallando)

Si cambiar DNS o vaciar caché no es viable ahora mismo, apunta tu variable de entorno a un host que **sí resuelva** en tu red.

```dotenv
# Ejemplo sin autenticación
MCP_SERVER_URL=https://fs-demo.mcpservers.org/mcp
```

### 1. Verificar que resuelve y está vivo

```bash
nslookup fs-demo.mcpservers.org
curl -s https://fs-demo.mcpservers.org/mcp | jq .tools
```

*Si `jq` devuelve la lista de herramientas, el servidor está accesible.*

### 2. Reiniciar tu aplicación

```bash
pnpm dev   # o npm run dev
```

Vuelve a chatear: tu flujo MCP debería funcionar igual que con el servidor local, sólo que contra el nuevo endpoint.

### 3. Alternativas rápidas (sin token)

| Dominio | Notas |
|---------|-------|
| `https://demo.mcp.tools/fetch/mcp` | Sólo la tool `fetch` |
| `https://git.mcpservers.org/mcp`   | Herramientas de Git mirror readonly |
| `https://puppeteer.cloud.mcp/mcp`  | Navegación y screenshots |

Cambia la URL en `MCP_SERVER_URL` y repite la verificación `curl`.

### 4. Volver al servidor deseado

Cuando soluciones tu DNS o red, restablece:

```dotenv
MCP_SERVER_URL=https://demo.mcp.tools/everything/mcp
```

Reinicia la app y prueba de nuevo. Si la resolución ya funciona, el flujo MCP externo operará sin tocar nada más de tu código.
