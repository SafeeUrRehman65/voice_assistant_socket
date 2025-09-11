import os
from deepgram import (
    DeepgramClient,
    PrerecordedOptions,
    FileSource,
)
from dotenv import load_dotenv

load_dotenv()

# Path to the audio file
api_key_local = "855ed21872f041642d0406166571b920c343fa76"
def transcribe(file_path):
    try:
        # STEP 1 Create a Deepgram client using the API key
        deepgram = DeepgramClient(api_key = api_key_local)

        with open(file_path, "rb") as file:
            buffer_data = file.read()

        payload: FileSource = {
            "buffer": buffer_data,
        }

        #STEP 2: Configure Deepgram options for audio analysis
        options = PrerecordedOptions(
            model="nova-3",
            smart_format=True,
        )

        # STEP 3: Call the transcribe_file method with the text payload and options
        
        response = deepgram.listen.rest.v("1").transcribe_file(payload, options)
        # Get transcript directly from the response object
        transcript = response.results.channels[0].alternatives[0].transcript
        return transcript

    except Exception as e:
        print(f"Exception: {e}")
        return f"Some error occured: {e}"
        

