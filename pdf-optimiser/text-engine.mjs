export function createTextEngine(mupdf, pdfLib) {
  const { PDFDocument, StandardFonts, rgb } = pdfLib;
  const standardNames = new Set(Object.values(StandardFonts));
  const fontCache = new Map();
  const cleanFontName = (name) => name.replace(/^[A-Z]{6}\+/, '');
  const intersects = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > .1 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > .1;
  const plain = (chars) => chars.map((char) => char.text).join('').replace(/\s/g, '');
  function bounds(chars) {
    return [Math.min(...chars.map((c) => c.rect[0])), Math.min(...chars.map((c) => c.rect[1])), Math.max(...chars.map((c) => c.rect[2])), Math.max(...chars.map((c) => c.rect[3]))];
  }
  function point(matrix, origin) {
    return [matrix[0] * origin[0] + matrix[2] * origin[1] + matrix[4], matrix[1] * origin[0] + matrix[3] * origin[1] + matrix[5]];
  }
  function readPage(page, index) {
    const lines = [], images = [], chars = [];
    let line;
    const text = page.toStructuredText('preserve-whitespace,preserve-images');
    try {
      text.walk({
        onImageBlock: (rect, transform, image) => { images.push(rect); image.destroy(); },
        beginLine: (rect, wmode, direction) => { line = { chars: [], direction, wmode, rect, index: lines.length }; lines.push(line); },
        onChar: (value, origin, font, size, quad, color, bidi) => {
          try {
            if (chars.length >= 50000) throw new Error('This page has too much text for the correction tool.');
            const rect = [Math.min(quad[0], quad[2], quad[4], quad[6]), Math.min(quad[1], quad[3], quad[5], quad[7]), Math.max(quad[0], quad[2], quad[4], quad[6]), Math.max(quad[1], quad[3], quad[5], quad[7])];
            const char = { id: `${index}:${line.index}:${line.chars.length}`, text: value, origin, rect, font: font.getName(), size, color, bidi, serif: font.isSerif(), mono: font.isMono(), bold: font.isBold(), italic: font.isItalic() };
            line.chars.push(char); chars.push(char);
          } finally { font.destroy(); }
        }
      });
    } finally { text.destroy(); }
    const matrix = page.getTransform();
    const axisAligned = Math.abs(matrix[0] - 1) < .001 && Math.abs(matrix[1]) < .001 && Math.abs(matrix[2]) < .001 && Math.abs(matrix[3] + 1) < .001;
    const annotations = page.getAnnotations();
    let pendingRedactions;
    try { pendingRedactions = annotations.some((annotation) => annotation.getType() === 'Redact'); }
    finally { for (const annotation of annotations) annotation.destroy(); }
    const items = [];
    function item(selected, kind, currentLine) {
      while (selected.length && /\s/.test(selected[0].text)) selected = selected.slice(1);
      while (selected.length && /\s/.test(selected[selected.length - 1].text)) selected = selected.slice(0, -1);
      if (!selected.length) return;
      const first = selected[0], rect = bounds(selected), ids = new Set(selected.map((char) => char.id));
      let reason = '';
      if (!axisAligned || currentLine.wmode !== 0 || Math.abs(currentLine.direction[0] - 1) > .001 || Math.abs(currentLine.direction[1]) > .001 || selected.some((char) => char.bidi !== 0)) reason = 'Rotated, vertical or right-to-left text is not supported.';
      else if (pendingRedactions) reason = 'This page has pending redactions. Apply or remove them before editing.';
      else if (selected.some((char) => char.font !== first.font || Math.abs(char.size - first.size) > .05 || char.color.some((value, i) => Math.abs(value - first.color[i]) > .01))) reason = 'This selection has mixed fonts, sizes or colours. Select a single-style word instead.';
      else if (images.some((image) => intersects(rect, image))) reason = 'Text over an image cannot be corrected in this version.';
      else if (chars.some((char) => !ids.has(char.id) && intersects(rect, char.rect))) reason = 'This text overlaps neighbouring content and cannot be corrected safely.';
      else if (selected.length > 500 || first.size < 1 || first.size > 144) reason = 'This selection is outside the supported text size or length.';
      items.push({ id: `${kind}:${first.id}:${selected[selected.length - 1].id}`, page: index, kind, text: selected.map((char) => char.text).join(''), rect, origin: point(mupdf.Matrix.invert(matrix), first.origin), size: first.size, font: first.font, color: first.color, serif: first.serif, mono: first.mono, bold: first.bold, italic: first.italic, charIds: [...ids], reason });
    }
    for (const current of lines) {
      item(current.chars, 'line', current);
      let word = [];
      for (const char of current.chars) {
        if (/\s/.test(char.text)) { item(word, 'word', current); word = []; }
        else word.push(char);
      }
      item(word, 'word', current);
    }
    return { bounds: page.getBounds(), items, chars };
  }
  function analyse(bytes, index) {
    const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
    let page;
    try {
      if (!Number.isInteger(index) || index < 0 || index >= doc.countPages()) throw new Error('Choose a valid page.');
      page = doc.loadPage(index);
      const result = readPage(page, index);
      return { bounds: result.bounds, items: result.items };
    } finally { page?.destroy(); doc.destroy(); }
  }
  function matchedFont(item) {
    const name = cleanFontName(item.font);
    if (standardNames.has(name)) return name;
    if (item.mono) return item.bold ? (item.italic ? StandardFonts.CourierBoldOblique : StandardFonts.CourierBold) : (item.italic ? StandardFonts.CourierOblique : StandardFonts.Courier);
    if (item.serif) return item.bold ? (item.italic ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanBold) : (item.italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman);
    return item.bold ? (item.italic ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaBold) : (item.italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica);
  }
  async function measure(item, options) {
    if (item.reason) throw new Error(item.reason);
    const replacement = String(options.replacement ?? '');
    if (!replacement.trim() || replacement.length > 500 || /[\x00-\x1f\x7f]/.test(replacement)) throw new Error('Enter a single line of replacement text, up to 500 characters.');
    const size = Number(options.size);
    if (!Number.isFinite(size) || size < 1 || size > 144) throw new Error('Choose a font size between 1 and 144 pt.');
    if (!['auto', 'Helvetica', 'Times-Roman', 'Courier'].includes(options.font)) throw new Error('Choose a supported replacement font.');
    const fontName = options.font === 'auto' ? matchedFont(item) : options.font;
    if (!fontCache.has(fontName)) {
      const doc = await PDFDocument.create();
      fontCache.set(fontName, await doc.embedFont(fontName));
    }
    const font = fontCache.get(fontName);
    let width;
    try { width = font.widthOfTextAtSize(replacement, size); }
    catch { throw new Error('The replacement font does not support one or more characters. Use supported Latin text.'); }
    const availableWidth = item.rect[2] - item.rect[0];
    const availableHeight = item.rect[3] - item.rect[1];
    const fits = width <= availableWidth + .25 && font.heightAtSize(size) <= availableHeight + .25 && size <= item.size * 1.05;
    return { fontName, fallback: fontName !== cleanFontName(item.font), width, availableWidth, fits, size };
  }
  async function apply(bytes, edits) {
    if (!Array.isArray(edits) || edits.length > 100) throw new Error('Apply up to 100 corrections per document.');
    if (!edits.length) return bytes.slice();
    const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
    const prepared = [], pages = new Map();
    let redacted;
    try {
      const seen = new Set();
      for (const edit of edits) {
        if (seen.has(edit.id)) throw new Error('Duplicate correction.');
        seen.add(edit.id);
        const index = edit.page;
        if (!Number.isInteger(index) || index < 0 || index >= doc.countPages()) throw new Error('Choose a valid page.');
        if (!pages.has(index)) {
          const page = doc.loadPage(index);
          pages.set(index, { page, analysis: readPage(page, index), removed: new Set() });
        }
        const state = pages.get(index);
        const target = state.analysis.items.find((item) => item.id === edit.id);
        if (!target) throw new Error('The selected text could not be found in the source PDF.');
        if (target.charIds.some((id) => state.removed.has(id))) throw new Error('This correction overlaps an existing correction. Undo the overlapping correction first.');
        const metrics = await measure(target, edit);
        if (!metrics.fits) throw new Error('Replacement text does not fit. Use shorter wording or reduce the font size.');
        if (metrics.fallback && !edit.acceptFallback) throw new Error(`The original font will be replaced with ${metrics.fontName}. Confirm the font substitution first.`);
        target.charIds.forEach((id) => state.removed.add(id));
        prepared.push({ edit, target, metrics });
      }
      for (const { edit, target } of prepared) {
        const page = pages.get(edit.page).page;
        const annotation = page.createAnnotation('Redact');
        try { annotation.setRect(target.rect); annotation.update(); }
        finally { annotation.destroy(); }
      }
      for (const state of pages.values()) state.page.applyRedactions(false, mupdf.PDFPage.REDACT_IMAGE_NONE, mupdf.PDFPage.REDACT_LINE_ART_NONE, mupdf.PDFPage.REDACT_TEXT_REMOVE);
      const buffer = doc.saveToBuffer('garbage=4,compress');
      try { redacted = buffer.asUint8Array().slice(); } finally { buffer.destroy(); }
      const check = mupdf.Document.openDocument(redacted, 'application/pdf');
      try {
        for (const [index, state] of pages) {
          const page = check.loadPage(index);
          try {
            const remaining = readPage(page, index).chars;
            const expected = state.analysis.chars.filter((char) => !state.removed.has(char.id));
            if (plain(remaining) !== plain(expected)) throw new Error('Text removal affected neighbouring content. The correction has been discarded.');
          } finally { page.destroy(); }
        }
      } finally { check.destroy(); }
      const output = await PDFDocument.load(redacted, { updateMetadata: false });
      for (const { edit, target, metrics } of prepared) {
        const font = await output.embedFont(metrics.fontName);
        const color = target.color.length === 3 ? target.color : [0, 0, 0];
        output.getPages()[edit.page].drawText(edit.replacement, { x: target.origin[0], y: target.origin[1], font, size: metrics.size, color: rgb(...color) });
      }
      const result = await output.save({ useObjectStreams: true, updateFieldAppearances: false });
      if (result.length > 50 * 1024 * 1024) throw new Error('The corrected PDF exceeds 50 MB.');
      return result;
    } finally { for (const state of pages.values()) state.page.destroy(); doc.destroy(); }
  }
  return { analyse, measure, apply };
}
