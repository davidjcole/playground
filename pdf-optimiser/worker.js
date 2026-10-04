importScripts("vendor/pdf-lib/pdf-lib.min.js", "core.js");

self.onmessage = async ({ data }) => {
  try {
    const bytes = new Uint8Array(data.bytes);
    const source = await PDFOptimiser.inspect(bytes);
    if (data.action === "inspect") {
      self.postMessage({ pages: source.pages });
      return;
    }
    self.postMessage({ status: "Loading compression engine..." });
    importScripts("vendor/ghostscript-wasm/gs.js");
    const engine = await Module({
      locateFile: (file) => new URL(`vendor/ghostscript-wasm/${file}`, self.location.href).href,
      print: () => {},
      printErr: () => {}
    });
    engine.FS.writeFile("/input.pdf", bytes);
    self.postMessage({ status: "Compressing PDF..." });
    const code = engine.callMain(PDFOptimiser.argumentsFor(data.preset));
    if (code !== 0) throw new Error("This PDF could not be compressed. Try another document or compression setting.");
    const compressed = engine.FS.readFile("/output.pdf");
    self.postMessage({ status: "Checking the optimised document..." });
    const result = await PDFOptimiser.finish(bytes, compressed, data.removeMetadata);
    self.postMessage(result, [result.bytes.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message || "PDF processing failed. Try a smaller PDF." });
  }
};
