(function (root) {
  const library = typeof module === "object" ? require("pdf-lib") : root.PDFLib;
  const { PDFDocument, PDFDict, PDFName, degrees } = library;
  const { parseRanges } = typeof module === 'object' ? require('./ranges.js') : root.PDFPageRanges;
  const MAX_BYTES = 50 * 1024 * 1024;
  const MAX_PAGES = 200;
  const presets = { light: { setting: "printer", dpi: 300 }, balanced: { setting: "ebook", dpi: 150 }, small: { setting: "screen", dpi: 72 } };

  async function inspect(bytes) {
    if (bytes.length > MAX_BYTES) throw new Error("Choose a PDF smaller than 50 MB.");
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error("This file is not a PDF.");
    let document;
    try {
      document = await PDFDocument.load(bytes, { updateMetadata: false });
    } catch (error) {
      if (error.name === "EncryptedPDFError") throw new Error("Password-protected PDFs are not supported. Export an unlocked copy first.");
      throw new Error("This PDF could not be read. It may be damaged or unsupported.");
    }
    const pages = document.getPageCount();
    if (!pages || pages > MAX_PAGES) throw new Error("Choose a PDF with 1 to 200 pages.");
    for (const [, object] of document.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFDict)) continue;
      const type = object.get(PDFName.of("Type"));
      const fieldType = object.get(PDFName.of("FT"));
      if (String(type) === "/Sig" || String(fieldType) === "/Sig" || object.has(PDFName.of("ByteRange"))) {
        throw new Error("Signed PDFs are not supported. Changing the document would invalidate its digital signatures.");
      }
      if (String(object.get(PDFName.of("Subtype"))) === "/Widget") {
        throw new Error("Interactive forms are not supported. Export a flattened copy first.");
      }
    }
    if (document.getForm().getFields().length) throw new Error("Interactive forms are not supported. Export a flattened copy first.");
    return { document, pages };
  }

  function argumentsFor(preset) {
    const selected = presets[preset];
    if (!selected) throw new Error("Choose a valid compression setting.");
    const args = ["-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.7", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dQUIET", "-dPDFSTOPONERROR", "-dAutoRotatePages=/None", `-dPDFSETTINGS=/${selected.setting}`, "-dDetectDuplicateImages=true", "-dCompressFonts=true", "-dDownsampleColorImages=true", "-dDownsampleGrayImages=true", `-dColorImageResolution=${selected.dpi}`, `-dGrayImageResolution=${selected.dpi}`, "-sOutputFile=/output.pdf"];
    if (preset === "small") {
      args.push("-dAutoFilterColorImages=false", "-dAutoFilterGrayImages=false", "-dColorImageFilter=/DCTEncode", "-dGrayImageFilter=/DCTEncode", "-dPassThroughJPEGImages=false", "-dColorImageDownsampleType=/Bicubic", "-dGrayImageDownsampleType=/Bicubic", "-c", "<< /ColorImageDict << /QFactor 0.9 /HSamples [2 1 1 2] /VSamples [2 1 1 2] >> /GrayImageDict << /QFactor 0.9 >> >> setdistillerparams", "-f");
    }
    return [...args, "/input.pdf"];
  }

  async function finish(original, compressed, removeMetadata) {
    const source = await inspect(original);
    const output = await inspect(compressed);
    if (source.pages !== output.pages) throw new Error("Compression changed the page count. The output has been discarded.");
    const beforePages = source.document.getPages();
    const afterPages = output.document.getPages();
    const visibleSize = (page) => {
      const { width, height } = page.getCropBox();
      return Math.abs(page.getRotation().angle) % 180 === 90 ? { width: height, height: width } : { width, height };
    };
    if (beforePages.some((page, index) => {
      const before = visibleSize(page);
      const after = visibleSize(afterPages[index]);
      return Math.abs(before.width - after.width) > 1 || Math.abs(before.height - after.height) > 1;
    })) throw new Error("Compression changed the page dimensions. The output has been discarded.");
    let result = compressed;
    if (removeMetadata) {
      const infoRef = output.document.context.trailerInfo.Info;
      if (infoRef) output.document.context.delete(infoRef);
      output.document.context.trailerInfo.Info = undefined;
      for (const [ref, object] of output.document.context.enumerateIndirectObjects()) {
        const dictionary = object instanceof PDFDict ? object : object.dict;
        if (!(dictionary instanceof PDFDict)) continue;
        if (String(dictionary.get(PDFName.of("Type"))) === "/Metadata") output.document.context.delete(ref);
        dictionary.delete(PDFName.of("Metadata"));
      }
      result = await output.document.save({ useObjectStreams: true, updateFieldAppearances: false });
    }
    const keptOriginal = !removeMetadata && result.length >= original.length;
    return { bytes: keptOriginal ? original : result, keptOriginal, pages: source.pages };
  }
  async function prepareSources(sources) {
    if (!Array.isArray(sources) || !sources.length || sources.length > MAX_PAGES) throw new Error("Choose PDFs to assemble.");
    if (sources.reduce((total, bytes) => total + bytes.length, 0) > MAX_BYTES) throw new Error("Choose PDFs totalling no more than 50 MB.");
    return Promise.all(sources.map(async (bytes) => (await inspect(bytes)).document));
  }

  async function assembleDocuments(documents, plan) {
    if (!Array.isArray(plan) || !plan.length || plan.length > MAX_PAGES) throw new Error("Export between 1 and 200 pages.");
    const output = await PDFDocument.create();
    for (const entry of plan) {
      if (!Number.isInteger(entry.source) || !Number.isInteger(entry.page) || ![0, 90, 180, 270].includes(entry.rotation)) throw new Error("Invalid page selection.");
      const document = documents[entry.source];
      if (!document || entry.page < 0 || entry.page >= document.getPageCount()) throw new Error("A selected page could not be found.");
      // Copy separately so duplicated pages have independent rotation dictionaries.
      const [copy] = await output.copyPages(document, [entry.page]);
      copy.setRotation(degrees((copy.getRotation().angle + entry.rotation) % 360));
      output.addPage(copy);
    }
    const bytes = await output.save({ useObjectStreams: true, updateFieldAppearances: false });
    if (bytes.length > MAX_BYTES) throw new Error("The assembled PDF exceeds 50 MB. Export fewer pages.");
    return bytes;
  }

  async function assemble(sources, plan) {
    return assembleDocuments(await prepareSources(sources), plan);
  }

  const api = { inspect, argumentsFor, finish, parseRanges, prepareSources, assembleDocuments, assemble, MAX_BYTES, MAX_PAGES };
  if (typeof module === "object") module.exports = api;
  else root.PDFOptimiser = api;
})(globalThis);
