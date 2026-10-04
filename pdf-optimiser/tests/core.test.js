const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PDFDocument, PDFName, PDFString, StandardFonts } = require("pdf-lib");
const core = require("../core.js");
const initialise = require("@jspawn/ghostscript-wasm");

async function fixture() {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Test document");
  pdf.setAuthor("Example author");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawText(`Compression test - page ${i + 1}`, { x: 50, y: 750, size: 24, font });
    for (let j = 0; j < 250; j++) page.drawText("Selectable text remains text.", { x: 50, y: 700 - (j % 30) * 20, size: 10, font });
  }
  return pdf.save({ useObjectStreams: false });
}

async function compress(bytes, preset) {
  const wasm = new WebAssembly.Module(fs.readFileSync(require.resolve("@jspawn/ghostscript-wasm/gs.wasm")));
  const engine = await initialise({
    instantiateWasm(imports, ready) {
      const instance = new WebAssembly.Instance(wasm, imports);
      ready(instance);
      return instance.exports;
    }, print: () => {}, printErr: () => {}
  });
  engine.FS.writeFile("/input.pdf", bytes);
  assert.equal(engine.callMain(core.argumentsFor(preset)), 0);
  return engine.FS.readFile("/output.pdf");
}

test("all presets produce smaller valid PDFs with the same page count and dimensions", async () => {
  const bytes = await fixture();
  for (const preset of ["light", "balanced", "small"]) {
    const compressed = await compress(bytes, preset);
    const result = await core.finish(bytes, compressed, false);
    assert.equal(result.pages, 3);
    assert.equal(result.keptOriginal, false);
    assert.ok(result.bytes.length < bytes.length);
    assert.equal((await core.inspect(result.bytes)).pages, 3);
  }
});

test("metadata removal clears Info and document and page XMP", async () => {
  const source = await fixture();
  const pdf = await PDFDocument.load(source);
  const metadata = pdf.context.register(pdf.context.stream("<metadata>Private author</metadata>", { Type: "Metadata", Subtype: "XML" }));
  pdf.catalog.set(PDFName.of("Metadata"), metadata);
  pdf.getPages()[0].node.set(PDFName.of("Metadata"), metadata);
  const candidate = await pdf.save();
  const result = await core.finish(source, candidate, true);
  const document = await PDFDocument.load(result.bytes, { updateMetadata: false });
  assert.equal(document.context.trailerInfo.Info, undefined);
  assert.equal(document.getAuthor(), undefined);
  assert.equal(document.getTitle(), undefined);
  assert.equal(document.catalog.has(PDFName.of("Metadata")), false);
  assert.equal(document.getPages()[0].node.has(PDFName.of("Metadata")), false);
});

test("an output that is no smaller returns the exact original", async () => {
  const source = await fixture();
  const result = await core.finish(source, source, false);
  assert.equal(result.keptOriginal, true);
  assert.equal(result.bytes, source);
});

test("rejects invalid files, invalid presets and excess pages", async () => {
  await assert.rejects(core.inspect(new Uint8Array([1, 2, 3])), /not a PDF/);
  assert.throws(() => core.argumentsFor("anything"), /valid compression/);
  const pdf = await PDFDocument.create();
  for (let i = 0; i < 201; i++) pdf.addPage();
  await assert.rejects(core.inspect(await pdf.save()), /1 to 200/);
});

test("rejects interactive forms and digital signatures", async () => {
  const form = await PDFDocument.create();
  const page = form.addPage();
  form.getForm().createTextField("name").addToPage(page);
  await assert.rejects(core.inspect(await form.save()), /Interactive forms/);
  const signed = await PDFDocument.create();
  signed.addPage();
  signed.catalog.set(PDFName.of("Signature"), signed.context.register(signed.context.obj({ Type: "Sig", Contents: PDFString.of("signature") })));
  await assert.rejects(core.inspect(await signed.save()), /Signed PDFs/);
});

test("discards an output with missing pages", async () => {
  const source = await fixture();
  const pdf = await PDFDocument.create();
  pdf.addPage([595.28, 841.89]);
  await assert.rejects(core.finish(source, await pdf.save(), false), /page count/);
});
