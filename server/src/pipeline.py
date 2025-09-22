import asyncio
import os
# from socket import timeout
from queue import Queue, Empty
import json
import threading
import time
# WebSocket client from websocket-client library (not websocket)
import websocket
import urllib.parse
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from .helperFunctions import construct_llm_response
from .helperFunctions import PHASE
from text_to_speech import text_to_speech

load_dotenv()

# Configuration
WEBSOCKET_URL = "wss://audio-streaming.us-virginia-1.direct.fireworks.ai/v1/audio/transcriptions/streaming"
LANGUAGE = "en"

class TranscriptionClient:
    """Handles real-time audio transcription via WebSocket streaming."""

    def __init__(self, frontend_ws):
        # initializing a state for storing the initial segments obtained through transcription servcice via their respective ids
        self.segments = {}
        self.state = {}
        self.lock = threading.Lock()
        self.audio_chunks = []
        self.silence_threshold = 1.5
        self.frontend_ws = frontend_ws
        self.ws = None
        self.transcription_id = 0
        self.stream_thread_started = False
        self.is_connected = False
        self.last_audio_time = None

    # @staticmethod
    def stream_audio_to_fireworks(self, ws, queue):
        """Stream audio chunks to the WebSocket."""
        print("Starting audio stream...")
        while True:
            try:
                chunk = queue.get(timeout=10) 
                ws.send(chunk, opcode = websocket.ABNF.OPCODE_BINARY)
                time.sleep(0.05)
            except Empty:
                print("No audio received for 10s. waiting...")      
                continue     
            except websocket.WebSocketConnectionClosedException:
                
                print("WebSocket connection closed")
                break
            
            except websocket.WebSocketException as e:
                print("WebSocket exception occurred:", e)
                break

    # clear state function to stream fresh transcripts
    def clear_state_context(self, reset_id = "silence_timeout"):
        """Send state clear event to reset transcription context"""
        if self.ws:
            clear_event = {
                "event_id": f"clear_{int(time.time())}",
                "object": "stt.state.clear",
                "reset_id": reset_id
            }
            self.ws.send(json.dumps(clear_event))


            print(f"Sent state clear event with reset_id: {reset_id}")
    # monitor silence to clear state
    def monitor_silence(self):
        """Monitor silence and clear context when threshold is reached"""

        while True:
            if self.last_audio_time:
                silence_duration = time.time() - self.last_audio_time
                if silence_duration > self.silence_threshold:
                    print(f"Detected {silence_duration:.1f}s of silence, clearing context 🧹")
                    self.clear_state_context(f"silence_{int(time.time())}")         

                    if self.state:
                        transcript = self.state[self.transcription_id]
                        if transcript:
                            # generate llm response
                            self.llm_and_speech_response(transcript)  
                        else:
                            print("❌ No transcript found, can't generate llm_response")
                    else:
                        print("⌛ State is not populated with transcripts yet")
                    self.transcription_id += 1
                    self.last_audio_time = None
            time.sleep(1.0)
    
    def llm_and_speech_response(self, transcript):
        try:
            llm_data = construct_llm_response(transcript)
            if llm_data:
                print('llm_response', llm_data)
                # send llm_response to speech generation service 
                
                speech_data = self.generate_speech_url(llm_data)
                print("speech_data", speech_data)
                if speech_data:
                    # construct llm response object
                    llm_response_object = {
                        "response_id": self.transcription_id,
                        "response_text": llm_data
                    }

                    # constuct llm response data for frontend transmission
                    llm_response_data = {"phase": PHASE["LLM_RESPONSE"], "type": "llm_response", "llm_response": llm_response_object}

                    print(f"llm response data: {llm_response_data}")

                    # send speech data to frontend
                    asyncio.run(self.frontend_ws.send_text(json.dumps(speech_data)))
                    # send llm data to frontend                    
                    asyncio.run(self.frontend_ws.send_text(json.dumps(llm_response_data)))

                    # send audio data to frontend using deepgram service
                    # try:        
                    #     deepgram_transcription(self.frontend_ws, llm_data)
                    # except Exception as error:
                    #     print(f"⚠️ Some error occured while speechifying transcription using deepgram: ", error)
                    
                    
                    
                else:
                    print(f"❌ Speech data not available")
                
            else:
                print(f"❌ Response data not available")
        except Exception as e:
            print(f"Some error occured while constructing llm and speech response: {e}")
            
    def generate_speech_url(self, llm_response):
        try:
            speech_data = text_to_speech(llm_response)
            speech_response_data = {
                "phase": PHASE["SPEECHIFY"],
                "type": "audio_url",
                "audio_url": speech_data
            }
            return speech_response_data
        except Exception as e:
            print(f"Some error occured while generating speech_url: {e}")

    def on_websocket_close(self, ws, close_status_code, close_msg):
        self.is_connected = False
        print(f"Fireworks websocket closed:{close_status_code} - {close_msg}")

    def on_websocket_open(self, ws, queue):
        """Handle WebSocket connection opening."""
        if self.is_connected:
            print("Already connected, skipping duplicate connections")
            return 

        self.is_connected = True
        print("Connected to fireworks - ready for real-time audio stream")

        if not self.stream_thread_started:
            self.stream_thread_started = True
            # Start streaming in a separate thread
            streaming_thread = threading.Thread(
                target=self.stream_audio_to_fireworks,
                args=(ws, queue,),
                daemon=True
            )
            streaming_thread.start()

    def on_websocket_message(self, ws, message):
        """Handle incoming transcription messages."""
        try:
            data = json.loads(message)
            # print("data from fireworks ai", data)
            # Check for final trace completion
            if data.get("trace_id") == "final":
                print("\nTranscription complete!")
                ws.close()
                return

            # Update transcription state
            if "segments" in data:
                print("segment arrived")
                asyncio.run(self.frontend_ws.send_text(json.dumps({"phase": PHASE["SILENCE"], "type": "silence"})))
                self.last_audio_time = time.time()
                with self.lock:

                    # combine all segments in a state object with their respective ids
                    self.segments = {segment["id"]: segment["text"] for segment in data["segments"]}

                    print("Current segments with their segment ids")
                    print("------------------------")
                    print(self.segments)
                    print("------------------------")
                    # append all segments in a single id-text object
                    self.state = {self.transcription_id:' '.join(self.segments.values())}

                    # Wrapping the latest transcription in the response data to send to frontend
                
                    transcription_object = {"segment_id":self.transcription_id, "segment_text": self.state[self.transcription_id]}

                    response_data = {"phase": PHASE["TRANSCRIPTION"],"type": "transcription", "transcription": transcription_object}
                    
                    print("response_data", response_data)
                    asyncio.run(self.frontend_ws.send_text(json.dumps(response_data)))
                
                    self.display_transcription()

        except json.JSONDecodeError:
            print(f"Failed to parse message: {message}")

    @staticmethod
    def on_websocket_error(_, error):
        """Handle WebSocket errors."""
        print(f"WebSocket error: {error}")

    def display_transcription(self):
        """Display the current transcription state."""
        print("\n--- Current Transcription ---")
        # for segment_id in sorted(self.state.keys(), key=int):
        #     print(f"{segment_id}: {self.state[segment_id]}")
        print(self.state)
        print("----------------------------\n")

    def create_websocket_connection(self, queue):
        """Create and configure the WebSocket connection."""
        # Build WebSocket URL with parameters
        params = urllib.parse.urlencode({"language": LANGUAGE})
        full_url = f"{WEBSOCKET_URL}?{params}"

        api_key = os.getenv("FIREWORKS_API_KEY")
        
        if not api_key:
            raise ValueError("FIREWORKS_API_KEY environment variable not set")

        websocket_client = websocket.WebSocketApp(
            full_url,
            header={"Authorization": api_key},
            on_open=lambda ws: self.on_websocket_open(ws, queue),
            on_message=self.on_websocket_message,
            on_close=self.on_websocket_close,
            on_error=self.on_websocket_error,
        )
        
        self.ws = websocket_client
        # initialize a thread to monitor silence in a different background thread
        silence_monitoring_thread = threading.Thread(target = self.monitor_silence, daemon=True)
        silence_monitoring_thread.start()
        
        return websocket_client

    def run(self, queue):
        """Main execution flow."""
        try:
            websocket_client = self.create_websocket_connection(queue)

            print("Connecting to transcription service...")
            websocket_client.run_forever()

        except Exception as e:
            print(f"Error: {e}")
            return 1

        return 0


def initiate_conversation(data = None):
    audio_link = text_to_speech("Hey! I am Musa - an AI powered voice assistant, how can I help you today?")
    response_data = {"phase": PHASE["START"] ,"type":"audio_url", "audio_link": audio_link}
    return response_data




# initializing the fast api app
app = FastAPI()

@app.websocket('/wss')
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()
    print("Connection established with frontend Client")

    # initialize a queue for sending audio chunks as soon as they are received from client-side
    audio_queue = Queue()
    print("Audio queue", audio_queue)

    # initate a transcription client
    client = TranscriptionClient(websocket)
    # connect with the fireworks transcription service
    client_thread = threading.Thread(target=client.run, args = (audio_queue,), daemon=True)

    client_thread.start()
    # client.run(queue = audio_queue)

    # create a switch for case handling
    switch = {
        "start": initiate_conversation,
    }
    while True:
        data = await websocket.receive()

        if "bytes" in data:
            # send incoming PCM 16 audio chunks to fireworks ai transcription
            audio_pcm_chunk = data["bytes"]
            audio_queue.put(audio_pcm_chunk)
        
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

