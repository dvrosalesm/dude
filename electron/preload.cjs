const { contextBridge, ipcRenderer } = require("electron");

function randomUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

contextBridge.exposeInMainWorld("dudeDesktop", {
  isDesktop: true,
  platform: process.platform,
  htmlInCanvas: {
    flagEnabled: true,
  },
  localData: {
    info: () => ipcRenderer.invoke("dude:local-data-info"),
    readState: () => ipcRenderer.invoke("dude:local-state-read"),
    writeState: (state) => ipcRenderer.invoke("dude:local-state-write", state),
  },
  gateway: {
    info: () => ipcRenderer.invoke("dude:gateway-info"),
    request: (request) => ipcRenderer.invoke("dude:gateway-request", request),
    stream: (request, onChunk) => {
      const streamId = randomUUID();
      const handler = (_event, payload) => {
        if (!payload || payload.streamId !== streamId) return;
        onChunk(String(payload.chunk || ""));
      };
      ipcRenderer.on("dude:gateway-stream-data", handler);
      return ipcRenderer
        .invoke("dude:gateway-stream", { ...request, streamId })
        .finally(() => {
          ipcRenderer.removeListener("dude:gateway-stream-data", handler);
        });
    },
  },
  windowControls: {
    minimize: () => ipcRenderer.invoke("dude:window-minimize"),
    maximize: () => ipcRenderer.invoke("dude:window-maximize"),
    close: () => ipcRenderer.invoke("dude:window-close"),
  },
});
