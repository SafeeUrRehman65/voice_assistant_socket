import { useMicVAD } from "@ricky0123/vad-react";
import { encodeWAV } from "@ricky0123/vad-web/dist/utils.js";
import "./App.css";
import { useEffect, useRef } from "react";
function Tester() {
  const currentBufferRef = useRef(new Float32Array(0));
  const webSocketRef = useRef(null);
  const VadRef = useRef(null);
  const timeIntervalRef = useRef(null);
  const transcriptionRef = useRef(null);

  const vad = useMicVAD({
    startOnLoad: false,
    onSpeechStart: () => {
      console.log("Speech Started");
    },
    onFrameProcessed: ({ isSpeech }, frame) => {
      if (vad.userSpeaking) {
        const old = currentBufferRef.current;
        const updated = new Float32Array(old.length + frame.length);
        updated.set(old);
        updated.set(frame, old.length);
        currentBufferRef.current = updated;
        console.log("chunk pushed into array");
      } else {
        return;
      }
    },
    onSpeechEnd: (audio) => {
      console.log("Speech ended: speak again");
    },
  });

  VadRef.current = vad;

  useEffect(() => {
    const websocket = new WebSocket("ws://localhost:8000/ws");
    webSocketRef.current = websocket;
    webSocketRef.current.onopen = () => {
      console.log("Connection established");
    };

    webSocketRef.current.onmessage = (event) => {
      console.log("New Message from server, Content:", event.data);
      const response_data = JSON.parse(event.data);

      console.log("Parsed data: ", response_data);

      if (response_data && response_data.phase) {
        const response_phase = response_data.phase;

        switch (response_phase) {
          case "transcription":
            if (transcriptionRef.current) {
              const transcription = response_data.transcription;
              console.log("transcription ", transcription);
              transcriptionRef.current.innerText += transcription;
            }
        }
      }
    };
    webSocketRef.current.onclose = () => {
      console.log("Connection closed");
    };

    webSocketRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      webSocketRef.current.close();
    };
  }, []);

  useEffect(() => {
    timeIntervalRef.current = setInterval(() => {
      if (currentBufferRef.current.length > 0 && VadRef.current.userSpeaking) {
        const wavAudio = encodeWAV(currentBufferRef.current);

        if (webSocketRef.current?.readyState === WebSocket.OPEN) {
          console.log("Sending data chunk", wavAudio);
          webSocketRef.current.send(wavAudio);
        }

        currentBufferRef.current = new Float32Array(0);
      }
    }, 2000);

    return () => {
      clearInterval(timeIntervalRef.current);
    };
  }, []);

  return (
    <div className="App pt-4">
      <button
        onClick={() => {
          VadRef.current?.start();
        }}
        className="cursor-pointer bg-blue-200 hover:bg-blue-400 px-3 py-2 rounded-md"
      >
        Start Recording
      </button>
      <p>Transcription:</p>
      <p ref={transcriptionRef}></p>
    </div>
  );
}

export default Tester;
