const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, ".server-config.json");

function loadServerConfig() {
  const config = {
    baseUrl: process.env.AK_API_BASE_URL || "",
    username: process.env.AK_API_USERNAME || "",
    password: process.env.AK_API_PASSWORD || "",
  };

  if (!fs.existsSync(CONFIG_PATH)) return config;

  try {
    const fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (typeof fileConfig.baseUrl === "string") config.baseUrl = fileConfig.baseUrl;
    if (typeof fileConfig.username === "string") config.username = fileConfig.username;
    if (typeof fileConfig.password === "string") config.password = fileConfig.password;
  } catch {
    // Ignore invalid config file and keep env defaults.
  }

  return config;
}

function saveServerConfig(config) {
  const data = JSON.stringify(config, null, 2);
  fs.writeFileSync(CONFIG_PATH, data, { mode: 0o600 });
}

let serverConfig = loadServerConfig();

function isConfigured() {
  return Boolean(serverConfig.baseUrl && serverConfig.username && serverConfig.password);
}

function withTrailingSlash(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function sanitizePath(urlPath) {
  const normalized = path.normalize(urlPath).replace(/^\/+/, "");
  if (!normalized || normalized === ".") return "index.html";
  return normalized;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function sendJson(res, statusCode, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

async function handleDraftCreate(req, res) {
  if (!isConfigured()) {
    return sendJson(res, 500, {
      error:
        "Server missing ActionKit credentials. Set them in settings.html or via AK_API_BASE_URL/AK_API_USERNAME/AK_API_PASSWORD.",
    });
  }

  const body = await readJsonBody(req);
  if (!body) {
    return sendJson(res, 400, { error: "Invalid JSON body." });
  }

  const endpoint = `${withTrailingSlash(serverConfig.baseUrl)}rest/v1/mailer/`;
  const token = Buffer.from(`${serverConfig.username}:${serverConfig.password}`).toString("base64");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${token}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    const location = response.headers.get("location");

    res.writeHead(response.status, {
      "Content-Type": "application/json; charset=utf-8",
    });

    res.end(
      JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        location,
        body: responseText,
      }),
    );
  } catch (error) {
    sendJson(res, 502, {
      error: `ActionKit request failed: ${error.message}`,
    });
  }
}

function handleServerConfigGet(res) {
  sendJson(res, 200, {
    baseUrl: serverConfig.baseUrl || "",
    username: serverConfig.username || "",
    hasPassword: Boolean(serverConfig.password),
  });
}

async function handleServerConfigUpdate(req, res) {
  const body = await readJsonBody(req);
  if (!body) {
    return sendJson(res, 400, { error: "Invalid JSON body." });
  }

  const nextConfig = { ...serverConfig };

  if (typeof body.baseUrl === "string") nextConfig.baseUrl = body.baseUrl.trim();
  if (typeof body.username === "string") nextConfig.username = body.username.trim();
  if (typeof body.password === "string" && body.password.trim()) nextConfig.password = body.password;

  if (!nextConfig.baseUrl || !nextConfig.username || !nextConfig.password) {
    return sendJson(res, 400, {
      error: "baseUrl, username, and password are required. For password, provide a non-empty value.",
    });
  }

  serverConfig = nextConfig;
  try {
    saveServerConfig(serverConfig);
  } catch (error) {
    return sendJson(res, 500, { error: `Failed to save server config: ${error.message}` });
  }

  return sendJson(res, 200, {
    baseUrl: serverConfig.baseUrl,
    username: serverConfig.username,
    hasPassword: Boolean(serverConfig.password),
  });
}

function handleStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const relativePath = sanitizePath(url.pathname);
  const filePath = path.join(ROOT, relativePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(500);
      res.end("Server error");
      return;
    }

    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/server-config") {
    handleServerConfigGet(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/server-config") {
    await handleServerConfigUpdate(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/drafts") {
    await handleDraftCreate(req, res);
    return;
  }

  if (req.method === "GET") {
    handleStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
