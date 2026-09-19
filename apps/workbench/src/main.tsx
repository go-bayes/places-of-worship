import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AgentIntake } from "./concepts/AgentIntake";
import "./styles/theme.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("missing #root element");

createRoot(rootElement).render(
  <StrictMode>
    {new URLSearchParams(window.location.search).get("concept") === "agent" ? <AgentIntake /> : <App />}
  </StrictMode>,
);
