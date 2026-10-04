const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const destination = path.join(root, "pdf-optimiser", "vendor");
fs.mkdirSync(destination, { recursive: true });
const assets = {
  "@jspawn/ghostscript-wasm": ["gs.js", "gs.wasm", "LICENSE"],
  "pdf-lib": ["dist/pdf-lib.min.js", "LICENSE.md"],
  "pdfjs-dist": ["build/pdf.min.mjs", "build/pdf.worker.min.mjs", "LICENSE"]
};
for (const [name, files] of Object.entries(assets)) {
  const directory = path.join(destination, name.split("/").pop());
  fs.mkdirSync(directory, { recursive: true });
  for (const file of files) {
    fs.copyFileSync(path.join(root, "node_modules", name, file), path.join(directory, path.basename(file)));
  }
}
// PDF.js uses these assets for embedded character maps and standard fonts.
for (const directory of ["cmaps", "standard_fonts"]) {
  fs.cpSync(path.join(root, "node_modules/pdfjs-dist", directory), path.join(destination, "pdfjs-dist", directory), { recursive: true });
}
