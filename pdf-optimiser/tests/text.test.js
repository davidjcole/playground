const { test } = require('node:test');
const assert = require('node:assert/strict');
const pdfLib = require('pdf-lib');
const { PDFDocument, StandardFonts, rgb, degrees } = pdfLib;
const setup = Promise.all([import('mupdf'), import('../text-engine.mjs')]).then(([mupdf, { createTextEngine }]) => ({ mupdf, engine: createTextEngine(mupdf, pdfLib) }));

async function fixture({ rotate = false, image = false, mixed = false, empty = false, crop = false } = {}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  if (rotate) page.setRotation(degrees(90));
  if (crop) page.setCropBox(20, 30, 540, 780);
  page.drawRectangle({ x: 0, y: 700, width: 595, height: 142, color: rgb(.15, .37, .39) });
  if (image) {
    const { mupdf } = await setup;
    const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 4, 4], false);
    try { pixmap.clear(200); page.drawImage(await pdf.embedPng(pixmap.asPNG()), { x: 40, y: 740, width: 200, height: 60 }); }
    finally { pixmap.destroy(); }
  }
  if (!empty) {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText('Morgan Smith', { x: 50, y: 770, size: 24, font, color: rgb(1, 1, 1) });
    page.drawText('Neighbouring content stays intact.', { x: 50, y: 650, size: 14, font });
    if (mixed) {
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      page.drawText('Mixed ', { x: 50, y: 550, size: 18, font });
      page.drawText('style', { x: 50 + font.widthOfTextAtSize('Mixed ', 18), y: 550, size: 18, font: bold });
    }
  }
  pdf.addPage([400, 300]);
  return pdf.save();
}

function editFor(target, extra = {}) { return { id: target.id, page: target.page, replacement: 'Alex', font: 'auto', size: target.size, ...extra }; }

test('removes the old word, inserts selectable replacement and preserves neighbours and source bytes', async () => {
  const { engine } = await setup;
  const source = await fixture();
  const original = source.slice();
  const word = engine.analyse(source, 0).items.find((item) => item.kind === 'word' && item.text === 'Morgan');
  assert.equal(word.reason, '');
  const result = await engine.apply(source, [editFor(word)]);
  const text = engine.analyse(result, 0).items.filter((item) => item.kind === 'line').map((item) => item.text).join(' ');
  assert.doesNotMatch(text, /Morgan/); assert.match(text, /Alex/); assert.match(text, /Smith/); assert.match(text, /Neighbouring content stays intact/);
  assert.equal((await PDFDocument.load(result)).getPageCount(), 2);
  assert.deepEqual(source, original);
  assert.deepEqual(await engine.apply(source, []), source);
});

test('preserves vector background colour underneath the removed word', async () => {
  const { mupdf, engine } = await setup;
  const source = await fixture();
  const word = engine.analyse(source, 0).items.find((item) => item.kind === 'word' && item.text === 'Morgan');
  const result = await engine.apply(source, [editFor(word)]);
  const doc = mupdf.Document.openDocument(result, 'application/pdf');
  const page = doc.loadPage(0);
  const pixels = page.toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, false, false);
  try {
    const index = 60 * pixels.getStride() + 125 * pixels.getNumberOfComponents();
    const color = [...pixels.getPixels().slice(index, index + 3)];
    assert.ok(Math.abs(color[0] - 38) <= 2 && Math.abs(color[1] - 94) <= 2 && Math.abs(color[2] - 99) <= 2, JSON.stringify(color));
  } finally { pixels.destroy(); page.destroy(); doc.destroy(); }
});

test('supports single-style line replacement and crop-box coordinates', async () => {
  const { engine } = await setup;
  for (const crop of [false, true]) {
    const source = await fixture({ crop });
    const line = engine.analyse(source, 0).items.find((item) => item.kind === 'line' && item.text === 'Morgan Smith');
    const output = await engine.apply(source, [editFor(line, { replacement: 'Alex Jones' })]);
    const edited = engine.analyse(output, 0).items.find((item) => item.kind === 'line' && item.text === 'Alex Jones');
    assert.ok(edited);
    assert.ok(Math.abs(edited.origin[0] - line.origin[0]) < .1 && Math.abs(edited.origin[1] - line.origin[1]) < .1);
  }
});

test('rejects overflow, unsupported characters, unacknowledged fonts and overlapping edits', async () => {
  const { engine } = await setup;
  const source = await fixture();
  const items = engine.analyse(source, 0).items;
  const word = items.find((item) => item.kind === 'word' && item.text === 'Morgan');
  const line = items.find((item) => item.kind === 'line' && item.text === 'Morgan Smith');
  await assert.rejects(engine.apply(source, [editFor(word, { replacement: 'A much longer replacement than the original' })]), /does not fit/);
  await assert.rejects(engine.apply(source, [editFor(word, { replacement: '\u4e2d\u6587' })]), /does not support/);
  await assert.rejects(engine.apply(source, [editFor(word, { font: 'Courier' })]), /Confirm the font substitution/);
  assert.ok((await engine.apply(source, [editFor(word, { font: 'Courier', acceptFallback: true })])).length > 0);
  await assert.rejects(engine.apply(source, [editFor(word), editFor(line)]), /overlaps/);
});

test('flags rotated text, image-backed text, mixed-style lines and scans', async () => {
  const { engine } = await setup;
  const rotated = engine.analyse(await fixture({ rotate: true }), 0).items;
  assert.ok(rotated.length > 0 && rotated.every((item) => /Rotated/.test(item.reason)));
  const image = engine.analyse(await fixture({ image: true }), 0).items.find((item) => item.text === 'Morgan');
  assert.match(image.reason, /over an image/);
  const mixed = engine.analyse(await fixture({ mixed: true }), 0).items;
  assert.ok(mixed.some((item) => item.kind === 'line' && /mixed fonts/i.test(item.reason)));
  assert.deepEqual(engine.analyse(await fixture({ empty: true, image: true }), 0).items, []);
});
