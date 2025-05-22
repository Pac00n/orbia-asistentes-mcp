
# 🌐 Servidores MCP públicos / recomendados

| Categoría | URL base (`/mcp`) | ¿Token? | Herramientas principales |
|-----------|-------------------|---------|--------------------------|
| Demo «everything» | https://demo.mcp.tools/everything/mcp | No | echo, fetch, git, sqlite, puppeteer, ffmpeg, etc. |
| Demo solo fetch | https://demo.mcp.tools/fetch/mcp | No | fetch |
| Búsqueda Brave | https://search.bravesoftware.com/mcp | Sí (Brave key) | braveSearch |
| Búsqueda Tavily | https://tavily.io/mcp | Sí (Tavily key) | tavily.search |
| FS sandbox | https://fs-demo.mcpservers.org/mcp | No | filesystem |
| Git mirror | https://git.mcpservers.org/mcp | No | git.diff, git.search |
| SQLite demo | https://sqlite-demo.mcpservers.org/mcp | No | sqlite.query |
| Postgres demo | https://postgres-demo.mcpservers.org/mcp | No | postgres.query |
| Puppeteer cloud | https://puppeteer.cloud.mcp/mcp | No | page.goto, screenshot |
| Apify actors | https://actors.apify.com/mcp | Sí (Apify token) | ejecutar actors |
| Slack API | https://slack.mcpservers.org/mcp | Sí (OAuth bot) | slack.postMessage, listChannels |

## Descubrimiento

- **mcpservers.org** – buscador con filtro por categoría y auth  
- Listas *awesome‑mcp‑servers* en GitHub  
- Discord `#servers` y subreddit **r/mcp**

## Cómo conectarte

```dotenv
MCP_SERVER_URL=https://demo.mcp.tools/everything/mcp
# Si el servidor requiere autenticación:
MCP_API_KEY=<tu-token>
```

```bash
curl -s $MCP_SERVER_URL | jq .tools
```
