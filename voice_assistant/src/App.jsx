import { useEffect, useRef, useState } from "react";
import reactLogo from "./assets/react.svg";
import SplineChips from "./components/spline-chips.jsx";
import viteLogo from "/vite.svg";

import { typeGreeting } from "./utils/typeUtil.js";
import { FaMicrophone } from "react-icons/fa";
import { STATES } from "./utils/STATES.js";
import { useMicVAD } from "@ricky0123/vad-react";
import { encodeWAV } from "@ricky0123/vad-web/dist/utils.js";

import { prompts_responses } from "./utils/STATES.js";

export const VoiceAssistant = () => {
  const [count, setCount] = useState(0);
  const [websocket, setWebSocket] = useState(null);
  const [inboxMessage, setInboxMessage] = useState(null);
  const [sentMessage, setSentMessage] = useState(null);
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
  const voiceIntervalRef = useRef();
  const silenceTimerRef = useRef(null);
  const speechCounterRef = useRef(0);
  const prompt_response_obj = { prompt: "", response: "" };
  const [prompt_response, setprompt_response] = useState([prompt_response_obj]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTo({
        top: messagesEndRef.current.scrollHeight,
        behaviour: "smooth",
      });
    }
  }, [prompt_response]);

  const addPrompt = (prompt) => {
    if (!prompt.trim()) return;

    setprompt_response((prev) => [...prev, { prompt: prompt, response: "" }]);
  };

  const addResponse = (response) => {
    if (!response.trim()) return;

    setprompt_response((prev) => {
      if (prev.length === 0) return prev;

      const lastIndex = prev.length - 1;
      const updatedMessage = [...prev];
      updatedMessage[lastIndex] = {
        ...updatedMessage[lastIndex],
        response: response,
      };

      return updatedMessage;
    });
  };

  const vad = useMicVAD({
    startOnLoad: false,
    onSpeechEnd: (audio) => {
      console.log("User stopped speaking", typeof audio);
      currentStateRef.current = STATES.PROCESSING;
      sendStream(audio);
      setNotification("User stopped speaking");
      // console.log("Audio", audio);
    },
    onSpeechStart: () => {
      console.log("Speech started");
      if (showStartSpeaking) {
        setshowStartSpeaking(false);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      currentStateRef.current = STATES.LISTENING;
      setNotification("Listening....");
    },
  });
  VADRef.current = vad;

  //send audio stream to backend
  const sendStream = (audio) => {
    const response_data = {
      type: "audio_metadata",
      format: "audio_bytes",
      message: "Audio metadata for the upcoming audio",
    };

    const wavBlob = encodeWAV(audio);

    websocketRef.current.send(wavBlob);
    console.log("Ohkayy", wavBlob);
  };

  // voiceIntervalRef.current = setInterval(() => {
  //   if (VADRef.current.userSpeaking) {
  //     speechCounterRef.current++;
  //     if (VADRef.current.userSpeaking && speechCounterRef.current > 2) {
  //       // cancel the previous request sent and pause the audio instantly

  //       // request cancellation logic here
  //       // set state to LISTENING
  //       currentStateRef.current = STATES.LISTENING;
  //       audioRef.current.pause();
  //       // reset the speechcounter
  //       speechCounterRef.current = 0;
  //     }
  //     if (silenceTimerRef.current) {
  //       clearTimeout(silenceTimerRef.current);
  //       silenceTimerRef.current = null;
  //     }
  //   } else {
  //     speechCounterRef.current = 0;
  //     if (!silenceTimerRef.current && currentStateRef.current == "listening") {
  //       silenceTimerRef.current = setTimeout(() => {
  //         console.log("Stopping audio after 1 second of silence");
  //         VADRef.current.pause();
  //         currentStateRef.current = "processing";
  //       }, 5000);
  //     }
  //   }
  // }, 200);

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
      console.log("New Message from server, Content:", event.data);

      const response_data = JSON.parse(event.data);
      console.log("Parsed Response:", response_data);
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
              setShowMicrophone(false);
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
          className="text-center text-3xl roboto-300 text-zinc-300 whitespace-pre"
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
            className="lg:w-[70vw] h-[20vh] overflow-y-scroll scrollbar-hide"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
            }}
          >
            {prompt_response?.map((pair, index) => (
              <div
                key={index}
                className="prompt-response-box flex flex-col gap-y-8 py-2 px-8"
              >
                {pair["prompt"] ? (
                  <div className="prompt-box rounded-lg border border-white/20 inter-200 backdrop-blur-sm p-2 self-end w-[40%]">
                    <p className="inter-300 text-zinc-100">{pair["prompt"]}</p>
                  </div>
                ) : null}

                {pair["response"] ? (
                  <div className="prompt-box w-1/2 border border border-white/20 backdrop-blur-sm p-2 rounded-lg inter-300">
                    <p className="text-zinc-100">{pair["response"]}</p>
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
