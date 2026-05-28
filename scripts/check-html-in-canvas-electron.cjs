const { app, BrowserWindow } = require("electron");

app.commandLine.appendSwitch("enable-features", "CanvasDrawElement");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true },
  });

  await win.loadURL(
    "data:text/html;charset=utf-8," +
      encodeURIComponent(`
        <canvas id="c" layoutsubtree width="100" height="100">
          <div id="child">hi</div>
        </canvas>
      `),
  );

  const result = await win.webContents.executeJavaScript(`
    (() => {
      const canvas = document.getElementById('c');
      const ctx = canvas.getContext('2d');
      return {
        chromium: navigator.userAgent,
        requestPaint: typeof canvas.requestPaint,
        drawElementImage: ctx && typeof ctx.drawElementImage,
      };
    })()
  `);

  console.log(JSON.stringify(result, null, 2));
  app.quit();
});
