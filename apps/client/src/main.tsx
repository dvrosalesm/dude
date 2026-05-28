import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/globals.css";
import hostConfig from "../../../specialists.config.client";
import { initSpecialistMeta } from "@dude/chat/specialists/specialist-meta";
import { AppRouter } from "./router";
import { DesktopWindowChrome } from "./desktop-window-chrome";
import { installDesktopFetchShim } from "./desktop-fetch-shim";

initSpecialistMeta(hostConfig);

if (typeof window !== "undefined" && window.location.protocol === "file:") {
  installDesktopFetchShim();
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <DesktopWindowChrome />
    </>
  </React.StrictMode>,
);
