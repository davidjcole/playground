import * as pdfjs from "./vendor/pdfjs-dist/pdf.min.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs-dist/pdf.worker.min.mjs", import.meta.url).href;
const $ = (id) => document.getElementById(id);
const MAX_BYTES = 50 * 1024 * 1024;
let sourceBytes, sourceDocument, outputDocument, outputBytes, outputUrl;
let page = 1, version = "original", busy = false, activeWorker, workerReject, workerTimer;
let renderTask, renderGeneration = 0, loadGeneration = 0;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / (bytes >= 1024 * 1024 ? 1024 * 1024 : 1024)).toFixed(2)} ${bytes >= 1024 * 1024 ? "MB" : "KB"}`;
}

function message(text, error = false) {
  $("message").textContent = text;
  $("message").classList.toggle("error", error);
  $("message").hidden = !text;
}

function work(payload) {
  return new Promise((resolve, reject) => {
    activeWorker = new Worker(new URL("./worker.js", import.meta.url));
    workerReject = reject;
    workerTimer = setTimeout(() => stopWorker("Processing took too long. Try a smaller PDF."), 120000);
    activeWorker.onmessage = ({ data }) => {
      if (data.status) { $("processing-status").textContent = data.status; return; }
      stopWorker();
      if (data.error) reject(new Error(data.error));
      else resolve(data);
    };
    activeWorker.onerror = () => stopWorker("The PDF engine could not load. Refresh the page and try again.");
    activeWorker.postMessage(payload);
  });
}

function stopWorker(reason) {
  activeWorker?.terminate();
  activeWorker = null;
  clearTimeout(workerTimer);
  if (reason) workerReject?.(new Error(reason));
  workerReject = null;
}

function setBusy(value, loading = false) {
  busy = value;
  $("choose").disabled = value;
  $("replace").disabled = value;
  $("settings").disabled = value;
  $("optimise").disabled = value;
  $("optimise").hidden = value && !loading;
  $("processing").hidden = !value || loading;
  $("download").disabled = value || !outputBytes;
  $("upload").setAttribute("aria-busy", String(value));
  $("upload-status").textContent = loading ? "Checking PDF..." : "Up to 50 MB / 200 pages";
}

function clearOutput() {
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = null;
  outputBytes = null;
  outputDocument?.destroy();
  outputDocument = null;
  $("output-tab").disabled = true;
  $("download").disabled = true;
  $("output-size").textContent = "-";
  $("saving").textContent = "Ready to optimise";
  $("saving").classList.remove("larger");
  $("size-bar").style.width = "0%";
  if (version === "output") selectVersion("original");
}

function openDocument(bytes) {
  return pdfjs.getDocument({
    data: bytes.slice(), isEvalSupported: false,
    cMapUrl: new URL("./vendor/pdfjs-dist/cmaps/", import.meta.url).href,
    cMapPacked: true,
    standardFontDataUrl: new URL("./vendor/pdfjs-dist/standard_fonts/", import.meta.url).href
  }).promise;
}

async function loadFile(file) {
  if (!file || busy) return;
  message("");
  if (!file.size || file.size > MAX_BYTES) { message("Choose a PDF between 1 byte and 50 MB.", true); return; }
  const generation = ++loadGeneration;
  setBusy(true, true);
  let nextDocument;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = await work({ action: "inspect", bytes });
    nextDocument = await openDocument(bytes);
    if (generation !== loadGeneration) { nextDocument.destroy(); return; }
    clearOutput();
    renderTask?.cancel();
    sourceDocument?.destroy();
    sourceBytes = bytes;
    sourceDocument = nextDocument;
    page = 1;
    $("file-name").textContent = file.name;
    $("file-info").textContent = `${info.pages} ${info.pages === 1 ? "page" : "pages"} / ${formatSize(file.size)}`;
    $("original-size").textContent = formatSize(file.size);
    $("export-name").value = `${file.name.replace(/\.pdf$/i, "").slice(0, 80)}-optimised`;
    $("upload").hidden = true;
    $("editor").hidden = false;
    selectVersion("original");
  } catch (error) {
    nextDocument?.destroy();
    message(error.message || "This PDF could not be opened.", true);
  } finally {
    setBusy(false);
    $("file-input").value = "";
  }
}

function selectVersion(selected) {
  version = selected;
  $("original-tab").setAttribute("aria-selected", String(selected === "original"));
  $("output-tab").setAttribute("aria-selected", String(selected === "output"));
  $("page-preview").setAttribute("aria-labelledby", selected === "original" ? "original-tab" : "output-tab");
  $("preview-label").textContent = selected === "original" ? "Original document" : "Optimised document";
  renderPreview();
}

async function renderPreview() {
  const document = version === "original" ? sourceDocument : outputDocument;
  if (!document) return;
  const generation = ++renderGeneration;
  if (renderTask) {
    renderTask.cancel();
    try { await renderTask.promise; } catch { /* Cancellation releases the canvas before the next render. */ }
  }
  if (generation !== renderGeneration) return;
  $("page-count").textContent = `${page} / ${document.numPages}`;
  $("previous").disabled = page === 1;
  $("next").disabled = page === document.numPages;
  $("preview").hidden = true;
  $("preview-status").hidden = false;
  $("preview-status").textContent = "Preparing preview...";
  $("page-preview").setAttribute("aria-busy", "true");
  try {
    const pdfPage = await document.getPage(page);
    if (generation !== renderGeneration) return;
    const natural = pdfPage.getViewport({ scale: 1 });
    const stage = $("page-preview");
    const availableWidth = stage.clientWidth - 48;
    const availableHeight = stage.clientHeight - 48;
    const scale = Math.min(availableWidth / natural.width, availableHeight / natural.height) * Math.min(window.devicePixelRatio || 1, 2);
    const viewport = pdfPage.getViewport({ scale });
    const canvas = $("preview");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    renderTask = pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport });
    await renderTask.promise;
    if (generation !== renderGeneration) return;
    canvas.hidden = false;
    $("preview-status").hidden = true;
    $("page-dimensions").textContent = `${Math.round(natural.width * 25.4 / 72)} × ${Math.round(natural.height * 25.4 / 72)} mm`;
  } catch (error) {
    if (generation === renderGeneration && error.name !== "RenderingCancelledException") {
      $("preview-status").textContent = "This page could not be previewed.";
    }
  } finally {
    if (generation === renderGeneration) $("page-preview").setAttribute("aria-busy", "false");
  }
}

async function optimise() {
  if (!sourceBytes || busy) return;
  clearOutput();
  message("");
  setBusy(true);
  $("processing-status").textContent = "Loading compression engine...";
  const removeMetadata = $("remove-metadata").checked;
  try {
    const result = await work({ action: "compress", bytes: sourceBytes, preset: document.querySelector('input[name="preset"]:checked').value, removeMetadata });
    const bytes = new Uint8Array(result.bytes);
    outputDocument = await openDocument(bytes);
    outputBytes = bytes;
    outputUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    $("output-tab").disabled = false;
    $("output-size").textContent = formatSize(bytes.length);
    const saving = (1 - bytes.length / sourceBytes.length) * 100;
    $("size-bar").style.width = `${Math.min(100, bytes.length / sourceBytes.length * 100)}%`;
    $("saving").classList.toggle("larger", saving < 0);
    $("saving").textContent = result.keptOriginal ? "Already efficient. Original kept; no size reduction." : saving > 0 ? `${saving.toFixed(1)}% smaller / ${formatSize(sourceBytes.length - bytes.length)} saved${removeMetadata ? " / metadata removed" : ""}` : `Metadata removed / ${saving < 0 ? `${formatSize(bytes.length - sourceBytes.length)} larger` : "same file size"}`;
    $("download").querySelector("span").textContent = result.keptOriginal ? "Download original" : "Download PDF";
    selectVersion("output");
  } catch (error) {
    message(error.message, true);
  } finally { setBusy(false); }
}

$("choose").addEventListener("click", () => $("file-input").click());
$("replace").addEventListener("click", () => $("file-input").click());
$("file-input").addEventListener("change", (event) => loadFile(event.target.files[0]));
$("optimise").addEventListener("click", optimise);
$("cancel").addEventListener("click", () => stopWorker("Optimisation cancelled. Your original PDF is unchanged."));
$("settings").addEventListener("change", (event) => { if (event.target.id !== "export-name") clearOutput(); });
$("original-tab").addEventListener("click", () => selectVersion("original"));
$("output-tab").addEventListener("click", () => selectVersion("output"));
$("previous").addEventListener("click", () => { page--; renderPreview(); });
$("next").addEventListener("click", () => { page++; renderPreview(); });
$("download").addEventListener("click", () => {
  if (!outputUrl || busy) return;
  const link = document.createElement("a");
  link.href = outputUrl;
  const name = $("export-name").value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/\.pdf$/i, "");
  link.download = `${name || "document-optimised"}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
});
for (const eventName of ["dragenter", "dragover"]) {
  document.addEventListener(eventName, (event) => { event.preventDefault(); if (!busy) $("upload").classList.add("dragging"); });
}
document.addEventListener("dragleave", (event) => { if (!event.relatedTarget) $("upload").classList.remove("dragging"); });
document.addEventListener("drop", (event) => {
  event.preventDefault();
  $("upload").classList.remove("dragging");
  if (busy) return;
  if (event.dataTransfer.files.length !== 1) { message("Choose one PDF at a time.", true); return; }
  loadFile(event.dataTransfer.files[0]);
});
let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderPreview, 150); });
window.addEventListener("pagehide", () => { stopWorker(); if (outputUrl) URL.revokeObjectURL(outputUrl); });
window.addEventListener("DOMContentLoaded", () => window.lucide?.createIcons());
if (document.readyState !== "loading") window.lucide?.createIcons();
