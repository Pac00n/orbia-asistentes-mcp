# Mejoras de Interfaz de Usuario para MCP

## Problema Identificado

La interfaz de usuario mostraba incorrectamente el número de herramientas disponibles en el icono de martillo. El componente estaba utilizando una lista estática hardcodeada de 6 herramientas, mientras que en realidad había 12 herramientas disponibles en la simulación MCP.

## Cambios Implementados

Se modificó el componente de chat en `app/chat/mcpv4/[assistantId]/page.tsx` para obtener dinámicamente la lista real de herramientas disponibles desde el nuevo endpoint API.

### Actualización del Componente

Se cambió la función `fetchTools` para obtener las herramientas desde el API en lugar de usar una lista estática:

```tsx
useEffect(() => {
  const fetchTools = async () => {
    try {
      // Obtener herramientas reales desde el endpoint de la API
      const response = await fetch('/api/chat/mcpv4/tools', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        // Evitar caché para siempre obtener datos frescos
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Error al obtener herramientas: ${response.status}`);
      }
      
      const toolsData = await response.json();
      console.log('Herramientas MCP obtenidas:', toolsData);
      
      // Transformar datos de herramientas al formato esperado por el componente
      const formattedTools = toolsData.map((tool: any) => ({
        name: tool.function?.name || tool.name || 'Herramienta sin nombre',
        description: tool.function?.description || tool.description || 'Sin descripción'
      }));
      
      setAvailableTools(formattedTools);
    } catch (e) {
      console.error("Error fetching available tools:", e);
      // En caso de error, no mostrar nada o usar una lista de respaldo
      setAvailableTools([]);
    }
  };
  fetchTools();
}, []);
```

### Características Clave

1. **Obtención Dinámica**: Las herramientas se obtienen dinámicamente del endpoint API en lugar de ser hardcodeadas.

2. **Transformación de Datos**: Los datos obtenidos se transforman al formato esperado por el componente UI.

3. **Manejo de Errores**: Se implementó un manejo adecuado de errores para evitar problemas en la interfaz si la API falla.

4. **Configuración de Caché**: Se configuró para evitar el caché y siempre obtener datos frescos.

## Componente de Martillo con Contador

El componente de UI que muestra el martillo con el contador de herramientas ahora refleja con precisión el número real de herramientas disponibles:

```tsx
<button
  onClick={() => setShowTools(!showTools)}
  className="flex items-center p-2 rounded hover:bg-gray-700 transition-colors"
  title="Herramientas disponibles"
>
  <Hammer className="w-5 h-5 mr-2" />
  <span>{availableTools.length}</span> {/* Número real de herramientas */}
  {showTools ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
</button>
```

## Lista Desplegable de Herramientas

Al hacer clic en el martillo, se muestra una lista desplegable con todas las herramientas disponibles, incluyendo sus nombres y descripciones:

```tsx
{showTools && (
  <div className="absolute right-0 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10 p-2">
    <h3 className="text-sm font-semibold mb-2 px-2">Herramientas Disponibles:</h3>
    {availableTools.length > 0 ? (
      <ul className="max-h-60 overflow-y-auto text-sm">
        {availableTools.map((tool, index) => (
          <li key={index} className="p-2 hover:bg-gray-700 rounded">
            <p className="font-medium">{tool.name || 'Herramienta sin nombre'}</p>
            <p className="text-xs text-gray-400">{tool.description || 'Sin descripción.'}</p>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-xs text-gray-400 px-2">No hay herramientas disponibles o no se pudieron cargar.</p>
    )}
  </div>
)}
```

## Beneficios de las Mejoras

1. **Precisión**: La interfaz ahora muestra con exactitud el número real de herramientas disponibles (12 en lugar de 6).

2. **Actualización Automática**: Si cambia el número de herramientas disponibles (por ejemplo, al conectarse a diferentes servidores), la UI se actualizará automáticamente.

3. **Experiencia de Usuario**: Los usuarios ahora pueden ver todas las herramientas disponibles, proporcionando una mejor comprensión de las capacidades del sistema.

4. **Mantenimiento Simplificado**: Ya no es necesario actualizar manualmente la lista de herramientas en el frontend cuando se añaden o eliminan herramientas en el backend.
