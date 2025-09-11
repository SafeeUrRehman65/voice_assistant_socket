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
  const bufferChunksRef = useRef([]);
  const vad = useMicVAD({
    startOnLoad: false,
    onSpeechStart: () => {
      console.log("Speech Started");
    },
    // onFrameProcessed: ({ isSpeech, notSpeech }, frame) => {
    //   if (vad.userSpeaking) {
    //     // const old = currentBufferRef.current;
    //     // const updated = new Float32Array(old.length + frame.length);
    //     // updated.set(old);
    //     // updated.set(frame, old.length);
    //     // currentBufferRef.current = updated;
    //     bufferChunksRef.current.push(frame)
    //     console.log("chunk pushed into array");
    //   } else {
    //     return;
    //   }
    // },
    onSpeechEnd: (audio) => {
      if (webSocketRef.current?.readyState === WebSocket.OPEN) {
        const wavAudio = encodeWAV(audio);
        console.log("Sending data chunk", wavAudio);
        webSocketRef.current.send(wavAudio);
      }
      console.log("Speech ended: speak again");
    },
  });

  VadRef.current = vad;

  const startVAD = () => {
    VadRef.current.start();
  };

  useEffect(() => {
    return () => {
      VadRef.current?.pause();
    };
  }, []);
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

  // useEffect(() => {
  //   timeIntervalRef.current = setInterval(() => {
  //     if (bufferChunksRef.current.length > 0 && VadRef.current.userSpeaking) {
  //       // const wavAudio = encodeWAV(currentBufferRef.current);

  //       // if (webSocketRef.current?.readyState === WebSocket.OPEN) {
  //       // console.log("Sending data chunk", wavAudio);
  //       // webSocketRef.current.send(wavAudio);
  //       flushAudioBuffer()
  //       // }

  //       // currentBufferRef.current = new Float32Array(0);
  //     }
  //   }, 2000);

  //   return () => {
  //     clearInterval(timeIntervalRef.current);
  //   };
  // }, []);

  const flushAudioBuffer = () => {
    const chunks = bufferChunksRef.current;
    console.log("Buffer chunks content", bufferChunksRef.current);

    if (chunks.length === 0) return;
    const totalLength = chunks.reduce((sum, chunk) => {
      if (!chunk || !(chunk instanceof Float32Array)) {
        console.warn("Invalid chunk detected:", chunk);
        return sum;
      }

      return sum + chunk.length;
    }, 0);

    if (totalLength === 0) {
      console.warn("Total audio length is 0, skipping.");
      return;
    }

    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      if (!chunk instanceof Float32Array) {
        console.warn("Skipping invalid chunk:", chunk);
        continue;
      }

      if (offset + chunk.length > combined.length) {
        console.error(
          `Offset overflow: offset(${offset}) + chunk.length(${chunk.length}) `
        );
        break;
      }
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const wavAudio = encodeWAV(combined);
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(wavAudio);
    }

    bufferChunksRef.current = [];
  };
  return (
    <div className="App pt-4">
      <button
        onClick={startVAD}
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
