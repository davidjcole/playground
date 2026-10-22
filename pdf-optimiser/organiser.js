import './ranges.js';

export function createOrganiser({ openDocument, message, onOptimise, onCorrect }) {
  const $ = (id) => document.getElementById(id);
  const MAX_BYTES = 50 * 1024 * 1024;
  let sources = [], plan = [], selected = new Set(), undo = [], redo = [];
  let nextId = 1, busy = false, replacing = false, worker, rejectWorker, timer, generation = 0;
  let previewTask, previewVersion = 0;

  const icons = () => window.lucide?.createIcons();
  const snapshot = () => ({ plan: plan.map((entry) => ({ ...entry })), selected: [...selected] });
  function restore(state) { plan = state.plan; selected = new Set(state.selected); draw(); }
  function commit(next) {
    undo.push(snapshot());
    if (undo.length > 50) undo.shift();
    redo = [];
    plan = next;
    selected = new Set([...selected].filter((id) => plan.some((entry) => entry.id === id)));
    draw();
  }
  function controls() {
    const count = selected.size;
    $('pages-selection').textContent = `${count} selected`;
    $('pages-select-all').checked = count > 0 && count === plan.length;
    $('pages-select-all').indeterminate = count > 0 && count < plan.length;
    for (const id of ['pages-left', 'pages-right', 'pages-rotate', 'pages-extract']) $(id).disabled = busy || !count;
    $('pages-delete').disabled = busy || !count || count === plan.length;
    $('pages-duplicate').disabled = busy || !count || plan.length + count > 200;
    $('pages-undo').disabled = busy || !undo.length;
    $('pages-redo').disabled = busy || !redo.length;
    for (const tile of $('pages-grid').children) {
      tile.classList.toggle('selected', selected.has(Number(tile.dataset.id)));
      tile.querySelector('input').checked = selected.has(Number(tile.dataset.id));
      tile.draggable = !busy;
    }
    rangeStatus();
  }
  function setBusy(value) {
    busy = value;
    for (const control of document.querySelectorAll('#page-tools button, #page-tools input')) control.disabled = value;
    $('compress-mode').disabled = value;
    $('organise-mode').disabled = value;
    $('text-mode').disabled = value;
    $('pages-progress').hidden = !value;
    $('pages-cancel').disabled = false;
    $('pages-upload').setAttribute('aria-busy', String(value));
    if (!value) controls();
  }
  function stop(reason) {
    worker?.terminate(); worker = null; clearTimeout(timer);
    if (reason) rejectWorker?.(new Error(reason));
    rejectWorker = null;
  }
  function run(payload) {
    return new Promise((resolve, reject) => {
      rejectWorker = reject;
      worker = new Worker(new URL('./worker.js', import.meta.url));
      timer = setTimeout(() => stop('Processing took too long. Try fewer pages.'), 120000);
      worker.onmessage = ({ data }) => {
        if (data.status) { $('pages-progress-status').textContent = data.status; return; }
        stop();
        if (data.error) reject(new Error(data.error)); else resolve(data);
      };
      worker.onerror = () => stop('The PDF engine could not load. Refresh and try again.');
      worker.postMessage(payload);
    });
  }
  async function loadFiles(files, replace = false) {
    if (busy || !files.length) return;
    const incoming = [...files];
    const total = incoming.reduce((sum, file) => sum + file.size, 0) + (replace ? 0 : sources.reduce((sum, source) => sum + source.bytes.length, 0));
    if (incoming.some((file) => !file.size) || total > MAX_BYTES) { message('Choose non-empty PDFs totalling no more than 50 MB.', true); return; }
    if (incoming.length + (replace ? 0 : sources.length) > 200) { message('Choose no more than 200 PDFs.', true); return; }
    setBusy(true);
    message('Checking PDFs...');
    const pending = [];
    try {
      let totalPages = replace ? 0 : plan.length;
      for (const file of incoming) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const info = await run({ action: 'inspect', bytes });
        totalPages += info.pages;
        if (totalPages > 200) throw new Error('The assembled document can contain up to 200 pages.');
        const pdf = await openDocument(bytes);
        pending.push({ name: file.name, bytes, pdf, pages: info.pages });
      }
      if (replace) {
        ++generation;
        for (const source of sources) source.pdf.destroy();
        sources = []; plan = []; selected.clear(); undo = []; redo = [];
      }
      const offset = sources.length;
      sources.push(...pending);
      const added = pending.flatMap((source, index) => Array.from({ length: source.pages }, (_, page) => ({ id: nextId++, source: offset + index, page, rotation: 0 })));
      if (replace || !plan.length) { plan = added; draw(); }
      else commit([...plan, ...added]);
      $('pages-upload').hidden = true;
      $('pages-workspace').hidden = false;
      if (replace || offset === 0) $('pages-name').value = `${incoming[0].name.replace(/\.pdf$/i, '').slice(0, 70)}-assembled`;
      message('');
    } catch (error) {
      for (const source of pending) if (!sources.includes(source)) source.pdf.destroy();
      message(error.message, true);
    } finally { setBusy(false); $('pages-input').value = ''; }
  }
  function iconButton(icon, title) {
    const button = document.createElement('button');
    button.className = 'icon-button'; button.type = 'button'; button.title = title; button.setAttribute('aria-label', title);
    const glyph = document.createElement('i'); glyph.dataset.lucide = icon; button.append(glyph);
    return button;
  }
  function draw() {
    const version = ++generation;
    $('pages-grid').replaceChildren();
    const activeSources = new Set(plan.map((entry) => entry.source));
    $('pages-summary').textContent = `${plan.length} ${plan.length === 1 ? 'page' : 'pages'} / ${activeSources.size} ${activeSources.size === 1 ? 'PDF' : 'PDFs'}`;
    $('pages-sources').textContent = [...activeSources].map((index) => sources[index].name).join(' / ');
    for (const [index, entry] of plan.entries()) {
      const tile = document.createElement('article'); tile.className = 'page-tile'; tile.dataset.id = entry.id; tile.draggable = !busy;
      const header = document.createElement('div'); header.className = 'page-tile-header';
      const label = document.createElement('label');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.setAttribute('aria-label', `Select page ${index + 1}`);
      checkbox.addEventListener('change', () => { if (checkbox.checked) selected.add(entry.id); else selected.delete(entry.id); controls(); });
      label.append(checkbox, document.createTextNode(`Page ${index + 1}`));
      const preview = iconButton('maximize-2', `Preview page ${index + 1}`);
      preview.addEventListener('click', () => previewPage(entry, index));
      header.append(label, preview);
      const stage = document.createElement('div'); stage.className = 'thumbnail-stage';
      const canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', `Page ${index + 1} thumbnail`); canvas.hidden = true;
      const status = document.createElement('span'); status.className = 'thumbnail-status'; status.textContent = 'Preparing page...';
      stage.append(canvas, status);
      stage.addEventListener('click', () => { if (!busy) { if (selected.has(entry.id)) selected.delete(entry.id); else selected.add(entry.id); controls(); } });
      const footer = document.createElement('div'); footer.className = 'page-tile-footer';
      footer.textContent = `${sources[entry.source].name} / p. ${entry.page + 1}${entry.rotation ? ` / +${entry.rotation} degrees` : ''}`; footer.title = footer.textContent;
      tile.append(header, stage, footer);
      tile.addEventListener('dragstart', (event) => {
        if (busy) { event.preventDefault(); return; }
        const ids = selected.has(entry.id) ? [...selected] : [entry.id];
        event.dataTransfer.setData('application/x-pdf-pages', JSON.stringify(ids));
        event.dataTransfer.effectAllowed = 'move';
      });
      tile.addEventListener('dragover', (event) => { if (!busy && event.dataTransfer.types.includes('application/x-pdf-pages')) { event.preventDefault(); event.stopPropagation(); tile.classList.add('drag-target'); } });
      tile.addEventListener('dragleave', () => tile.classList.remove('drag-target'));
      tile.addEventListener('drop', (event) => {
        if (busy || !event.dataTransfer.types.includes('application/x-pdf-pages')) return;
        event.preventDefault(); event.stopPropagation(); tile.classList.remove('drag-target');
        try {
          const ids = new Set(JSON.parse(event.dataTransfer.getData('application/x-pdf-pages')));
          if (ids.has(entry.id)) return;
          const moving = plan.filter((item) => ids.has(item.id));
          if (!moving.length) return;
          const next = plan.filter((item) => !ids.has(item.id));
          next.splice(next.findIndex((item) => item.id === entry.id), 0, ...moving);
          commit(next);
        } catch { message('The pages could not be moved.', true); }
      });
      $('pages-grid').append(tile);
    }
    icons(); controls(); renderThumbnails(version);
  }
  async function drawPage(entry, canvas, maximumWidth, maximumHeight) {
    const source = sources[entry.source];
    const page = await source.pdf.getPage(entry.page + 1);
    const rotation = (page.rotate + entry.rotation) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    const scale = Math.min(maximumWidth / base.width, maximumHeight / base.height) * Math.min(devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale, rotation });
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
    return task;
  }
  async function renderThumbnails(version) {
    $('pages-grid').setAttribute('aria-busy', 'true');
    const entries = [...plan];
    for (let index = 0; index < entries.length; index++) {
      if (version !== generation) return;
      const tile = $('pages-grid').children[index];
      const canvas = tile.querySelector('canvas');
      const status = tile.querySelector('.thumbnail-status');
      try {
        const task = await drawPage(entries[index], canvas, 150, 169);
        await task.promise;
        if (version !== generation) return;
        canvas.hidden = false; status.hidden = true;
      } catch {
        if (version === generation) status.textContent = 'Preview unavailable';
      }
    }
    if (version === generation) $('pages-grid').setAttribute('aria-busy', 'false');
  }
  async function previewPage(entry, index) {
    const version = ++previewVersion;
    $('page-dialog-title').textContent = `Page ${index + 1} / ${sources[entry.source].name}`;
    $('page-dialog-canvas').hidden = true; $('page-dialog-status').hidden = false; $('page-dialog-status').textContent = 'Preparing preview...';
    if (!$('page-dialog').open) $('page-dialog').showModal();
    if (previewTask) { previewTask.cancel(); try { await previewTask.promise; } catch {} }
    if (version !== previewVersion) return;
    try {
      previewTask = await drawPage(entry, $('page-dialog-canvas'), Math.max(100, $('page-dialog').clientWidth - 72), Math.max(100, innerHeight * .7 - 32));
      await previewTask.promise;
      if (version !== previewVersion) return;
      $('page-dialog-canvas').hidden = false; $('page-dialog-status').hidden = true;
    } catch { if (version === previewVersion) $('page-dialog-status').textContent = 'This page could not be previewed.'; }
  }
  function move(direction) {
    const next = [...plan];
    if (direction < 0) {
      for (let i = 1; i < next.length; i++) if (selected.has(next[i].id) && !selected.has(next[i - 1].id)) [next[i - 1], next[i]] = [next[i], next[i - 1]];
    } else {
      for (let i = next.length - 2; i >= 0; i--) if (selected.has(next[i].id) && !selected.has(next[i + 1].id)) [next[i], next[i + 1]] = [next[i + 1], next[i]];
    }
    if (next.some((entry, index) => entry !== plan[index])) commit(next);
  }
  function parseRanges(value) {
    return globalThis.PDFPageRanges.parseRanges(value, plan.length);
  }
  function rangeStatus() {
    let valid = false;
    const value = $('pages-ranges').value.trim();
    try {
      if (value) {
        const groups = parseRanges(value);
        $('pages-range-status').textContent = `${groups.flat().length} pages / ${groups.length} ${groups.length === 1 ? 'split file' : 'split files'}`;
        valid = true;
      } else $('pages-range-status').textContent = plan.length ? `Pages 1-${plan.length}` : '';
      $('pages-range-status').classList.remove('error');
      $('pages-ranges').setAttribute('aria-invalid', 'false');
    } catch (error) {
      $('pages-range-status').textContent = error.message; $('pages-range-status').classList.add('error'); $('pages-ranges').setAttribute('aria-invalid', 'true');
    }
    $('pages-range-extract').disabled = busy || !valid;
    $('pages-split').disabled = busy || !valid;
  }
  function filename(suffix = '') {
    return ($('pages-name').value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\.pdf$/i, '') || 'document-assembled') + suffix;
  }
  function download(bytes, name, type) {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function exportPages(kind) {
    if (busy || !plan.length) return;
    let chosen = plan;
    try {
      if (kind === 'selected') chosen = plan.filter((entry) => selected.has(entry.id));
      if (kind === 'range') chosen = parseRanges($('pages-ranges').value).flat().map((index) => plan[index]);
      if (!chosen.length) throw new Error('Select pages to extract.');
      if (kind === 'split') parseRanges($('pages-ranges').value);
      setBusy(true); message(''); $('pages-progress-status').textContent = 'Preparing pages...';
      const result = await run({ action: kind === 'split' ? 'split' : 'assemble', sources: sources.map((source) => source.bytes), plan: chosen, ranges: $('pages-ranges').value });
      if (kind === 'compress') await onOptimise(new File([result.bytes], `${filename()}.pdf`, { type: 'application/pdf' }));
      else if (kind === 'text') await onCorrect(new File([result.bytes], `${filename()}.pdf`, { type: 'application/pdf' }));
      else {
        download(result.bytes, `${filename(kind === 'selected' || kind === 'range' ? '-extract' : '')}.${kind === 'split' ? 'zip' : 'pdf'}`, kind === 'split' ? 'application/zip' : 'application/pdf');
        message(kind === 'split' ? `${result.files.length} PDFs exported in a ZIP.` : `${chosen.length} pages exported.`);
      }
    } catch (error) { message(error.message, true); }
    finally { setBusy(false); }
  }
  $('pages-choose').addEventListener('click', () => { replacing = true; $('pages-input').click(); });
  $('pages-add').addEventListener('click', () => { replacing = false; $('pages-input').click(); });
  $('pages-replace').addEventListener('click', () => { replacing = true; $('pages-input').click(); });
  $('pages-input').addEventListener('change', (event) => loadFiles(event.target.files, replacing));
  $('pages-select-all').addEventListener('change', (event) => { selected = new Set(event.target.checked ? plan.map((entry) => entry.id) : []); controls(); });
  $('pages-left').addEventListener('click', () => move(-1));
  $('pages-right').addEventListener('click', () => move(1));
  $('pages-rotate').addEventListener('click', () => commit(plan.map((entry) => selected.has(entry.id) ? { ...entry, rotation: (entry.rotation + 90) % 360 } : entry)));
  $('pages-duplicate').addEventListener('click', () => commit(plan.flatMap((entry) => selected.has(entry.id) ? [entry, { ...entry, id: nextId++ }] : [entry])));
  $('pages-delete').addEventListener('click', () => commit(plan.filter((entry) => !selected.has(entry.id))));
  $('pages-undo').addEventListener('click', () => { if (undo.length) { redo.push(snapshot()); restore(undo.pop()); } });
  $('pages-redo').addEventListener('click', () => { if (redo.length) { undo.push(snapshot()); restore(redo.pop()); } });
  for (const [id, kind] of Object.entries({ 'pages-download': 'all', 'pages-extract': 'selected', 'pages-compress': 'compress', 'pages-text': 'text', 'pages-range-extract': 'range', 'pages-split': 'split' })) $(id).addEventListener('click', () => exportPages(kind));
  $('pages-ranges').addEventListener('input', rangeStatus);
  $('pages-cancel').addEventListener('click', () => stop('Page export cancelled. Your source PDFs are unchanged.'));
  $('page-dialog-close').addEventListener('click', () => $('page-dialog').close());
  $('page-dialog').addEventListener('close', () => { ++previewVersion; previewTask?.cancel(); });
  window.addEventListener('pagehide', () => stop('Page processing interrupted. Try again.'));
  return { loadFiles, hasDocuments: () => !!plan.length, isBusy: () => busy };
}
