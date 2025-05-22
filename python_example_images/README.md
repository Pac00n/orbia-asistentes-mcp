# Proxy Python para OpenAI Vision

Este es un servidor proxy simple desarrollado en Python (Flask) para manejar las comunicaciones entre el plugin de Civil 3D y OpenAI Vision.

## Características

- Endpoint REST para recibir imágenes y prompts
- Manejo seguro de credenciales (API Key)
- Comunicación completa con OpenAI Assistants API
- Optimizado para imágenes capturadas desde Civil 3D

## Requisitos

- Python 3.7 o superior
- Dependencias listadas en `requirements.txt`

## Instalación

1. Asegúrate de tener Python instalado
2. Instala las dependencias:
   ```
   pip install -r requirements.txt
   ```

## Uso

1. Inicia el servidor:
   ```
   python app.py
   ```

2. El servidor estará disponible en `http://localhost:5000`

3. El plugin C3DVisionPlugin está configurado para comunicarse con este servidor para evitar exponer credenciales de API en el plugin.

## Endpoints

- **POST /api/vision**: Recibe una imagen y un prompt, los procesa con OpenAI y devuelve la respuesta generada

## Integración con Civil 3D

El proxy se comunica con el plugin de Civil 3D de la siguiente manera:

1. El usuario ejecuta el comando `CAPTUREIA` en Civil 3D
2. El plugin captura la pantalla y solicita un prompt
3. El plugin envía la imagen y el prompt al proxy Python
4. El proxy procesa la solicitud con OpenAI Vision
5. La respuesta se devuelve al plugin y se muestra en Civil 3D
