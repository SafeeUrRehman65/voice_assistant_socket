from .generateResponse import generateResponse
from .text_to_speech import text_to_speech

# different phase required during conversation with AI agent
PHASE = {
    "START":"start",
    "AUDIO_METADATA": "audio_metadata",
    "CONVERSATION": "conversation",
    "TRANSCRIPTION": "transcription",
    "LLM_RESPONSE": "llm_response",
    "SPEECHIFY": "speechify",
    "SILENCE": "silence",
    "AUDIO_CHUNK": "audio_chunk",
    "END":"end"
}

def construct_llm_response(transcript):
    try:
        llm_response = generateResponse(transcript)
        if llm_response:
            response_data = llm_response
        else:
            response_data = []
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



wav_header = bytes([
            0x52, 0x49, 0x46, 0x46,  # "RIFF"
            0x00, 0x00, 0x00, 0x00,  # Placeholder for file size
            0x57, 0x41, 0x56, 0x45,  # "WAVE"
            0x66, 0x6D, 0x74, 0x20,  # "fmt "
            0x10, 0x00, 0x00, 0x00,  # Chunk size (16)
            0x01, 0x00,              # Audio format (1 for PCM)
            0x01, 0x00,              # Number of channels (1)
            0x80, 0xBB, 0x00, 0x00,  # Sample rate (48000)
            0x00, 0xEE, 0x02, 0x00,  # Byte rate (48000 * 2)
            0x02, 0x00,              # Block align (2)
            0x10, 0x00,              # Bits per sample (16)
            0x64, 0x61, 0x74, 0x61,  # "data"
            0x00, 0x00, 0x00, 0x00   # Placeholder for data size
])