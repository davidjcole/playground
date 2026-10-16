const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, PDFName, PDFString, StandardFonts, degrees } = require('pdf-lib');
const { assemble, parseRanges } = require('../core.js');

async function fixture(name, count = 2) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < count; i++) {
    const page = pdf.addPage(i ? [400, 300] : [595, 842]);
    page.drawText(`${name} page ${i + 1}`, { x: 30, y: 200, font, size: 24 });
    page.node.set(PDFName.of('TestPage'), PDFString.of(`${name}-${i + 1}`));
    if (i === 1) { page.setRotation(degrees(90)); page.setCropBox(10, 10, 350, 250); }
  }
  return pdf.save();
}

test('merges, reorders, deletes and duplicates pages without changing the sources', async () => {
  const first = await fixture('First');
  const second = await fixture('Second');
  const originals = [first.slice(), second.slice()];
  const bytes = await assemble([first, second], [
    { source: 1, page: 1, rotation: 0 },
    { source: 0, page: 0, rotation: 90 },
    { source: 0, page: 0, rotation: 0 }
  ]);
  const output = await PDFDocument.load(bytes);
  const pages = output.getPages();
  assert.equal(pages.length, 3);
  assert.deepEqual(pages.map((page) => page.node.get(PDFName.of('TestPage')).decodeText()), ['Second-2', 'First-1', 'First-1']);
  assert.deepEqual(pages.map((page) => page.getRotation().angle), [90, 90, 0]);
  assert.deepEqual(pages[0].getSize(), { width: 400, height: 300 });
  assert.deepEqual(pages[0].getCropBox(), { x: 10, y: 10, width: 350, height: 250 });
  assert.deepEqual(first, originals[0]); assert.deepEqual(second, originals[1]);
  assert.notEqual(pages[1].ref.toString(), pages[2].ref.toString());
});

test('adds rotation to existing page rotation', async () => {
  const bytes = await assemble([await fixture('Rotated')], [{ source: 0, page: 1, rotation: 270 }]);
  assert.equal((await PDFDocument.load(bytes)).getPages()[0].getRotation().angle, 0);
});

test('page ranges retain typed ordering and group boundaries for splitting', () => {
  assert.deepEqual(parseRanges('3, 1 - 2, 5', 5), [[2], [0, 1], [4]]);
  assert.deepEqual(parseRanges('1-1', 1), [[0]]);
  for (const invalid of ['', '0', '6', '3-1', '1,,2', '1.5', '1e2', '1-2-3', '-1']) assert.throws(() => parseRanges(invalid, 5));
  assert.throws(() => parseRanges('1-200,1', 200), /200 pages/);
});

test('rejects empty, missing or invalid page plans', async () => {
  const sources = [await fixture('Invalid')];
  for (const plan of [[], [{ source: 1, page: 0, rotation: 0 }], [{ source: 0, page: 2, rotation: 0 }], [{ source: 0, page: 0, rotation: 45 }], [{ source: 0, page: -1, rotation: 0 }]]) {
    await assert.rejects(assemble(sources, plan));
  }
  await assert.rejects(assemble(sources, Array.from({ length: 201 }, () => ({ source: 0, page: 0, rotation: 0 }))), /200 pages/);
});

test('page exports reject interactive forms before copying pages', async () => {
  const pdf = await PDFDocument.create();
  pdf.getForm().createTextField('Name').addToPage(pdf.addPage());
  await assert.rejects(assemble([await pdf.save()], [{ source: 0, page: 0, rotation: 0 }]), /Interactive forms/);
});
