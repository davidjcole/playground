import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 4173;

const db = new DatabaseSync(path.join(__dirname, "urls.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS created_urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    region TEXT,
    landing_page TEXT NOT NULL,
    platform TEXT NOT NULL,
    medium TEXT NOT NULL,
    tracking_date TEXT,
    topic TEXT,
    campaign TEXT NOT NULL,
    actionkit_source TEXT,
    final_url TEXT NOT NULL
  )
`);

try {
  db.exec(`ALTER TABLE created_urls ADD COLUMN tracking_date TEXT`);
} catch {
  // Column already exists on existing databases.
}

try {
  db.exec(`ALTER TABLE created_urls ADD COLUMN topic TEXT`);
} catch {
  // Column already exists on existing databases.
}

db.exec(`
  CREATE TABLE IF NOT EXISTS allowed_values (
    category TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (category, value)
  )
`);

const insertUrl = db.prepare(`
  INSERT INTO created_urls (
    region,
    landing_page,
    platform,
    medium,
    tracking_date,
    topic,
    campaign,
    actionkit_source,
    final_url
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const listUrls = db.prepare(`
  SELECT
    id,
    created_at,
    region,
    landing_page,
    platform,
    medium,
    tracking_date,
    topic,
    campaign,
    actionkit_source,
    final_url
  FROM created_urls
  ORDER BY datetime(created_at) DESC, id DESC
  LIMIT 500
`);

const listAllowedValues = db.prepare(`
  SELECT category, value
  FROM allowed_values
  ORDER BY category, value
`);

const clearAllowedValues = db.prepare(`DELETE FROM allowed_values WHERE category = ?`);
const insertAllowedValue = db.prepare(`
  INSERT OR IGNORE INTO allowed_values (category, value)
  VALUES (?, ?)
`);
const EMPTY_SENTINEL = "__EMPTY__";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/urls") {
    return sendJson(res, 200, listUrls.all());
  }

  if (req.method === "GET" && req.url === "/api/settings") {
    const rows = listAllowedValues.all();
    const settings = { configured: rows.length > 0, regions: [], platforms: [], mediums: [] };
    for (const row of rows) {
      if (row.value === EMPTY_SENTINEL) continue;
      if (row.category === "regions") settings.regions.push(row.value);
      if (row.category === "platforms") settings.platforms.push(row.value);
      if (row.category === "mediums") settings.mediums.push(row.value);
    }
    return sendJson(res, 200, settings);
  }

  if (req.method === "POST" && req.url === "/api/urls") {
    try {
      const rawBody = await readBody(req);
      const payload = JSON.parse(rawBody || "{}");

      const requiredFields = ["landingPage", "platform", "medium", "campaign", "finalUrl"];
      const missingField = requiredFields.find((field) => !payload[field]);
      if (missingField) return sendJson(res, 400, { error: `Missing field: ${missingField}` });

      insertUrl.run(
        payload.region || "",
        payload.landingPage,
        payload.platform,
        payload.medium,
        payload.trackingDate || "",
        payload.topic || "",
        payload.campaign,
        payload.actionkitSource || "",
        payload.finalUrl
      );

      return sendJson(res, 201, { ok: true });
    } catch {
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }
  }

  if (req.method === "POST" && req.url === "/api/settings") {
    try {
      const rawBody = await readBody(req);
      const payload = JSON.parse(rawBody || "{}");
      const categories = ["regions", "platforms", "mediums"];

      for (const category of categories) {
        if (!Array.isArray(payload[category])) {
          return sendJson(res, 400, { error: `Expected ${category} to be an array.` });
        }
      }

      db.exec("BEGIN");
      for (const category of categories) {
        clearAllowedValues.run(category);
        const values = payload[category]
          .filter((value) => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean);
        if (!values.length) {
          insertAllowedValue.run(category, EMPTY_SENTINEL);
        }
        for (const value of values) {
          if (typeof value === "string" && value.trim()) {
            insertAllowedValue.run(category, value.trim());
          }
        }
      }
      db.exec("COMMIT");
      return sendJson(res, 200, { ok: true });
    } catch {
      try {
        db.exec("ROLLBACK");
      } catch {
        // Ignore rollback failures if no transaction started.
      }
      return sendJson(res, 400, { error: "Invalid JSON payload." });
    }
  }

  return sendJson(res, 404, { error: "Not found" });
}

async function serveStatic(req, res) {
  const requestPath =
    req.url === "/"
      ? "/index.html"
      : req.url === "/history"
        ? "/history.html"
        : req.url === "/help"
          ? "/help.html"
          : req.url === "/settings"
            ? "/settings.html"
          : req.url;
  const cleanPath = requestPath.split("?")[0];
  const filePath = path.join(__dirname, cleanPath);

  if (!filePath.startsWith(__dirname) || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  const contentType = contentTypes[ext] || "application/octet-stream";
  const file = await readFile(filePath);
  res.writeHead(200, { "Content-Type": contentType });
  res.end(file);
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  if (req.url.startsWith("/api/")) {
    await handleApi(req, res);
    return;
  }

  try {
    await serveStatic(req, res);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal server error");
  }
});

server.listen(PORT, () => {
  console.log(`350 source code generator listening on http://localhost:${PORT}`);
});
