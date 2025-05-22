from flask import Flask, request, jsonify
import requests
import base64
import json
import os
import time
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración
app = Flask(__name__)
OPENAI_API_KEY = "tu-clave-api-de-openai-aqui"
OPENAI_ASSISTANT_ID = "asst_MXuUc0TcV7aPYkLGbN5glitq"
OPENAI_API_URL = "https://api.openai.com/v1"

# Habilitar CORS para permitir peticiones desde el plugin
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    return response

@app.route('/api/vision', methods=['POST'])
def analyze_image():
    try:
        # Obtener datos del formulario
        prompt = request.form.get('prompt', 'Describe esta imagen')
        image_file = request.files.get('image')
        
        if not image_file:
            return jsonify({"error": "No se proporcionó ninguna imagen"}), 400
        
        # Leer la imagen
        image_data = image_file.read()
        
        # Configurar headers para OpenAI
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v1"
        }
        
        # 1. Crear thread
        thread_response = requests.post(
            f"{OPENAI_API_URL}/threads", 
            headers=headers,
            json={}
        )
        thread_data = thread_response.json()
        thread_id = thread_data.get("id")
        
        if not thread_id:
            return jsonify({"error": "Error al crear thread", "details": thread_data}), 500
            
        # 2. Enviar mensaje con imagen
        message_payload = {
            "role": "user",
            "content": prompt,
            "attachments": [
                {
                    "type": "image",
                    "data": base64.b64encode(image_data).decode('utf-8')
                }
            ]
        }
        
        message_response = requests.post(
            f"{OPENAI_API_URL}/threads/{thread_id}/messages",
            headers=headers,
            json=message_payload
        )
        
        if message_response.status_code != 200:
            return jsonify({"error": "Error al enviar mensaje", "details": message_response.json()}), 500
            
        # 3. Ejecutar el asistente
        run_payload = {"assistant_id": OPENAI_ASSISTANT_ID}
        run_response = requests.post(
            f"{OPENAI_API_URL}/threads/{thread_id}/runs",
            headers=headers,
            json=run_payload
        )
        run_data = run_response.json()
        run_id = run_data.get("id")
        
        if not run_id:
            return jsonify({"error": "Error al ejecutar asistente", "details": run_data}), 500
            
        # 4. Polling hasta que termine
        status = "queued"
        while status in ["queued", "in_progress"]:
            time.sleep(1.5)  # Esperar antes de verificar estado
            
            status_response = requests.get(
                f"{OPENAI_API_URL}/threads/{thread_id}/runs/{run_id}",
                headers=headers
            )
            status_data = status_response.json()
            status = status_data.get("status")
            
            if status not in ["queued", "in_progress", "completed"]:
                return jsonify({"error": f"Error en ejecución: {status}", "details": status_data}), 500
                
        # 5. Obtener mensajes
        messages_response = requests.get(
            f"{OPENAI_API_URL}/threads/{thread_id}/messages",
            headers=headers
        )
        messages_data = messages_response.json()
        
        # La primera respuesta es la del asistente
        assistant_message = next((msg for msg in messages_data.get("data", []) 
                                if msg.get("role") == "assistant"), None)
        
        if not assistant_message:
            return jsonify({"error": "No se recibió respuesta del asistente"}), 500
            
        # Obtener el texto de la respuesta
        response_text = assistant_message.get("content", [{}])[0].get("text", {}).get("value", "")
        
        return jsonify({"response": response_text})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
