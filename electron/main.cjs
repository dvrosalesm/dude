const { app, BrowserWindow, ipcMain, nativeImage, shell } = require("electron");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const Database = require("better-sqlite3");

// HTML-in-Canvas (Chromium 148+). No-op on older Electron builds, but ready when upgraded.
app.commandLine.appendSwitch("enable-features", "CanvasDrawElement");

const SERVER_START_TIMEOUT_MS = 45_000;
const GATEWAY_START_TIMEOUT_MS = 90_000;
const SERVER_POLL_INTERVAL_MS = 250;

let mainWindow = null;
let appIcon = null;
let appUrl = process.env.DUDE_DESKTOP_DEV_URL || null;
let gatewayProcess = null;
let gatewayUrl = process.env.DUDE_GATEWAY_URL || null;
let gatewayApiKey = process.env.GATEWAY_API_KEY || null;
let localDb = null;

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function loadDesktopEnv() {
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
    path.join(getServerRoot(), ".env.local"),
    path.join(getServerRoot(), ".env"),
  ];

  if (app.isPackaged) {
    candidates.push(
      path.join(process.resourcesPath, "dude.env"),
      path.join(app.getPath("userData"), "dude.env"),
    );
  }

  for (const candidate of candidates) {
    parseEnvFile(candidate);
  }
}

function isLocalBundleMode() {
  return app.isPackaged || process.env.DUDE_DESKTOP_FORCE_LOCAL === "1";
}

function getRendererIndexPath() {
  if (process.env.DUDE_DESKTOP_RENDERER_DIR) {
    return path.join(path.resolve(process.env.DUDE_DESKTOP_RENDERER_DIR), "index.html");
  }

  if (app.isPackaged) {
    return path.join(app.getAppPath(), "dist", "index.html");
  }

  return path.join(process.cwd(), "dist", "index.html");
}

function getServerRoot() {
  if (process.env.DUDE_SERVER_ROOT) {
    return path.resolve(process.env.DUDE_SERVER_ROOT);
  }

  if (app.isPackaged) {
    return path.join(process.resourcesPath, "dude-server");
  }

  return path.join(process.cwd(), "apps", "api");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isServerReady(url) {
  return new Promise((resolve) => {
    const request = http.get(`${url}/healthz`, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_START_TIMEOUT_MS) {
    if (await isServerReady(url)) return;
    await wait(SERVER_POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for local renderer at ${url}`);
}

function isViteDevServerReady(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 400);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForViteDevServer(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_START_TIMEOUT_MS) {
    if (await isViteDevServerReady(url)) return;
    await wait(SERVER_POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for Vite dev server at ${url}`);
}

function isGatewayReady(url) {
  return new Promise((resolve) => {
    const request = http.get(`${url}/v1/health`, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForGateway(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < GATEWAY_START_TIMEOUT_MS) {
    if (await isGatewayReady(url)) return;
    await wait(SERVER_POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for local gateway at ${url}`);
}

function createGatewayApiKey() {
  return randomBytes(24).toString("hex");
}

function getLocalDbPath() {
  return path.join(os.homedir(), ".dude", "dude-local.sqlite");
}

function getLocalDb() {
  if (localDb) return localDb;

  const dbPath = getLocalDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  localDb = new Database(dbPath);
  localDb.pragma("journal_mode = WAL");
  localDb.pragma("foreign_keys = ON");
  localDb.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      specialist_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      configurations TEXT NOT NULL DEFAULT '{}',
      data TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_workspaces_specialist
      ON workspaces (specialist_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS threads (
      key TEXT PRIMARY KEY,
      messages TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_messages (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      applies_to TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  localDb.exec("DROP TABLE IF EXISTS organizations");
  migrateLocalDbSchema(localDb);
  return localDb;
}

function readJsonColumn(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function migrateLocalDbSchema(db) {
  const columns = db.prepare("PRAGMA table_info(workspaces)").all();
  if (columns.length === 0) return;

  const columnNames = new Set(columns.map((column) => column.name));
  const expectedColumns = [
    "id",
    "specialist_id",
    "name",
    "status",
    "configurations",
    "data",
    "created_at",
    "updated_at",
  ];
  const schemaMatches =
    expectedColumns.every((name) => columnNames.has(name)) &&
    columnNames.size === expectedColumns.length;

  if (schemaMatches) return;

  console.log("[desktop] Migrating local workspaces table to current schema");

  const rows = db.prepare("SELECT * FROM workspaces").all();
  const now = new Date().toISOString();

  db.exec(`
    CREATE TABLE workspaces__next (
      id TEXT PRIMARY KEY,
      specialist_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      configurations TEXT NOT NULL DEFAULT '{}',
      data TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const insertWorkspace = db.prepare(`
    INSERT INTO workspaces__next (
      id,
      specialist_id,
      name,
      status,
      configurations,
      data,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @specialist_id,
      @name,
      @status,
      @configurations,
      @data,
      @created_at,
      @updated_at
    )
  `);

  const migrate = db.transaction(() => {
    for (const row of rows) {
      const fromData =
        row.data && typeof row.data === "string"
          ? readJsonColumn(row.data, null)
          : null;
      const workspace =
        fromData && typeof fromData === "object"
          ? fromData
          : {
              id: row.id,
              specialistId: row.specialist_id,
              name: row.name,
              status: row.status,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              configurations: readJsonColumn(row.configurations, {}),
            };

      insertWorkspace.run({
        id: String(workspace.id || row.id),
        specialist_id:
          workspace.specialistId || row.specialist_id || "main-assistant",
        name: workspace.name || row.name || "Untitled workspace",
        status: workspace.status || row.status || "draft",
        created_at: workspace.createdAt || row.created_at || now,
        updated_at: workspace.updatedAt || row.updated_at || now,
        configurations: JSON.stringify(workspace.configurations || {}),
        data: JSON.stringify(workspace),
      });
    }

    db.exec(`
      DROP TABLE workspaces;
      ALTER TABLE workspaces__next RENAME TO workspaces;
      CREATE INDEX IF NOT EXISTS idx_workspaces_specialist
        ON workspaces (specialist_id, updated_at DESC);
    `);
  });

  migrate();
}

function readLocalStateFromDb() {
  const db = getLocalDb();
  const workspaces = {};
  const threads = {};
  const files = {};

  for (const row of db
    .prepare(
      "SELECT id, specialist_id, name, status, created_at, updated_at, configurations, data FROM workspaces",
    )
    .all()) {
    const fromColumn = readJsonColumn(row.configurations, {});
    const fromData = readJsonColumn(row.data, null);
    const dataConfigurations =
      fromData &&
      typeof fromData === "object" &&
      fromData.configurations &&
      typeof fromData.configurations === "object"
        ? fromData.configurations
        : {};

    const mergedConfigurations = {
      ...dataConfigurations,
      ...fromColumn,
    };

    workspaces[row.id] =
      fromData && typeof fromData === "object"
        ? {
            ...fromData,
            id: row.id,
            specialistId: fromData.specialistId || row.specialist_id,
            name: fromData.name || row.name,
            status: fromData.status || row.status,
            createdAt: fromData.createdAt || row.created_at,
            updatedAt: row.updated_at || fromData.updatedAt,
            configurations: mergedConfigurations,
          }
        : {
            id: row.id,
            specialistId: row.specialist_id,
            name: row.name,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            configurations: mergedConfigurations,
          };
  }

  for (const row of db.prepare("SELECT key, messages FROM threads").all()) {
    threads[row.key] = readJsonColumn(row.messages, []);
  }

  for (const row of db.prepare("SELECT id, data FROM files").all()) {
    files[row.id] = readJsonColumn(row.data, null);
  }

  return {
    threads,
    workspaces,
    files,
  };
}

function writeLocalStateToDb(state) {
  const db = getLocalDb();
  const now = new Date().toISOString();
  const workspaces =
    state && typeof state.workspaces === "object" ? state.workspaces : {};
  const threads =
    state && typeof state.threads === "object" ? state.threads : {};
  const files =
    state && typeof state.files === "object" ? state.files : {};

  const write = db.transaction(() => {
    db.prepare("DELETE FROM workspaces").run();
    db.prepare("DELETE FROM threads").run();
    db.prepare("DELETE FROM files").run();

    const insertWorkspace = db.prepare(`
      INSERT INTO workspaces (
        id,
        specialist_id,
        name,
        status,
        created_at,
        updated_at,
        configurations,
        data
      )
      VALUES (
        @id,
        @specialist_id,
        @name,
        @status,
        @created_at,
        @updated_at,
        @configurations,
        @data
      )
    `);
    for (const [id, workspace] of Object.entries(workspaces)) {
      if (!workspace || typeof workspace !== "object") continue;
      insertWorkspace.run({
        id,
        specialist_id: workspace.specialistId || "main-assistant",
        name: workspace.name || "Untitled workspace",
        status: workspace.status || "draft",
        created_at: workspace.createdAt || now,
        updated_at: workspace.updatedAt || now,
        configurations: JSON.stringify(workspace.configurations || {}),
        data: JSON.stringify(workspace),
      });
    }

    const insertThread = db.prepare(`
      INSERT INTO threads (key, messages, updated_at)
      VALUES (@key, @messages, @updated_at)
    `);
    for (const [key, messages] of Object.entries(threads)) {
      insertThread.run({
        key,
        messages: JSON.stringify(Array.isArray(messages) ? messages : []),
        updated_at: now,
      });
    }

    const insertFile = db.prepare(`
      INSERT INTO files (id, data, updated_at)
      VALUES (@id, @data, @updated_at)
    `);
    for (const [id, file] of Object.entries(files)) {
      if (!file || typeof file !== "object") continue;
      insertFile.run({
        id,
        data: JSON.stringify(file),
        updated_at: file.updatedAt || now,
      });
    }
  });

  write();
}

async function startLocalGateway() {
  if (process.env.DUDE_GATEWAY_DISABLED === "1") return null;

  const port = Number(
    process.env.DUDE_API_PORT || process.env.DUDE_GATEWAY_PORT || 8787,
  );

  if (process.env.DUDE_GATEWAY_URL) {
    gatewayUrl = process.env.DUDE_GATEWAY_URL.replace(/\/+$/, "");
    gatewayApiKey = process.env.GATEWAY_API_KEY || process.env.PIMONO_GATEWAY_API_KEY || "";
    await waitForGateway(gatewayUrl);
    return gatewayUrl;
  }

  const serverRoot = getServerRoot();
  const packageJsonPath = path.join(serverRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Missing unified server package at ${packageJsonPath}`);
  }

  gatewayUrl = `http://127.0.0.1:${port}`;
  gatewayApiKey =
    process.env.GATEWAY_API_KEY ||
    process.env.PIMONO_GATEWAY_API_KEY ||
    createGatewayApiKey();

  if (await isGatewayReady(gatewayUrl)) {
    return gatewayUrl;
  }

  // `desktop:dev` starts the API via concurrently — wait for it instead of spawning
  // a second process with system Node (which breaks better-sqlite3 ABI).
  if (!app.isPackaged && process.env.DUDE_DESKTOP_DEV_URL) {
    await waitForGateway(gatewayUrl);
    return gatewayUrl;
  }

  const command = app.isPackaged ? process.execPath : "npm";
  const args = app.isPackaged
    ? [path.join(serverRoot, "dist", "index.js")]
    : ["run", "dev", "-w", "@dude/api"];

  gatewayProcess = spawn(command, args, {
    cwd: app.isPackaged ? serverRoot : process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DUDE_API_PORT: String(port),
      DUDE_DB_PATH: getLocalDbPath(),
      GATEWAY_INTERNAL_PORT: String(port),
      GATEWAY_API_KEY: gatewayApiKey,
      PIMONO_GATEWAY_API_KEY: gatewayApiKey,
      NEXTJS_INTERNAL_URL:
        process.env.NEXTJS_INTERNAL_URL || gatewayUrl,
      DUDE_SERVER_URL: gatewayUrl,
    },
    stdio: process.env.DUDE_DESKTOP_DEBUG_GATEWAY === "1" ? "inherit" : "pipe",
  });

  gatewayProcess.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM" && signal !== "SIGINT") {
      console.error(`[desktop] local gateway exited with ${code ?? signal}`);
    }
    gatewayProcess = null;
  });

  if (gatewayProcess.stdout && process.env.DUDE_DESKTOP_DEBUG_GATEWAY !== "1") {
    gatewayProcess.stdout.on("data", (chunk) => {
      if (process.env.DUDE_DESKTOP_LOG_GATEWAY === "1") {
        process.stdout.write(`[gateway] ${chunk}`);
      }
    });
  }
  if (gatewayProcess.stderr && process.env.DUDE_DESKTOP_DEBUG_GATEWAY !== "1") {
    gatewayProcess.stderr.on("data", (chunk) => {
      if (process.env.DUDE_DESKTOP_LOG_GATEWAY === "1") {
        process.stderr.write(`[gateway] ${chunk}`);
      }
    });
  }

  await waitForGateway(gatewayUrl);
  return gatewayUrl;
}

function getLocalRendererUrl() {
  const rendererIndex = getRendererIndexPath();
  if (!fs.existsSync(rendererIndex)) {
    throw new Error(
      `Missing Vite renderer at ${rendererIndex}. Run npm run desktop:prepare first.`,
    );
  }
  const initialRoute = process.env.DUDE_DESKTOP_INITIAL_ROUTE || "/chat";
  return `${pathToFileURL(rendererIndex).toString()}?dudeRoute=${encodeURIComponent(initialRoute)}`;
}

function getAppIconCandidates() {
  const iconNames =
    process.platform === "darwin"
      ? ["dude-icon-dock.png", "icon.png"]
      : ["icon.png", "dude-icon-dock.png"];

  const roots = [
    path.join(__dirname),
    path.join(__dirname, ".."),
    process.cwd(),
  ];
  const relativePaths = [
    ...iconNames.map((name) => path.join("public", "assets", name)),
    "icon.png",
  ];
  const candidates = [];

  for (const relativePath of relativePaths) {
    for (const root of roots) {
      const candidate = path.join(root, relativePath);
      if (fs.existsSync(candidate) && !candidates.includes(candidate)) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

function loadAppIcon() {
  for (const candidate of getAppIconCandidates()) {
    const image = nativeImage.createFromPath(candidate);
    if (!image.isEmpty()) {
      console.log(`[desktop] Using app icon ${candidate}`);
      return image;
    }
  }

  return undefined;
}

function applyAppIcon() {
  const icon = loadAppIcon();
  if (!icon) {
    console.warn("[desktop] No usable app icon found in public/assets/");
    return undefined;
  }

  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(icon);
  }

  return icon;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: "Dude",
    backgroundColor: "#101010",
    frame: false,
    show: false,
    ...(appIcon ? { icon: appIcon } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  void mainWindow.loadURL(url);
}

async function boot() {
  loadDesktopEnv();
  await startLocalGateway();

  appUrl = isLocalBundleMode()
    ? getLocalRendererUrl()
    : process.env.DUDE_DESKTOP_DEV_URL || "http://127.0.0.1:5173";

  if (!isLocalBundleMode()) {
    await waitForViteDevServer(appUrl);
  }

  createWindow(appUrl);
}

ipcMain.handle("dude:gateway-info", () => ({
  url: gatewayUrl,
  running: Boolean(gatewayUrl),
}));

ipcMain.handle("dude:local-data-info", () => ({
  path: getLocalDbPath(),
}));

ipcMain.handle("dude:window-minimize", () => {
  mainWindow?.minimize();
  return { ok: true };
});

ipcMain.handle("dude:window-maximize", () => {
  if (!mainWindow) return { ok: false };
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return { ok: true, maximized: mainWindow.isMaximized() };
});

ipcMain.handle("dude:window-close", () => {
  mainWindow?.close();
  return { ok: true };
});

ipcMain.handle("dude:local-state-read", () => readLocalStateFromDb());

ipcMain.handle("dude:local-state-write", (_event, state) => {
  writeLocalStateToDb(state);
  return { ok: true };
});

ipcMain.handle("dude:gateway-request", async (_event, request) => {
  if (!gatewayUrl || !gatewayApiKey) {
    return {
      ok: false,
      status: 503,
      data: { error: "Local gateway is not running" },
    };
  }

  const method = String(request?.method || "GET").toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return {
      ok: false,
      status: 400,
      data: { error: `Unsupported method: ${method}` },
    };
  }

  const requestPath = String(request?.path || "");
  if (!requestPath.startsWith("/") || requestPath.startsWith("//")) {
    return {
      ok: false,
      status: 400,
      data: { error: "Gateway path must start with /" },
    };
  }

  const headers = {
    "Content-Type": "application/json",
    ...(request?.headers && typeof request.headers === "object"
      ? request.headers
      : {}),
    Authorization: `Bearer ${gatewayApiKey}`,
  };

  try {
    const response = await fetch(`${gatewayUrl}/v1${requestPath}`, {
      method,
      headers,
      body:
        method === "GET" || method === "DELETE"
          ? undefined
          : JSON.stringify(request?.body ?? {}),
      signal: AbortSignal.timeout(Number(request?.timeoutMs || 120_000)),
    });
    const text = await response.text();
    let data = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // keep raw text
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      data: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
});

const AGENT_CHAT_TURN_TIMEOUT_MS = 20 * 60 * 1000;

ipcMain.handle("dude:gateway-stream", async (event, request) => {
  if (!gatewayUrl || !gatewayApiKey) {
    return {
      ok: false,
      status: 503,
      data: { error: "Local gateway is not running" },
    };
  }

  const method = String(request?.method || "GET").toUpperCase();
  if (method !== "GET") {
    return {
      ok: false,
      status: 400,
      data: { error: "Gateway stream only supports GET" },
    };
  }

  const requestPath = String(request?.path || "");
  if (!requestPath.startsWith("/") || requestPath.startsWith("//")) {
    return {
      ok: false,
      status: 400,
      data: { error: "Gateway path must start with /" },
    };
  }

  const streamId = String(request?.streamId || "");
  const headers = {
    Accept: "text/event-stream",
    ...(request?.headers && typeof request.headers === "object"
      ? request.headers
      : {}),
    Authorization: `Bearer ${gatewayApiKey}`,
  };

  try {
    const response = await fetch(`${gatewayUrl}/v1${requestPath}`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(
        Number(request?.timeoutMs || AGENT_CHAT_TURN_TIMEOUT_MS),
      ),
    });

    if (!response.ok) {
      const text = await response.text();
      let data = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // keep raw text
      }
      return {
        ok: false,
        status: response.status,
        data,
      };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return {
        ok: false,
        status: 500,
        data: { error: "Gateway stream returned no body" },
      };
    }

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      event.sender.send("dude:gateway-stream-data", {
        streamId,
        chunk: decoder.decode(value, { stream: true }),
      });
    }
    const trailing = decoder.decode();
    if (trailing) {
      event.sender.send("dude:gateway-stream-data", {
        streamId,
        chunk: trailing,
      });
    }

    return {
      ok: true,
      status: response.status,
      data: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      data: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
});

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.setName("Dude");
  }

  appIcon = applyAppIcon();

  boot().catch((error) => {
    console.error("[desktop] Failed to start Dude:", error);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && appUrl) {
      createWindow(appUrl);
    }
  });
});

app.on("before-quit", () => {
  mainWindow = null;
  if (localDb) {
    localDb.close();
    localDb = null;
  }
  if (gatewayProcess) {
    gatewayProcess.kill("SIGTERM");
    gatewayProcess = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
