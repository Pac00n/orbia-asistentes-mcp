# Script para crear un repositorio limpio sin claves API
# Este script copia los archivos del proyecto actual a un nuevo directorio
# excluyendo archivos sensibles con claves API

$sourceDir = "c:\Users\LPA-PUESTO6\Documents\w15\asistentes-ia-v02"
$targetDir = "c:\Users\LPA-PUESTO6\Documents\w15\asistentes-ia-v02-clean"

# Crear directorio destino si no existe
if (-not (Test-Path $targetDir)) {
    New-Item -Path $targetDir -ItemType Directory
}

# Archivos y carpetas a excluir (contienen claves API o son innecesarios)
$excludePatterns = @(
    "\.env*",                      # Todos los archivos .env
    "python_example_images\app.py", # Archivo que contiene la clave API
    "env-template*.txt",           # Plantillas de entorno
    "node_modules",                # Carpeta node_modules
    "\.git",                       # Carpeta .git
    "\.next",                      # Carpeta .next
    "\.vercel"                     # Carpeta .vercel
)

# Función para verificar si un archivo debe ser excluido
function ShouldExclude($filePath) {
    $relativePath = $filePath.Replace($sourceDir + "\", "")
    
    foreach ($pattern in $excludePatterns) {
        if ($relativePath -like $pattern) {
            return $true
        }
    }
    
    return $false
}

# Función para copiar archivos de forma recursiva excluyendo los patrones especificados
function CopyFilesRecursively($source, $destination) {
    # Crear directorio destino si no existe
    if (-not (Test-Path $destination)) {
        New-Item -Path $destination -ItemType Directory | Out-Null
    }
    
    # Obtener todos los elementos en el directorio fuente
    $items = Get-ChildItem -Path $source -Force
    
    foreach ($item in $items) {
        $destPath = Join-Path $destination $item.Name
        
        # Verificar si el elemento debe ser excluido
        if (ShouldExclude($item.FullName)) {
            Write-Host "Excluyendo: $($item.FullName)" -ForegroundColor Yellow
            continue
        }
        
        if ($item.PSIsContainer) {
            # Si es un directorio, copiar recursivamente
            CopyFilesRecursively $item.FullName $destPath
        } else {
            # Si es un archivo, copiarlo
            Copy-Item -Path $item.FullName -Destination $destPath -Force
            Write-Host "Copiado: $($item.FullName) -> $destPath" -ForegroundColor Green
        }
    }
}

# Crear versión limpia del archivo python_example_images/app.py
$appPyDir = Join-Path $targetDir "python_example_images"
if (-not (Test-Path $appPyDir)) {
    New-Item -Path $appPyDir -ItemType Directory | Out-Null
}

$appPyContent = @"
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import requests

# Configuración
app = Flask(__name__)
OPENAI_API_KEY = "tu-clave-api-de-openai-aqui"
OPENAI_ASSISTANT_ID = "tu-id-de-asistente-aqui"
OPENAI_API_URL = "https://api.openai.com/v1"

# Habilitar CORS
CORS(app)

# ... resto del código original ...
"@

$appPyPath = Join-Path $appPyDir "app.py"
Set-Content -Path $appPyPath -Value $appPyContent
Write-Host "Creado archivo limpio: $appPyPath" -ForegroundColor Green

# Crear archivo .gitignore mejorado
$gitignoreContent = @"
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js
.yarn/install-state.gz

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env
.env*.local
env-template*.txt

# archivos con posibles claves API
**/secrets.json
**/api-keys.js

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
"@

$gitignorePath = Join-Path $targetDir ".gitignore"
Set-Content -Path $gitignorePath -Value $gitignoreContent
Write-Host "Creado archivo .gitignore mejorado: $gitignorePath" -ForegroundColor Green

# Crear archivo README.md con instrucciones
$readmeContent = @"
# Aplicación con Integración MCP

Este repositorio contiene una aplicación que integra el Protocolo de Contexto de Modelo (MCP) para mejorar las capacidades de asistentes de IA.

## Configuración

Para usar esta aplicación, necesitas configurar variables de entorno:

1. Crea un archivo `.env.local` con las siguientes variables:

```
OPENAI_API_KEY=tu-clave-de-openai
MCP_SERVERS_CONFIG='[
  {
    "id": "srv1",
    "url": "http://simulated.server",
    "name": "Servidor Simulado 1"
  },
  {
    "id": "toolCo",
    "url": "http://simulated.toolserver",
    "name": "Tool Company Simulada"
  }
]'
MCP_FORCE_REAL=false
```

## Desarrollo Local

```bash
npm install
npm run dev
```

## Despliegue en Vercel

Para desplegar en Vercel, configura las siguientes variables de entorno:

```
OPENAI_API_KEY=tu-clave-de-openai
MCP_SERVERS_CONFIG=[{"id":"fs-demo","url":"https://fs-demo.mcpservers.org/mcp","name":"MCP FS Demo"},{"id":"git","url":"https://git.mcpservers.org/mcp","name":"Git Mirror ReadOnly"},{"id":"fetch","url":"https://demo.mcp.tools/fetch/mcp","name":"Fetch Tool"}]
MCP_FORCE_REAL=true
```

Ver la documentación completa en `docs/implementacion-mcp-mayo2025/` para más detalles.
"@

$readmePath = Join-Path $targetDir "README.md"
Set-Content -Path $readmePath -Value $readmeContent
Write-Host "Creado archivo README.md: $readmePath" -ForegroundColor Green

# Iniciar la copia de archivos
Write-Host "Iniciando copia de archivos..." -ForegroundColor Cyan
CopyFilesRecursively $sourceDir $targetDir

Write-Host "¡Proceso completado!" -ForegroundColor Green
Write-Host "El repositorio limpio se ha creado en: $targetDir" -ForegroundColor Green
Write-Host "Ahora puedes:" -ForegroundColor Green
Write-Host "1. Inicializar un nuevo repositorio Git en esa carpeta" -ForegroundColor Green
Write-Host "2. Conectarlo a un nuevo repositorio en GitHub" -ForegroundColor Green
Write-Host "3. Hacer push sin problemas de detección de claves API" -ForegroundColor Green
