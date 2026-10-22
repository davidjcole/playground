export function createTextEditor({ openDocument, message, onSend }) {
  const $ = (id) => document.getElementById(id);
  let sourceBytes, sourceFile, originalDocument, currentDocument, currentBytes, analysis;
  let page = 0, changes = [], undo = [], redo = [], selected = null, metrics = null, busy = false;
  let worker, boot, ready, requestId = 0, renderTask, renderVersion = 0, measureVersion = 0, measureTimer;
  const pending = new Map(), analyses = new Map();
  const selectionMode = () => document.querySelector('input[name="text-selection-mode"]:checked').value;
  const draft = () => ({ id: selected.id, page, replacement: $('text-replacement').value, font: $('text-font').value, size: Number($('text-size').value), acceptFallback: $('text-fallback').checked });
  function stop(reason = 'Text processing cancelled. Your source PDF is unchanged.') {
    worker?.terminate(); worker = null; boot = null; ready = null;
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error(reason)); }
    pending.clear();
  }
  function startWorker() {
    worker = new Worker(new URL('./text-worker.mjs', import.meta.url), { type: 'module' });
    boot = new Promise((resolve, reject) => {
      const timer = setTimeout(() => stop('The text engine took too long to load. Try again.'), 120000);
      pending.set('boot', { resolve, reject, timer });
    });
    worker.onmessage = ({ data }) => {
      const id = data.ready ? 'boot' : data.id;
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id); clearTimeout(request.timer);
      if (data.error) request.reject(new Error(data.error)); else request.resolve(data.result);
    };
    worker.onerror = () => stop('The text engine could not load. Refresh the page and try again.');
  }
  function request(action, data = {}) {
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      const timer = setTimeout(() => stop('Text processing took too long. Try a simpler PDF.'), 120000);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ id, action, ...data });
    });
  }
  async function run(action, data = {}) {
    if (!worker) startWorker();
    await boot;
    if (action === 'load') { ready = request(action, data); return ready; }
    if (!ready) ready = request('load', { bytes: sourceBytes });
    await ready;
    return request(action, data);
  }
  function updateControls() {
    const existing = selected && changes.find((edit) => edit.id === selected.id);
    const different = selected && ($('text-replacement').value !== (existing?.replacement ?? selected.text) || $('text-font').value !== (existing?.font ?? 'auto') || Number($('text-size').value) !== (existing?.size ?? selected.size));
    $('text-fields').disabled = busy || !selected || !!selected.reason;
    $('text-target').disabled = busy || !analysis?.items.length;
    $('text-apply').disabled = busy || !selected || !metrics?.fits || (metrics.fallback && !$('text-fallback').checked) || !different;
    $('text-undo').disabled = busy || !undo.length;
    $('text-redo').disabled = busy || !redo.length;
    $('text-download').disabled = busy || !changes.length;
    $('text-to-pages').disabled = busy || !changes.length;
    $('text-to-compress').disabled = busy || !changes.length;
    $('text-previous').disabled = busy || page === 0;
    $('text-next').disabled = busy || !originalDocument || page + 1 >= originalDocument.numPages;
    $('text-change-count').textContent = `${changes.length} ${changes.length === 1 ? 'correction' : 'corrections'}`;
    $('text-page-count').textContent = `${page + 1} / ${originalDocument?.numPages || 1}`;
    for (const hit of $('text-hits').children) {
      hit.disabled = busy;
      hit.classList.toggle('selected', hit.dataset.id === selected?.id);
      hit.classList.toggle('corrected', changes.some((edit) => edit.id === hit.dataset.id));
    }
  }
  function setBusy(value) {
    busy = value;
    for (const element of document.querySelectorAll('#text-tools input, #text-tools button, #text-tools select, #text-tools textarea')) element.disabled = value;
    for (const id of ['compress-mode', 'organise-mode', 'text-mode']) $(id).disabled = value;
    $('text-cancel').disabled = false;
    $('text-load-cancel').disabled = false;
    $('text-load-cancel').hidden = !value || !$('text-workspace').hidden;
    $('text-progress').hidden = !value;
    $('text-upload').setAttribute('aria-busy', String(value));
    updateControls();
  }
  async function loadFile(file) {
    if (busy || !file) return false;
    if (!file.size || file.size > 50 * 1024 * 1024) { message('Choose a PDF between 1 byte and 50 MB.', true); return false; }
    setBusy(true); message('Checking PDF text...'); ++measureVersion; clearTimeout(measureTimer);
    stop();
    let next;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const info = await run('load', { bytes });
      next = await openDocument(bytes);
      const firstPage = await run('analyse', { page: 0 });
      ++renderVersion; renderTask?.cancel();
      if (renderTask) { try { await renderTask.promise; } catch {} }
      if (currentDocument && currentDocument !== originalDocument) currentDocument.destroy();
      originalDocument?.destroy();
      sourceBytes = bytes; currentBytes = bytes; sourceFile = file; originalDocument = next; currentDocument = next;
      analyses.clear(); analyses.set(0, firstPage); analysis = firstPage;
      page = 0; changes = []; undo = []; redo = []; selected = null; metrics = null;
      $('text-upload').hidden = true; $('text-workspace').hidden = false;
      $('text-filename').textContent = file.name;
      $('text-summary').textContent = `${info.pages} ${info.pages === 1 ? 'page' : 'pages'} / ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
      $('text-name').value = `${file.name.replace(/\.pdf$/i, '').slice(0, 80)}-corrected`;
      $('text-original').checked = false;
      clearSelection(); buildTargets(); await render(); message('');
      return true;
    } catch (error) { if (next !== originalDocument) next?.destroy(); stop(); message(error.message, true); return false; }
    finally { setBusy(false); $('text-input').value = ''; }
  }
  function clearSelection() {
    ++measureVersion; clearTimeout(measureTimer); selected = null; metrics = null;
    $('text-target').value = ''; $('text-replacement').value = ''; $('text-source-font').textContent = '';
    $('text-fit').textContent = ''; $('text-fit').classList.remove('error'); $('text-fallback-label').hidden = true;
    updateControls();
  }
  function visibleItems() { return (analysis?.items || []).filter((item) => item.kind === selectionMode()); }
  function buildTargets() {
    const select = $('text-target'); select.replaceChildren();
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = `Select a ${selectionMode()}`; select.append(placeholder);
    const items = visibleItems();
    for (const item of items) {
      const option = document.createElement('option'); option.value = item.id;
      const text = changes.find((edit) => edit.id === item.id)?.replacement || item.text;
      option.textContent = `${text.slice(0, 120)}${item.reason ? ' (unsupported)' : ''}`;
      option.title = item.reason || item.text; option.disabled = !!item.reason; select.append(option);
    }
    if (selected && items.some((item) => item.id === selected.id)) select.value = selected.id;
    const count = items.filter((item) => !item.reason).length;
    $('text-page-status').textContent = count ? `${count} editable ${selectionMode() === 'word' ? 'words' : 'lines'} on this page` : items.length ? (items.find((item) => item.reason)?.reason || 'No supported text on this page.') : 'No selectable text on this page. Scanned pages need OCR.';
    drawHits(); updateControls();
  }
  function drawHits() {
    $('text-hits').replaceChildren();
    if (!analysis) return;
    const [x, y, right, bottom] = analysis.bounds;
    for (const item of visibleItems().filter((item) => !item.reason)) {
      const hit = document.createElement('button'); hit.type = 'button'; hit.className = 'text-hit'; hit.dataset.id = item.id;
      hit.title = changes.find((edit) => edit.id === item.id)?.replacement || item.text;
      hit.setAttribute('aria-label', `Select text: ${hit.title}`);
      hit.style.left = `${(item.rect[0] - x) / (right - x) * 100}%`;
      hit.style.top = `${(item.rect[1] - y) / (bottom - y) * 100}%`;
      hit.style.width = `${(item.rect[2] - item.rect[0]) / (right - x) * 100}%`;
      hit.style.height = `${(item.rect[3] - item.rect[1]) / (bottom - y) * 100}%`;
      hit.addEventListener('click', () => choose(item.id));
      $('text-hits').append(hit);
    }
    updateControls();
  }
  function choose(id) {
    const target = analysis?.items.find((item) => item.id === id);
    if (!target || target.reason) { clearSelection(); return; }
    selected = target; metrics = null;
    const existing = changes.find((edit) => edit.id === id);
    $('text-target').value = id;
    $('text-replacement').value = existing?.replacement ?? target.text;
    $('text-font').value = existing?.font ?? 'auto'; $('text-size').value = existing?.size ?? target.size;
    $('text-fallback').checked = existing?.acceptFallback ?? false;
    $('text-source-font').textContent = `${target.font} / ${Number(target.size.toFixed(2))} pt`;
    assess(); updateControls();
  }
  async function assess() {
    const version = ++measureVersion;
    metrics = null; $('text-fallback-label').hidden = true; updateControls();
    if (!selected) return;
    const edit = draft();
    $('text-fit').textContent = 'Checking replacement...'; $('text-fit').classList.remove('error');
    try {
      const result = await run('measure', { edit });
      if (version !== measureVersion) return;
      metrics = result;
      $('text-fit').textContent = result.fits ? `${result.width.toFixed(1)} / ${result.availableWidth.toFixed(1)} pt wide` : 'Replacement does not fit. Use shorter text or reduce the font size.';
      $('text-fit').classList.toggle('error', !result.fits);
      $('text-fallback-label').hidden = !result.fallback;
      $('text-fallback-description').textContent = `Use ${result.fontName} instead of ${selected.font}.`;
    } catch (error) {
      if (version !== measureVersion) return;
      $('text-fit').textContent = error.message; $('text-fit').classList.add('error');
    }
    if (version === measureVersion) updateControls();
  }
  async function render() {
    if (!currentDocument || $('text-tools').hidden) return;
    const version = ++renderVersion;
    if (renderTask) { renderTask.cancel(); try { await renderTask.promise; } catch {} }
    if (version !== renderVersion) return;
    $('text-stage').setAttribute('aria-busy', 'true'); $('text-paper').hidden = true;
    $('text-render-status').hidden = false; $('text-render-status').textContent = 'Preparing preview...';
    try {
      const doc = $('text-original').checked ? originalDocument : currentDocument;
      const pdfPage = await doc.getPage(page + 1);
      if (version !== renderVersion) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = $('text-zoom').value === 'fit' ? Math.max(100, $('text-stage').clientWidth - 40) / base.width : Number($('text-zoom').value);
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const viewport = pdfPage.getViewport({ scale: scale * ratio });
      const canvas = $('text-canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      $('text-paper').style.width = `${base.width * scale}px`; $('text-paper').style.height = `${base.height * scale}px`;
      renderTask = pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport });
      await renderTask.promise;
      if (version !== renderVersion) return;
      $('text-paper').hidden = false; $('text-render-status').hidden = true; drawHits();
    } catch (error) {
      if (version === renderVersion && error.name !== 'RenderingCancelledException') $('text-render-status').textContent = 'This page could not be previewed.';
    } finally { if (version === renderVersion) $('text-stage').setAttribute('aria-busy', 'false'); }
  }
  async function changePage(next) {
    if (busy || !originalDocument || next < 0 || next >= originalDocument.numPages) return;
    setBusy(true); ++measureVersion;
    try {
      const result = analyses.get(next) || await run('analyse', { page: next });
      analyses.set(next, result); page = next; analysis = result;
      clearSelection(); buildTargets(); await render();
    } catch (error) { message(error.message, true); }
    finally { setBusy(false); }
  }
  async function installChanges(next) {
    const result = await run('apply', { edits: next });
    const doc = next.length ? await openDocument(new Uint8Array(result.bytes)) : originalDocument;
    ++renderVersion; renderTask?.cancel();
    if (renderTask) { try { await renderTask.promise; } catch {} }
    if (currentDocument !== originalDocument) currentDocument.destroy();
    currentDocument = doc; currentBytes = new Uint8Array(result.bytes); changes = next;
    $('text-original').checked = false;
    buildTargets(); await render();
    if (selected) choose(selected.id);
  }
  async function apply() {
    if (busy || $('text-apply').disabled || !selected) return;
    const edit = draft(), before = changes;
    const next = changes.filter((item) => item.id !== edit.id).concat(edit);
    setBusy(true); message(''); ++measureVersion;
    try {
      await installChanges(next); undo.push(before); if (undo.length > 50) undo.shift(); redo = [];
      message('Correction applied. Review the page before downloading.');
    } catch (error) { message(error.message, true); }
    finally { setBusy(false); }
  }
  async function history(direction) {
    const stack = direction === 'undo' ? undo : redo;
    if (busy || !stack.length) return;
    const next = stack[stack.length - 1], before = changes;
    setBusy(true); message(''); ++measureVersion;
    try { await installChanges(next); stack.pop(); (direction === 'undo' ? redo : undo).push(before); }
    catch (error) { message(error.message, true); }
    finally { setBusy(false); }
  }
  function name() { return $('text-name').value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\.pdf$/i, '') || 'document-corrected'; }
  async function send(mode) {
    if (busy || !changes.length) return;
    setBusy(true);
    try { await onSend(new File([currentBytes], `${name()}.pdf`, { type: 'application/pdf' }), mode); }
    finally { setBusy(false); }
  }
  $('text-choose').addEventListener('click', () => $('text-input').click());
  $('text-replace').addEventListener('click', () => $('text-input').click());
  $('text-input').addEventListener('change', (event) => loadFile(event.target.files[0]));
  $('text-target').addEventListener('change', (event) => choose(event.target.value));
  for (const input of document.querySelectorAll('input[name="text-selection-mode"]')) input.addEventListener('change', () => { clearSelection(); buildTargets(); });
  for (const id of ['text-replacement', 'text-font', 'text-size']) $(id).addEventListener('input', () => {
    clearTimeout(measureTimer); ++measureVersion; metrics = null; $('text-fallback').checked = false; updateControls();
    measureTimer = setTimeout(assess, 200);
  });
  $('text-fallback').addEventListener('change', updateControls);
  $('text-apply').addEventListener('click', apply);
  $('text-undo').addEventListener('click', () => history('undo'));
  $('text-redo').addEventListener('click', () => history('redo'));
  $('text-previous').addEventListener('click', () => changePage(page - 1));
  $('text-next').addEventListener('click', () => changePage(page + 1));
  $('text-original').addEventListener('change', render);
  $('text-zoom').addEventListener('change', render);
  $('text-cancel').addEventListener('click', () => stop());
  $('text-load-cancel').addEventListener('click', () => stop());
  $('text-to-pages').addEventListener('click', () => send('organise'));
  $('text-to-compress').addEventListener('click', () => send('compress'));
  $('text-download').addEventListener('click', () => {
    if (busy || !changes.length) return;
    const url = URL.createObjectURL(new Blob([currentBytes], { type: 'application/pdf' }));
    const link = document.createElement('a'); link.href = url; link.download = `${name()}.pdf`; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
  let resize;
  window.addEventListener('resize', () => { clearTimeout(resize); resize = setTimeout(render, 150); });
  window.addEventListener('pagehide', () => stop('Text processing interrupted. Try again.'));
  return { loadFile, hasDocument: () => !!sourceFile, isBusy: () => busy, show: render };
}
