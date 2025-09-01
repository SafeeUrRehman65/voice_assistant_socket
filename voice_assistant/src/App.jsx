import { useEffect, useRef, useState } from "react";
import reactLogo from "./assets/react.svg";
import SplineChips from "./components/spline-chips.jsx";
import viteLogo from "/vite.svg";
import "./App.css";
import { typeGreeting } from "./utils/typeUtil.js";
import { FaMicrophone } from "react-icons/fa";
import { STATES } from "./utils/STATES.js";
import { useMicVAD } from "@ricky0123/vad-react";

export const VoiceAssistant = () => {
  const [count, setCount] = useState(0);
  const [websocket, setWebSocket] = useState(null);
  const [inboxMessage, setInboxMessage] = useState(null);
  const [sentMessage, setSentMessage] = useState(null);
  const [notification, setNotification] = useState("");
  const audioRef = useRef(null);
  const currentStateRef = useRef();
  const [isRecording, setisRecording] = useState();
  const [greeting, setGreeting] = useState("How may I help you today?");
  const [showMicrophone, setShowMicrophone] = useState(true);
  const greetingRef = useRef(null);
  const timerRefWord = useRef();
  const websocketRef = useRef(null);
  const timerRefChar = useRef();
  const VADRef = useRef();
  const voiceIntervalRef = useRef();
  const silenceTimerRef = useRef(null);
  const speechCounterRef = useRef(0);

  const vad = useMicVAD({
    startOnLoad: false,
    onSpeechEnd: (audio) => {
      console.log("User stopped speaking");
      sendStream(audio);
      setNotification("User stopped speaking");
      console.log("Audio", audio);
    },
    onSpeechStart: () => {
      console.log("Speech started");
      setNotification("Speech recording started");
    },
  });
  VADRef.current = vad;

  //send audio stream to backend
  const sendStream = (audio) => {
    const response_data = {
      type: "audio_metadata",
      format: audio.type,
      size: audio.size,
      message: "Audio metadata for the upcoming audio",
    };
    const reader = new FileReader();

    reader.onload = () => {
      const arrayBuffer = reader.result;
      websocketRef.current.send(arrayBuffer);
    };
    reader.readAsArrayBuffer(audio);
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
              setShowMicrophone(false);
              audioRef.current.onended = () => {
                VADRef.current.start();
                currentStateRef.current = STATES.LISTENING;
                setNotification("Conersation started, start Speaking!");
                console.log(currentStateRef.current);
              };
            }
            break;

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
    <div className="w-screen h-screen bg-stars-back bg-cover ">
      <div className="h-[6vh] w-full">
        <p className="text-white text-sm rounded-lg font-roboto-300 px-3 py-2 border border-gray-100 w-max">
          {notification}
        </p>
      </div>
      <div className="w-full h-[60%] shadow-2xl shadow-violet-500/20">
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
      ) : null}
      <div>
        <audio ref={audioRef} controls></audio>
      </div>
    </div>
  );
};
