const { app, BrowserWindow } = require("electron");
const path = require("node:path");

app.commandLine.appendSwitch("enable-features", "CanvasDrawElement");

const devUrl = process.env.DUDE_DESKTOP_DEV_URL || "http://127.0.0.1:5173/chat";

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../electron/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await win.loadURL(devUrl, { timeout: 30000 });
    await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const deadline = Date.now() + 15000;
        const poll = () => {
          const shell = document.querySelector('[data-html-in-canvas]');
          if (shell || Date.now() > deadline) {
            resolve({
              desktop: Boolean(window.dudeDesktop?.isDesktop),
              htmlInCanvasFlag: Boolean(window.dudeDesktop?.htmlInCanvas?.flagEnabled),
              mode: shell?.getAttribute('data-html-in-canvas') ?? null,
              chromium: navigator.userAgent.match(/Chrome\\/([\\d.]+)/)?.[1] ?? null,
              requestPaint: typeof HTMLCanvasElement.prototype.requestPaint,
              drawElementImage: (() => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                return typeof ctx?.drawElementImage;
              })(),
            });
            return;
          }
          window.requestAnimationFrame(poll);
        };
        poll();
      })
    `).then((result) => {
      console.log(JSON.stringify(result, null, 2));
      app.exit(result.mode === "native" ? 0 : 1);
    });
  } catch (error) {
    console.error(error);
    app.exit(2);
  }
});
