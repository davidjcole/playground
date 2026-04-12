const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendRedirect(res, location) {
  res.writeHead(301, { Location: location });
  res.end();
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      sendJson(res, 500, { error: "Failed to read file" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

function resolveStaticPath(requestPath) {
  const decodedPath = decodeURIComponent(requestPath);
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const relativePath = safePath.replace(/^[/\\]+/, "");
  const fullPath = path.join(ROOT, relativePath);

  if (!fullPath.startsWith(ROOT)) {
    return null;
  }

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    return {
      isDirectory: true,
      filePath: path.join(fullPath, "index.html")
    };
  }

  return {
    isDirectory: false,
    filePath: relativePath === "" ? path.join(ROOT, "index.html") : fullPath
  };
}

async function handleWeatherProxy(res, url) {
  const location = url.searchParams.get("q");

  if (!location) {
    sendJson(res, 400, { error: "Missing location query parameter" });
    return;
  }

  if (!WEATHER_API_KEY) {
    sendJson(res, 500, { error: "Weather API key is not configured" });
    return;
  }

  const upstreamUrl = new URL("https://api.weatherapi.com/v1/current.json");
  upstreamUrl.searchParams.set("key", WEATHER_API_KEY);
  upstreamUrl.searchParams.set("q", location);
  upstreamUrl.searchParams.set("aqi", "no");

  try {
    const upstreamResponse = await fetch(upstreamUrl);
    const body = await upstreamResponse.text();

    res.writeHead(upstreamResponse.status, {
      "Content-Type": upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8"
    });
    res.end(body);
  } catch (error) {
    sendJson(res, 502, { error: "Failed to fetch weather data" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/weather") {
    await handleWeatherProxy(res, url);
    return;
  }

  const resolvedPath = resolveStaticPath(url.pathname);
  if (!resolvedPath) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  if (resolvedPath.isDirectory && !url.pathname.endsWith("/")) {
    const query = url.search || "";
    sendRedirect(res, `${url.pathname}/${query}`);
    return;
  }

  sendFile(res, resolvedPath.filePath);
});

server.listen(PORT, () => {
  console.log(`Playground server listening on port ${PORT}`);
});
