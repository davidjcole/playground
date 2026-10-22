import * as mupdf from './vendor/mupdf/mupdf.js';
import './vendor/pdf-lib/pdf-lib.min.js';
import './ranges.js';
import './core.js';
import { createTextEngine } from './text-engine.mjs';

const engine = createTextEngine(mupdf, self.PDFLib);
let source;
const analyses = new Map();
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      let result;
      if (data.action === 'load') {
        const bytes = new Uint8Array(data.bytes);
        const { pages } = await self.PDFOptimiser.inspect(bytes);
        source = bytes; analyses.clear();
        result = { pages };
      } else if (!source) throw new Error('Choose a PDF first.');
      else if (data.action === 'analyse') {
        if (!analyses.has(data.page)) analyses.set(data.page, engine.analyse(source, data.page));
        result = analyses.get(data.page);
      }
      else if (data.action === 'measure') {
        if (!analyses.has(data.edit.page)) analyses.set(data.edit.page, engine.analyse(source, data.edit.page));
        const analysis = analyses.get(data.edit.page);
        const item = analysis.items.find((item) => item.id === data.edit.id);
        if (!item) throw new Error('Select a word or line first.');
        result = await engine.measure(item, data.edit);
      } else if (data.action === 'apply') {
        const bytes = await engine.apply(source, data.edits);
        result = { bytes };
      } else throw new Error('Unknown text operation.');
      self.postMessage({ id: data.id, result }, result?.bytes ? [result.bytes.buffer] : []);
    } catch (error) { self.postMessage({ id: data.id, error: error.message || 'Text correction failed.' }); }
  });
};
self.postMessage({ ready: true });
