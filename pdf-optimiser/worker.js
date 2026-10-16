importScripts("vendor/pdf-lib/pdf-lib.min.js", "ranges.js", "core.js");

self.onmessage = async ({ data }) => {
  try {
    if (data.action === "assemble" || data.action === "split") {
      self.postMessage({ status: "Assembling pages..." });
      const documents = await PDFOptimiser.prepareSources(data.sources.map((bytes) => new Uint8Array(bytes)));
      if (data.action === "assemble") {
        const bytes = await PDFOptimiser.assembleDocuments(documents, data.plan);
        self.postMessage({ bytes }, [bytes.buffer]);
      } else {
        importScripts("vendor/fflate/index.js");
        const groups = PDFOptimiser.parseRanges(data.ranges, data.plan.length);
        const files = {};
        let size = 0;
        for (let index = 0; index < groups.length; index++) {
          const group = groups[index];
          const bytes = await PDFOptimiser.assembleDocuments(documents, group.map((page) => data.plan[page]));
          size += bytes.length;
          if (size > PDFOptimiser.MAX_BYTES) throw new Error("The split PDFs exceed 50 MB combined. Export fewer pages.");
          const range = group.length === 1 ? `${group[0] + 1}` : `${group[0] + 1}-${group[group.length - 1] + 1}`;
          files[`${String(index + 1).padStart(2, '0')}-pages-${range}.pdf`] = bytes;
        }
        const bytes = fflate.zipSync(files, { level: 0 });
        self.postMessage({ bytes, files: Object.keys(files) }, [bytes.buffer]);
      }
      return;
    }
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
