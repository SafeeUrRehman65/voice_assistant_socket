import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./App.css";
import { VoiceAssistant } from "./App.jsx";
import Tester from "./Test.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <VoiceAssistant />
  </StrictMode>
);
