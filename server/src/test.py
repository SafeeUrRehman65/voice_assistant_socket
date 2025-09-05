from fastapi import FastAPI, WebSocket
import json
import os
from transcribe import transcribe

app = FastAPI()

AUDIO_DIR = "audio_chunks"
def save_audio_data(data):
    os.makedirs(AUDIO_DIR, exist_ok=True)
    file_path = f"{AUDIO_DIR}/chunk.wav"
    print(f"Audio chunk to be saved in audio_chunk folder :{data}")

    with open(file_path, "wb") as f:
        f.write(data)
    print(f"Saved {file_path}")
    return file_path
    
@app.websocket("/ws")
async def websocket_endpoint(websocket : WebSocket):
    await websocket.accept()
    print("Connection established through websocket")

    while True:
        data = await websocket.receive_bytes()

        file_path = save_audio_data(data)
        
        transcription = transcribe(file_path)

        print("transcription", transcription)
        if transcription:
            response_data = {"phase": "transcription","type": "transcription", "transcription": transcription}
            await websocket.send_json(response_data)