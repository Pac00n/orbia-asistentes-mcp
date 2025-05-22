// lib/mcp/config.ts

export interface McpServerConfig {
  id: string;
  url: string;
  name?: string;
  apiKey?: string; // Mantenido para compatibilidad con versiones anteriores
  auth?: {
    type: 'bearer' | 'header';
    token?: string;     // Para autenticación Bearer
    header?: string;    // Para autenticación por header personalizado
    value?: string;     // Para autenticación por header personalizado
  };
}

export function getMcpServersConfiguration(): McpServerConfig[] {
  const configJson = process.env.MCP_SERVERS_CONFIG;

  if (!configJson) {
    console.warn("MCP_SERVERS_CONFIG no está definida. El cliente MCP no tendrá servidores externos configurados.");
    return [];
  }

  try {
    const parsedConfig = JSON.parse(configJson);

    if (!Array.isArray(parsedConfig)) {
      console.error("Error: MCP_SERVERS_CONFIG no es un array JSON válido.");
      return [];
    }

    // Validación básica de cada objeto de configuración
    const validConfigs: McpServerConfig[] = [];
    for (const item of parsedConfig) {
      if (item && typeof item.id === 'string' && typeof item.url === 'string') {
        // Asegurarse de que la URL es válida (simple check)
        try {
          new URL(item.url); // Valida el formato de la URL
          
          // Crear objeto de configuración base
          const serverConfig: McpServerConfig = {
            id: item.id,
            url: item.url,
            name: typeof item.name === 'string' ? item.name : undefined,
          };
          
          // Procesar autenticación
          if (item.auth) {
            // Validar estructura de auth
            if (item.auth.type === 'bearer' && typeof item.auth.token === 'string') {
              serverConfig.auth = {
                type: 'bearer',
                token: item.auth.token
              };
              console.log(`Config: Configuración de autenticación Bearer detectada para ${item.id}`);
            } else if (item.auth.type === 'header' && typeof item.auth.header === 'string' && typeof item.auth.value === 'string') {
              serverConfig.auth = {
                type: 'header',
                header: item.auth.header,
                value: item.auth.value
              };
              console.log(`Config: Configuración de autenticación por header ${item.auth.header} detectada para ${item.id}`);
            } else {
              console.warn(`Config: Estructura de autenticación inválida para ${item.id}:`, item.auth);
            }
          } else if (typeof item.apiKey === 'string') {
            // Compatibilidad con versiones anteriores
            serverConfig.apiKey = item.apiKey;
            console.log(`Config: Usando apiKey (deprecated) para ${item.id}`);
          }
          
          validConfigs.push(serverConfig);
        } catch (e) {
          console.error(`Error: URL inválida para el servidor MCP con id '${item.id}': ${item.url}`);
        }
      } else {
        console.warn("Advertencia: Elemento de configuración de servidor MCP inválido u omitido:", item);
      }
    }
    
    console.log(`Config: Configuración de servidores MCP cargada con éxito. ${validConfigs.length} servidores válidos.`);
    return validConfigs;

  } catch (error) {
    console.error("Error al parsear MCP_SERVERS_CONFIG:", error);
    return [];
  }
}
