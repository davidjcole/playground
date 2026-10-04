const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { test, before, after } = require("node:test");
const server = require("../server.js");

before(async () => {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function request(requestPath) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: "127.0.0.1", port: server.address().port, path: requestPath }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    }).on("error", reject);
  });
}

test("repository files and encoded private paths are blocked", async () => {
  for (const url of [
    "/.git/config", "/.env", "/package.json", "/package-lock.json", "/server.js",
    "/railway.json", "/README.md", "/scripts/prepare-pdf-assets.js",
    "/node_modules/pdf-lib/package.json", "/pdf-optimiser/tests/core.test.js",
    "/weather/README.md", "/tests/server.test.js", "/%2egit/config",
    "/%2e%2e/package.json", "/weather/%2e%2e%2fserver.js",
    "/weather/%2eenv", "/weather%5c..%5cserver.js"
  ]) {
    const response = await request(url);
    assert.equal(response.status, 403, url);
    assert.deepEqual(JSON.parse(response.body), { error: "Forbidden" });
  }
});

test("malformed paths are rejected without stopping the server", async () => {
  for (const url of ["/%", "/%FF", "/weather/scripts.js%00"]) {
    assert.equal((await request(url)).status, 403, url);
  }
  assert.equal((await request("/")).status, 200);
});

test("every application and representative browser assets remain accessible", async () => {
  for (const url of [
    "/", "/index.html", "/styles.css", "/image-optimiser/", "/jokes/",
    "/pdf-optimiser/", "/percentage-calculator/", "/prompt-examples/",
    "/readability/", "/recycle/", "/weather/", "/wordcounter/", "/zuzu-booker/",
    "/weather/scripts.js", "/weather/images/sunny.jpg",
    "/prompt-examples/prompt-library-complete.json", "/pdf-optimiser/core.js",
    "/pdf-optimiser/worker.js", "/image-optimiser/vendor/lucide.min.js",
    "/image-optimiser/vendor/cropper.min.css", "/image-optimiser/vendor/cropper.min.js",
    "/pdf-optimiser/vendor/ghostscript-wasm/gs.js", "/pdf-optimiser/vendor/ghostscript-wasm/gs.wasm",
    "/pdf-optimiser/vendor/pdf-lib/pdf-lib.min.js", "/pdf-optimiser/vendor/pdfjs-dist/pdf.min.mjs",
    "/pdf-optimiser/vendor/pdfjs-dist/pdf.worker.min.mjs",
    "/pdf-optimiser/vendor/pdfjs-dist/cmaps/Adobe-Japan1-UCS2.bcmap",
    "/pdf-optimiser/vendor/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"
  ]) {
    const response = await request(url);
    assert.equal(response.status, 200, url);
    assert.ok(response.body.length > 0, url);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
  }
});

test("application redirects preserve queries", async () => {
  const response = await request("/weather?q=London");
  assert.equal(response.status, 301);
  assert.equal(response.headers.location, "/weather/?q=London");
});

test("symlinks at otherwise public asset paths cannot expose server files", async () => {
  const link = path.join(__dirname, "../pdf-optimiser/vendor/pdfjs-dist/cmaps/security-test.bcmap");
  fs.symlinkSync(path.join(__dirname, "../server.js"), link);
  try {
    assert.equal((await request("/pdf-optimiser/vendor/pdfjs-dist/cmaps/security-test.bcmap")).status, 403);
  } finally {
    fs.unlinkSync(link);
  }
});
