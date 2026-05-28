const { app, BrowserWindow } = require("electron");
const path = require("node:path");

const devUrl = process.env.DUDE_DESKTOP_DEV_URL || "http://127.0.0.1:5173/chat";
const sandbox = process.env.DUDE_TEST_SANDBOX !== "0";

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../electron/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox,
    },
  });

  win.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("PRELOAD ERROR:", preloadPath, error);
  });

  try {
    await win.loadURL(devUrl, { timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const result = await win.webContents.executeJavaScript(`
      (() => {
        const chrome = document.querySelector("[data-dude-window-chrome]");
        const btn = document.querySelector("[data-dude-window-chrome] button");
        const styles = chrome ? getComputedStyle(chrome) : null;
        const btnStyles = btn ? getComputedStyle(btn) : null;
        return {
          sandbox: ${JSON.stringify(sandbox)},
          hasDudeDesktop: Boolean(window.dudeDesktop),
          isDesktop: Boolean(window.dudeDesktop?.isDesktop),
          hasControls: Boolean(window.dudeDesktop?.windowControls),
          chromePresent: Boolean(chrome),
          buttonPresent: Boolean(btn),
          chromeZIndex: styles?.zIndex ?? null,
          chromeDisplay: styles?.display ?? null,
          chromeHeight: styles?.height ?? null,
          btnWidth: btnStyles?.width ?? null,
          btnBg: btnStyles?.backgroundColor ?? null,
          dataDesktopApp: document.querySelector("[data-dude-desktop-app]") != null,
          shellPt9: document.querySelector("[data-dude-desktop-app] .pt-9") != null,
        };
      })()
    `);

    console.log(JSON.stringify(result, null, 2));
    app.exit(result.chromePresent ? 0 : 1);
  } catch (error) {
    console.error(error);
    app.exit(2);
  }
});
