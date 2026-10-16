(function (root) {
  function parseRanges(value, pageCount) {
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 200) throw new Error('No pages are available.');
    const groups = String(value).split(',').map((part) => {
      const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) throw new Error('Enter page numbers or ranges, such as 1-3, 5.');
      const first = Number(match[1]);
      const last = match[2] ? Number(match[2]) : first;
      if (first < 1 || last < first || last > pageCount) throw new Error(`Use ascending page ranges between 1 and ${pageCount}.`);
      return Array.from({ length: last - first + 1 }, (_, index) => first - 1 + index);
    });
    if (groups.flat().length > 200) throw new Error('Export up to 200 pages at a time.');
    return groups;
  }
  const api = { parseRanges };
  if (typeof module === 'object') module.exports = api;
  else root.PDFPageRanges = api;
})(globalThis);
