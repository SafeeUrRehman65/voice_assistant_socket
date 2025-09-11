
import asyncio
import json
import time
import traceback
from deepgram.utils import verboselogs
import wave
import os
from dotenv import load_dotenv
from utils.helperFunctions import PHASE, wav_header

load_dotenv()

from deepgram import (
    DeepgramClient,
    SpeakWebSocketEvents,
    SpeakWSOptions,
)

AUDIO_FILE = "output.wav"
TTS_TEXT = """The sun is setting behind the mountains.

It casts a beautiful, orange glow across the entire valley.

This is my absolute favorite time of the day."""

#BreakTheSiege"

response_data = {
    "phase": "AUDIO_CHUNK",
    "type" : "audio_chunk",
    "audio_chunk": None
}

def deepgram_transcription(frontend_ws, text):
    try:
        # use default config
        deepgram: DeepgramClient = DeepgramClient(api_key=os.getenv("DEEPGRAM_AI_API_KEY"))

        # Create a websocket connection to Deepgram
        dg_connection = deepgram.speak.websocket.v("1")

        def on_binary_data(self, data, **kwargs):
            print("Received binary data")
            try:
                if not hasattr(self, 'header_sent'):
                    # send wav header first
                    header_msg = {
                        "phase": PHASE["AUDIO_CHUNK"],
                        "type": "audio_chunk",
                        "audio_chunk": wav_header.hex()
                    }
                    # send wav header to frontend
                    asyncio.run(frontend_ws.send_text(json.dumps(header_msg)))

                    print(f"Header sent to frontend")
                    self.header_sent = True
                
                # send audio chunks to frontend
                
                chunk_msg = {
                    "phase": PHASE["AUDIO_CHUNK"],
                    "type": "audio_chunk",
                    "audio_chunk": data.hex()
                }
                asyncio.run(frontend_ws.send_text(json.dumps(chunk_msg)))
                print(f"chunk message sent to frontend")
            except Exception as error:
                print(f"Some error occured during speechifying text", error)
                print(traceback.format_exc())
            
            
        dg_connection.on(SpeakWebSocketEvents.AudioData, on_binary_data)

        # connect to websocket
        options = SpeakWSOptions(
            model="aura-2-thalia-en",
            encoding="linear16",
            sample_rate=16000,
        )

        print("\n\nPress Enter to stop...\n\n")
        if dg_connection.start(options) is False:
            print("Failed to start connection")
            return

        # send the text to Deepgram
        dg_connection.send_text(text)
        print("Text sent to deepgram for speechifying...")

        # if auto_flush_speak_delta is not used, you must flush the connection by calling flush()
        dg_connection.flush()

        # Indicate that we've finished
        time.sleep(7)
        print("\n\nPress Enter to stop...\n\n")
        input()

        # Close the connection
        dg_connection.finish()

        print("Finished")

    except ValueError as e:
        print(f"Invalid value encountered: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

# if __name__ == "__main__":
#     deepgram_transcription()
