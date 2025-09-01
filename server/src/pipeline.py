from fastapi import FastAPI, FastAPI, WebSocket
import os
import json
from transcribe import transcribe
from text_to_speech import text_to_speech
from generateResponse import generateResponse
app = FastAPI()

AUDIO_DIR = "audios"
PHASE = {
    "START":"start",
    "AUDIO_METADATA":"audio_metadata",
    "CONVERSATION":"conversation",
    "END":"end"
}

def initiate_conversation(data = None):
    audio_link = text_to_speech("Hey there, how can I help you today?")
    return {"phase": PHASE["START"] ,"type":"audio_url", "audio_link": audio_link}


def save_audio_data(data):
    os.makedirs(AUDIO_DIR, exist_ok=True)
    filename = f"{AUDIO_DIR}/audio.wav"
    print("Audio data to be saved", data)

    with open(filename,"wb") as f:
        f.write(data)
    print(f"Saved {filename}")
    return {"phase": PHASE["CONVERSATION"], "type":"audio_bytes"}

def handle_audio_metadata(data):
    print("Audio metadata received", data)
    return {"phase": PHASE["AUDIO_METADATA"], "type": "audio_metadata","format": data["format"]}

@app.websocket("/ws")
async def websocket_endpoint(websocket:WebSocket):
    await websocket.accept()
    print("Connection established through websocket")

    switch = {
        "start": initiate_conversation,
        "audio_metadata": handle_audio_metadata
    }
    
    while True:
        data = await websocket.receive()
        
        if "bytes" in data:
            save_audio_data(data["bytes"])
        elif "text" in data:
            json_data = json.loads(data["text"])
            json_data_type = json_data["type"]
            handler = switch.get(json_data_type)
            if handler:
                
                if handler.__code__.co_argcount > 0:
                    response = handler(json_data)
                else:
                    response = handler()
                # send data back to client
                await websocket.send_json(response)
            else:
                await websocket.send_json({"type": "error", "message":"Unkown case"})