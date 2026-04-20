const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;
const WEATHER_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const WEATHER_RATE_LIMIT_MAX = 20;
const GEOIP_CACHE_TTL_MS = 10 * 60 * 1000;
const GEOIP_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const GEOIP_RATE_LIMIT_MAX = 10;
const weatherCache = new Map();
const weatherRateLimits = new Map();
const geoIpCache = new Map();
const geoIpRateLimits = new Map();

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
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
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

    res.writeHead(200, buildSecurityHeaders({
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    }));
    res.end(data);
  });
}

function buildSecurityHeaders(headers = {}) {
  return {
    "Cache-Control": "no-store",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self'",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://api.weatherapi.com https://mapbox-event-finder.vercel.app",
      "media-src 'self' https://cdn.freesound.org",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'"
    ].join("; "),
    ...headers
  };
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "unknown";
}

function pruneExpiredEntries(store, now) {
  for (const [key, value] of store.entries()) {
    if (value.expiresAt <= now) {
      store.delete(key);
    }
  }
}

function validateWeatherLocation(location) {
  const normalized = String(location || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { ok: false, error: "Missing location query parameter" };
  }
  if (normalized.length > 100) {
    return { ok: false, error: "Location must be 100 characters or fewer" };
  }
  if (!/^[\p{L}\p{N}\s,.'-]+$/u.test(normalized)) {
    return { ok: false, error: "Location contains unsupported characters" };
  }

  return { ok: true, value: normalized };
}

function checkWeatherRateLimit(req) {
  return checkRateLimit(req, weatherRateLimits, WEATHER_RATE_LIMIT_WINDOW_MS, WEATHER_RATE_LIMIT_MAX);
}

function checkGeoIpRateLimit(req) {
  return checkRateLimit(req, geoIpRateLimits, GEOIP_RATE_LIMIT_WINDOW_MS, GEOIP_RATE_LIMIT_MAX);
}

function checkRateLimit(req, store, windowMs, maxRequests) {
  const now = Date.now();
  pruneExpiredEntries(store, now);

  const ip = getClientIp(req);
  const current = store.get(ip);
  if (!current || current.expiresAt <= now) {
    store.set(ip, {
      count: 1,
      expiresAt: now + windowMs
    });
    return { allowed: true };
  }

  current.count += 1;
  if (current.count > maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - now) / 1000))
    };
  }

  return { allowed: true };
}

function writeRateLimitedJson(res, retryAfterSeconds, payload) {
  res.writeHead(429, buildSecurityHeaders({
    "Content-Type": "application/json; charset=utf-8",
    "Retry-After": String(retryAfterSeconds)
  }));
  res.end(JSON.stringify(payload));
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

async function handleWeatherProxy(req, res, url) {
  const rateLimit = checkWeatherRateLimit(req);
  if (!rateLimit.allowed) {
    writeRateLimitedJson(res, rateLimit.retryAfterSeconds, {
      error: "Too many weather requests. Please try again shortly."
    });
    return;
  }

  const validation = validateWeatherLocation(url.searchParams.get("q"));
  if (!validation.ok) {
    sendJson(res, 400, { error: validation.error });
    return;
  }

  const location = validation.value;

  if (!WEATHER_API_KEY) {
    sendJson(res, 500, { error: "Weather API key is not configured" });
    return;
  }

  const cacheKey = location.toLowerCase();
  const now = Date.now();
  pruneExpiredEntries(weatherCache, now);

  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    res.writeHead(200, buildSecurityHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, max-age=300"
    }));
    res.end(cached.body);
    return;
  }

  const upstreamUrl = new URL("https://api.weatherapi.com/v1/current.json");
  upstreamUrl.searchParams.set("key", WEATHER_API_KEY);
  upstreamUrl.searchParams.set("q", location);
  upstreamUrl.searchParams.set("aqi", "no");

  try {
    const upstreamResponse = await fetch(upstreamUrl);
    const body = await upstreamResponse.text();

    if (upstreamResponse.ok) {
      weatherCache.set(cacheKey, {
        body,
        expiresAt: now + WEATHER_CACHE_TTL_MS
      });
    }

    res.writeHead(upstreamResponse.status, buildSecurityHeaders({
      "Content-Type": upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": upstreamResponse.ok ? "private, max-age=300" : "no-store"
    }));
    res.end(body);
  } catch (error) {
    sendJson(res, 502, { error: "Failed to fetch weather data" });
  }
}

async function handleGeoIpProxy(req, res) {
  const rateLimit = checkGeoIpRateLimit(req);
  if (!rateLimit.allowed) {
    writeRateLimitedJson(res, rateLimit.retryAfterSeconds, {
      error: "Too many automatic location requests. Please try again shortly."
    });
    return;
  }

  const cacheKey = getClientIp(req);
  const now = Date.now();
  pruneExpiredEntries(geoIpCache, now);

  const cached = geoIpCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    res.writeHead(200, buildSecurityHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, max-age=600"
    }));
    res.end(cached.body);
    return;
  }

  const upstreamUrl = new URL("http://ip-api.com/json/");
  upstreamUrl.searchParams.set("fields", "status,message,country,regionName,city,lat,lon,query");

  try {
    const upstreamResponse = await fetch(upstreamUrl);
    const body = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      res.writeHead(upstreamResponse.status, buildSecurityHeaders({
        "Content-Type": upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }));
      res.end(body);
      return;
    }

    const parsed = JSON.parse(body);
    if (parsed.status !== "success") {
      sendJson(res, 502, { error: parsed.message || "Failed to determine location" });
      return;
    }

    geoIpCache.set(cacheKey, {
      body,
      expiresAt: now + GEOIP_CACHE_TTL_MS
    });

    res.writeHead(200, buildSecurityHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, max-age=600"
    }));
    res.end(body);
  } catch (error) {
    sendJson(res, 502, { error: "Failed to determine location" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/weather") {
    await handleWeatherProxy(req, res, url);
    return;
  }

  if (url.pathname === "/api/geoip") {
    await handleGeoIpProxy(req, res);
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
