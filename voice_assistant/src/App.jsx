import { useEffect, useRef, useState } from "react";
import SplineChips from "./components/spline-chips.jsx";
import { typeGreeting } from "./utils/typeUtil.js";
import { FaBreadSlice, FaMicrophone } from "react-icons/fa";
import { STATES } from "./utils/STATES.js";
import { useMicVAD } from "@ricky0123/vad-react";
import { prompts_responses } from "./utils/STATES.js";
import { once } from "ws";

export const VoiceAssistant = () => {
  const [websocket, setWebSocket] = useState(null);
  const [notification, setNotification] = useState("");
  const audioRef = useRef(null);
  const currentStateRef = useRef();
  const messagesEndRef = useRef(null);
  const [isRecording, setisRecording] = useState();
  const [greeting, setGreeting] = useState("How may I help you today?");
  const [showMicrophone, setShowMicrophone] = useState(true);
  const greetingRef = useRef(null);
  const timerRefWord = useRef();
  const websocketRef = useRef(null);
  const timerRefChar = useRef();
  const VADRef = useRef();
  const [showStartSpeaking, setshowStartSpeaking] = useState(false);

  const [prompt_response, setprompt_response] = useState([]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTo({
        top: messagesEndRef.current.scrollHeight,
        behaviour: "smooth",
      });
    }
  }, [prompt_response]);

  const addPrompt = (prompt) => {
    if (!prompt || prompt.length === 0) return;

    setprompt_response((prev) => {
      const requiredIndex = prev.findIndex(obj => obj.segment_id === prompt.segment_id)

      let updatedMessage;

      if (requiredIndex !== -1) {
        updatedMessage = [...prev]
        updatedMessage[requiredIndex] = {
          ...updatedMessage[requiredIndex],
          segment_text: prompt.segment_text
        }
      } else {
        updatedMessage = [...prev, { segment_id: prompt.segment_id, segment_text: prompt.segment_text, response_id: "", response_text: "" }]
      }
      return updatedMessage
    })
  };


  const addResponse = (response) => {
    if (!response.response_text.trim()) return;

    setprompt_response((prev) => {
      if (prev.length === 0) return prev;

      const lastIndex = prev.length - 1;
      const updatedMessage = [...prev];
      updatedMessage[lastIndex] = {
        ...updatedMessage[lastIndex],
        response_id: response.response_id,
        response_text: response.response_text
      };

      return updatedMessage;
    });
  };

  const vad = useMicVAD({
    startOnLoad: false,
    onSpeechStart: () => {
      console.log("Speech recording started!")
    },
    onFrameProcessed: ({ isSpeech, notSpeech }, frame) => {
      if (vad.userSpeaking) {
        const chunk = float32ToPCM16(frame)
        if (chunk) {
          console.log('PCM 16 chunk', chunk)
          // Send pcm 16 chunk to server for further processing
          try {
            websocketRef.current.send(chunk)
          } catch (error) {
            console.error("Some error occured while sending PCM 16 audio chunks to server", error)
          }
        }

      }
    },
    onSpeechEnd: (audio) => {

    }
  })
  VADRef.current = vad



  // Convert float32 array to PCM 16-bit little-endian
  function float32ToPCM16(float32Array) {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit signed integer
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = sample * 0x7FFF;
    }
    return pcm16.buffer; // Return as ArrayBuffer for WebSocket
  }


  useEffect(() => {
    if (greetingRef.current) {
      typeGreeting(greeting, greetingRef, timerRefChar, timerRefWord);

      return () => {
        if (timerRefWord.current) {
          clearTimeout(timerRefWord.current);
        }
      };
    }
  }, [greeting]);

  useEffect(() => {

    const websocket = new WebSocket("ws://localhost:8080/ws");
    setWebSocket(websocket);
    websocketRef.current = websocket;

    websocketRef.current.onopen = () => {
      console.log("Connected to web socket");
      setNotification("Connected to web socket");
    };

    websocketRef.current.onmessage = (event) => {
      const response_data = JSON.parse(event.data);
      console.log("Parsed Response:", response_data);
      const chunks = []
      if (response_data && response_data.phase) {
        const response_type = response_data.type;
        const response_phase = response_data.phase;

        switch (response_phase) {
          case "start":
            if (audioRef.current) {
              audioRef.current.src = response_data.audio_link;
              audioRef.current.play();
              currentStateRef.current = STATES.SPEAKING;
              audioRef.current.onended = () => {
                VADRef.current.start();
                currentStateRef.current = STATES.LISTENING;
                setshowStartSpeaking(true);
                setNotification("Start Speaking!");
                console.log(currentStateRef.current);
              };

            }
          case "transcription":
            const transcription = response_data.transcription;
            if (transcription) {
              addPrompt(transcription);
            }
            break;
          case "llm_response":
            const llm_response = response_data.llm_response;
            if (llm_response) {
              addResponse(llm_response);
            }
          case "speechify":
            const audio_url = response_data.audio_url;
            if (audio_url && audioRef.current) {
              audioRef.current.src = audio_url;
              audioRef.current.play();
              currentStateRef.current = STATES.SPEAKING;
            }

          case "audio_chunk":
          // if (sourceBuffer) {
          //   const hexString = response_data.audio_chunk
          //   const bytes = new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))

          //   if (!sourceBuffer.updating && queue.length === 0) {
          //     sourceBuffer.appendBuffer(bytes)
          //   } else {
          //     queue.push(bytes)
          //   }
          //   if (audioRef.current.paused) {
          //     audioRef.current.play().catch(e => console.warn("Playback error: ", e))
          //   }
          //   break
          // }
          default:
            setNotification("Unkown phase", response_phase);
        }
      }
      setNotification("Connected to web socket : New message recieved");
    };

    websocketRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);

      setNotification("An error occured during connection:", toString(error));
    };

    websocketRef.current.onclose = () => {
      console.log("Connection has been closed");
      setNotification("Connection has been closed");
    };

    return () => {
      websocketRef.current.close();
    };
  }, []);

  const startConversation = () => {
    if (
      websocketRef.current &&
      websocketRef.current.readyState === WebSocket.OPEN
    ) {
      const response_data = {
        type: "start",
        message: "Start the conversation with Voice Agent",
      };
      websocketRef.current.send(JSON.stringify(response_data));
      setShowMicrophone(false);
    }
  };

  return (
    <div className="w-screen h-max min-h-screen bg-stars-back bg-cover">
      <div className="h-[6vh] w-full">
        <p className="text-white text-sm rounded-lg inter-300 px-3 py-2 border border-gray-100/50 w-max">
          {notification}
        </p>
      </div>
      <div className="w-full h-[60vh] shadow-2xl shadow-violet-500/20">
        <SplineChips />
      </div>

      <div className="w-full pt-6 flex flex-col items-center justify-center">
        <p
          ref={greetingRef}
          className="text-center text-3xl inter-200 text-zinc-300 whitespace-pre"
        ></p>
      </div>
      {showMicrophone ? (
        <div className="w-full flex justify-center my-4">
          <div
            onClick={startConversation}
            className="bg-gray-50 w-16 h-16 rounded-full flex justify-center items-center hover:bg-gray-200 cursor-pointer"
          >
            <FaMicrophone className="text-zinc-800 w-6 h-6" />
          </div>
        </div>
      ) : (
        <div className="container-prompt-responses mt-2 w-screen flex justify-center">
          <div
            ref={messagesEndRef}
            className="lg:w-[70vw] w-full h-[20vh] overflow-y-scroll scrollbar-hide"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
            }}
          >
            {prompt_response?.map((object, index) => (
              <div
                key={index}
                className="prompt-response-box flex flex-col gap-y-8 py-2 px-8"
              >

                <div key={`prompt-${object["segment_id"]}`} className="prompt-box rounded-lg border border-white/20 inter-200 backdrop-blur-sm p-2 self-end w-[50%]">
                  <p className="inter-300 text-zinc-100">{object?.segment_text ? object.segment_text : <span>Listening ...</span>}</p>
                </div>

                {object.response_text ? (
                  <div key={`response-${object["response_id"]}`} className="prompt-box w-1/2 border border border-white/20 backdrop-blur-sm p-2 rounded-lg inter-300 w-[60%]">
                    <p className="text-zinc-100">{object?.response_text ? object.response_text : null}</p>
                  </div>
                ) : null}

              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <audio className="hidden" ref={audioRef} controls></audio>
      </div>
    </div>
  );
};
