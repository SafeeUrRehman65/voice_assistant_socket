import os
from dotenv import load_dotenv
from murf import Murf

load_dotenv()
client = Murf(api_key=os.getenv("MURF_AI_API_KEY"))

def text_to_speech(text: str):
    response = client.text_to_speech.generate(
    text = text,
    voice_id = "en-US-ken",
    style = "Conversational",
    pitch = 10
    )


    return response.audio_file
