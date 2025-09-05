from fastapi import FastAPI, WebSocket
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
    "TRANSCRIPTION":"transcription",
    "LLM_RESPONSE":"llm_response",
    "SPEECHIFY":"speechify",
    "END":"end"
}

def initiate_conversation(data = None):
    audio_link = text_to_speech("Hey there, how can I help you today?")
    response_data = {"phase": PHASE["START"] ,"type":"audio_url", "audio_link": audio_link}
    return response_data


def save_audio_data(data):
    os.makedirs(AUDIO_DIR, exist_ok=True)
    file_path = f"{AUDIO_DIR}/audio.wav"
    print("Audio data to be saved", data)

    with open(file_path,"wb") as f:
        f.write(data)
    print(f"Saved {file_path}")
    return file_path
    

def generate_transcript(file_path):
    try:
        transcription = transcribe(file_path)
        if transcription:
            response_data = {"phase": PHASE["TRANSCRIPTION"],"type": "transcription", "transcription": transcription}
            
        else:
            response_data = {"phase": PHASE["TRANSCRIPTION"],"type": "transcription", "transcription": []}

        return response_data
    except Exception as e:
        print(f"Some error occured while generating output from audio, error: {e}")

def construct_llm_response(transcript):
    try:
        llm_response = generateResponse(transcript)
        if llm_response:
            response_data = {"phase": PHASE["LLM_RESPONSE"],"type": "llm_response", "llm_response": llm_response}
        else:
            response_data = {"phase": PHASE["LLM_RESPONSE"],"type": "llm_response", "llm_response": []}
        return response_data
    except Exception as e:
        print(f"Some error occured while generating llm_response from transcription, error: {e}")
            
def generate_speech(llm_response):
    try:
        audio_url = text_to_speech(llm_response) 

        if audio_url:
            response_data = {"phase": PHASE["SPEECHIFY"],"type": "audio_url", "audio_url": audio_url}
        else:
            response_data = {"phase": PHASE["SPEECHIFY"],"type": "audio_url", "audio_url": []}
        return response_data

    except Exception as e:
        print(f"Some error occured while generating speech: {e}")


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
            file_path = save_audio_data(data["bytes"])

            
            # transcription phase
            transcription_data = generate_transcript(file_path)
            # send transcription_data to frontend
            await websocket.send_json(transcription_data)

            # LLM response phase
            transcription = transcription_data["transcription"]
            llm_response_data = construct_llm_response(transcription)
            # send llm_response to frontend
            await websocket.send_json(llm_response_data)

            # Speechify phase
            llm_response = llm_response_data["llm_response"]
            audio_data = generate_speech(llm_response)

            # send audio_url to frontend
            await websocket.send_json(audio_data)
            
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